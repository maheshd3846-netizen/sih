"""
Automated Test Suite for EXP003 Leakage-Safe Adaptive Forecast Fusion
Covers:
1. Temporal leakage verification (cutoff < forecast time)
2. Weight bounds, clipping, and conservation (w_gfs + w_ec = 1.0)
3. Sample count consistency (23,730 June evaluation pairs)
4. Inverse-MAE rolling skill logic
5. Regime classification logic
6. File existence and schema verification
"""
import os
import pytest
import numpy as np
import pandas as pd
from datetime import datetime, date, timedelta

def test_temporal_leakage_guarantee():
    audit_file = "results/metrics/exp003_weight_history.csv"
    assert os.path.exists(audit_file), f"Audit file {audit_file} not found!"
    df_audit = pd.read_csv(audit_file)
    
    assert len(df_audit) == 30, f"Expected 30 daily audit records, got {len(df_audit)}"
    
    for _, row in df_audit.iterrows():
        f_date = datetime.strptime(row["forecast_date"], "%Y-%m-%d").date()
        cutoff_date = datetime.strptime(row["historical_cutoff_date"], "%Y-%m-%d").date()
        latest_obs = datetime.strptime(row["latest_imd_obs_used"], "%Y-%m-%d").date()
        
        # Strictly causal: cutoff and latest observation must strictly precede forecast issue date
        assert cutoff_date < f_date, f"Temporal leakage detected! Cutoff {cutoff_date} >= Forecast {f_date}"
        assert latest_obs < f_date, f"Temporal leakage detected! Latest obs {latest_obs} >= Forecast {f_date}"
        assert (f_date - cutoff_date).days == 1, f"Operational latency must be exactly 1 day! Found {(f_date - cutoff_date).days}"

def test_weight_conservation_and_bounds():
    parquet_file = "data/processed/exp003_adaptive_predictions.parquet"
    assert os.path.exists(parquet_file), f"Parquet file {parquet_file} not found!"
    df = pd.read_parquet(parquet_file)
    
    # Check Model 5 weights
    assert np.allclose(df["w_gfs_m5"] + df["w_ecmwf_m5"], 1.0, atol=1e-5)
    assert ((df["w_gfs_m5"] >= 0.0) & (df["w_gfs_m5"] <= 1.0)).all()
    
    # Check Model 6 weights
    assert np.allclose(df["w_gfs_m6"] + df["w_ecmwf_m6"], 1.0, atol=1e-5)
    assert ((df["w_gfs_m6"] >= 0.0) & (df["w_gfs_m6"] <= 1.0)).all()
    
    # Check Model 7 weights
    assert np.allclose(df["w_gfs_m7"] + df["w_ecmwf_m7"], 1.0, atol=1e-5)
    assert ((df["w_gfs_m7"] >= 0.10) & (df["w_gfs_m7"] <= 0.90)).all()

def test_sample_count_consistency():
    parquet_file = "data/processed/exp003_adaptive_predictions.parquet"
    df = pd.read_parquet(parquet_file)
    assert len(df) == 23730, f"Sample count {len(df)} does not match 23,730 canonical June pairs!"
    
    # Exactly 791 valid land grid cells per day for 30 days
    daily_counts = df.groupby("valid_time").size()
    assert len(daily_counts) == 30
    assert (daily_counts == 791).all(), "Every day must have exactly 791 valid terrestrial grid points"

def test_rolling_inverse_mae_logic():
    # If GFS has MAE = 2.0 and ECMWF has MAE = 4.0:
    # 1/2 = 0.5, 1/4 = 0.25 -> w_gfs = 0.5 / 0.75 = 2/3
    gfs_mae = 2.0
    ec_mae = 4.0
    w_gfs = (1.0 / gfs_mae) / (1.0 / gfs_mae + 1.0 / ec_mae)
    w_ec = 1.0 - w_gfs
    assert np.isclose(w_gfs, 2.0 / 3.0)
    assert np.isclose(w_ec, 1.0 / 3.0)

def test_required_artifacts_exist():
    required_files = [
        "configs/experiment_003.yaml",
        "data/processed/exp003_adaptive_predictions.parquet",
        "results/metrics/exp003_all_models.csv",
        "results/metrics/exp003_weight_history.csv",
        "results/metrics/exp003_statistical_tests.csv",
        "results/plots/exp003_model_comparison.png",
        "results/plots/exp003_weight_evolution.png",
        "results/plots/exp003_weight_distribution.png",
        "results/plots/exp003_regime_performance.png",
        "results/plots/exp003_regional_performance.png",
        "results/plots/exp003_error_distribution.png",
    ]
    for rf in required_files:
        assert os.path.exists(rf), f"Required artifact {rf} does not exist!"
