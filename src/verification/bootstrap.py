"""
Paired Block / Day-Level Bootstrap Significance Test.
Resamples paired forecast days with replacement to preserve spatial cross-correlation
across all 791 terrestrial grid cells.
Evaluates empirical p-values and 95% Confidence Intervals for Delta MAE.
"""
from typing import Dict, Any, List, Optional
import numpy as np
import pandas as pd


def paired_day_level_bootstrap(
    eval_df: pd.DataFrame,
    pred_col_candidate: str,
    pred_col_baseline: str,
    obs_col: str = "obs",
    day_col: str = "forecast_day",
    n_iterations: int = 2000,
    random_seed: int = 42
) -> Dict[str, Any]:
    """
    Executes day-level paired bootstrap test.
    Computes Delta MAE = MAE(Candidate) - MAE(Baseline).
    Negative Delta MAE indicates candidate has lower error (improved skill).
    """
    rng = np.random.default_rng(random_seed)
    
    # Filter valid rows
    valid_mask = (
        (~eval_df[pred_col_candidate].isna()) &
        (~eval_df[pred_col_baseline].isna()) &
        (~eval_df[obs_col].isna())
    )
    df = eval_df[valid_mask].copy()
    
    unique_days = np.array(df[day_col].unique())
    n_days = len(unique_days)
    if n_days < 5:
        return {
            "status": "INSUFFICIENT_SAMPLE",
            "message": f"Only {n_days} evaluation days available; bootstrap requires at least 5 days.",
            "p_value": 1.0,
            "delta_mae_mean": 0.0,
            "ci_95_lower": 0.0,
            "ci_95_upper": 0.0,
            "is_significant": False
        }

    # Group daily errors for ultra-fast vectorized bootstrap sampling
    daily_groups = df.groupby(day_col)
    day_mae_cand = daily_groups.apply(
        lambda g: float(np.mean(np.abs(g[pred_col_candidate] - g[obs_col])))
    ).to_dict()
    day_mae_base = daily_groups.apply(
        lambda g: float(np.mean(np.abs(g[pred_col_baseline] - g[obs_col])))
    ).to_dict()

    cand_day_arr = np.array([day_mae_cand[d] for d in unique_days])
    base_day_arr = np.array([day_mae_base[d] for d in unique_days])
    observed_delta = float(np.mean(cand_day_arr) - np.mean(base_day_arr))

    # Resample days with replacement
    boot_deltas = np.zeros(n_iterations)
    for i in range(n_iterations):
        sample_indices = rng.integers(0, n_days, size=n_days)
        boot_cand = np.mean(cand_day_arr[sample_indices])
        boot_base = np.mean(base_day_arr[sample_indices])
        boot_deltas[i] = boot_cand - boot_base

    # Compute empirical 95% Confidence Interval
    ci_lower = float(np.percentile(boot_deltas, 2.5))
    ci_upper = float(np.percentile(boot_deltas, 97.5))

    # Two-tailed p-value testing H0: Delta MAE == 0
    # Fraction of bootstrap iterations where sign opposite to observed or crossing zero
    if observed_delta < 0:
        p_val = float(2.0 * np.mean(boot_deltas >= 0.0))
    else:
        p_val = float(2.0 * np.mean(boot_deltas <= 0.0))
    p_val = min(1.0, max(0.0, p_val))

    # Statistically significant improvement requires delta < 0 and p < 0.05 and CI upper < 0
    is_improved = bool(observed_delta < 0 and p_val < 0.05 and ci_upper < 0)

    return {
        "status": "SUCCESS",
        "n_days": n_days,
        "n_samples": len(df),
        "n_iterations": n_iterations,
        "observed_candidate_mae": round(float(np.mean(cand_day_arr)), 4),
        "observed_baseline_mae": round(float(np.mean(base_day_arr)), 4),
        "observed_delta_mae": round(observed_delta, 4),
        "bootstrap_mean_delta": round(float(np.mean(boot_deltas)), 4),
        "bootstrap_std_err": round(float(np.std(boot_deltas)), 4),
        "ci_95_lower": round(ci_lower, 4),
        "ci_95_upper": round(ci_upper, 4),
        "p_value": round(p_val, 4),
        "is_significant": is_improved,
        "significance_declaration": (
            "STATISTICALLY_SIGNIFICANT_IMPROVEMENT" if is_improved else "NO_STATISTICAL_IMPROVEMENT"
        )
    }
