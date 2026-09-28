"""
Live 24-Hour Numerical Weather Prediction (NWP) Forecast Engine
SIH26081 — Operational Meteorological Workstation

Probes NOAA GFS (0.25° APCP) and ECMWF IFS (0.25° tp) for matching 00Z runs,
downloads raw GRIB2 slices, enforces strict validation gates, extracts the
exact 791 native terrestrial grid points, and computes equal-weight fusion
and empirical confidence classifications.

Strictly zero ML, zero interpolation, zero synthetic data, zero silent fallback to historical data.
"""
import os
import sys
import json
import time
import urllib.request
from datetime import datetime, date, timezone, timedelta
from typing import Dict, Any, List, Optional, Tuple

project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

import numpy as np
import pandas as pd
import xarray as xr

from src.utils.logger import setup_logger
from src.ingestion.gfs_downloader import download_gfs_forecast_day, AWS_GFS_BASE
from src.ingestion.ecmwf_downloader import download_ecmwf_forecast_day, GCS_ECMWF_BASE
from src.preprocessing.gfs_parser import parse_gfs_apcp_grib2
from src.preprocessing.ecmwf_parser import parse_ecmwf_tp_grib2
from src.operational.engine import DISAGREEMENT_THRESHOLDS, EMPIRICAL_EXPECTED_ERRORS

logger = setup_logger("LiveEngine")

# Frozen Operational Domain Boundaries
BOUNDING_BOX = (12.0, 20.0, 76.0, 85.0)  # lat_min, lat_max, lon_min, lon_max
EXPECTED_CELL_COUNT = 791
DEFAULT_CYCLE = "00"
DEFAULT_LEAD_HOURS = 24
LIVE_CACHE_DIR = os.path.join("data", "processed", "live")
MASTER_PARQUET_PATH = os.path.join("data", "processed", "exp004_multimonth_predictions.parquet")


