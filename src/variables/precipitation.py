"""
Precipitation Variable Handler.
Ingests GFS APCP (kg/m² -> mm) and ECMWF tp (m -> mm).
Enforces physical non-negativity and upper flood bounds [0.0, 1500.0 mm].
"""
from typing import Tuple
import numpy as np
from src.variables.base import VariableHandler


class PrecipitationHandler(VariableHandler):
    @property
    def variable_id(self) -> str:
        return "precipitation"

    @property
    def standard_unit(self) -> str:
        return "mm"

    @property
    def valid_range(self) -> Tuple[float, float]:
        # Minimum: 0.0 mm (cannot rain negative)
        # Maximum: 1500.0 mm (world record 24h rainfall is ~1825mm, Cherrapunji/Reunion)
        return (0.0, 1500.0)

    def convert_gfs(self, raw_values: np.ndarray) -> np.ndarray:
        """
        GFS APCP is reported in kg m**-2.
        For liquid water with density 1000 kg/m³, 1 kg/m² = 1 mm.
        Clip tiny negative floating point artifacts to 0.0.
        """
        arr = np.asarray(raw_values, dtype=float)
        return np.where(np.isnan(arr), np.nan, np.maximum(arr, 0.0))

    def convert_ecmwf(self, raw_values: np.ndarray) -> np.ndarray:
        """
        ECMWF tp is reported in meters (m).
        Convert to millimeters by multiplying by 1000.0.
        Clip tiny negative floating point artifacts to 0.0.
        """
        arr = np.asarray(raw_values, dtype=float) * 1000.0
        return np.where(np.isnan(arr), np.nan, np.maximum(arr, 0.0))
