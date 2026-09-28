"""
Explicit Statistical Acceptance Gate.
Certifies whether a dynamically blended candidate model achieves statistically
significant improvement over the reference baseline on an unseen held-out test set.
If improvement is not demonstrated, enforces honest reporting and preserves the baseline.
"""
from typing import Dict, Any, List
import pandas as pd
from src.verification.metrics import compute_all_metrics, compute_contingency_metrics
from src.verification.bootstrap import paired_day_level_bootstrap


class StatisticalAcceptanceGate:
    """
    Enforces scientific integrity on candidate model claims.
    Gate Rule:
    Candidate is certified as 'SKILL_IMPROVED' if and only if:
    1. Out-of-sample Delta MAE < 0 (lower absolute error).
    2. Bootstrap p-value < 0.05 (two-tailed significance).
    3. 95% Confidence Interval Upper Bound < 0.
    
    Otherwise:
    Declares 'BASELINE_RETAINED', preserves baseline as champion, and forbids
    unsubstantiated claims of model superiority.
    """

    @staticmethod
    def audit_candidate_against_baselines(
        test_df: pd.DataFrame,
        candidate_col: str,
        baseline_col: str = "model3_ensemble_50_50",
        gfs_col: str = "gfs",
        ecmwf_col: str = "ecmwf",
        obs_col: str = "imd",
        variable_name: str = "precipitation",
        lead_hours: int = 24,
        extreme_threshold: float = 64.5,
        n_bootstrap: int = 2000
    ) -> Dict[str, Any]:
        """
        Run complete four-way evaluation (GFS, ECMWF, 50/50 Baseline, Candidate Blend)
        and apply the strict acceptance gate.
        """
        # 1. Standard metrics for all four models
        m_gfs = compute_all_metrics(test_df[gfs_col], test_df[obs_col])
        m_ec = compute_all_metrics(test_df[ecmwf_col], test_df[obs_col])
        m_base = compute_all_metrics(test_df[baseline_col], test_df[obs_col])
        m_cand = compute_all_metrics(test_df[candidate_col], test_df[obs_col])

        # 2. Extreme event contingency metrics
        c_gfs = compute_contingency_metrics(test_df[gfs_col], test_df[obs_col], extreme_threshold)
        c_ec = compute_contingency_metrics(test_df[ecmwf_col], test_df[obs_col], extreme_threshold)
        c_base = compute_contingency_metrics(test_df[baseline_col], test_df[obs_col], extreme_threshold)
        c_cand = compute_contingency_metrics(test_df[candidate_col], test_df[obs_col], extreme_threshold)

        # 3. Paired block bootstrap test
        boot_res = paired_day_level_bootstrap(
            eval_df=test_df,
            pred_col_candidate=candidate_col,
            pred_col_baseline=baseline_col,
            obs_col=obs_col,
            n_iterations=n_bootstrap
        )

        is_certified = bool(boot_res.get("is_significant", False))

        if is_certified:
            verdict = "SKILL_IMPROVED_CERTIFIED"
            champion_model = candidate_col
            rationale = (
                f"Candidate demonstrated statistically significant error reduction on held-out test data "
                f"(Delta MAE: {boot_res['observed_delta_mae']} mm, p-value: {boot_res['p_value']}, "
                f"95% CI: [{boot_res['ci_95_lower']}, {boot_res['ci_95_upper']}])."
            )
        else:
            verdict = "BASELINE_RETAINED_HONEST_DISCLOSURE"
            champion_model = baseline_col
            rationale = (
                f"Candidate dynamic blend did not demonstrate statistically significant improvement over "
                f"50/50 equal-weight baseline (Delta MAE: {boot_res['observed_delta_mae']} mm, "
                f"p-value: {boot_res['p_value']}, 95% CI: [{boot_res['ci_95_lower']}, {boot_res['ci_95_upper']}]). "
                f"Per scientific protocol, the baseline is preserved as the operational reference model."
            )

        return {
            "acceptance_status": verdict,
            "champion_model": champion_model,
            "scientific_rationale": rationale,
            "variable": variable_name,
            "lead_hours": lead_hours,
            "total_test_samples": len(test_df),
            "benchmark_comparison": {
                "NOAA_GFS": {"metrics": m_gfs, "contingency": c_gfs},
                "ECMWF_IFS": {"metrics": m_ec, "contingency": c_ec},
                "Baseline_50_50": {"metrics": m_base, "contingency": c_base},
                "Candidate_Dynamic_Blend": {"metrics": m_cand, "contingency": c_cand},
            },
            "paired_bootstrap_audit": boot_res
        }
