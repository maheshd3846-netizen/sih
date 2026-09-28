"""
Automated Test Suite for Live 24-Hour NWP Forecasting Subsystem
SIH26081 — Operational Meteorological Workstation

Tests:
1. Live date discovery
2. Matching GFS + ECMWF run requirement
3. 24h lead validation
4. Native 0.25° alignment
5. 791-cell terrestrial mask
6. No negative precipitation & finite values
7. Equal-weight fusion formula (50% GFS + 50% ECMWF)
8. Disagreement calculation & normalized disagreement
9. Confidence classification & historical MAE
10. Zero IMD verification / null observation in live mode
11. Stale-data rejection (no silent historical fallback)
12. Unavailable-source handling & explicit messages
13. Live API response (/api/live & /api/live/status)
14. Strict retrospective/live separation
"""
import os
import json
import pytest
import urllib.request
import urllib.error
from datetime import datetime, date, timedelta, timezone
import numpy as np
import pandas as pd

from src.operational.live_engine import (
    LiveForecastEngine,
    EXPECTED_CELL_COUNT,
    DEFAULT_CYCLE,
    DEFAULT_LEAD_HOURS,
    BOUNDING_BOX
)
from src.operational.engine import OperationalForecastEngine, DISAGREEMENT_THRESHOLDS, EMPIRICAL_EXPECTED_ERRORS

@pytest.fixture(scope="module")
def live_engine():
    return LiveForecastEngine()

@pytest.fixture(scope="module")
def retro_engine():
    return OperationalForecastEngine()

# 1. Live Date Discovery
def test_live_date_discovery(live_engine):
    discovery = live_engine.discover_latest_matching_run()
    assert discovery["status"] in ["SUCCESS", "LATEST_RUN_NOT_AVAILABLE", "LIVE_DATA_UNAVAILABLE"]
    if discovery["status"] == "SUCCESS":
        assert "matched_date" in discovery
        assert discovery["cycle"] == DEFAULT_CYCLE
        assert discovery["lead_hours"] == DEFAULT_LEAD_HOURS
        assert discovery["gfs_available"] is True
        assert discovery["ecmwf_available"] is True
        # Ensure matched date is within recent days
        matched_d = datetime.strptime(discovery["matched_date"], "%Y-%m-%d").date()
        today_utc = datetime.now(timezone.utc).date()
        assert (today_utc - matched_d).days <= 5

# 2. Matching GFS + ECMWF Run Requirement
def test_matching_gfs_ecmwf_run_requirement(live_engine, monkeypatch):
    test_d = date(2026, 9, 28)

    # Case A: GFS available, ECMWF unavailable -> must NOT match
    def mock_probe_gfs_only(d, cycle="00", lead_hours=24, timeout=5):
        return {
            "date": d.isoformat(),
            "cycle": cycle,
            "lead_hours": lead_hours,
            "gfs_available": True,
            "ecmwf_available": False,
            "gfs_url": "mock_gfs",
            "ecmwf_url": "mock_ecmwf",
            "status": "GFS_ONLY"
        }

    monkeypatch.setattr(live_engine, "probe_source_availability", mock_probe_gfs_only)
    disc_gfs_only = live_engine.discover_latest_matching_run(max_lookback_days=1)
    assert disc_gfs_only["status"] == "LATEST_RUN_NOT_AVAILABLE"
    assert disc_gfs_only["source_status"]["gfs"] == "AVAILABLE"
    assert disc_gfs_only["source_status"]["ecmwf"] == "UNAVAILABLE"
    assert "will not substitute an older run" in disc_gfs_only["reason"]

    # Case B: ECMWF available, GFS unavailable -> must NOT match
    def mock_probe_ecmwf_only(d, cycle="00", lead_hours=24, timeout=5):
        return {
            "date": d.isoformat(),
            "cycle": cycle,
            "lead_hours": lead_hours,
            "gfs_available": False,
            "ecmwf_available": True,
            "gfs_url": "mock_gfs",
            "ecmwf_url": "mock_ecmwf",
            "status": "ECMWF_ONLY"
        }

    monkeypatch.setattr(live_engine, "probe_source_availability", mock_probe_ecmwf_only)
    disc_ecmwf_only = live_engine.discover_latest_matching_run(max_lookback_days=1)
    assert disc_ecmwf_only["status"] == "LATEST_RUN_NOT_AVAILABLE"
    assert disc_ecmwf_only["source_status"]["gfs"] == "UNAVAILABLE"
    assert disc_ecmwf_only["source_status"]["ecmwf"] == "AVAILABLE"
    assert "will not substitute an older run" in disc_ecmwf_only["reason"]

