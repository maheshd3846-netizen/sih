"""
Unit Tests for Strict Causal Information Boundaries and Temporal Validation.
"""
import pytest
from datetime import date, timedelta
import pandas as pd
import numpy as np

from src.features.historical_skill import compute_causal_rolling_skill
from src.features.temporal import get_meteorological_season, add_temporal_features


def test_causal_lookback_cutoff_and_no_leakage():
    # Construct synthetic history ending at 2024-07-15
    dates = pd.date_range("2024-07-01", "2024-07-15").date
    rows = []
    for d in dates:
        rows.append({
            "obs_date": d,
            "gfs": 10.0,
            "ecmwf": 12.0,
            "imd": 11.0,
            "subregion": "Telangana"
        })
    df_hist = pd.DataFrame(rows)

    # Forecast issued for 2024-07-15
    # Strict cutoff: T - 1 = 2024-07-14. Observation for 2024-07-15 must NOT be accessed!
    forecast_d = date(2024, 7, 15)
    res = compute_causal_rolling_skill(
        history_df=df_hist,
        forecast_date=forecast_d,
        window_days=5,
        gfs_col="gfs",
        ecmwf_col="ecmwf",
        obs_col="imd",
        date_col="obs_date"
    )

    assert res["cutoff_date"] == "2024-07-14"
    assert res["sample_count"] == 5 # 2024-07-10 to 2024-07-14


def test_leakage_assertion_raises_if_future_obs_included():
    # Inject an observation strictly on or after forecast date
    df_leak = pd.DataFrame([
        {"obs_date": date(2024, 7, 15), "gfs": 10.0, "ecmwf": 12.0, "imd": 11.0, "subregion": "Telangana"},
        {"obs_date": date(2024, 7, 16), "gfs": 10.0, "ecmwf": 12.0, "imd": 11.0, "subregion": "Telangana"},
    ])
    # Cutoff for 2024-07-15 is 2024-07-14.
    # When filtering properly, df_leak produces 0 valid rows
    res = compute_causal_rolling_skill(
        history_df=df_leak,
        forecast_date=date(2024, 7, 15),
        window_days=5
    )
    # Returns safe fallback count 0
    assert res["sample_count"] == 0


def test_meteorological_season_classification():
    assert get_meteorological_season(date(2024, 1, 15)) == "Winter"
    assert get_meteorological_season(date(2024, 4, 10)) == "Pre-Monsoon"
    assert get_meteorological_season(date(2024, 7, 20)) == "Southwest Monsoon"
    assert get_meteorological_season(date(2024, 11, 5)) == "Post-Monsoon"
