"""
Spatial Feature Engineering for 791 Terrestrial Grid Cells.
Assigns subregions, coordinates, and spatial boundaries.
"""
from typing import Dict, Any, Tuple
import pandas as pd
import numpy as np

# Subregion bounding rules calibrated for AP + Telangana experimental domain
def assign_subregion(lat: float, lon: float) -> str:
    """
    Classify a grid coordinate into meteorological subregions:
    - Coastal Andhra Pradesh
    - Rayalaseema
    - Telangana
    - Border / Western Ghats / Northern fringe
    """
    if lon >= 80.5 and lat <= 19.0:
        return "Coastal Andhra Pradesh"
    elif lat < 15.5 and lon < 80.0:
        return "Rayalaseema"
    elif lat >= 15.5 and lon < 80.5:
        return "Telangana"
    else:
        return "Border / Ghats"

def add_spatial_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    Append spatial features to a DataFrame containing 'lat' and 'lon'.
    """
    df = df.copy()
    if "subregion" not in df.columns:
        df["subregion"] = [assign_subregion(row["lat"], row["lon"]) for _, row in df.iterrows()]
    
    # Normalized spatial coordinates [0, 1] relative to domain 12-20N, 76-85E
    df["norm_lat"] = (df["lat"] - 12.0) / (20.0 - 12.0)
    df["norm_lon"] = (df["lon"] - 76.0) / (85.0 - 76.0)
    return df
