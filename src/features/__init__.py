"""
Features package for SIH26081 Meteorological Architecture.
Contains spatial, temporal, causal historical skill, and weather regime feature extractors.
"""
from src.features.spatial import assign_subregion, add_spatial_features
from src.features.temporal import get_meteorological_season, add_temporal_features
from src.features.historical_skill import compute_causal_rolling_skill
from src.features.regime import (
    classify_precipitation_regime,
    classify_temperature_regime,
    classify_wind_regime,
)

__all__ = [
    "assign_subregion",
    "add_spatial_features",
    "get_meteorological_season",
    "add_temporal_features",
    "compute_causal_rolling_skill",
    "classify_precipitation_regime",
    "classify_temperature_regime",
    "classify_wind_regime",
]
