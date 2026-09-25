"""
Automated Test Suite for Operational Prototype
Covers:
1. 50/50 GFS–ECMWF equal-weight fusion formula
2. Disagreement calculation & normalized disagreement
3. Frozen EXP004 confidence engine classification and empirical errors
4. Full 791-cell spatial grid coverage and provenance completeness
5. Explicit system statuses on missing or invalid queries (no silent substitution)
6. Point query geometry and out-of-bounds rejection
7. Live HTTP API server endpoints
"""
import os
import pytest
import urllib.request
import json
import numpy as np

from src.operational.engine import OperationalForecastEngine, DISAGREEMENT_THRESHOLDS, EMPIRICAL_EXPECTED_ERRORS

@pytest.fixture(scope="module")
def engine():
    return OperationalForecastEngine()

def test_equal_weight_fusion_formula(engine):
    # Test on synthetic values
    gfs_val = 14.0
    ecmwf_val = 22.0
    expected_fused = 0.5 * gfs_val + 0.5 * ecmwf_val
    assert np.isclose(expected_fused, 18.0)

    # Test on actual engine forecast
    res = engine.get_grid_forecast("2024-07-15")
    assert res["status"] == "SUCCESS"
    for pt in res["points"]:
        expected = round(0.5 * pt["gfs_mm"] + 0.5 * pt["ecmwf_mm"], 2)
        assert np.isclose(pt["fused_mm"], expected, atol=0.02)

def test_disagreement_calculation(engine):
    res = engine.get_grid_forecast("2024-07-15")
    assert res["status"] == "SUCCESS"
    for pt in res["points"]:
        expected_d = round(abs(pt["gfs_mm"] - pt["ecmwf_mm"]), 2)
        assert np.isclose(pt["disagreement_mm"], expected_d, atol=0.02)
        expected_d_norm = round(expected_d / (1.0 + pt["fused_mm"]), 3)
        assert np.isclose(pt["disagreement_norm"], expected_d_norm, atol=0.02)

def test_confidence_engine_classification(engine):
    c_high, err_high = engine.classify_confidence(0.05)
    assert c_high == "High Confidence"
    assert err_high["mae_mm"] == 2.02

    c_mod, err_mod = engine.classify_confidence(1.20)
    assert c_mod == "Moderate Confidence"
    assert err_mod["mae_mm"] == 3.75

    c_low, err_low = engine.classify_confidence(5.50)
    assert c_low == "Low Confidence"
    assert err_low["mae_mm"] == 9.46

def test_grid_coverage_and_provenance(engine):
    res = engine.get_grid_forecast("2024-07-15")
    assert res["status"] == "SUCCESS"
    assert res["total_land_points"] == 791
    assert len(res["points"]) == 791

    # Check provenance fields
    prov = res["provenance"]
    assert "NOAA GFS" in prov["nwp_source_1"]
    assert "ECMWF IFS" in prov["nwp_source_2"]
    assert "Equal-Weight" in prov["fusion_method"]
    assert "EXP004 Disagreement Bins" in prov["confidence_engine"]
    assert "IMD" in prov["verification_source"]
    assert "1-day observation availability lag" in prov["causal_latency_applied"]

    # Check point fields
    for pt in res["points"][:10]:
        assert "gfs_mm" in pt
        assert "ecmwf_mm" in pt
        assert "fused_mm" in pt
        assert "disagreement_mm" in pt
        assert "disagreement_norm" in pt
        assert "confidence_class" in pt
        assert "expected_mae_mm" in pt
        assert "subregion" in pt
        assert "predicted_regime" in pt

def test_explicit_error_on_invalid_and_missing_dates(engine):
    # Non-existent date
    res_missing = engine.get_grid_forecast("1995-01-01")
    assert res_missing["status"] == "DATE_NOT_FOUND"
    assert len(res_missing["data"]) == 0

    # Malformed string
    res_bad = engine.get_grid_forecast("invalid-date-string")
    assert res_bad["status"] == "INVALID_DATE_FORMAT"

def test_point_query_and_boundary_rejection(engine):
    # In-domain coordinate: Vijayawada vicinity (16.5, 80.6)
    res_in = engine.get_point_forecast(16.5, 80.6, "2024-07-15")
    assert res_in["status"] == "SUCCESS"
    assert res_in["matched_grid_cell"]["subregion"] == "Coastal Andhra Pradesh"

    # Out-of-domain coordinate: Delhi vicinity (28.6, 77.2)
    res_out = engine.get_point_forecast(28.6, 77.2, "2024-07-15")
    assert res_out["status"] == "POINT_OUT_OF_DOMAIN"

def test_live_http_server():
    # Test /api/system/health
    try:
        req = urllib.request.Request("http://127.0.0.1:8080/api/system/health")
        with urllib.request.urlopen(req, timeout=3) as resp:
            assert resp.status == 200
            data = json.loads(resp.read().decode())
            assert data["system_status"] == "ONLINE"
            assert data["total_terrestrial_cells"] == 791
            assert data["available_days"] == 92
    except Exception as e:
        pytest.fail(f"HTTP Server health check failed: {e}")

    # Test /api/dates
    try:
        req = urllib.request.Request("http://127.0.0.1:8080/api/dates")
        with urllib.request.urlopen(req, timeout=3) as resp:
            assert resp.status == 200
            data = json.loads(resp.read().decode())
            assert data["status"] == "SUCCESS"
            assert len(data["dates"]) == 92
    except Exception as e:
        pytest.fail(f"HTTP Server dates API failed: {e}")