# 3. 24h Lead Validation
def test_24h_lead_validation(live_engine):
    forecast = live_engine.generate_live_forecast()
    assert forecast["status"] == "SUCCESS"
    assert forecast["lead_hours"] == 24

    init_dt = datetime.fromisoformat(forecast["initialization_time_utc"].replace("Z", "+00:00"))
    valid_dt = datetime.fromisoformat(forecast["valid_time_utc"].replace("Z", "+00:00"))
    delta = valid_dt - init_dt
    assert delta.total_seconds() == 24 * 3600  # Exactly 24 hours

    # Verify step range in source metadata
    meta = forecast.get("source_metadata", {})
    if "gfs" in meta:
        assert meta["gfs"]["step_range"] in ["0-24", "24"]
    if "ecmwf" in meta:
        assert meta["ecmwf"]["step_range"] in ["0-24", "24"]

# 4. Native 0.25° Alignment
def test_native_025_alignment(live_engine):
    forecast = live_engine.generate_live_forecast()
    assert forecast["status"] == "SUCCESS"

    for pt in forecast["points"]:
        # Verify 0.25° integer alignment: lat * 4 and lon * 4 must be integers
        lat_rem = (pt["lat"] * 4) % 1.0
        lon_rem = (pt["lon"] * 4) % 1.0
        assert np.isclose(lat_rem, 0.0, atol=1e-4) or np.isclose(lat_rem, 1.0, atol=1e-4)
        assert np.isclose(lon_rem, 0.0, atol=1e-4) or np.isclose(lon_rem, 1.0, atol=1e-4)
        # Verify within domain bounding box
        assert BOUNDING_BOX[0] <= pt["lat"] <= BOUNDING_BOX[1]
        assert BOUNDING_BOX[2] <= pt["lon"] <= BOUNDING_BOX[3]

# 5. 791-Cell Terrestrial Mask
def test_791_cell_mask(live_engine):
    forecast = live_engine.generate_live_forecast()
    assert forecast["status"] == "SUCCESS"
    assert forecast["total_land_points"] == EXPECTED_CELL_COUNT
    assert len(forecast["points"]) == EXPECTED_CELL_COUNT

    # Verify identical coordinate match with master mask
    master_coords = set(zip(live_engine.mask_df["lat"].round(2), live_engine.mask_df["lon"].round(2)))
    live_coords = set((round(pt["lat"], 2), round(pt["lon"], 2)) for pt in forecast["points"])
    assert master_coords == live_coords

# 6. No Negative Precipitation & Finite Values
def test_no_negative_precipitation(live_engine):
    forecast = live_engine.generate_live_forecast()
    assert forecast["status"] == "SUCCESS"

    for pt in forecast["points"]:
        assert np.isfinite(pt["gfs_mm"])
        assert np.isfinite(pt["ecmwf_mm"])
        assert np.isfinite(pt["fused_mm"])
        assert np.isfinite(pt["disagreement_mm"])
        assert pt["gfs_mm"] >= 0.0
        assert pt["ecmwf_mm"] >= 0.0
        assert pt["fused_mm"] >= 0.0
        assert pt["disagreement_mm"] >= 0.0

# 7. Equal-Weight Fusion
def test_equal_weight_fusion(live_engine):
    forecast = live_engine.generate_live_forecast()
    assert forecast["status"] == "SUCCESS"

    for pt in forecast["points"]:
        expected_fused = round(0.5 * pt["gfs_mm"] + 0.5 * pt["ecmwf_mm"], 2)
        assert np.isclose(pt["fused_mm"], expected_fused, atol=0.02)

# 8. Disagreement Calculation
def test_disagreement_calculation(live_engine):
    forecast = live_engine.generate_live_forecast()
    assert forecast["status"] == "SUCCESS"

    for pt in forecast["points"]:
        expected_d = round(abs(pt["gfs_mm"] - pt["ecmwf_mm"]), 2)
        assert np.isclose(pt["disagreement_mm"], expected_d, atol=0.02)
        expected_d_norm = round(expected_d / (1.0 + pt["fused_mm"]), 3)
        assert np.isclose(pt["disagreement_norm"], expected_d_norm, atol=0.02)

