"""
High-Wind & Squall Guidance Engine.
Implements IMD and WMO Beaufort Scale criteria for:
- Strong Breeze / High Wind Advisory (Yellow): 40 - 61 km/h sustained OR Gust >= 50 km/h
- Squall / Gale Force Warning (Orange): 62 - 87 km/h sustained OR Gust >= 62 km/h
- Severe Gale / Storm Force Warning (Red): >= 88 km/h sustained OR Gust >= 90 km/h

Evaluates deterministic threshold exceedance and classifies inter-model consensus agreement:
- UNANIMOUS_EXCEEDANCE
- DIVERGENT_GFS_ONLY
- DIVERGENT_ECMWF_ONLY
- BELOW_WARNING_THRESHOLD

Zero fabricated probabilities. Strictly deterministic meteorological criteria.
"""
from typing import Dict, Any

IMD_STRONG_WIND_MIN = 40.0   # km/h
IMD_GALE_SQUALL_MIN = 62.0   # km/h
IMD_STORM_FORCE_MIN = 88.0   # km/h
IMD_GUST_ADVISORY_MIN = 50.0 # km/h
IMD_GUST_WARNING_MIN = 62.0  # km/h
IMD_GUST_SEVERE_MIN = 90.0   # km/h


def classify_wind_alert_level(
    sustained_kmh: float,
    gust_kmh: float
) -> Dict[str, Any]:
    """
    Classify wind conditions into official IMD/WMO warning tiers.
    """
    s = float(sustained_kmh)
    g = float(gust_kmh)

    if s >= IMD_STORM_FORCE_MIN or g >= IMD_GUST_SEVERE_MIN:
        return {"level": "Severe Gale / Storm Warning", "warning_color": "RED", "severity": 3}
    elif s >= IMD_GALE_SQUALL_MIN or g >= IMD_GUST_WARNING_MIN:
        return {"level": "Squall / Gale Force Warning", "warning_color": "ORANGE", "severity": 2}
    elif s >= IMD_STRONG_WIND_MIN or g >= IMD_GUST_ADVISORY_MIN:
        return {"level": "Strong Wind Advisory", "warning_color": "YELLOW", "severity": 1}
    else:
        return {"level": "Normal Breeze / Light Wind", "warning_color": "GREEN", "severity": 0}


def evaluate_high_wind_guidance(
    blended_speed_kmh: float,
    gfs_speed_kmh: float,
    ecmwf_speed_kmh: float,
    blended_gust_kmh: float = 0.0,
    gfs_gust_kmh: float = 0.0,
    ecmwf_gust_kmh: float = 0.0
) -> Dict[str, Any]:
    """
    Evaluate high-wind guidance for a specific cell, including model consensus agreement.
    """
    s_blend = float(blended_speed_kmh)
    s_gfs = float(gfs_speed_kmh)
    s_ecmwf = float(ecmwf_speed_kmh)
    g_blend = float(blended_gust_kmh) if blended_gust_kmh > 0 else s_blend * 1.3
    g_gfs = float(gfs_gust_kmh) if gfs_gust_kmh > 0 else s_gfs * 1.3
    g_ecmwf = float(ecmwf_gust_kmh) if ecmwf_gust_kmh > 0 else s_ecmwf * 1.3

    alert_info = classify_wind_alert_level(s_blend, g_blend)
    gfs_info = classify_wind_alert_level(s_gfs, g_gfs)
    ecmwf_info = classify_wind_alert_level(s_ecmwf, g_ecmwf)

    gfs_alert = gfs_info["severity"] >= 1
    ecmwf_alert = ecmwf_info["severity"] >= 1
    blend_alert = alert_info["severity"] >= 1

    if gfs_alert and ecmwf_alert:
        agreement = "UNANIMOUS_EXCEEDANCE"
    elif gfs_alert and not ecmwf_alert:
        agreement = "DIVERGENT_GFS_ONLY"
    elif not gfs_alert and ecmwf_alert:
        agreement = "DIVERGENT_ECMWF_ONLY"
    else:
        agreement = "BELOW_WARNING_THRESHOLD"

    return {
        "event_type": "HIGH_WIND",
        "blended_speed_kmh": round(s_blend, 2),
        "gfs_speed_kmh": round(s_gfs, 2),
        "ecmwf_speed_kmh": round(s_ecmwf, 2),
        "blended_gust_kmh": round(g_blend, 2),
        "is_exceeded": blend_alert,
        "warning_level": alert_info["level"],
        "warning_color": alert_info["warning_color"],
        "severity_score": alert_info["severity"],
        "model_agreement": agreement,
        "protocol": "IMD/WMO Beaufort Wind and Squall Scale"
    }
