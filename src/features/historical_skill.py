"""
Causal Historical Skill Feature Engineering.
Computes rolling model MAE, RMSE, and error metrics strictly using historical
observations available before forecast issuance time T (obs_date <= T - 1).
Strictly zero future observation leakage.
"""
from typing import Dict, Any, Tuple, Optional
from datetime import date, timedelta
import pandas as pd
import numpy as np


def compute_causal_rolling_skill(
    history_df: pd.DataFrame,
    forecast_date: date,
    window_days: int = 5,
    gfs_col: str = "gfs",
    ecmwf_col: str = "ecmwf",
    obs_col: str = "imd",
    date_col: str = "obs_date",
    subregion: Optional[str] = None
) -> Dict[str, float]:
    """
    Computes rolling performance metrics for GFS and ECMWF over a lookback window
    strictly prior to forecast issuance date.
    
    Cutoff Rule:
    For forecast initialized on forecast_date T:
    Latest observation allowed is T - 1 day.
    Window span: [T - window_days, T - 1].
    
    If no observations exist in window, returns neutral default values.
    """
    latest_allowed_obs = forecast_date - timedelta(days=1)
    earliest_obs = latest_allowed_obs - timedelta(days=window_days - 1)
    
    # Enforce strict causal filter
    mask = (
        (history_df[date_col] >= earliest_obs) &
        (history_df[date_col] <= latest_allowed_obs) &
        (~history_df[obs_col].isna()) &
        (~history_df[gfs_col].isna()) &
        (~history_df[ecmwf_col].isna())
    )
    if subregion is not None and "subregion" in history_df.columns:
        mask = mask & (history_df["subregion"] == subregion)
        
    window_data = history_df[mask]
    
    # Assert zero future leakage
    if not window_data.empty:
        max_obs_found = window_data[date_col].max()
        if isinstance(max_obs_found, pd.Timestamp):
            max_obs_found = max_obs_found.date()
        assert max_obs_found <= latest_allowed_obs, (
            f"LEAKAGE DETECTED: Observation date {max_obs_found} > cutoff {latest_allowed_obs}"
        )
        
    if len(window_data) < 10:
        # Insufficient history; return neutral fallback
        return {
            "gfs_rolling_mae": 1.0,
            "ecmwf_rolling_mae": 1.0,
            "gfs_rolling_rmse": 1.0,
            "ecmwf_rolling_rmse": 1.0,
            "sample_count": len(window_data),
            "cutoff_date": latest_allowed_obs.isoformat()
        }
        
    gfs_err = window_data[gfs_col].values - window_data[obs_col].values
    ecmwf_err = window_data[ecmwf_col].values - window_data[obs_col].values
    
    gfs_mae = float(np.mean(np.abs(gfs_err)))
    ecmwf_mae = float(np.mean(np.abs(ecmwf_err)))
    gfs_rmse = float(np.sqrt(np.mean(gfs_err**2)))
    ecmwf_rmse = float(np.sqrt(np.mean(ecmwf_err**2)))
    
    return {
        "gfs_rolling_mae": gfs_mae,
        "ecmwf_rolling_mae": ecmwf_mae,
        "gfs_rolling_rmse": gfs_rmse,
        "ecmwf_rolling_rmse": ecmwf_rmse,
        "sample_count": len(window_data),
        "cutoff_date": latest_allowed_obs.isoformat()
    }
