"""
Geographical & Spatial Coordinate Utilities for SIH26081
Handles IMD and NOAA GFS coordinate definitions, bounding boxes, and grid indices.
"""
from typing import Tuple, Dict, Any
import numpy as np

# IMD 0.25 Degree Specifications (Pai et al. 2014)
IMD_LAT_START = 6.5
IMD_LAT_END = 38.5
IMD_LAT_STEPS = 129
IMD_LON_START = 66.5
IMD_LON_END = 100.0
IMD_LON_STEPS = 135
IMD_RESOLUTION = 0.25

# NOAA GFS 0.25 Degree Specifications
GFS_LAT_START = 90.0
GFS_LAT_END = -90.0
GFS_LAT_STEPS = 721
GFS_LON_START = 0.0
GFS_LON_END = 359.75
GFS_LON_STEPS = 1440
GFS_RESOLUTION = 0.25

def get_imd_coords() -> Tuple[np.ndarray, np.ndarray]:
    """Returns (lats, lons) for IMD 0.25 grid."""
    lats = np.linspace(IMD_LAT_START, IMD_LAT_END, IMD_LAT_STEPS, dtype=np.float32)
    lons = np.linspace(IMD_LON_START, IMD_LON_END, IMD_LON_STEPS, dtype=np.float32)
    return lats, lons

def get_gfs_coords() -> Tuple[np.ndarray, np.ndarray]:
    """Returns (lats, lons) for GFS 0.25 grid."""
    lats = np.linspace(GFS_LAT_START, GFS_LAT_END, GFS_LAT_STEPS, dtype=np.float32)
    lons = np.linspace(GFS_LON_START, GFS_LON_END, GFS_LON_STEPS, dtype=np.float32)
    return lats, lons

def get_domain_coords(
    lat_min: float = 12.0,
    lat_max: float = 20.0,
    lon_min: float = 76.0,
    lon_max: float = 85.0,
    res: float = 0.25
) -> Tuple[np.ndarray, np.ndarray]:
    """
    Returns coordinate arrays for the experimental domain.
    Coordinates are regular multiples of res.
    """
    n_lat = int(round((lat_max - lat_min) / res)) + 1
    n_lon = int(round((lon_max - lon_min) / res)) + 1
    lats = np.linspace(lat_min, lat_max, n_lat, dtype=np.float32)
    lons = np.linspace(lon_min, lon_max, n_lon, dtype=np.float32)
    return lats, lons
