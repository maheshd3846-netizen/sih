"""
Weather Regime Feature Classification.
Classifies forecast conditions into meteorological regimes for:
- Precipitation (Dry, Light, Moderate, Heavy)
- Temperature (Normal, High, Extreme Heat)
- Wind (Light, Moderate, High/Squall)
"""
from typing import Union, List
import numpy as np
import pandas as pd


def classify_precipitation_regime(precip_mm: Union[float, np.ndarray]) -> Union[str, np.ndarray]:
    """
    Classify precipitation forecast into physical regimes:
    - Dry: < 0.1 mm
    - Light: 0.1 to < 5.0 mm
    - Moderate: 5.0 to < 15.0 mm
    - Heavy: >= 15.0 mm
    """
    if isinstance(precip_mm, (int, float)):
        val = float(precip_mm)
        if val < 0.1:
            return "Dry (<0.1mm)"
        elif val < 5.0:
            return "Light (0.1-5mm)"
        elif val < 15.0:
            return "Moderate (5-15mm)"
        else:
            return "Heavy (>=15mm)"
            
    arr = np.asarray(precip_mm, dtype=float)
    regimes = np.where(arr < 0.1, "Dry (<0.1mm)",
              np.where(arr < 5.0, "Light (0.1-5mm)",
              np.where(arr < 15.0, "Moderate (5-15mm)", "Heavy (>=15mm)")))
    return regimes


def classify_temperature_regime(temp_c: Union[float, np.ndarray]) -> Union[str, np.ndarray]:
    """
    Classify 2m temperature into thermal regimes:
    - Cool/Mild: < 25.0 °C
    - Warm: 25.0 to < 35.0 °C
    - Hot: 35.0 to < 40.0 °C
    - Heat Wave Level: >= 40.0 °C
    """
    if isinstance(temp_c, (int, float)):
        val = float(temp_c)
        if val < 25.0:
            return "Mild (<25°C)"
        elif val < 35.0:
            return "Warm (25-35°C)"
        elif val < 40.0:
            return "Hot (35-40°C)"
        else:
            return "Extreme Heat (>=40°C)"
            
    arr = np.asarray(temp_c, dtype=float)
    regimes = np.where(arr < 25.0, "Mild (<25°C)",
              np.where(arr < 35.0, "Warm (25-35°C)",
              np.where(arr < 40.0, "Hot (35-40°C)", "Extreme Heat (>=40°C)")))
    return regimes


def classify_wind_regime(speed_kmh: Union[float, np.ndarray]) -> Union[str, np.ndarray]:
    """
    Classify 10m wind speed into kinetic regimes:
    - Light: < 20.0 km/h
    - Moderate: 20.0 to < 40.0 km/h
    - High/Strong: 40.0 to < 62.0 km/h
    - Squall/Gale: >= 62.0 km/h
    """
    if isinstance(speed_kmh, (int, float)):
        val = float(speed_kmh)
        if val < 20.0:
            return "Light (<20km/h)"
        elif val < 40.0:
            return "Moderate (20-40km/h)"
        elif val < 62.0:
            return "High (40-62km/h)"
        else:
            return "Gale/Squall (>=62km/h)"
            
    arr = np.asarray(speed_kmh, dtype=float)
    regimes = np.where(arr < 20.0, "Light (<20km/h)",
              np.where(arr < 40.0, "Moderate (20-40km/h)",
              np.where(arr < 62.0, "High (40-62km/h)", "Gale/Squall (>=62km/h)")))
    return regimes
