"""
Constrained Convex Weight Optimization and Entropy Metrics.
Guarantees strictly non-negative weights that sum to 1.0.
Calculates Shannon weight entropy, dominant model, and AI adaptation magnitude.
"""
from typing import Tuple, Union, Dict, Any
import numpy as np

MIN_WEIGHT = 0.05
MAX_WEIGHT = 0.95
EPSILON = 1e-12


def enforce_simplex_weights(w_gfs: Union[float, np.ndarray], clip_bounds: bool = True) -> Tuple[Union[float, np.ndarray], Union[float, np.ndarray]]:
    """
    Project raw weight score onto the 2-model probability simplex:
    w_GFS >= 0, w_ECMWF >= 0, and w_GFS + w_ECMWF == 1.0.
    
    If clip_bounds is True, clamps weights into [MIN_WEIGHT, MAX_WEIGHT] to prevent
    extreme single-model degeneracy and maintain multi-model ensemble robustness.
    """
    if isinstance(w_gfs, (int, float)):
        val = float(w_gfs)
        if clip_bounds:
            val = max(MIN_WEIGHT, min(MAX_WEIGHT, val))
        else:
            val = max(0.0, min(1.0, val))
        w_ecmwf = round(1.0 - val, 6)
        return val, w_ecmwf

    arr = np.asarray(w_gfs, dtype=float)
    if clip_bounds:
        clipped_gfs = np.clip(arr, MIN_WEIGHT, MAX_WEIGHT)
    else:
        clipped_gfs = np.clip(arr, 0.0, 1.0)
    clipped_ecmwf = 1.0 - clipped_gfs
    return clipped_gfs, clipped_ecmwf


def compute_weight_entropy(w_gfs: Union[float, np.ndarray], w_ecmwf: Union[float, np.ndarray]) -> Union[float, np.ndarray]:
    """
    Compute Shannon Weight Entropy:
    H = - (w_GFS * ln(w_GFS) + w_ECMWF * ln(w_ECMWF))
    Maximum entropy H = ln(2) ~ 0.6931 (pure 50/50 consensus).
    Minimum entropy -> 0 (single model dominance).
    """
    if isinstance(w_gfs, (int, float)) and isinstance(w_ecmwf, (int, float)):
        w1 = max(float(w_gfs), EPSILON)
        w2 = max(float(w_ecmwf), EPSILON)
        h = -(w1 * np.log(w1) + w2 * np.log(w2))
        return float(round(h, 4))

    w1 = np.maximum(np.asarray(w_gfs, dtype=float), EPSILON)
    w2 = np.maximum(np.asarray(w_ecmwf, dtype=float), EPSILON)
    h = -(w1 * np.log(w1) + w2 * np.log(w2))
    return np.round(h, 4)


def classify_dominant_model(w_gfs: Union[float, np.ndarray], dominance_threshold: float = 0.55) -> Union[str, np.ndarray]:
    """
    Determine dominant model based on weight allocation:
    - GFS Dominant: w_GFS > 0.55
    - ECMWF Dominant: w_ECMWF > 0.55 (w_GFS < 0.45)
    - Consensus (Balanced): 0.45 <= w_GFS <= 0.55
    """
    if isinstance(w_gfs, (int, float)):
        val = float(w_gfs)
        if val > dominance_threshold:
            return "GFS Dominant"
        elif val < (1.0 - dominance_threshold):
            return "ECMWF Dominant"
        else:
            return "Consensus (Balanced)"

    arr = np.asarray(w_gfs, dtype=float)
    dominant = np.where(arr > dominance_threshold, "GFS Dominant",
               np.where(arr < (1.0 - dominance_threshold), "ECMWF Dominant", "Consensus (Balanced)"))
    return dominant


def compute_ai_adaptation_magnitude(w_gfs: Union[float, np.ndarray]) -> Union[float, np.ndarray]:
    """
    Compute AI adaptation magnitude (departure from neutral 50/50 baseline):
    delta_w_AI = |w_GFS - 0.50|
    Ranges from 0.0 (exact baseline consensus) to 0.45 (strong AI-steered reweighting).
    """
    if isinstance(w_gfs, (int, float)):
        return float(round(abs(float(w_gfs) - 0.50), 4))
    return np.round(np.abs(np.asarray(w_gfs, dtype=float) - 0.50), 4)
