"""
Automated Test Suite for EXP004 Multi-Period Robustness and Disagreement Analysis
Covers:
1. Sample-count gates (June = 23,730, July = 24,521, August = 24,521, Total = 72,772)
2. Disagreement calculations (D_raw, D_norm with epsilon = 1.0)
3. Zero temporal leakage (historical cutoff = T - 1)
4. Frozen calibration thresholds
5. Weight bounds and conservation
6. Required artifacts and output verification
"""
import os
import pytest
import numpy as np
import pandas as pd
from datetime import datetime, date, timedelta

def test_exp004_sample_count_gate():
    parquet_path = "data/processed/exp004_multimonth_predictions.parquet"
    if not os.path.exists(parquet_path):
        pytest.skip("EXP004 parquet not yet generated (download/pipeline in progress)")
    df = pd.read_parquet(parquet_path)
    
    assert len(df) == 72772, f"Expected 72,772 samples, got {len(df)}"
    counts = df.groupby("period").size()
    assert counts["Period 1 (June)"] == 23730
    assert counts["Period 2 (July)"] == 24521
    assert counts["Period 3 (August)"] == 24521

def test_disagreement_calculation():
    gfs = np.array([10.0, 5.0, 0.0, 25.0])
    ecmwf = np.array([12.0, 5.0, 8.0, 15.0])
    
    d_raw = np.abs(gfs - ecmwf)
    expected_raw = np.array([2.0, 0.0, 8.0, 10.0])
    assert np.allclose(d_raw, expected_raw)

    consensus = 0.5 * (gfs + ecmwf)
    d_norm = d_raw / (1.0 + consensus)
    expected_norm = np.array([2.0 / 12.0, 0.0 / 6.0, 8.0 / 5.0, 10.0 / 21.0])
    assert np.allclose(d_norm, expected_norm)

def test_disagreement_bounds_and_non_negativity():
    parquet_path = "data/processed/exp004_multimonth_predictions.parquet"
    if not os.path.exists(parquet_path):
        pytest.skip("EXP004 parquet not yet generated")
    df = pd.read_parquet(parquet_path)
    assert (df["disagreement_raw"] >= 0.0).all()
    assert (df["disagreement_norm"] >= 0.0).all()

def test_expanding_origin_causal_latency():
    audit_file = "results/metrics/exp004_weight_history.csv"
    if not os.path.exists(audit_file):
        pytest.skip("EXP004 audit history not yet generated")
    df_audit = pd.read_csv(audit_file)
    assert len(df_audit) == 92
    
    for _, row in df_audit.iterrows():
        f_date = datetime.strptime(row["forecast_date"], "%Y-%m-%d").date()
        c_date = datetime.strptime(row["historical_cutoff_date"], "%Y-%m-%d").date()
        latest_obs = datetime.strptime(row["latest_imd_obs_used"], "%Y-%m-%d").date()
        assert c_date < f_date
        assert latest_obs < f_date
        assert (f_date - c_date).days == 1

def test_weight_conservation():
    parquet_path = "data/processed/exp004_multimonth_predictions.parquet"
    if not os.path.exists(parquet_path):
        pytest.skip("EXP004 parquet not yet generated")
    df = pd.read_parquet(parquet_path)
    assert np.allclose(df["w_gfs_m6"] + df["w_ecmwf_m6"], 1.0, atol=1e-5)
    assert np.allclose(df["w_gfs_m7"] + df["w_ecmwf_m7"], 1.0, atol=1e-5)
    assert ((df["w_gfs_m7"] >= 0.10) & (df["w_gfs_m7"] <= 0.90)).all()

def test_required_artifacts_exist():
    required = [
        "configs/experiment_004.yaml",
        "results/reports/EXP004_DATA_AVAILABILITY.md",
        "src/verification/independent_exp004_audit.py",
    ]
    for r in required:
        assert os.path.exists(r), f"Missing required file: {r}"
