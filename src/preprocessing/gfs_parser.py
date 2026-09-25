"""
NOAA GFS GRIB2 Forecast Parser
Extracts accumulated precipitation from GRIB2 files into standard xarray DataArrays.
Uses eccodes library.
"""
import os
import eccodes
import numpy as np
import xarray as xr
from typing import Optional, Tuple
from src.utils.geo import get_gfs_coords
from src.utils.logger import setup_logger

logger = setup_logger("GFS_Parser")

def parse_gfs_apcp_grib2(
    grib_file: str,
    bounding_box: Optional[Tuple[float, float, float, float]] = None
) -> xr.DataArray:
    """
    Parses a 24-hour APCP GRIB2 slice file from NOAA GFS.
    
    Args:
        grib_file: Path to GRIB2 file
        bounding_box: Optional (lat_min, lat_max, lon_min, lon_max)
        
    Returns:
        xr.DataArray with coords ('lat', 'lon') and values in mm.
        Latitude is normalized to monotonically increasing.
    """
    if not os.path.exists(grib_file):
        raise FileNotFoundError(f"GFS GRIB2 file not found: {grib_file}")

    with open(grib_file, "rb") as f:
        gid = eccodes.codes_grib_new_from_file(f)
        if gid is None:
            raise ValueError(f"Could not read GRIB2 message from {grib_file}")
        
        try:
            short_name = eccodes.codes_get(gid, "shortName")
            units = eccodes.codes_get(gid, "units")
            init_date = eccodes.codes_get(gid, "dataDate")
            init_time = eccodes.codes_get(gid, "dataTime")
            step_range = eccodes.codes_get(gid, "stepRange")
            ni = eccodes.codes_get(gid, "Ni")
            nj = eccodes.codes_get(gid, "Nj")
            
            raw_vals = eccodes.codes_get_values(gid)
        finally:
            eccodes.codes_release(gid)

    if len(raw_vals) != ni * nj:
        raise ValueError(f"Expected {ni * nj} values, got {len(raw_vals)}")

    # GFS GRIB2 grid is 721 (lat, 90 to -90) x 1440 (lon, 0 to 359.75)
    grid = raw_vals.reshape((nj, ni)).copy()
    
    raw_lats, raw_lons = get_gfs_coords()

    # Invert latitude axis so coordinates are monotonically increasing (-90 to +90)
    grid_flipped = np.flipud(grid)
    lats_ascending = np.flip(raw_lats)

    da = xr.DataArray(
        data=grid_flipped,
        dims=["lat", "lon"],
        coords={
            "lat": lats_ascending,
            "lon": raw_lons
        },
        attrs={
            "standard_name": "precipitation_amount",
            "long_name": "GFS Total Accumulated Precipitation",
            "units": "mm", # kg m**-2 is numerically identical to mm of water
            "gfs_init_date": str(init_date),
            "gfs_init_time": str(init_time),
            "step_range": str(step_range)
        }
    )

    if bounding_box is not None:
        lat_min, lat_max, lon_min, lon_max = bounding_box
        da = da.sel(
            lat=slice(lat_min, lat_max),
            lon=slice(lon_min, lon_max)
        )

    return da
