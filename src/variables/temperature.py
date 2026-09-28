"""
2-Metre Air Temperature Variable Handler.
Ingests GFS TMP:2m (Kelvin -> Celsius) and ECMWF 2t (Kelvin -> Celsius).
Enforces meteorological bounds [-10.0°C, 60.0°C] for peninsular India.
"""
from typing import Tuple
import numpy as np
from src.variables.base import VariableHandler

KELVIN_ZERO_CELSIUS = 273.15


class TemperatureHandler(VariableHandler):
    @property
    def variable_id(self) -> str:
        return "temperature"

    @property
    def standard_unit(self) -> str:
        return "°C"

    @property
    def valid_range(self) -> Tuple[float, float]:
        # Minimum: -10.0 °C (Lambasingi/Eastern Ghats lowest ~0°C to 1.5°C)
        # Maximum: 60.0 °C (Highest recorded in India is 51.0°C Phalodi, Rajasthan)
        return (-10.0, 60.0)

    def convert_gfs(self, raw_values: np.ndarray) -> np.ndarray:
        """
        GFS TMP:2m is in Kelvin.
        Convert to Celsius: C = K - 273.15.
        """
        arr = np.asarray(raw_values, dtype=float)
        # If already in Celsius (< 100), preserve; otherwise subtract 273.15
        is_kelvin = arr > 100.0
        celsius = np.where(is_kelvin, arr - KELVIN_ZERO_CELSIUS, arr)
        return celsius

    def convert_ecmwf(self, raw_values: np.ndarray) -> np.ndarray:
        """
        ECMWF 2t is in Kelvin.
        Convert to Celsius: C = K - 273.15.
        """
        arr = np.asarray(raw_values, dtype=float)
        is_kelvin = arr > 100.0
        celsius = np.where(is_kelvin, arr - KELVIN_ZERO_CELSIUS, arr)
        return celsius
