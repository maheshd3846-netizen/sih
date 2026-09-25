"""
EXP004 Multi-Period Robustness & Model-Disagreement Analysis Pipeline
Implements:
1. Expanding-origin causal temporal evaluation across June, July, and August 2024.
2. Disagreement analysis: raw (D = |GFS - ECMWF|) and normalized (D_norm).
3. Frozen calibration: Bins, regime rules, and fixed weights learned from prior data only.
4. Day-level paired bootstrap preserving spatial autocorrelation.
5. All required metric exports and publication-grade visualizations.
"""
import os
import sys

project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

import json
import yaml
from datetime import datetime, date, timedelta
from typing import Dict, Any, List, Tuple
import numpy as np
import pandas as pd
from scipy import stats
import matplotlib.pyplot as plt

from src.utils.logger import setup_logger
from src.preprocessing.gfs_parser import parse_gfs_apcp_grib2
from src.preprocessing.ecmwf_parser import parse_ecmwf_tp_grib2
from src.preprocessing.imd_parser import parse_imd_date
from src.verification.alignment import derive_valid_time, map_forecast_to_imd_observation_date

logger = setup_logger("EXP004_Pipeline")

def load_canonical_month(start_date: date, end_date: date, bbox: Tuple[float, float, float, float], imd_file: str) -> pd.DataFrame:
    """Load and spatially align GFS, ECMWF, and IMD records for a given date range."""
    records = []
    curr = start_date
    while curr <= end_date:
        dstr = curr.strftime("%Y%m%d")
        init_dt = datetime(curr.year, curr.month, curr.day, 0, 0, 0)
        valid_dt = derive_valid_time(init_dt, 24)
        obs_date = map_forecast_to_imd_observation_date(init_dt, 24)

        gfs_path = f"data/raw/gfs/gfs_{dstr}_00z_apcp_f024.grib2"
        ecmwf_path = f"data/raw/ecmwf/ecmwf_{dstr}_00z_tp_f024.grib2"

        gfs_da = parse_gfs_apcp_grib2(gfs_path, bounding_box=bbox)
        ecmwf_da = parse_ecmwf_tp_grib2(ecmwf_path, bounding_box=bbox)
        imd_da = parse_imd_date(imd_file, target_date=obs_date, bounding_box=bbox)

        gfs_vals = gfs_da.values
        ecmwf_vals = ecmwf_da.values
        imd_vals = imd_da.values
        lats = imd_da.lat.values
        lons = imd_da.lon.values

        for i, lat in enumerate(lats):
            for j, lon in enumerate(lons):
                records.append({
                    "forecast_day": curr,
                    "init_time": init_dt.isoformat(),
                    "valid_time": valid_dt.isoformat(),
                    "lead_hours": 24,
                    "obs_date": obs_date,
                    "lat": float(lat),
                    "lon": float(lon),
                    "gfs": float(gfs_vals[i, j]),
                    "ecmwf": float(ecmwf_vals[i, j]),
                    "imd": float(imd_vals[i, j]),
                })
        curr += timedelta(days=1)

    df = pd.DataFrame(records)
    valid_mask = (
        (~np.isnan(df["imd"])) & (~np.isnan(df["gfs"])) & (~np.isnan(df["ecmwf"])) &
        (df["imd"] >= 0.0) & (df["gfs"] >= 0.0) & (df["ecmwf"] >= 0.0)
    )
    df_clean = df[valid_mask].copy()
    return df_clean

def assign_metadata(df: pd.DataFrame) -> pd.DataFrame:
    """Assign subregions, regimes, and disagreement metrics."""
    # Subregions
    df["subregion"] = "Other"
    df.loc[(df["lon"] >= 80.5) & (df["lat"] <= 19.0), "subregion"] = "Coastal Andhra Pradesh"
    df.loc[(df["lat"] < 15.5) & (df["lon"] < 80.0), "subregion"] = "Rayalaseema"
    df.loc[(df["lat"] >= 15.5) & (df["lon"] < 80.5), "subregion"] = "Telangana"

    # Consensus forecast
    df["consensus_pred"] = 0.5 * (df["gfs"] + df["ecmwf"])

    # Forecast-time regimes
    df["predicted_regime"] = "Moderate"
    df.loc[df["consensus_pred"] < 0.1, "predicted_regime"] = "Dry (<0.1mm)"
    df.loc[(df["consensus_pred"] >= 0.1) & (df["consensus_pred"] < 5.0), "predicted_regime"] = "Light (0.1-5mm)"
    df.loc[(df["consensus_pred"] >= 5.0) & (df["consensus_pred"] < 15.0), "predicted_regime"] = "Moderate (5-15mm)"
    df.loc[df["consensus_pred"] >= 15.0, "predicted_regime"] = "Heavy (>=15mm)"

    # Disagreement metrics
    df["disagreement_raw"] = np.abs(df["gfs"] - df["ecmwf"])
    df["disagreement_norm"] = df["disagreement_raw"] / (1.0 + df["consensus_pred"])
    return df