# 9. Confidence Classification & Historical MAE
def test_confidence_classification(live_engine):
    forecast = live_engine.generate_live_forecast()
    assert forecast["status"] == "SUCCESS"

    for pt in forecast["points"]:
        d = pt["disagreement_mm"]
        c_class = pt["confidence_class"]
        exp_mae = pt["expected_mae_mm"]

        if d < DISAGREEMENT_THRESHOLDS["low_max"]:
            assert c_class == "High Confidence"
            assert exp_mae == 2.02
        elif d < DISAGREEMENT_THRESHOLDS["med_max"]:
            assert c_class == "Moderate Confidence"
            assert exp_mae == 3.75
        else:
            assert c_class == "Low Confidence"
            assert exp_mae == 9.46

# 10. No IMD Verification in Live Mode
def test_no_imd_verification_in_live_mode(live_engine):
    forecast = live_engine.generate_live_forecast()
    assert forecast["status"] == "SUCCESS"
    assert forecast["mode"] == "LIVE"

    for pt in forecast["points"]:
        assert pt["imd_mm"] is None
        assert pt["fused_error_mm"] is None
        assert pt["fused_abs_error_mm"] is None

    prov = forecast["provenance"]
    assert prov["verification_status"] == "NOT_AVAILABLE_FOR_CURRENT_FORECAST"

# 11. Stale-Data Rejection (No Silent Historical Fallback)
def test_stale_data_rejection(live_engine, monkeypatch):
    # Simulate completely unavailable data
    def mock_probe_none(d, cycle="00", lead_hours=24, timeout=5):
        return {
            "date": d.isoformat(),
            "cycle": cycle,
            "lead_hours": lead_hours,
            "gfs_available": False,
            "ecmwf_available": False,
            "status": "NEITHER_AVAILABLE"
        }

    monkeypatch.setattr(live_engine, "probe_source_availability", mock_probe_none)
    result = live_engine.discover_latest_matching_run(max_lookback_days=2)
    assert result["status"] == "LIVE_DATA_UNAVAILABLE"
    # Ensure it did NOT return 2024 data
    assert "2024" not in str(result.get("matched_date", ""))

# 12. Unavailable-Source Handling
def test_unavailable_source_handling(live_engine):
    # Probing far-future date should return explicit unavailabilities
    future_date = date(2035, 1, 1)
    probe = live_engine.probe_source_availability(future_date)
    assert probe["gfs_available"] is False
    assert probe["ecmwf_available"] is False
    assert probe["status"] == "NEITHER_AVAILABLE"

    # Attempting to generate live forecast for future date should fail explicitly
    res = live_engine.generate_live_forecast(target_date=future_date)
    assert res["status"] in ["LIVE_DATA_UNAVAILABLE", "LATEST_RUN_NOT_AVAILABLE"]
    assert "reason" in res
    assert res["mode"] == "LIVE"

# 13. Live API Response
def test_live_api_response():
    # Test GET /api/live/status
    req_status = urllib.request.Request("http://127.0.0.1:8080/api/live/status")
    with urllib.request.urlopen(req_status, timeout=5) as resp:
        assert resp.status == 200
        data = json.loads(resp.read().decode())
        assert data["mode"] == "LIVE"
        assert "latest_available_run" in data
        assert data["gfs_availability"] in ["AVAILABLE", "UNAVAILABLE"]
        assert data["ecmwf_availability"] in ["AVAILABLE", "UNAVAILABLE"]
        assert "initialization_time" in data
        assert "valid_time" in data
        assert "cache_age" in data
        assert data["cell_count"] == 791
        assert "VALIDATED" in data["data_integrity_status"]

    # Test GET /api/live
    req_live = urllib.request.Request("http://127.0.0.1:8080/api/live")
    with urllib.request.urlopen(req_live, timeout=10) as resp:
        assert resp.status == 200
        live_json = json.loads(resp.read().decode())
        assert live_json["status"] == "SUCCESS"
        assert live_json["mode"] == "LIVE"
        assert live_json["forecast_type"] == "LIVE_24H_NWP_FORECAST"
        assert live_json["lead_hours"] == 24
        assert live_json["source_status"]["gfs"] == "AVAILABLE"
        assert live_json["source_status"]["ecmwf"] == "AVAILABLE"
        assert len(live_json["points"]) == 791
        assert live_json["points"][0]["imd_mm"] is None

