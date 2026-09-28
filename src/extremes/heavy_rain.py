"""
Heavy Rainfall Guidance Engine.
Implements India Meteorological Department (IMD Pune) official 24-hour rainfall classification:
- Moderate Rain (Advisory): 15.6 - 64.4 mm
- Heavy Rain (Yellow Warning): 64.5 - 115.5 mm
- Very Heavy Rain (Orange Warning): 115.6 - 204.4 mm
- Extremely Heavy Rain (Red Warning): >= 204.5 mm

Evaluates deterministic threshold exceedance and classifies inter-model consensus agreement:
- UNANIMOUS_EXCEEDANCE (both GFS and ECMWF exceed threshold)
- DIVERGENT_GFS_ONLY (GFS exceeds, ECMWF below)
- DIVERGENT_ECMWF_ONLY (ECMWF exceeds, GFS below)
- BELOW_WARNING_THRESHOLD (neither model exceeds)

Zero fabricated probabilities. Strictly deterministic meteorological criteria.
"""
from typing import Dict, Any, Union
import numpy as np

# Official IMD 24-hour Rainfall Thresholds (mm)
IMD_MODERATE_MIN = 15.6
IMD_HEAVY_MIN = 64.5
IMD_VERY_HEAVY_MIN = 115.6
IMD_EXTREMELY_HEAVY_MIN = 204.5


def classify_rain_alert_level(precip_mm: float) -> Dict[str, str]:
    """
    Map 24h precipitation to official IMD warning tier and color code.
    """
    val = float(precip_mm)
    if val >= IMD_EXTREMELY_HEAVY_MIN:
        return {"level": "Extremely Heavy Rain", "warning_color": "RED", "severity": 4}
    elif val >= IMD_VERY_HEAVY_MIN:
        return {"level": "Very Heavy Rain", "warning_color": "ORANGE", "severity": 3}
    elif val >= IMD_HEAVY_MIN:
        return {"level": "Heavy Rain", "warning_color": "YELLOW", "severity": 2}
    elif val >= IMD_MODERATE_MIN:
        return {"level": "Moderate Rain", "warning_color": "BLUE", "severity": 1}
    else:
        return {"level": "No Warning / Light Rain", "warning_color": "GREEN", "severity": 0}


def evaluate_heavy_rain_guidance(
    blended_precip: float,
    gfs_precip: float,
    ecmwf_precip: float,
    threshold: float = IMD_HEAVY_MIN
) -> Dict[str, Any]:
    """
    Evaluate heavy rain guidance for a specific cell, including model consensus agreement.
    """
    p_blend = float(blended_precip)
    p_gfs = float(gfs_precip)
    p_ecmwf = float(ecmwf_precip)

    alert_info = classify_rain_alert_level(p_blend)

    # Check threshold exceedance
    blend_exceeds = bool(p_blend >= threshold)
    gfs_exceeds = bool(p_gfs >= threshold)
    ecmwf_exceeds = bool(p_ecmwf >= threshold)

    # Consensus agreement classification
    if gfs_exceeds and ecmwf_exceeds:
        agreement = "UNANIMOUS_EXCEEDANCE"
    elif gfs_exceeds and not ecmwf_exceeds:
        agreement = "DIVERGENT_GFS_ONLY"
    elif not gfs_exceeds and ecmwf_exceeds:
        agreement = "DIVERGENT_ECMWF_ONLY"
    else:
        agreement = "BELOW_WARNING_THRESHOLD"

    disagreement = abs(p_gfs - p_ecmwf)

    return {
        "event_type": "HEAVY_RAINFALL",
        "blended_mm": round(p_blend, 2),
        "gfs_mm": round(p_gfs, 2),
        "ecmwf_mm": round(p_ecmwf, 2),
        "disagreement_mm": round(disagreement, 2),
        "threshold_evaluated_mm": threshold,
        "is_exceeded": blend_exceeds,
        "warning_level": alert_info["level"],
        "warning_color": alert_info["warning_color"],
        "severity_score": alert_info["severity"],
        "model_agreement": agreement,
        "protocol": "IMD Pune 24-Hour Rainfall Classification Standard"
    }