def run_exp004(config_path: str = "configs/experiment_004.yaml"):
    logger.info("Starting EXP004 — Multi-Period Robustness & Disagreement Pipeline")
    with open(config_path, "r") as f:
        cfg = yaml.safe_load(f)

    region = cfg["region"]
    bbox = (region["lat_min"], region["lat_max"], region["lon_min"], region["lon_max"])
    imd_file = "data/raw/imd/ind2024_rfp25.grd"

    # Step 1: Ingest Calibration Period (May 17-31, 2024)
    calib_start = datetime.strptime(cfg["periods"]["calibration"]["start"], "%Y-%m-%d").date()
    calib_end = datetime.strptime(cfg["periods"]["calibration"]["end"], "%Y-%m-%d").date()
    logger.info(f"Loading Calibration Window W0: {calib_start} to {calib_end}...")
    df_calib = load_canonical_month(calib_start, calib_end, bbox, imd_file)
    df_calib = assign_metadata(df_calib)
    logger.info(f"Calibration records loaded: {len(df_calib)} (Expected: 11,865)")
    assert len(df_calib) == 11865, f"Calibration count {len(df_calib)} != 11,865"

    # Freeze disagreement tertiles from May calibration period
    d_tertiles = np.percentile(df_calib["disagreement_raw"], [33.333, 66.667])
    t_low, t_high = float(d_tertiles[0]), float(d_tertiles[1])
    logger.info(f"Frozen Disagreement Thresholds from May Calibration: Low < {t_low:.2f} mm, Medium [{t_low:.2f}, {t_high:.2f}], High >= {t_high:.2f} mm")

    # Step 2: Load Evaluation Periods
    # Period 1: June 1-30, 2024
    p1_start = datetime.strptime(cfg["periods"]["period_1"]["start"], "%Y-%m-%d").date()
    p1_end = datetime.strptime(cfg["periods"]["period_1"]["end"], "%Y-%m-%d").date()
    logger.info(f"Loading Period 1 (June): {p1_start} to {p1_end}...")
    df_p1 = load_canonical_month(p1_start, p1_end, bbox, imd_file)
    df_p1 = assign_metadata(df_p1)
    assert len(df_p1) == 23730, f"June count {len(df_p1)} != 23,730"

    # Period 2: July 1-31, 2024
    p2_start = datetime.strptime(cfg["periods"]["period_2"]["start"], "%Y-%m-%d").date()
    p2_end = datetime.strptime(cfg["periods"]["period_2"]["end"], "%Y-%m-%d").date()
    logger.info(f"Loading Period 2 (July): {p2_start} to {p2_end}...")
    df_p2 = load_canonical_month(p2_start, p2_end, bbox, imd_file)
    df_p2 = assign_metadata(df_p2)
    assert len(df_p2) == 24521, f"July count {len(df_p2)} != 24,521"

    # Period 3: August 1-31, 2024
    p3_start = datetime.strptime(cfg["periods"]["period_3"]["start"], "%Y-%m-%d").date()
    p3_end = datetime.strptime(cfg["periods"]["period_3"]["end"], "%Y-%m-%d").date()
    logger.info(f"Loading Period 3 (August): {p3_start} to {p3_end}...")
    df_p3 = load_canonical_month(p3_start, p3_end, bbox, imd_file)
    df_p3 = assign_metadata(df_p3)
    assert len(df_p3) == 24521, f"August count {len(df_p3)} != 24,521"

    # Total Season
    df_eval_all = pd.concat([df_p1, df_p2, df_p3], ignore_index=True)
    logger.info(f"Total Season records loaded: {len(df_eval_all)} (Expected: 72,772)")
    assert len(df_eval_all) == 72772, f"Total count {len(df_eval_all)} != 72,772"

    # Combined master dataset for expanding-origin sequential simulation
    df_master = pd.concat([df_calib, df_eval_all], ignore_index=True)

    # Step 3: Expanding-Origin Sequential Causal Simulation
    logger.info("Executing expanding-origin causal simulation across June, July, and August...")
    W_roll = cfg["operational_constraints"].get("default_rolling_window_days", 5)

    all_eval_days = pd.date_range(p1_start, p3_end).date
    audit_history = []
    m6_preds = []
    m7_preds = []
    w6_gfs_list = []
    w6_ec_list = []
    w7_gfs_list = []
    w7_ec_list = []

    for d in all_eval_days:
        cutoff_date = d - timedelta(days=1)
        w_start = cutoff_date - timedelta(days=W_roll - 1)
        
        hist_window = df_master[(df_master["obs_date"] >= w_start) & (df_master["obs_date"] <= cutoff_date)]
        assert len(hist_window) == W_roll * 791, f"Incomplete rolling history for date {d}"

        gfs_mae_w = float(np.mean(np.abs(hist_window["gfs"] - hist_window["imd"])))
        ec_mae_w = float(np.mean(np.abs(hist_window["ecmwf"] - hist_window["imd"])))

        inv_gfs = 1.0 / max(gfs_mae_w, 1e-4)
        inv_ec = 1.0 / max(ec_mae_w, 1e-4)
        w6_gfs = inv_gfs / (inv_gfs + inv_ec)
        w6_ec = 1.0 - w6_gfs

        sub_day = df_eval_all[df_eval_all["forecast_day"] == d].copy()
        
        # Model 6
        p6 = w6_gfs * sub_day["gfs"].values + w6_ec * sub_day["ecmwf"].values
        m6_preds.extend(p6.tolist())
        w6_gfs_list.extend([w6_gfs] * len(sub_day))
        w6_ec_list.extend([w6_ec] * len(sub_day))

        # Model 7: Combined with regime shift
        reg_shift = np.where(sub_day["consensus_pred"] < 0.1, 0.15,
                    np.where(sub_day["consensus_pred"] < 5.0, 0.10, -0.15))
        w7_gfs = np.clip(w6_gfs + reg_shift, 0.10, 0.90)
        w7_ec = 1.0 - w7_gfs
        p7 = w7_gfs * sub_day["gfs"].values + w7_ec * sub_day["ecmwf"].values
        m7_preds.extend(p7.tolist())
        w7_gfs_list.extend(w7_gfs.tolist())
        w7_ec_list.extend(w7_ec.tolist())

        audit_history.append({
            "forecast_date": d.isoformat(),
            "forecast_init_utc": f"{d.isoformat()}T00:00:00",
            "verification_date": (d + timedelta(days=1)).isoformat(),
            "historical_cutoff_date": cutoff_date.isoformat(),
            "latest_imd_obs_used": cutoff_date.isoformat(),
            "lookback_window_days": W_roll,
            "window_gfs_mae": round(gfs_mae_w, 4),
            "window_ecmwf_mae": round(ec_mae_w, 4),
            "m6_w_gfs": round(float(w6_gfs), 4),
            "m6_w_ecmwf": round(float(w6_ec), 4),
            "m7_mean_w_gfs": round(float(np.mean(w7_gfs)), 4),
            "m7_mean_w_ecmwf": round(float(np.mean(w7_ec)), 4),
            "m7_min_w_gfs": round(float(np.min(w7_gfs)), 4),
            "m7_max_w_gfs": round(float(np.max(w7_gfs)), 4),
            "mean_fused_precipitation_mm": round(float(np.mean(p7)), 4),
        })

    # Save audit table
    df_audit = pd.DataFrame(audit_history)
    df_audit.to_csv("results/metrics/exp004_weight_history.csv", index=False)
    logger.info("Saved causal operational audit history to results/metrics/exp004_weight_history.csv")

    # Assign predictions to df_eval_all
    df_eval_all["model1_gfs"] = df_eval_all["gfs"]
    df_eval_all["model2_ecmwf"] = df_eval_all["ecmwf"]
    df_eval_all["model3_ensemble_50_50"] = 0.5 * df_eval_all["gfs"] + 0.5 * df_eval_all["ecmwf"]
    df_eval_all["model4_best_fixed"] = 0.5 * df_eval_all["gfs"] + 0.5 * df_eval_all["ecmwf"] # 0.5 verified optimal on May sweep
    
    # Model 5: Regime-Conditioned
    w5_gfs = np.where(df_eval_all["consensus_pred"] < 0.1, 0.80,
             np.where(df_eval_all["consensus_pred"] < 5.0, 0.70, 0.30))
    df_eval_all["model5_regime"] = w5_gfs * df_eval_all["gfs"] + (1.0 - w5_gfs) * df_eval_all["ecmwf"]

    # Model 6 & Model 7
    df_eval_all["model6_rolling_w5"] = m6_preds
    df_eval_all["w_gfs_m6"] = w6_gfs_list
    df_eval_all["w_ecmwf_m6"] = w6_ec_list

    df_eval_all["model7_combined"] = m7_preds
    df_eval_all["w_gfs_m7"] = w7_gfs_list
    df_eval_all["w_ecmwf_m7"] = w7_ec_list

    # Assign period tag
    df_eval_all["period"] = "Period 1 (June)"
    df_eval_all.loc[(df_eval_all["forecast_day"] >= p2_start) & (df_eval_all["forecast_day"] <= p2_end), "period"] = "Period 2 (July)"
    df_eval_all.loc[(df_eval_all["forecast_day"] >= p3_start) & (df_eval_all["forecast_day"] <= p3_end), "period"] = "Period 3 (August)"

    # Assign frozen disagreement bin
    df_eval_all["disagreement_bin"] = "Medium"
    df_eval_all.loc[df_eval_all["disagreement_raw"] < t_low, "disagreement_bin"] = "Low"
    df_eval_all.loc[df_eval_all["disagreement_raw"] >= t_high, "disagreement_bin"] = "High"

    # Save multi-month predictions parquet
    parquet_path = "data/processed/exp004_multimonth_predictions.parquet"
    df_eval_all.to_parquet(parquet_path, index=False)
    logger.info(f"Saved processed multi-month predictions to {parquet_path}")

    # Step 4: Model-Disagreement Correlation Analysis
    logger.info("Computing GFS-ECMWF disagreement vs forecast error relationships...")
    disagreement_records = []
    periods_to_eval = [
        ("June 2024", df_eval_all[df_eval_all["period"] == "Period 1 (June)"]),
        ("July 2024", df_eval_all[df_eval_all["period"] == "Period 2 (July)"]),
        ("August 2024", df_eval_all[df_eval_all["period"] == "Period 3 (August)"]),
        ("Full Season (Jun-Aug)", df_eval_all),
    ]

    for pname, psub in periods_to_eval:
        d_raw = psub["disagreement_raw"].values
        d_norm = psub["disagreement_norm"].values
        e_gfs = np.abs(psub["gfs"].values - psub["imd"].values)
        e_ec = np.abs(psub["ecmwf"].values - psub["imd"].values)
        e_ens = np.abs(psub["model3_ensemble_50_50"].values - psub["imd"].values)
        e_ens_sq = (psub["model3_ensemble_50_50"].values - psub["imd"].values)**2

        r_ens, _ = stats.pearsonr(d_raw, e_ens)
        rho_ens, _ = stats.spearmanr(d_raw, e_ens)
        r_sq, _ = stats.pearsonr(d_raw, e_ens_sq)
        r_norm, _ = stats.pearsonr(d_norm, e_ens)

        disagreement_records.append({
            "Period": pname,
            "N": len(psub),
            "Mean Disagreement (mm)": round(float(np.mean(d_raw)), 4),
            "Median Disagreement (mm)": round(float(np.median(d_raw)), 4),
            "Corr(D, |e_ens|)": round(float(r_ens), 4),
            "Spearman(D, |e_ens|)": round(float(rho_ens), 4),
            "Corr(D, e_ens^2)": round(float(r_sq), 4),
            "Corr(D_norm, |e_ens|)": round(float(r_norm), 4),
        })

    df_disagree_corr = pd.DataFrame(disagreement_records)
    df_disagree_corr.to_csv("results/metrics/exp004_disagreement_metrics.csv", index=False)
    logger.info("Saved disagreement correlation metrics to results/metrics/exp004_disagreement_metrics.csv")
    print("\n=== MODEL DISAGREEMENT VS ENSEMBLE ERROR CORRELATION ===")
    print(df_disagree_corr.to_string(index=False))

    # Binned Disagreement Analysis across test bins
    binned_records = []
    for pname, psub in periods_to_eval:
        for bname in ["Low", "Medium", "High"]:
            bsub = psub[psub["disagreement_bin"] == bname]
            obs = bsub["imd"].values
            abs_gfs = np.abs(bsub["gfs"].values - obs)
            abs_ec = np.abs(bsub["ecmwf"].values - obs)
            abs_ens = np.abs(bsub["model3_ensemble_50_50"].values - obs)
            abs_m7 = np.abs(bsub["model7_combined"].values - obs)

            binned_records.append({
                "Period": pname,
                "Disagreement Bin": bname,
                "N": len(bsub),
                "Mean D (mm)": round(float(np.mean(bsub["disagreement_raw"])), 4),
                "GFS MAE (mm)": round(float(np.mean(abs_gfs)), 4),
                "ECMWF MAE (mm)": round(float(np.mean(abs_ec)), 4),
                "50/50 MAE (mm)": round(float(np.mean(abs_ens)), 4),
                "Adaptive M7 MAE (mm)": round(float(np.mean(abs_m7)), 4),
                "50/50 RMSE (mm)": round(float(np.sqrt(np.mean((bsub["model3_ensemble_50_50"].values - obs)**2))), 4),
                "95th Pct Error (mm)": round(float(np.percentile(abs_ens, 95)), 4),
                "99th Pct Error (mm)": round(float(np.percentile(abs_ens, 99)), 4),
            })
    df_binned = pd.DataFrame(binned_records)
    df_binned.to_csv("results/metrics/exp004_disagreement_bins.csv", index=False)
    logger.info("Saved disagreement bin metrics to results/metrics/exp004_disagreement_bins.csv")

    # Step 5: Primary Metrics by Period and Model
    logger.info("Computing primary verification metrics across models and periods...")
    models = [
        ("Model 1 (NOAA GFS)", "model1_gfs"),
        ("Model 2 (ECMWF IFS)", "model2_ecmwf"),
        ("Model 3 (50/50 Ensemble)", "model3_ensemble_50_50"),
        ("Model 4 (Best Fixed Weight)", "model4_best_fixed"),
        ("Model 5 (Regime-Conditioned)", "model5_regime"),
        ("Model 6 (Rolling Skill W=5)", "model6_rolling_w5"),
        ("Model 7 (Combined Adaptive)", "model7_combined"),
    ]

    temporal_records = []
    for pname, psub in periods_to_eval:
        obs = psub["imd"].values
        for mname, mcol in models:
            pred = psub[mcol].values
            err = pred - obs
            abs_err = np.abs(err)

            p_corr, _ = stats.pearsonr(pred, obs)
            s_corr, _ = stats.spearmanr(pred, obs)

            dry_mask = obs < 0.1
            light_mask = (obs >= 0.1) & (obs < 5.0)
            mod_mask = (obs >= 5.0) & (obs < 15.0)
            heavy_mask = obs >= 15.0

            temporal_records.append({
                "Period": pname,
                "Model": mname,
                "N": len(pred),
                "MAE (mm)": round(float(np.mean(abs_err)), 4),
                "RMSE (mm)": round(float(np.sqrt(np.mean(err**2))), 4),
                "Mean Bias (mm)": round(float(np.mean(err)), 4),
                "Pearson Correlation": round(float(p_corr), 4),
                "Spearman Correlation": round(float(s_corr), 4),
                "Dry-Event MAE (<0.1mm)": round(float(np.mean(abs_err[dry_mask])), 4),
                "Light-Rain MAE (0.1-5mm)": round(float(np.mean(abs_err[light_mask])), 4),
                "Moderate-Rain MAE (5-15mm)": round(float(np.mean(abs_err[mod_mask])), 4),
                "Heavy-Rain MAE (>=15mm)": round(float(np.mean(abs_err[heavy_mask])), 4),
                "95th Pct Abs Error (mm)": round(float(np.percentile(abs_err, 95)), 4),
                "99th Pct Abs Error (mm)": round(float(np.percentile(abs_err, 99)), 4),
            })

    df_temporal = pd.DataFrame(temporal_records)
    df_temporal.to_csv("results/metrics/exp004_temporal_metrics.csv", index=False)
    logger.info("Saved temporal metrics to results/metrics/exp004_temporal_metrics.csv")

    # Step 6: Generalization Scorecard (Period Summary)
    period_summary_records = []
    for pname in ["June 2024", "July 2024", "August 2024"]:
        for mname in ["Model 1 (NOAA GFS)", "Model 2 (ECMWF IFS)", "Model 3 (50/50 Ensemble)", "Model 7 (Combined Adaptive)"]:
            row = df_temporal[(df_temporal["Period"] == pname) & (df_temporal["Model"] == mname)].iloc[0]
            period_summary_records.append({
                "Period": pname,
                "Model": mname,
                "N": row["N"],
                "MAE (mm)": row["MAE (mm)"],
                "RMSE (mm)": row["RMSE (mm)"],
                "Mean Bias (mm)": row["Mean Bias (mm)"],
                "Heavy-Rain MAE (mm)": row["Heavy-Rain MAE (>=15mm)"],
                "99th Pct Error (mm)": row["99th Pct Abs Error (mm)"],
            })
    df_period_summary = pd.DataFrame(period_summary_records)
    df_period_summary.to_csv("results/metrics/exp004_period_summary.csv", index=False)
    logger.info("Saved period summary to results/metrics/exp004_period_summary.csv")
    print("\n=== EXP004 GENERALIZATION SCORECARD ===")
    print(df_period_summary.to_string(index=False))

    # Cross-Period Summary Statistics for Model 7 vs 50/50
    m3_maes = [df_temporal[(df_temporal["Period"] == p) & (df_temporal["Model"] == "Model 3 (50/50 Ensemble)")]["MAE (mm)"].values[0] for p in ["June 2024", "July 2024", "August 2024"]]
    m7_maes = [df_temporal[(df_temporal["Period"] == p) & (df_temporal["Model"] == "Model 7 (Combined Adaptive)")]["MAE (mm)"].values[0] for p in ["June 2024", "July 2024", "August 2024"]]
    m3_rmses = [df_temporal[(df_temporal["Period"] == p) & (df_temporal["Model"] == "Model 3 (50/50 Ensemble)")]["RMSE (mm)"].values[0] for p in ["June 2024", "July 2024", "August 2024"]]
    m7_rmses = [df_temporal[(df_temporal["Period"] == p) & (df_temporal["Model"] == "Model 7 (Combined Adaptive)")]["RMSE (mm)"].values[0] for p in ["June 2024", "July 2024", "August 2024"]]

    cross_stats = [{
        "Comparison": "Model 7 vs 50/50 Ensemble",
        "Metric": "MAE",
        "Mean Across Periods (50/50)": round(float(np.mean(m3_maes)), 4),
        "Mean Across Periods (Adaptive)": round(float(np.mean(m7_maes)), 4),
        "Median (50/50)": round(float(np.median(m3_maes)), 4),
        "Median (Adaptive)": round(float(np.median(m7_maes)), 4),
        "Std Dev (50/50)": round(float(np.std(m3_maes)), 4),
        "Std Dev (Adaptive)": round(float(np.std(m7_maes)), 4),
        "Num Periods Adaptive < 50/50": int(sum(a < b for a, b in zip(m7_maes, m3_maes))),
        "Total Evaluation Periods": 3
    }, {
        "Comparison": "Model 7 vs 50/50 Ensemble",
        "Metric": "RMSE",
        "Mean Across Periods (50/50)": round(float(np.mean(m3_rmses)), 4),
        "Mean Across Periods (Adaptive)": round(float(np.mean(m7_rmses)), 4),
        "Median (50/50)": round(float(np.median(m3_rmses)), 4),
        "Median (Adaptive)": round(float(np.median(m7_rmses)), 4),
        "Std Dev (50/50)": round(float(np.std(m3_rmses)), 4),
        "Std Dev (Adaptive)": round(float(np.std(m7_rmses)), 4),
        "Num Periods Adaptive < 50/50": int(sum(a < b for a, b in zip(m7_rmses, m3_rmses))),
        "Total Evaluation Periods": 3
    }]
    df_cross_stats = pd.DataFrame(cross_stats)
    df_cross_stats.to_csv("results/metrics/exp004_cross_period_statistics.csv", index=False)
    logger.info("Saved cross-period statistics to results/metrics/exp004_cross_period_statistics.csv")

    # Step 7: Day-Level Paired Bootstrap Statistical Testing
    logger.info("Executing Day-Level Paired Bootstrap (1,000 resamples) preserving spatial autocorrelation...")
    np.random.seed(42)
    boot_records = []

    for pname, psub in [("June 2024", df_eval_all[df_eval_all["period"] == "Period 1 (June)"]),
                        ("July 2024", df_eval_all[df_eval_all["period"] == "Period 2 (July)"]),
                        ("August 2024", df_eval_all[df_eval_all["period"] == "Period 3 (August)"]),
                        ("Full Season", df_eval_all)]:
        
        # Group by forecast date to preserve spatial structure across all 791 cells
        days_in_p = sorted(psub["forecast_day"].unique())
        n_days = len(days_in_p)
        day_dfs = {d: psub[psub["forecast_day"] == d] for d in days_in_p}

        # Calculate daily mean absolute errors
        daily_mae_gfs = np.array([np.mean(np.abs(day_dfs[d]["gfs"].values - day_dfs[d]["imd"].values)) for d in days_in_p])
        daily_mae_ec = np.array([np.mean(np.abs(day_dfs[d]["ecmwf"].values - day_dfs[d]["imd"].values)) for d in days_in_p])
        daily_mae_ens = np.array([np.mean(np.abs(day_dfs[d]["model3_ensemble_50_50"].values - day_dfs[d]["imd"].values)) for d in days_in_p])
        daily_mae_m7 = np.array([np.mean(np.abs(day_dfs[d]["model7_combined"].values - day_dfs[d]["imd"].values)) for d in days_in_p])

        comparisons = [
            ("Model 7 vs NOAA GFS", daily_mae_m7 - daily_mae_gfs),
            ("Model 7 vs ECMWF IFS", daily_mae_m7 - daily_mae_ec),
            ("Model 7 vs 50/50 Ensemble", daily_mae_m7 - daily_mae_ens),
        ]

        for comp_name, diff_series in comparisons:
            boot_means = np.random.choice(diff_series, size=(1000, n_days), replace=True).mean(axis=1)
            mean_diff = float(np.mean(diff_series))
            ci_low = float(np.percentile(boot_means, 2.5))
            ci_high = float(np.percentile(boot_means, 97.5))
            p_val = float((boot_means >= 0).mean()) if mean_diff < 0 else float((boot_means <= 0).mean())
            sig = bool(p_val < 0.05 and (ci_low > 0 or ci_high < 0))

            boot_records.append({
                "Period": pname,
                "Comparison": comp_name,
                "Days Resampled": n_days,
                "Mean Difference (mm)": round(mean_diff, 4),
                "95% CI Lower": round(ci_low, 4),
                "95% CI Upper": round(ci_high, 4),
                "P-Value": round(p_val, 4),
                "Statistically Significant (p<0.05)": sig
            })

    df_boot = pd.DataFrame(boot_records)
    df_boot.to_csv("results/metrics/exp004_statistical_tests.csv", index=False)
    logger.info("Saved statistical bootstrap tests to results/metrics/exp004_statistical_tests.csv")
    print("\n=== DAY-LEVEL PAIRED BOOTSTRAP SIGNIFICANCE TESTS ===")
    print(df_boot.to_string(index=False))

    # Step 8: Regional and Regime Breakdowns
    logger.info("Computing regional and regime breakdowns across periods...")
    regional_records = []
    regime_records = []

    for pname, psub in periods_to_eval:
        # Regional
        for reg in ["Coastal Andhra Pradesh", "Rayalaseema", "Telangana"]:
            rsub = psub[psub["subregion"] == reg]
            obs = rsub["imd"].values
            regional_records.append({
                "Period": pname,
                "Subregion": reg,
                "N": len(rsub),
                "GFS MAE (mm)": round(float(np.mean(np.abs(rsub["gfs"].values - obs))), 4),
                "ECMWF MAE (mm)": round(float(np.mean(np.abs(rsub["ecmwf"].values - obs))), 4),
                "50/50 MAE (mm)": round(float(np.mean(np.abs(rsub["model3_ensemble_50_50"].values - obs))), 4),
                "Adaptive M7 MAE (mm)": round(float(np.mean(np.abs(rsub["model7_combined"].values - obs))), 4),
            })
        
        # Regimes
        for r_name, r_cond in [("Dry (<0.1mm)", psub["imd"] < 0.1),
                               ("Light (0.1-5mm)", (psub["imd"] >= 0.1) & (psub["imd"] < 5.0)),
                               ("Moderate (5-15mm)", (psub["imd"] >= 5.0) & (psub["imd"] < 15.0)),
                               ("Heavy (>=15mm)", psub["imd"] >= 15.0)]:
            rsub = psub[r_cond]
            obs = rsub["imd"].values
            regime_records.append({
                "Period": pname,
                "Regime": r_name,
                "N": len(rsub),
                "GFS MAE (mm)": round(float(np.mean(np.abs(rsub["gfs"].values - obs))), 4),
                "ECMWF MAE (mm)": round(float(np.mean(np.abs(rsub["ecmwf"].values - obs))), 4),
                "50/50 MAE (mm)": round(float(np.mean(np.abs(rsub["model3_ensemble_50_50"].values - obs))), 4),
                "Adaptive M7 MAE (mm)": round(float(np.mean(np.abs(rsub["model7_combined"].values - obs))), 4),
            })

    pd.DataFrame(regional_records).to_csv("results/metrics/exp004_regional_metrics.csv", index=False)
    pd.DataFrame(regime_records).to_csv("results/metrics/exp004_regime_metrics.csv", index=False)
    logger.info("Saved regional and regime metrics.")

    # Step 9: Generate Visualizations
    generate_exp004_plots(df_eval_all, df_temporal, df_audit, df_disagree_corr, df_binned)
    logger.info("EXP004 pipeline execution completed.")

