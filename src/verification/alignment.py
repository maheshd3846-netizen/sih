"""
Deterministic Temporal & Spatial Alignment Module for SIH26081
Aligns GFS forecast cycles and lead times with corresponding IMD daily observation grids.
"""
from datetime import datetime, timedelta, date
from typing import Tuple, Dict, Any
import numpy as np
import xarray as xr
from src.utils.logger import setup_logger

logger = setup_logger("Alignment")

def derive_valid_time(init_time: datetime, lead_hours: int) -> datetime:
    """
    Derives the forecast valid time programmatically:
    valid_time = init_time + lead_hours
    """
    if lead_hours < 0:
        raise ValueError("Lead hours must be non-negative.")
    return init_time + timedelta(hours=lead_hours)

def map_forecast_to_imd_observation_date(init_time: datetime, lead_hours: int) -> date:
    """
    Maps a GFS forecast cycle and lead time to the corresponding IMD daily observation record date.
    
    Standard IMD rainfall is recorded at 08:30 IST for the previous 24 hours.
    For a 00 UTC run with 24-hour lead time, the 24-hour accumulation valid at
    init_time + 24 hours (ending at 00 UTC on Day D+1) corresponds operationally
    to the IMD observation labeled Day D+1 (87.5% temporal overlap).
    """
    valid_dt = derive_valid_time(init_time, lead_hours)
    return valid_dt.date()

def spatial_coordinate_check(gfs_da: xr.DataArray, imd_da: xr.DataArray, tolerance: float = 1e-4) -> bool:
    """
    Verifies whether GFS and IMD coordinates match directly without interpolation.
    """
    gfs_lats = gfs_da.coords["lat"].values
    imd_lats = imd_da.coords["lat"].values
    gfs_lons = gfs_da.coords["lon"].values
    imd_lons = imd_da.coords["lon"].values

    if len(gfs_lats) != len(imd_lats) or len(gfs_lons) != len(imd_lons):
        return False

    lats_match = np.allclose(gfs_lats, imd_lats, atol=tolerance)
    lons_match = np.allclose(gfs_lons, imd_lons, atol=tolerance)

    return lats_match and lons_match

def align_forecast_and_observation(
    gfs_da: xr.DataArray,
    imd_da: xr.DataArray
) -> xr.Dataset:
    """
    Aligns GFS forecast and IMD observation fields into a single canonical Dataset.
    Performs direct coordinate matching.
    """
    if not spatial_coordinate_check(gfs_da, imd_da):
        # Perform exact index alignment on shared coordinates
        common_lats = np.intersect1d(
            np.round(gfs_da.lat.values, 4),
            np.round(imd_da.lat.values, 4)
        )
        common_lons = np.intersect1d(
            np.round(gfs_da.lon.values, 4),
            np.round(imd_da.lon.values, 4)
        )
        if len(common_lats) == 0 or len(common_lons) == 0:
            raise ValueError("No common spatial coordinates found between GFS and IMD grids.")
        
        gfs_subset = gfs_da.sel(lat=common_lats, lon=common_lons)
        imd_subset = imd_da.sel(lat=common_lats, lon=common_lons)
    else:
        gfs_subset = gfs_da
        imd_subset = imd_da

    ds = xr.Dataset(
        data_vars={
            "gfs_precipitation": (["lat", "lon"], gfs_subset.values),
            "imd_precipitation": (["lat", "lon"], imd_subset.values)
        },
        coords={
            "lat": imd_subset.lat.values,
            "lon": imd_subset.lon.values
        },
        attrs={
            "description": "Aligned GFS Forecast vs IMD Observation Grid",
            "gfs_units": "mm",
            "imd_units": "mm"
        }
    )
    return ds
