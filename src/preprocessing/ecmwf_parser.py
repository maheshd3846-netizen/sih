"""
ECMWF IFS GRIB2 Forecast Parser
Extracts accumulated precipitation from ECMWF IFS GRIB2 slice files into standard xarray DataArrays.
Validates units with ecCodes and converts metres to millimetres.
"""
import os
import sys

project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

import eccodes
import numpy as np
import xarray as xr
from typing import Optional, Tuple
from src.utils.logger import setup_logger

logger = setup_logger("ECMWF_Parser")

def parse_ecmwf_tp_grib2(
    grib_file: str,
    bounding_box: Optional[Tuple[float, float, float, float]] = None
) -> xr.DataArray:
    """
    Parses a 24-hour Total Precipitation GRIB2 slice file from ECMWF IFS.
    
    Args:
        grib_file: Path to ECMWF GRIB2 slice file
        bounding_box: Optional (lat_min, lat_max, lon_min, lon_max)
        
    Returns:
        xr.DataArray with coords ('lat', 'lon') and values in mm.
        Latitudes and longitudes are monotonically increasing and co-located with IMD/GFS.
    """
    if not os.path.exists(grib_file):
        raise FileNotFoundError(f"ECMWF GRIB2 file not found: {grib_file}")

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
            lat1 = eccodes.codes_get(gid, "latitudeOfFirstGridPointInDegrees")
            lat2 = eccodes.codes_get(gid, "latitudeOfLastGridPointInDegrees")
            lon1 = eccodes.codes_get(gid, "longitudeOfFirstGridPointInDegrees")
            dx = eccodes.codes_get(gid, "iDirectionIncrementInDegrees")
            dy = eccodes.codes_get(gid, "jDirectionIncrementInDegrees")
            
            raw_vals = eccodes.codes_get_values(gid)
        finally:
            eccodes.codes_release(gid)

    if len(raw_vals) != ni * nj:
        raise ValueError(f"Expected {ni * nj} values, got {len(raw_vals)}")

    # 1. Grid coordinates:
    # Latitude: descending from lat1 (+90) to lat2 (-90)
    raw_lats = lat1 - np.arange(nj, dtype=np.float32) * dy
    # Longitude: ECMWF starts at lon1 (180.0) with step dx (0.25)
    raw_lons = (lon1 + np.arange(ni, dtype=np.float32) * dx) % 360.0

    # 2. Reshape into 2D grid (nj, ni) -> (lat, lon)
    grid = raw_vals.reshape((nj, ni)).copy()

    # 3. Unit conversion: ECMWF Total Precipitation is in metres ('m')
    if units == "m":
        grid = grid * 1000.0  # Convert metres to millimetres
    elif units in ["kg m**-2", "mm"]:
        pass  # Already in mm equivalent
    else:
        logger.warning(f"Unexpected ECMWF precipitation unit '{units}'. Assuming metres.")
        grid = grid * 1000.0

    # 4. Sort longitudes into strictly increasing [0.0, 359.75]
    lon_sort_idx = np.argsort(raw_lons)
    lons_sorted = raw_lons[lon_sort_idx]
    grid_sorted_lon = grid[:, lon_sort_idx]

    # 5. Invert latitude axis so coordinates are monotonically increasing [-90.0, +90.0]
    grid_ascending_lat = np.flipud(grid_sorted_lon)
    lats_ascending = np.flip(raw_lats)

    da = xr.DataArray(
        data=grid_ascending_lat,
        dims=["lat", "lon"],
        coords={
            "lat": lats_ascending,
            "lon": lons_sorted
        },
        attrs={
            "standard_name": "precipitation_amount",
            "long_name": "ECMWF IFS Total Precipitation",
            "units": "mm",
            "raw_units": units,
            "ecmwf_init_date": str(init_date),
            "ecmwf_init_time": str(init_time),
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
