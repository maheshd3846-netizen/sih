"""
Verification package for SIH26081 Meteorological Architecture.
Contains alignment tools, statistical metrics, paired block bootstrap tests, and acceptance gates.
"""
from src.verification.metrics import (
    calculate_mae,
    calculate_rmse,
    calculate_mean_bias,
    compute_all_metrics,
    compute_contingency_metrics,
)
from src.verification.bootstrap import paired_day_level_bootstrap
from src.verification.acceptance_gate import StatisticalAcceptanceGate

__all__ = [
    "calculate_mae",
    "calculate_rmse",
    "calculate_mean_bias",
    "compute_all_metrics",
    "compute_contingency_metrics",
    "paired_day_level_bootstrap",
    "StatisticalAcceptanceGate",
]