# 14. Strict Retrospective / Live Separation
def test_retrospective_live_separation(retro_engine, live_engine):
    # Retrospective 2024 forecast
    retro_data = retro_engine.get_grid_forecast("2024-07-15")
    assert retro_data["status"] == "SUCCESS"
    assert retro_data["total_land_points"] == 791
    # Must have valid IMD observations in retrospective mode
    has_valid_imd = any(p["imd_mm"] is not None for p in retro_data["points"])
    assert has_valid_imd is True
    assert "IMD 0.25° Gridded Daily Rainfall Analysis" in retro_data["provenance"]["verification_source"]

    # Live forecast
    live_data = live_engine.generate_live_forecast()
    assert live_data["status"] == "SUCCESS"
    assert live_data["mode"] == "LIVE"
    # Must have strictly NULL observations in live mode
    all_imd_null = all(p["imd_mm"] is None for p in live_data["points"])
    assert all_imd_null is True
    all_err_null = all(p["fused_error_mm"] is None for p in live_data["points"])
    assert all_err_null is True
    assert live_data["provenance"]["verification_status"] == "NOT_AVAILABLE_FOR_CURRENT_FORECAST"

# 15. Regression Tests for Strict Current-Run-Only Live Discovery Semantics
def test_strict_current_run_only_discovery(live_engine, monkeypatch):
    today = date(2026, 9, 28)
    yesterday = date(2026, 9, 27)

    def create_mock_probe(today_gfs, today_ecmwf, yesterday_gfs=True, yesterday_ecmwf=True):
        def _probe(d, cycle="00", lead_hours=24, timeout=5):
            if d == today:
                return {
                    "date": d.isoformat(),
                    "cycle": cycle,
                    "lead_hours": lead_hours,
                    "gfs_available": today_gfs,
                    "ecmwf_available": today_ecmwf,
                    "gfs_url": "mock_gfs",
                    "ecmwf_url": "mock_ecmwf",
                    "status": "PROBED"
                }
            elif d == yesterday:
                return {
                    "date": d.isoformat(),
                    "cycle": cycle,
                    "lead_hours": lead_hours,
                    "gfs_available": yesterday_gfs,
                    "ecmwf_available": yesterday_ecmwf,
                    "gfs_url": "mock_gfs",
                    "ecmwf_url": "mock_ecmwf",
                    "status": "PROBED"
                }
            return {
                "date": d.isoformat(),
                "cycle": cycle,
                "lead_hours": lead_hours,
                "gfs_available": False,
                "ecmwf_available": False,
                "status": "NEITHER_AVAILABLE"
            }
        return _probe

    # Scenario 1: Current date neither available + previous date both available -> MUST return unavailable
    monkeypatch.setattr(live_engine, "probe_source_availability", create_mock_probe(False, False, True, True))
    disc1 = live_engine.discover_latest_matching_run(current_date_utc=today)
    assert disc1["status"] in ["LATEST_RUN_NOT_AVAILABLE", "LIVE_DATA_UNAVAILABLE"]
    assert disc1.get("matched_date") != yesterday.isoformat()
    assert "will not substitute an older run" in disc1["reason"]

    # Scenario 2: Current date GFS only + previous date both available -> MUST return unavailable
    monkeypatch.setattr(live_engine, "probe_source_availability", create_mock_probe(True, False, True, True))
    disc2 = live_engine.discover_latest_matching_run(current_date_utc=today)
    assert disc2["status"] in ["LATEST_RUN_NOT_AVAILABLE", "LIVE_DATA_UNAVAILABLE"]
    assert disc2.get("matched_date") != yesterday.isoformat()
    assert disc2["source_status"]["gfs"] == "AVAILABLE"
    assert disc2["source_status"]["ecmwf"] == "UNAVAILABLE"
    assert "will not substitute an older run" in disc2["reason"]

    # Scenario 3: Current date ECMWF only + previous date both available -> MUST return unavailable
    monkeypatch.setattr(live_engine, "probe_source_availability", create_mock_probe(False, True, True, True))
    disc3 = live_engine.discover_latest_matching_run(current_date_utc=today)
    assert disc3["status"] in ["LATEST_RUN_NOT_AVAILABLE", "LIVE_DATA_UNAVAILABLE"]
    assert disc3.get("matched_date") != yesterday.isoformat()
    assert disc3["source_status"]["gfs"] == "UNAVAILABLE"
    assert disc3["source_status"]["ecmwf"] == "AVAILABLE"
    assert "will not substitute an older run" in disc3["reason"]

    # Scenario 4: Current date both available -> SUCCESS
    monkeypatch.setattr(live_engine, "probe_source_availability", create_mock_probe(True, True, True, True))
    disc4 = live_engine.discover_latest_matching_run(current_date_utc=today)
    assert disc4["status"] == "SUCCESS"
    assert disc4["matched_date"] == today.isoformat()
    assert disc4["gfs_available"] is True
    assert disc4["ecmwf_available"] is True

