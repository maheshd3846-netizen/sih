"""
Unit Tests for Simplex Weight Constraints, Entropy, and Dynamic AI Weight Allocation.
"""
import pytest
import numpy as np
from src.blending.constrained_optimizer import (
    enforce_simplex_weights,
    compute_weight_entropy,
    classify_dominant_model,
    compute_ai_adaptation_magnitude,
)
from src.blending.context_blender import ContextAwareAIBlender


def test_weights_sum_to_one_and_non_negative():
    test_inputs = [-0.5, 0.0, 0.35, 0.50, 0.85, 1.0, 1.5]
    for raw in test_inputs:
        w_gfs, w_ecmwf = enforce_simplex_weights(raw, clip_bounds=True)
        assert w_gfs >= 0.0, f"w_gfs {w_gfs} is negative"
        assert w_ecmwf >= 0.0, f"w_ecmwf {w_ecmwf} is negative"
        assert np.isclose(w_gfs + w_ecmwf, 1.0, atol=1e-6), f"Sum {w_gfs + w_ecmwf} != 1.0"
        assert 0.05 <= w_gfs <= 0.95, f"w_gfs {w_gfs} outside clamped bounds"


def test_weights_vector_enforcement():
    raw_vec = np.array([-0.2, 0.1, 0.5, 0.9, 1.4])
    w_gfs, w_ec = enforce_simplex_weights(raw_vec, clip_bounds=True)
    assert len(w_gfs) == len(raw_vec)
    assert np.all(w_gfs >= 0.05)
    assert np.all(w_ec >= 0.05)
    assert np.allclose(w_gfs + w_ec, 1.0)


def test_shannon_weight_entropy_bounds():
    # Maximum entropy at 50/50: ln(2) ~ 0.6931
    h_max = compute_weight_entropy(0.5, 0.5)
    assert np.isclose(h_max, np.log(2.0), atol=1e-3)

    # Low entropy when skewed
    h_skew = compute_weight_entropy(0.9, 0.1)
    assert h_skew < h_max
    assert h_skew > 0.0


def test_dominant_model_classification():
    assert classify_dominant_model(0.70) == "GFS Dominant"
    assert classify_dominant_model(0.30) == "ECMWF Dominant"
    assert classify_dominant_model(0.50) == "Consensus (Balanced)"
    assert classify_dominant_model(0.52) == "Consensus (Balanced)"


def test_ai_adaptation_magnitude():
    assert compute_ai_adaptation_magnitude(0.50) == 0.0
    assert np.isclose(compute_ai_adaptation_magnitude(0.70), 0.20)
    assert np.isclose(compute_ai_adaptation_magnitude(0.35), 0.15)


def test_context_aware_ai_blender_attribution():
    blender = ContextAwareAIBlender()
    alloc = blender.allocate_weights(
        variable="precipitation",
        lead_hours=24,
        subregion="Coastal Andhra Pradesh",
        season="Southwest Monsoon",
        gfs_hist_mae=4.0,
        ecmwf_hist_mae=5.0,
        regime="Heavy (>=15mm)"
    )
    assert "w_gfs" in alloc
    assert "w_ecmwf" in alloc
    assert "delta_w_ai" in alloc
    assert "dominant_model" in alloc
    assert "weight_entropy" in alloc
    assert "attribution" in alloc

    w_gfs = alloc["w_gfs"]
    w_ec = alloc["w_ecmwf"]
    assert np.isclose(w_gfs + w_ec, 1.0)
    assert 0.05 <= w_gfs <= 0.95
