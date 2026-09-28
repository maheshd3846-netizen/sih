"""
Base Variable Handler Specification for SIH26081 Meteorological Architecture.
Defines abstract interface for multi-variable ingestion, unit conversion,
and strict physical Quality Control (QC).
"""
from abc import ABC, abstractmethod
from typing import Tuple, Optional, Any, Dict
import numpy as np


class VariableHandler(ABC):
    """Abstract base class for all meteorological forecast variables."""

    @property
    @abstractmethod
    def variable_id(self) -> str:
        """Unique variable identifier (e.g. 'precipitation', 'temperature', 'wind')."""
        pass

    @property
    @abstractmethod
    def standard_unit(self) -> str:
        """Standardized unit string (e.g. 'mm', '°C', 'km/h')."""
        pass

    @property
    @abstractmethod
    def valid_range(self) -> Tuple[float, float]:
        """Physical plausible range (min_val, max_val) for Quality Control."""
        pass

    @abstractmethod
    def convert_gfs(self, raw_values: np.ndarray) -> np.ndarray:
        """Convert raw NOAA GFS values to standard units."""
        pass

    @abstractmethod
    def convert_ecmwf(self, raw_values: np.ndarray) -> np.ndarray:
        """Convert raw ECMWF IFS values to standard units."""
        pass

    def validate_qc(self, data: np.ndarray, allow_nan: bool = True) -> Tuple[bool, Optional[str]]:
        """
        Perform strict numerical Quality Control against physical bounds.
        Returns (is_valid, error_message).
        """
        arr = np.asarray(data, dtype=float)
        if not allow_nan and np.isnan(arr).any():
            return False, f"Variable {self.variable_id} contains unexpected NaN values."

        valid_vals = arr[~np.isnan(arr)]
        if len(valid_vals) == 0:
            return True, None

        min_bound, max_bound = self.valid_range
        if np.any(valid_vals < min_bound):
            min_found = float(np.min(valid_vals))
            return False, f"Variable {self.variable_id} below lower QC bound {min_bound}: found {min_found}"
        if np.any(valid_vals > max_bound):
            max_found = float(np.max(valid_vals))
            return False, f"Variable {self.variable_id} exceeds upper QC bound {max_bound}: found {max_found}"

        return True, None