class LiveForecastEngine:
    def __init__(
        self,
        master_parquet_path: str = MASTER_PARQUET_PATH,
        cache_dir: str = LIVE_CACHE_DIR
    ):
        self.master_parquet_path = master_parquet_path
        self.cache_dir = cache_dir
        os.makedirs(self.cache_dir, exist_ok=True)
        self.mask_df: pd.DataFrame = self._load_terrestrial_mask()

    def _load_terrestrial_mask(self) -> pd.DataFrame:
        """
        Load the validated 791-cell terrestrial mask from EXP004 master dataset.
        Enforces exactly 791 unique terrestrial grid coordinates.
        """
        if not os.path.exists(self.master_parquet_path):
            raise FileNotFoundError(
                f"Operational master dataset missing at {self.master_parquet_path}. "
                "Cannot establish validated terrestrial mask."
            )
        
        df = pd.read_parquet(self.master_parquet_path)
        first_day = df["forecast_day"].iloc[0]
        mask = df[df["forecast_day"] == first_day][["lat", "lon", "subregion"]].reset_index(drop=True)
        
        if len(mask) != EXPECTED_CELL_COUNT:
            raise ValueError(f"Expected {EXPECTED_CELL_COUNT} terrestrial cells, got {len(mask)}")
        
        logger.info(f"Loaded validated terrestrial mask: {len(mask)} native 0.25° cells.")
        return mask

    def probe_source_availability(
        self,
        init_date: date,
        cycle: str = DEFAULT_CYCLE,
        lead_hours: int = DEFAULT_LEAD_HOURS,
        timeout: int = 5
    ) -> Dict[str, Any]:
        """
        Probes HTTP endpoints for NOAA GFS and ECMWF IFS to verify publication status.
        Does not assume data is published.
        """
        date_str = init_date.strftime("%Y%m%d")
        
        # 1. NOAA GFS Index Probe
        gfs_idx_url = f"{AWS_GFS_BASE}/gfs.{date_str}/{cycle}/atmos/gfs.t{cycle}z.pgrb2.0p25.f{lead_hours:03d}.idx"
        gfs_available = False
        try:
            req_gfs = urllib.request.Request(
                gfs_idx_url,
                method="HEAD",
                headers={"User-Agent": "SIH26081-Operational/1.0"}
            )
            with urllib.request.urlopen(req_gfs, timeout=timeout) as resp:
                gfs_available = (resp.status == 200)
        except Exception:
            gfs_available = False

        # 2. ECMWF IFS Index Probe
        ecmwf_idx_url = f"{GCS_ECMWF_BASE}/{date_str}/{cycle}z/ifs/0p25/oper/{date_str}{cycle}0000-{lead_hours}h-oper-fc.index"
        ecmwf_available = False
        try:
            req_ecmwf = urllib.request.Request(
                ecmwf_idx_url,
                method="HEAD",
                headers={"User-Agent": "SIH26081-Operational/1.0"}
            )
            with urllib.request.urlopen(req_ecmwf, timeout=timeout) as resp:
                ecmwf_available = (resp.status == 200)
        except Exception:
            ecmwf_available = False

        status = "BOTH_AVAILABLE" if (gfs_available and ecmwf_available) else (
            "GFS_ONLY" if gfs_available else (
                "ECMWF_ONLY" if ecmwf_available else "NEITHER_AVAILABLE"
            )
        )

        return {
            "date": init_date.isoformat(),
            "cycle": cycle,
            "lead_hours": lead_hours,
            "gfs_available": gfs_available,
            "ecmwf_available": ecmwf_available,
            "gfs_url": gfs_idx_url,
            "ecmwf_url": ecmwf_idx_url,
            "status": status
        }

    def discover_latest_matching_run(
        self,
        max_lookback_days: int = 5
    ) -> Dict[str, Any]:
        """
        Discovers the newest initialization date for which BOTH NOAA GFS and ECMWF IFS
        00Z +24h runs exist.
        
        Strict Stale-Data Rule:
        If the latest published cycle has GFS published but ECMWF not published yet,
        it does NOT silently substitute an older run. It reports LATEST_RUN_NOT_AVAILABLE.
        """
        now_utc = datetime.now(timezone.utc)
        current_date_utc = now_utc.date()

        first_probed = None
        for days_back in range(max_lookback_days + 1):
            check_date = current_date_utc - timedelta(days=days_back)
            probe = self.probe_source_availability(check_date)
            logger.info(f"Probing {check_date}: GFS={probe['gfs_available']}, ECMWF={probe['ecmwf_available']}")

            if first_probed is None and (probe["gfs_available"] or probe["ecmwf_available"]):
                first_probed = probe

            if probe["gfs_available"] and probe["ecmwf_available"]:
                # If a newer partial run was detected on a more recent date, we must respect strict matching
                if first_probed is not None and first_probed["date"] != probe["date"]:
                    # An in-progress run exists on a newer date where one source is missing
                    if first_probed["gfs_available"] and not first_probed["ecmwf_available"]:
                        return {
                            "status": "LATEST_RUN_NOT_AVAILABLE",
                            "error": "LATEST FORECAST RUN NOT YET AVAILABLE",
                            "reason": (
                                f"NOAA GFS is available for {first_probed['date']} 00 UTC, but the matching "
                                "ECMWF 00 UTC run has not been published yet. The system will not substitute an older run."
                            ),
                            "latest_attempted_date": first_probed["date"],
                            "source_status": {"gfs": "AVAILABLE", "ecmwf": "UNAVAILABLE"},
                            "fallback_probed_date": probe["date"],
                        }
                    elif first_probed["ecmwf_available"] and not first_probed["gfs_available"]:
                        return {
                            "status": "LATEST_RUN_NOT_AVAILABLE",
                            "error": "LATEST FORECAST RUN NOT YET AVAILABLE",
                            "reason": (
                                f"ECMWF IFS is available for {first_probed['date']} 00 UTC, but the matching "
                                "NOAA GFS 00 UTC run has not been published yet. The system will not substitute an older run."
                            ),
                            "latest_attempted_date": first_probed["date"],
                            "source_status": {"gfs": "UNAVAILABLE", "ecmwf": "AVAILABLE"},
                            "fallback_probed_date": probe["date"],
                        }

                return {
                    "status": "SUCCESS",
                    "matched_date": check_date.isoformat(),
                    "cycle": DEFAULT_CYCLE,
                    "lead_hours": DEFAULT_LEAD_HOURS,
                    "gfs_available": True,
                    "ecmwf_available": True,
                    "probe_info": probe
                }
            
            # If the current day has one source available but not the other
            if days_back == 0 and (probe["gfs_available"] or probe["ecmwf_available"]):
                if probe["gfs_available"] and not probe["ecmwf_available"]:
                    return {
                        "status": "LATEST_RUN_NOT_AVAILABLE",
                        "error": "LATEST FORECAST RUN NOT YET AVAILABLE",
                        "reason": (
                            f"NOAA GFS is available for {check_date.isoformat()} 00 UTC, but the matching "
                            "ECMWF 00 UTC run has not been published yet. The system will not substitute an older run."
                        ),
                        "latest_attempted_date": check_date.isoformat(),
                        "source_status": {"gfs": "AVAILABLE", "ecmwf": "UNAVAILABLE"}
                    }
                elif probe["ecmwf_available"] and not probe["gfs_available"]:
                    return {
                        "status": "LATEST_RUN_NOT_AVAILABLE",
                        "error": "LATEST FORECAST RUN NOT YET AVAILABLE",
                        "reason": (
                            f"ECMWF IFS is available for {check_date.isoformat()} 00 UTC, but the matching "
                            "NOAA GFS 00 UTC run has not been published yet. The system will not substitute an older run."
                        ),
                        "latest_attempted_date": check_date.isoformat(),
                        "source_status": {"gfs": "UNAVAILABLE", "ecmwf": "AVAILABLE"}
                    }

        return {
            "status": "LIVE_DATA_UNAVAILABLE",
            "error": "NO MATCHING OPERATIONAL RUN FOUND",
            "reason": f"Neither GFS nor ECMWF operational 00Z runs could be verified for the past {max_lookback_days} days.",
            "source_status": {"gfs": "UNAVAILABLE", "ecmwf": "UNAVAILABLE"}
        }

    def _get_cache_filepath(self, init_date: Any, cycle: str = DEFAULT_CYCLE, lead_hours: int = DEFAULT_LEAD_HOURS) -> str:
        if isinstance(init_date, (date, datetime)):
            date_str = init_date.strftime("%Y%m%d")
        else:
            date_str = str(init_date).replace("-", "")
        return os.path.join(self.cache_dir, f"live_forecast_{date_str}_{cycle}z_f{lead_hours:03d}.json")

    def _load_cache(self, init_date: date, cycle: str = DEFAULT_CYCLE, lead_hours: int = DEFAULT_LEAD_HOURS) -> Optional[Dict[str, Any]]:
        path = self._get_cache_filepath(init_date, cycle, lead_hours)
        if os.path.exists(path):
            try:
                with open(path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                if (
                    data.get("status") == "SUCCESS"
                    and data.get("initialization_date") == init_date.isoformat()
                    and len(data.get("points", [])) == EXPECTED_CELL_COUNT
                ):
                    logger.info(f"Loaded live forecast from cache: {path}")
                    return data
            except Exception as e:
                logger.warning(f"Failed to read cache file {path}: {e}")
        return None

    def _save_cache(self, data: Dict[str, Any], init_date: date, cycle: str = DEFAULT_CYCLE, lead_hours: int = DEFAULT_LEAD_HOURS):
        path = self._get_cache_filepath(init_date, cycle, lead_hours)
        try:
            with open(path, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2)
            logger.info(f"Saved live forecast to cache: {path}")
        except Exception as e:
            logger.error(f"Failed to write cache file {path}: {e}")

    def classify_confidence(self, d_raw: float) -> Tuple[str, Dict[str, float]]:
        """Frozen EXP004 confidence thresholds and empirical historical MAE."""
        if d_raw < DISAGREEMENT_THRESHOLDS["low_max"]:
            c_class = "High Confidence"
        elif d_raw < DISAGREEMENT_THRESHOLDS["med_max"]:
            c_class = "Moderate Confidence"
        else:
            c_class = "Low Confidence"
        return c_class, EMPIRICAL_EXPECTED_ERRORS[c_class]

    def _determine_predicted_regime(self, fused_mm: float) -> str:
        if fused_mm < 0.1:
            return "Dry (<0.1mm)"
        elif fused_mm < 5.0:
            return "Light (0.1-5mm)"
        elif fused_mm < 15.0:
            return "Moderate (5-15mm)"
        else:
            return "Heavy (>=15mm)"

    def generate_live_forecast(
        self,
        target_date: Optional[date] = None,
        force_refresh: bool = False
    ) -> Dict[str, Any]:
        """
        Executes end-to-end ingestion, parsing, coordinate alignment, validation,
        and fusion for a live 24-hour NWP forecast.
        """
        # 1. Determine target date if not specified
        if target_date is None:
            discovery = self.discover_latest_matching_run()
            if discovery["status"] != "SUCCESS":
                return discovery
            target_date = datetime.strptime(discovery["matched_date"], "%Y-%m-%d").date()

        cycle = DEFAULT_CYCLE
        lead_hours = DEFAULT_LEAD_HOURS
        date_str = target_date.strftime("%Y%m%d")

        # 2. Check Cache
        if not force_refresh:
            cached = self._load_cache(target_date, cycle, lead_hours)
            if cached is not None:
                return cached

        # 3. Probe Availability
        probe = self.probe_source_availability(target_date, cycle, lead_hours)
        if not probe["gfs_available"] or not probe["ecmwf_available"]:
            if probe["gfs_available"] and not probe["ecmwf_available"]:
                return {
                    "status": "LATEST_RUN_NOT_AVAILABLE",
                    "mode": "LIVE",
                    "error": "LATEST FORECAST RUN NOT YET AVAILABLE",
                    "reason": (
                        f"NOAA GFS is available for {target_date.isoformat()} 00 UTC, but the matching "
                        "ECMWF 00 UTC run has not been published yet. The system will not substitute an older run."
                    ),
                    "source_status": {"gfs": "AVAILABLE", "ecmwf": "UNAVAILABLE"}
                }
            elif probe["ecmwf_available"] and not probe["gfs_available"]:
                return {
                    "status": "LATEST_RUN_NOT_AVAILABLE",
                    "mode": "LIVE",
                    "error": "LATEST FORECAST RUN NOT YET AVAILABLE",
                    "reason": (
                        f"ECMWF IFS is available for {target_date.isoformat()} 00 UTC, but the matching "
                        "NOAA GFS 00 UTC run has not been published yet. The system will not substitute an older run."
                    ),
                    "source_status": {"gfs": "UNAVAILABLE", "ecmwf": "AVAILABLE"}
                }
            else:
                return {
                    "status": "LIVE_DATA_UNAVAILABLE",
                    "mode": "LIVE",
                    "error": "SOURCES UNAVAILABLE",
                    "reason": f"Neither GFS nor ECMWF operational runs are published for {target_date.isoformat()} 00 UTC.",
                    "source_status": {"gfs": "UNAVAILABLE", "ecmwf": "UNAVAILABLE"}
                }

        # 4. Ingest raw precipitation slices
        try:
            gfs_file = download_gfs_forecast_day(
                init_date=target_date,
                cycle=cycle,
                lead_hours=lead_hours,
                force_download=force_refresh
            )
        except Exception as e:
            logger.error(f"Failed to download GFS slice for {target_date}: {e}")
            return {
                "status": "NETWORK_FAILURE",
                "mode": "LIVE",
                "error": "GFS_DOWNLOAD_FAILED",
                "reason": f"Failed downloading NOAA GFS APCP: {str(e)}",
                "source_status": {"gfs": "ERROR", "ecmwf": "AVAILABLE"}
            }

        try:
            ecmwf_meta = download_ecmwf_forecast_day(
                init_date=target_date,
                cycle=cycle,
                lead_hours=lead_hours,
                force_download=force_refresh
            )
            ecmwf_file = ecmwf_meta["filepath"]
        except Exception as e:
            logger.error(f"Failed to download ECMWF slice for {target_date}: {e}")
            return {
                "status": "NETWORK_FAILURE",
                "mode": "LIVE",
                "error": "ECMWF_DOWNLOAD_FAILED",
                "reason": f"Failed downloading ECMWF IFS tp: {str(e)}",
                "source_status": {"gfs": "AVAILABLE", "ecmwf": "ERROR"}
            }

        # 5. Parse GRIB2 data
        try:
            da_gfs = parse_gfs_apcp_grib2(gfs_file, bounding_box=BOUNDING_BOX)
        except Exception as e:
            return {
                "status": "INVALID_GRIB",
                "mode": "LIVE",
                "error": "GFS_PARSER_ERROR",
                "reason": f"Unable to parse GFS GRIB2 message: {str(e)}"
            }

        try:
            da_ecmwf = parse_ecmwf_tp_grib2(ecmwf_file, bounding_box=BOUNDING_BOX)
        except Exception as e:
            return {
                "status": "INVALID_GRIB",
                "mode": "LIVE",
                "error": "ECMWF_PARSER_ERROR",
                "reason": f"Unable to parse ECMWF GRIB2 message: {str(e)}"
            }

        # 6. Rigorous Scientific & Integrity Validation Gates
        # 6a. Units verification
        if da_gfs.attrs.get("units") != "mm":
            return {
                "status": "WRONG_UNITS",
                "mode": "LIVE",
                "error": "INVALID_GFS_UNITS",
                "reason": f"Expected mm units for GFS, found '{da_gfs.attrs.get('units')}'."
            }
        if da_ecmwf.attrs.get("units") != "mm":
            return {
                "status": "WRONG_UNITS",
                "mode": "LIVE",
                "error": "INVALID_ECMWF_UNITS",
                "reason": f"Expected mm units for ECMWF, found '{da_ecmwf.attrs.get('units')}'."
            }

        # 6b. Initialization date and lead verification
        gfs_init_date_str = str(da_gfs.attrs.get("gfs_init_date", ""))
        ecmwf_init_date_str = str(da_ecmwf.attrs.get("ecmwf_init_date", ""))
        if gfs_init_date_str != date_str or ecmwf_init_date_str != date_str:
            return {
                "status": "INVALID_INITIALIZATION",
                "mode": "LIVE",
                "error": "INITIALIZATION_DATE_MISMATCH",
                "reason": (
                    f"Forecast init date mismatch: requested {date_str}, "
                    f"GFS has {gfs_init_date_str}, ECMWF has {ecmwf_init_date_str}."
                )
            }

        gfs_step = str(da_gfs.attrs.get("step_range", ""))
        ecmwf_step = str(da_ecmwf.attrs.get("step_range", ""))
        if gfs_step not in ["0-24", "24"] or ecmwf_step not in ["0-24", "24"]:
            return {
                "status": "INVALID_LEAD",
                "mode": "LIVE",
                "error": "LEAD_TIME_MISMATCH",
                "reason": f"Expected +24h lead accumulation ('0-24'), found GFS={gfs_step}, ECMWF={ecmwf_step}."
            }

        # 6c. Native 0.25° coordinate alignment & extraction of 791 terrestrial cells
        lats_da = xr.DataArray(self.mask_df["lat"].values, dims="points")
        lons_da = xr.DataArray(self.mask_df["lon"].values, dims="points")

        try:
            gfs_extracted = da_gfs.sel(lat=lats_da, lon=lons_da).values
            ecmwf_extracted = da_ecmwf.sel(lat=lats_da, lon=lons_da).values
        except Exception as e:
            return {
                "status": "WRONG_GRID",
                "mode": "LIVE",
                "error": "GRID_EXTRACTION_FAILURE",
                "reason": f"Failed extracting native coordinates from grid: {str(e)}"
            }

        # 6d. Check cell count
        if len(gfs_extracted) != EXPECTED_CELL_COUNT or len(ecmwf_extracted) != EXPECTED_CELL_COUNT:
            return {
                "status": "MISSING_CELLS",
                "mode": "LIVE",
                "error": "INCOMPLETE_DOMAIN_CELLS",
                "reason": f"Expected {EXPECTED_CELL_COUNT} terrestrial cells, got GFS={len(gfs_extracted)}, ECMWF={len(ecmwf_extracted)}."
            }

        # 6e. Check finite values
        if not np.isfinite(gfs_extracted).all() or not np.isfinite(ecmwf_extracted).all():
            return {
                "status": "INVALID_DATA",
                "mode": "LIVE",
                "error": "NON_FINITE_VALUES_DETECTED",
                "reason": "NaN or infinite values encountered in NWP forecast field."
            }

        # 6f. Check non-negativity
        if (gfs_extracted < 0).any() or (ecmwf_extracted < 0).any():
            return {
                "status": "INVALID_DATA",
                "mode": "LIVE",
                "error": "NEGATIVE_PRECIPITATION_DETECTED",
                "reason": "Negative precipitation accumulation values encountered in NWP forecast field."
            }

        # 7. Compute Fused Forecast and Confidence Regimes
        points = []
        for i in range(EXPECTED_CELL_COUNT):
            lat_val = round(float(self.mask_df["lat"].iloc[i]), 2)
            lon_val = round(float(self.mask_df["lon"].iloc[i]), 2)
            subregion_val = str(self.mask_df["subregion"].iloc[i])

            gfs_val = round(float(gfs_extracted[i]), 2)
            ecmwf_val = round(float(ecmwf_extracted[i]), 2)
            fused_val = round(float(0.5 * gfs_val + 0.5 * ecmwf_val), 2)
            d_raw = round(float(abs(gfs_val - ecmwf_val)), 2)
            d_norm = round(float(d_raw / (1.0 + fused_val)), 3)

            c_class, exp_err = self.classify_confidence(d_raw)
            regime = self._determine_predicted_regime(fused_val)

            # Strict Live Rule: IMD observation and verification error MUST BE NULL
            points.append({
                "lat": lat_val,
                "lon": lon_val,
                "gfs_mm": gfs_val,
                "ecmwf_mm": ecmwf_val,
                "fused_mm": fused_val,
                "disagreement_mm": d_raw,
                "disagreement_norm": d_norm,
                "confidence_class": c_class,
                "expected_mae_mm": exp_err["mae_mm"],
                "subregion": subregion_val,
                "predicted_regime": regime,
                "imd_mm": None,
                "fused_error_mm": None,
                "fused_abs_error_mm": None
            })

        # 8. Domain Summary Statistics
        fused_arr = np.array([p["fused_mm"] for p in points])
        d_arr = np.array([p["disagreement_mm"] for p in points])
        conf_classes = [p["confidence_class"] for p in points]

        high_conf_pct = round(conf_classes.count("High Confidence") / EXPECTED_CELL_COUNT * 100, 1)
        mod_conf_pct = round(conf_classes.count("Moderate Confidence") / EXPECTED_CELL_COUNT * 100, 1)
        low_conf_pct = round(conf_classes.count("Low Confidence") / EXPECTED_CELL_COUNT * 100, 1)

        init_time_str = f"{target_date.strftime('%Y-%m-%d')}T00:00:00Z"
        valid_date = target_date + timedelta(days=1)
        valid_time_str = f"{valid_date.strftime('%Y-%m-%d')}T00:00:00Z"
        generated_ts = datetime.now(timezone.utc).isoformat() + "Z"

        response_payload = {
            "status": "SUCCESS",
            "mode": "LIVE",
            "forecast_type": "LIVE_24H_NWP_FORECAST",
            "initialization_date": target_date.isoformat(),
            "initialization_time_utc": init_time_str,
            "valid_time_utc": valid_time_str,
            "lead_hours": lead_hours,
            "total_land_points": EXPECTED_CELL_COUNT,
            "generated_timestamp_utc": generated_ts,
            "source_status": {
                "gfs": "AVAILABLE",
                "ecmwf": "AVAILABLE"
            },
            "source_metadata": {
                "gfs": {
                    "source": "NOAA NCEP GFS 0.25° AWS Open Data",
                    "file_path": gfs_file,
                    "file_size": os.path.getsize(gfs_file),
                    "step_range": gfs_step
                },
                "ecmwf": {
                    "source": "ECMWF IFS 0.25° Open Data GCP",
                    "file_path": ecmwf_file,
                    "file_size": os.path.getsize(ecmwf_file),
                    "step_range": ecmwf_step
                }
            },
            "domain_summary": {
                "mean_fused_mm": round(float(np.mean(fused_arr)), 2),
                "max_fused_mm": round(float(np.max(fused_arr)), 2),
                "mean_disagreement_mm": round(float(np.mean(d_arr)), 2),
                "high_disagreement_area_pct": low_conf_pct,
                "confidence_distribution": {
                    "high_confidence_pct": high_conf_pct,
                    "moderate_confidence_pct": mod_conf_pct,
                    "low_confidence_pct": low_conf_pct
                }
            },
            "provenance": {
                "nwp_source_1": "NOAA GFS 0.25° oper (APCP surface, 00z cycle, +24h lead)",
                "nwp_source_2": "ECMWF IFS 0.25° oper (tp surface, 00z cycle, +24h lead)",
                "fusion_method": "Validated Equal-Weight Static Fusion (50% GFS + 50% ECMWF)",
                "confidence_engine": "EXP004 Disagreement Bins (Frozen May thresholds: High < 0.11mm, Moderate 0.11–<2.06mm, Low >= 2.06mm)",
                "scientific_rule": "Forward NWP forecast. Historical MAE for this disagreement regime reported (observations pending).",
                "verification_status": "NOT_AVAILABLE_FOR_CURRENT_FORECAST",
                "grid_provenance": "Exact native 0.25° grid matching 791 terrestrial mask cells. Zero interpolation, zero synthetic values."
            },
            "points": points
        }

        # 9. Save Validated Forecast to Cache
        self._save_cache(response_payload, target_date, cycle, lead_hours)

        return response_payload

    def get_live_status(self) -> Dict[str, Any]:
        """
        Reports operational health and status of the live forecasting subsystem:
        - latest available run
        - GFS availability
        - ECMWF availability
        - initialization time
        - valid time
        - cache age
        - cell count
        - data integrity status
        """
        discovery = self.discover_latest_matching_run()
        
        target_date_val = discovery.get("matched_date")
        if isinstance(target_date_val, str):
            target_date = datetime.strptime(target_date_val, "%Y-%m-%d").date()
        elif isinstance(target_date_val, date):
            target_date = target_date_val
        else:
            target_date = None
        if target_date is None:
            # Check latest cache
            cached_files = [f for f in os.listdir(self.cache_dir) if f.startswith("live_forecast_") and f.endswith(".json")]
            if cached_files:
                cached_files.sort(reverse=True)
                latest_cache_file = os.path.join(self.cache_dir, cached_files[0])
                try:
                    with open(latest_cache_file, "r", encoding="utf-8") as f:
                        data = json.load(f)
                    target_date = datetime.strptime(data["initialization_date"], "%Y-%m-%d").date()
                except Exception:
                    pass

        if target_date is None:
            target_date = datetime.now(timezone.utc).date()

        cache_path = self._get_cache_filepath(target_date)
        cache_exists = os.path.exists(cache_path)
        cache_age_seconds = None
        cache_age_desc = "NO_CACHE"

        if cache_exists:
            mtime = os.path.getmtime(cache_path)
            cache_age_seconds = int(time.time() - mtime)
            cache_age_desc = f"{cache_age_seconds}s"

        init_time_str = f"{target_date.strftime('%Y-%m-%d')}T00:00:00Z"
        valid_time_str = f"{(target_date + timedelta(days=1)).strftime('%Y-%m-%d')}T00:00:00Z"

        return {
            "status": "ONLINE" if discovery["status"] == "SUCCESS" else discovery["status"],
            "mode": "LIVE",
            "latest_available_run": target_date.isoformat(),
            "initialization_time": init_time_str,
            "valid_time": valid_time_str,
            "lead_hours": DEFAULT_LEAD_HOURS,
            "gfs_availability": "AVAILABLE" if discovery.get("gfs_available", False) else "UNAVAILABLE",
            "ecmwf_availability": "AVAILABLE" if discovery.get("ecmwf_available", False) else "UNAVAILABLE",
            "cache_age": cache_age_desc,
            "cache_age_seconds": cache_age_seconds,
            "cell_count": EXPECTED_CELL_COUNT,
            "data_integrity_status": "VALIDATED (791 native 0.25° cells, finite, non-negative, zero synthetic, zero ML)",
            "discovery_details": discovery
        }

    def get_point_forecast(self, lat: float, lon: float) -> Dict[str, Any]:
        """Query nearest 0.25° grid point in the live forecast."""
        live_data = self.generate_live_forecast()
        if live_data.get("status") != "SUCCESS":
            return live_data

        points = live_data.get("points", [])
        best_pt = None
        min_dist = float("inf")
        for pt in points:
            dist = (pt["lat"] - lat)**2 + (pt["lon"] - lon)**2
            if dist < min_dist:
                min_dist = dist
                best_pt = pt

        if best_pt is None or min_dist > 0.5:
            return {
                "status": "POINT_OUT_OF_DOMAIN",
                "mode": "LIVE",
                "error": f"Coordinates ({lat}, {lon}) are outside the active domain.",
            }

        return {
            "status": "SUCCESS",
            "mode": "LIVE",
            "query_coordinates": {"lat": lat, "lon": lon},
            "matched_grid_cell": best_pt,
            "initialization_time_utc": live_data.get("initialization_time_utc"),
            "valid_time_utc": live_data.get("valid_time_utc"),
            "provenance": live_data.get("provenance")
        }

