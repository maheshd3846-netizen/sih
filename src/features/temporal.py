"""
Temporal & Season Feature Engineering.
Encodes lead time, day of year, cyclic seasonal signals, and meteorological seasons.
"""
from typing import Dict, Any, Union
from datetime import date, datetime
import pandas as pd
import numpy as np


def get_meteorological_season(target_date: Union[date, datetime]) -> str:
    """
    Returns standard India Meteorological Department (IMD) season:
    - Winter: Jan - Feb
    - Pre-Monsoon / Summer: Mar - May
    - Southwest Monsoon: Jun - Sep
    - Post-Monsoon / NE Monsoon: Oct - Dec
    """
    month = target_date.month
    if month in [1, 2]:
        return "Winter"
    elif month in [3, 4, 5]:
        return "Pre-Monsoon"
    elif month in [6, 7, 8, 9]:
        return "Southwest Monsoon"
    else:
        return "Post-Monsoon"


def add_temporal_features(df: pd.DataFrame, date_col: str = "forecast_day", lead_col: str = "lead_hours") -> pd.DataFrame:
    """
    Appends cyclic temporal, seasonal, and lead-time features to DataFrame.
    """
    df = df.copy()
    dates = pd.to_datetime(df[date_col])
    
    # Day of year [1, 366]
    doy = dates.dt.dayofyear
    df["doy_sin"] = np.sin(2.0 * np.pi * doy / 365.25)
    df["doy_cos"] = np.cos(2.0 * np.pi * doy / 365.25)
    
    # Month
    df["month"] = dates.dt.month
    
    # IMD Meteorological season
    df["season"] = [get_meteorological_season(d) for d in dates]
    
    # Lead time encoding (normalized by 72 hours)
    if lead_col in df.columns:
        df["norm_lead"] = df[lead_col].astype(float) / 72.0
    else:
        df["norm_lead"] = 24.0 / 72.0
        
    return df
