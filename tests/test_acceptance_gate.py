"""
Unit Tests for Statistical Acceptance Gate and Paired Bootstrap.
Enforces honest reporting and baseline preservation when candidate does not beat baseline.
"""
import pytest
import numpy as np
import pandas as pd
from src.verification.bootstrap import paired_day_level_bootstrap
from src.verification.acceptance_gate import StatisticalAcceptanceGate


def test_paired_bootstrap_detects_significant_improvement():
    # Synthetic dataset where candidate is clearly superior (1.0 mm lower error every day)
    days = pd.date_range("2024-06-01", "2024-06-30").date
    rows = []
    for d in days:
        for cell in range(20):
            obs = 10.0
            base = 14.0 # err = 4.0
            cand = 12.0 # err = 2.0
            rows.append({
                "forecast_day": d,
                "cand": cand,
                "base": base,
                "obs": obs
            })
    df = pd.DataFrame(rows)

    boot_res = paired_day_level_bootstrap(
        eval_df=df,
        pred_col_candidate="cand",
        pred_col_baseline="base",
        obs_col="obs",
        n_iterations=500,
        random_seed=42
    )

    assert boot_res["is_significant"] is True
    assert boot_res["observed_delta_mae"] < 0
    assert boot_res["p_value"] < 0.05
    assert boot_res["ci_95_upper"] < 0


def test_acceptance_gate_enforces_baseline_retention_when_not_improved():
    # Synthetic dataset where candidate is inferior or equal (higher error)
    days = pd.date_range("2024-06-01", "2024-06-20").date
    rows = []
    for d in days:
        for cell in range(10):
            obs = 10.0
            base = 12.0 # err = 2.0
            cand = 13.0 # err = 3.0 (worse)
            rows.append({
                "forecast_day": d,
                "cand": cand,
                "base": base,
                "gfs": 13.5,
                "ecmwf": 11.5,
                "obs": obs
            })
    df = pd.DataFrame(rows)

    gate_res = StatisticalAcceptanceGate.audit_candidate_against_baselines(
        test_df=df,
        candidate_col="cand",
        baseline_col="base",
        gfs_col="gfs",
        ecmwf_col="ecmwf",
        obs_col="obs",
        n_bootstrap=200
    )

    # Acceptance gate MUST retain the baseline and report honest disclosure
    assert gate_res["acceptance_status"] == "BASELINE_RETAINED_HONEST_DISCLOSURE"
    assert gate_res["champion_model"] == "base"
    assert "did not demonstrate statistically significant improvement" in gate_res["scientific_rationale"]
