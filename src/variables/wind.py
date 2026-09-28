"""
10-Metre Wind Speed and Surface Gust Variable Handler.
Ingests U/V wind vectors (m/s -> km/h or scalar speed) and wind gusts.
Computes vector wind speed: W = sqrt(u^2 + v^2).
Enforces physical non-negativity and cyclone bounds [0.0, 300.0 km/h].
"""
from typing import Tuple, Dict, Any, Union
import numpy as np
from src.variables.base import VariableHandler

MS_TO_KMH = 3.6


class WindHandler(VariableHandler):
    @property
    def variable_id(self) -> str:
        return "wind"

    @property
    def standard_unit(self) -> str:
        return "km/h"

    @property
    def valid_range(self) -> Tuple[float, float]:
        # Minimum: 0.0 km/h (calm)
        # Maximum: 300.0 km/h (Category 5 Super Cyclone peak gusts ~280-300 km/h)
        return (0.0, 300.0)

    def convert_gfs(self, raw_values: np.ndarray) -> np.ndarray:
        """
        Convert GFS wind speed or gust from m/s to km/h.
        """
        arr = np.asarray(raw_values, dtype=float)
        return np.where(np.isnan(arr), np.nan, np.maximum(arr * MS_TO_KMH, 0.0))

    def convert_ecmwf(self, raw_values: np.ndarray) -> np.ndarray:
        """
        Convert ECMWF wind speed or gust from m/s to km/h.
        """
        arr = np.asarray(raw_values, dtype=float)
        return np.where(np.isnan(arr), np.nan, np.maximum(arr * MS_TO_KMH, 0.0))

    @staticmethod
    def compute_speed_from_uv(u: np.ndarray, v: np.ndarray, to_kmh: bool = True) -> np.ndarray:
        """
        Compute scalar wind speed from orthogonal zonal (u) and meridional (v) wind components.
        W = sqrt(u^2 + v^2)
        """
        u_arr = np.asarray(u, dtype=float)
        v_arr = np.asarray(v, dtype=float)
        speed = np.sqrt(u_arr**2 + v_arr**2)
        if to_kmh:
            speed = speed * MS_TO_KMH
        return speed

    @staticmethod
    def compute_direction_degrees(u: np.ndarray, v: np.ndarray) -> np.ndarray:
        """
        Compute meteorological wind direction (degrees FROM which the wind is blowing, 0=North, 90=East, 180=South, 270=West).
        """
        u_arr = np.asarray(u, dtype=float)
        v_arr = np.asarray(v, dtype=float)
        # Meteorological direction: 180 + (180/pi)*atan2(-u, -v) mod 360
        direction = (270.0 - np.rad2deg(np.arctan2(v_arr, u_arr))) % 360.0
        return direction
