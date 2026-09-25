"""
IMD Binary Gridded Rainfall Parser
Extracts daily rainfall grids from IMD unformatted binary files into xarray DataArrays.
"""
import os
from datetime import date
import numpy as np
import xarray as xr
from typing import Optional, Tuple
from src.utils.geo import (
    IMD_LAT_START, IMD_LAT_END, IMD_LAT_STEPS,
    IMD_LON_START, IMD_LON_END, IMD_LON_STEPS,
    get_imd_coords
)
from src.utils.logger import setup_logger

logger = setup_logger("IMD_Parser")

def parse_imd_date(
    grd_file: str,
    target_date: date,
    bounding_box: Optional[Tuple[float, float, float, float]] = None
) -> xr.DataArray:
    """
    Parses a single day from an IMD annual binary rainfall file.
    
    Args:
        grd_file: Path to indYYYY_rfp25.grd
        target_date: Target date to extract
        bounding_box: Optional (lat_min, lat_max, lon_min, lon_max)
        
    Returns:
        xr.DataArray with coords ('lat', 'lon') and rainfall values in mm (NaN for missing).
    """
    if not os.path.exists(grd_file):
        raise FileNotFoundError(f"IMD file not found: {grd_file}")

    year = target_date.year
    d0 = date(year, 1, 1)
    day_idx = (target_date - d0).days

    is_leap = (year % 4 == 0 and year % 100 != 0) or (year % 400 == 0)
    total_days = 366 if is_leap else 365

    if day_idx < 0 or day_idx >= total_days:
        raise ValueError(f"Date {target_date} out of range for year {year} ({total_days} days)")

    points_per_day = IMD_LAT_STEPS * IMD_LON_STEPS
    offset_bytes = day_idx * points_per_day * 4

    with open(grd_file, "rb") as f:
        f.seek(offset_bytes)
        raw_bytes = f.read(points_per_day * 4)

    raw_arr = np.frombuffer(raw_bytes, dtype="<f4")
    if len(raw_arr) != points_per_day:
        raise ValueError(f"Expected {points_per_day} points, read {len(raw_arr)}")

    # Shape: (129, 135) -> (latitude, longitude)
    grid = raw_arr.reshape((IMD_LAT_STEPS, IMD_LON_STEPS)).copy()

    # Mask missing points (-999.0) to NaN
    grid[grid == -999.0] = np.nan
    # Mask any negative artifacts
    grid[grid < 0.0] = np.nan

    lats, lons = get_imd_coords()

    da = xr.DataArray(
        data=grid,
        dims=["lat", "lon"],
        coords={
            "lat": lats,
            "lon": lons
        },
        attrs={
            "standard_name": "precipitation_amount",
            "long_name": "IMD Daily Gridded Rainfall",
            "units": "mm",
            "observation_date": target_date.isoformat(),
            "accumulation_period": "24 hours ending 08:30 IST"
        }
    )

    if bounding_box is not None:
        lat_min, lat_max, lon_min, lon_max = bounding_box
        da = da.sel(
            lat=slice(lat_min, lat_max),
            lon=slice(lon_min, lon_max)
        )

    return da
