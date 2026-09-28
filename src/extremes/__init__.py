"""
Extremes package for SIH26081 Meteorological Architecture.
Contains deterministic threshold exceedance engines and consensus agreement classifiers for:
- Heavy Rainfall (IMD Pune)
- Heat Wave (IMD New Delhi)
- High Wind & Squall (IMD/WMO Beaufort)
"""
from src.extremes.heavy_rain import evaluate_heavy_rain_guidance, classify_rain_alert_level
from src.extremes.heat_wave import evaluate_heat_wave_guidance, classify_heat_wave_level
from src.extremes.high_wind import evaluate_high_wind_guidance, classify_wind_alert_level

__all__ = [
    "evaluate_heavy_rain_guidance",
    "classify_rain_alert_level",
    "evaluate_heat_wave_guidance",
    "classify_heat_wave_level",
    "evaluate_high_wind_guidance",
    "classify_wind_alert_level",
]
