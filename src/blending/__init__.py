"""
Blending package for SIH26081 Meteorological Architecture.
Contains simplex weight enforcement, context-aware AI weight allocation, and weight map generators.
"""
from src.blending.constrained_optimizer import (
    enforce_simplex_weights,
    compute_weight_entropy,
    classify_dominant_model,
    compute_ai_adaptation_magnitude,
)
from src.blending.context_blender import ContextAwareAIBlender
from src.blending.weight_map_generator import WeightMapGenerator

__all__ = [
    "enforce_simplex_weights",
    "compute_weight_entropy",
    "classify_dominant_model",
    "compute_ai_adaptation_magnitude",
    "ContextAwareAIBlender",
    "WeightMapGenerator",
]