def generate_exp004_plots(df_all: pd.DataFrame, df_temp: pd.DataFrame, df_audit: pd.DataFrame, df_corr: pd.DataFrame, df_binned: pd.DataFrame):
    """Generate all publication-grade diagnostic plots for EXP004."""
    logger.info("Generating publication-quality plots for EXP004...")
    os.makedirs("results/plots", exist_ok=True)
    plt.style.use("seaborn-v0_8-whitegrid" if "seaborn-v0_8-whitegrid" in plt.style.available else "default")

    # Plot 1: Monthly Generalization (June, July, August MAE comparison)
    fig, ax = plt.subplots(figsize=(12, 6))
    periods = ["June 2024", "July 2024", "August 2024"]
    models = ["Model 1 (NOAA GFS)", "Model 2 (ECMWF IFS)", "Model 3 (50/50 Ensemble)", "Model 7 (Combined Adaptive)"]
    colors = ["#2a9d8f", "#e76f51", "#264653", "#f4a261"]
    
    xp = np.arange(len(periods))
    width = 0.2
    for idx, (mname, colr) in enumerate(zip(models, colors)):
        vals = [df_temp[(df_temp["Period"] == p) & (df_temp["Model"] == mname)]["MAE (mm)"].values[0] for p in periods]
        rects = ax.bar(xp + (idx - 1.5)*width, vals, width, label=mname, color=colr, alpha=0.88)
        for r in rects:
            ax.text(r.get_x() + r.get_width()/2, r.get_height() + 0.1, f"{r.get_height():.2f}", ha="center", fontsize=9)

    ax.set_ylabel("MAE (mm)", fontsize=12, fontweight="bold")
    ax.set_title("EXP004: Monthly Generalization across 2024 Monsoon (June, July, August)", fontsize=14, fontweight="bold")
    ax.set_xticks(xp)
    ax.set_xticklabels(periods, fontsize=11, fontweight="bold")
    ax.legend(loc="upper left")
    plt.tight_layout()
    plt.savefig("results/plots/exp004_monthly_generalization.png", dpi=300)
    plt.savefig("results/plots/exp004_temporal_generalization.png", dpi=300)
    plt.close()

    # Plot 2: Disagreement vs Forecast Error Scatter/Density
    fig, ax = plt.subplots(figsize=(10, 6))
    sub_sample = df_all.sample(n=min(5000, len(df_all)), random_state=42)
    sc = ax.scatter(sub_sample["disagreement_raw"], np.abs(sub_sample["model3_ensemble_50_50"] - sub_sample["imd"]),
                    c=sub_sample["consensus_pred"], cmap="viridis", alpha=0.5, s=18)
    cbar = plt.colorbar(sc, ax=ax)
    cbar.set_label("Consensus Forecast (mm)", fontsize=11)
    ax.set_xlabel("GFS–ECMWF Raw Disagreement D = |GFS - ECMWF| (mm)", fontsize=12, fontweight="bold")
    ax.set_ylabel("50/50 Ensemble Absolute Error (mm)", fontsize=12, fontweight="bold")
    ax.set_title("EXP004: Model Disagreement vs Subsequent Ensemble Forecast Error", fontsize=14, fontweight="bold")
    ax.set_xlim(0, 50)
    ax.set_ylim(0, 60)
    plt.tight_layout()
    plt.savefig("results/plots/exp004_disagreement_vs_error.png", dpi=300)
    plt.close()

    # Plot 3: Disagreement Bins Performance
    fig, ax = plt.subplots(figsize=(11, 5))
    bins = ["Low", "Medium", "High"]
    x_b = np.arange(len(bins))
    for idx, p in enumerate(["June 2024", "July 2024", "August 2024"]):
        b_maes = [df_binned[(df_binned["Period"] == p) & (df_binned["Disagreement Bin"] == b)]["50/50 MAE (mm)"].values[0] for b in bins]
        ax.plot(x_b, b_maes, marker="o", linewidth=2.0, label=f"{p} 50/50 MAE")

    ax.set_ylabel("Ensemble MAE (mm)", fontsize=12, fontweight="bold")
    ax.set_xlabel("Disagreement Bin (Frozen from May Calibration)", fontsize=12, fontweight="bold")
    ax.set_title("EXP004: Forecast Error Escalation across Disagreement Bins", fontsize=14, fontweight="bold")
    ax.set_xticks(x_b)
    ax.set_xticklabels(bins, fontsize=11, fontweight="bold")
    ax.legend(loc="upper left")
    plt.tight_layout()
    plt.savefig("results/plots/exp004_disagreement_bins.png", dpi=300)
    plt.savefig("results/plots/exp004_monthly_disagreement.png", dpi=300)
    plt.close()

    # Plot 4: Regional Robustness
    fig, ax = plt.subplots(figsize=(12, 5))
    subregs = ["Coastal Andhra Pradesh", "Rayalaseema", "Telangana"]
    xr = np.arange(len(subregs))
    rw = 0.25
    for idx, p in enumerate(["June 2024", "July 2024", "August 2024"]):
        # read regional metrics
        df_r = pd.read_csv("results/metrics/exp004_regional_metrics.csv")
        r_ens = [df_r[(df_r["Period"] == p) & (df_r["Subregion"] == s)]["50/50 MAE (mm)"].values[0] for s in subregs]
        ax.bar(xr + (idx - 1)*rw, r_ens, rw, label=f"{p} 50/50 MAE", alpha=0.85)

    ax.set_ylabel("MAE (mm)", fontsize=12, fontweight="bold")
    ax.set_title("EXP004: Regional Performance across June, July, and August 2024", fontsize=14, fontweight="bold")
    ax.set_xticks(xr)
    ax.set_xticklabels(subregs, fontsize=11, fontweight="bold")
    ax.legend(loc="upper left")
    plt.tight_layout()
    plt.savefig("results/plots/exp004_regional_robustness.png", dpi=300)
    plt.close()

    # Plot 5: Weight Stability across 92 Days
    fig, ax = plt.subplots(figsize=(14, 5))
    days = pd.to_datetime(df_audit["forecast_date"])
    ax.plot(days, df_audit["m6_w_gfs"], color="#1d3557", linewidth=2.0, label="Model 6: Causal Rolling w(GFS)")
    ax.plot(days, df_audit["m7_mean_w_gfs"], color="#e63946", linestyle="--", linewidth=2.0, label="Model 7: Combined Mean w(GFS)")
    ax.fill_between(days, df_audit["m7_min_w_gfs"], df_audit["m7_max_w_gfs"], color="#e63946", alpha=0.15, label="Model 7 Weight Envelope")
    ax.axhline(0.5, color="gray", linestyle=":", linewidth=1.5, label="50/50 Baseline")
    ax.axvline(pd.to_datetime("2024-07-01"), color="blue", linestyle="--", alpha=0.7, label="June/July Boundary")
    ax.axvline(pd.to_datetime("2024-08-01"), color="green", linestyle="--", alpha=0.7, label="July/August Boundary")
    ax.set_ylabel("GFS Weight", fontsize=12, fontweight="bold")
    ax.set_xlabel("Forecast Initialization Date", fontsize=12, fontweight="bold")
    ax.set_title("EXP004: Expanding-Origin Causal Weight Evolution (June 1 – August 31, 2024)", fontsize=14, fontweight="bold")
    ax.set_ylim(0.0, 1.0)
    ax.legend(loc="upper right", frameon=True)
    plt.tight_layout()
    plt.savefig("results/plots/exp004_weight_stability.png", dpi=300)
    plt.close()

    # Plot 6: Tail Error Comparison
    fig, ax = plt.subplots(figsize=(10, 6))
    obs_vals = df_all["imd"].values
    for mcol, mname, colr in [("model1_gfs", "NOAA GFS", "#2a9d8f"),
                              ("model2_ecmwf", "ECMWF IFS", "#e76f51"),
                              ("model3_ensemble_50_50", "50/50 Ensemble", "#264653"),
                              ("model7_combined", "Model 7 Combined", "#e63946")]:
        abs_e = np.sort(np.abs(df_all[mcol].values - obs_vals))
        cdf = np.arange(1, len(abs_e) + 1) / len(abs_e)
        ax.plot(abs_e, cdf, label=mname, color=colr, linewidth=2.0)

    ax.set_xlim(0, 50)
    ax.set_ylim(0.7, 1.0)
    ax.set_xlabel("Absolute Error (mm)", fontsize=12, fontweight="bold")
    ax.set_ylabel("Cumulative Probability (CDF)", fontsize=12, fontweight="bold")
    ax.set_title("EXP004: Full Season Absolute Error CDF (Extreme Tail Suppression)", fontsize=14, fontweight="bold")
    ax.legend(loc="lower right")
    plt.tight_layout()
    plt.savefig("results/plots/exp004_tail_error.png", dpi=300)
    plt.close()

    # Plot 7: Regime Robustness
    fig, ax = plt.subplots(figsize=(12, 5))
    df_reg = pd.read_csv("results/metrics/exp004_regime_metrics.csv")
    reg_names = ["Dry (<0.1mm)", "Light (0.1-5mm)", "Moderate (5-15mm)", "Heavy (>=15mm)"]
    xreg = np.arange(len(reg_names))
    rw = 0.25
    for idx, p in enumerate(["June 2024", "July 2024", "August 2024"]):
        r_ens = [df_reg[(df_reg["Period"] == p) & (df_reg["Regime"] == r)]["50/50 MAE (mm)"].values[0] for r in reg_names]
        ax.bar(xreg + (idx - 1)*rw, r_ens, rw, label=f"{p} 50/50 MAE", alpha=0.85)

    ax.set_ylabel("MAE (mm)", fontsize=12, fontweight="bold")
    ax.set_title("EXP004: Performance by Rainfall Regime across June, July, and August 2024", fontsize=14, fontweight="bold")
    ax.set_xticks(xreg)
    ax.set_xticklabels(reg_names, fontsize=11, fontweight="bold")
    ax.legend(loc="upper left")
    plt.tight_layout()
    plt.savefig("results/plots/exp004_regime_robustness.png", dpi=300)
    plt.close()
    logger.info("All EXP004 publication plots successfully generated and saved.")

if __name__ == "__main__":
    run_exp004()
