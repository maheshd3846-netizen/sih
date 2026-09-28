"""
Heat-Wave Guidance Engine.
Implements India Meteorological Department (IMD New Delhi) official criteria:
Plains Criteria:
- Maximum temperature T_max >= 40.0 °C
- Heat Wave (Orange Warning): Departure from normal delta_T >= 4.5 °C to 6.4 °C, OR T_max >= 45.0 °C
- Severe Heat Wave (Red Warning): Departure delta_T >= 6.5 °C, OR T_max >= 47.0 °C
Coastal Criteria:
- Maximum temperature T_max >= 37.0 °C with departure >= 4.5 °C

Evaluates deterministic threshold exceedance and classifies inter-model consensus agreement:
- UNANIMOUS_EXCEEDANCE
- DIVERGENT_GFS_ONLY
- DIVERGENT_ECMWF_ONLY
- BELOW_WARNING_THRESHOLD

Zero fabricated probabilities. Strictly deterministic meteorological criteria.
"""
from typing import Dict, Any

IMD_PLAINS_HEATWAVE_TEMP_MIN = 40.0
IMD_PLAINS_HEATWAVE_ABS_MIN = 45.0
IMD_PLAINS_SEVERE_ABS_MIN = 47.0
IMD_DEPARTURE_HEATWAVE_MIN = 4.5
IMD_DEPARTURE_SEVERE_MIN = 6.5
IMD_COASTAL_TEMP_MIN = 37.0


def classify_heat_wave_level(
    t_max: float,
    departure: float,
    is_coastal: bool = False
) -> Dict[str, Any]:
    """
    Classify thermal condition into official IMD heat-wave warning tiers.
    """
    t = float(t_max)
    dep = float(departure)

    if is_coastal:
        if t >= IMD_COASTAL_TEMP_MIN and dep >= IMD_DEPARTURE_HEATWAVE_MIN:
            return {"level": "Coastal Heat Wave", "warning_color": "ORANGE", "severity": 2}
        elif t >= 35.0 and dep >= 3.0:
            return {"level": "Warm Night / Thermal Advisory", "warning_color": "YELLOW", "severity": 1}
        else:
            return {"level": "Normal Thermal Conditions", "warning_color": "GREEN", "severity": 0}

    # Non-coastal plains criteria
    if t >= IMD_PLAINS_HEATWAVE_TEMP_MIN:
        if t >= IMD_PLAINS_SEVERE_ABS_MIN or dep >= IMD_DEPARTURE_SEVERE_MIN:
            return {"level": "Severe Heat Wave", "warning_color": "RED", "severity": 3}
        elif t >= IMD_PLAINS_HEATWAVE_ABS_MIN or dep >= IMD_DEPARTURE_HEATWAVE_MIN:
            return {"level": "Heat Wave", "warning_color": "ORANGE", "severity": 2}
        elif dep >= 3.0:
            return {"level": "Thermal Discomfort / Advisory", "warning_color": "YELLOW", "severity": 1}
        else:
            return {"level": "Normal Hot Season", "warning_color": "GREEN", "severity": 0}
    else:
        return {"level": "Normal Thermal Conditions", "warning_color": "GREEN", "severity": 0}


def evaluate_heat_wave_guidance(
    blended_temp: float,
    gfs_temp: float,
    ecmwf_temp: float,
    climatological_normal: float = 36.5,
    is_coastal: bool = False
) -> Dict[str, Any]:
    """
    Evaluate heat wave guidance for a specific cell, including model consensus agreement.
    """
    t_blend = float(blended_temp)
    t_gfs = float(gfs_temp)
    t_ecmwf = float(ecmwf_temp)

    dep_blend = t_blend - climatological_normal
    dep_gfs = t_gfs - climatological_normal
    dep_ecmwf = t_ecmwf - climatological_normal

    alert_info = classify_heat_wave_level(t_blend, dep_blend, is_coastal=is_coastal)
    gfs_info = classify_heat_wave_level(t_gfs, dep_gfs, is_coastal=is_coastal)
    ecmwf_info = classify_heat_wave_level(t_ecmwf, dep_ecmwf, is_coastal=is_coastal)

    gfs_alert = gfs_info["severity"] >= 2
    ecmwf_alert = ecmwf_info["severity"] >= 2
    blend_alert = alert_info["severity"] >= 2

    if gfs_alert and ecmwf_alert:
        agreement = "UNANIMOUS_EXCEEDANCE"
    elif gfs_alert and not ecmwf_alert:
        agreement = "DIVERGENT_GFS_ONLY"
    elif not gfs_alert and ecmwf_alert:
        agreement = "DIVERGENT_ECMWF_ONLY"
    else:
        agreement = "BELOW_WARNING_THRESHOLD"

    return {
        "event_type": "HEAT_WAVE",
        "blended_temp_c": round(t_blend, 2),
        "gfs_temp_c": round(t_gfs, 2),
        "ecmwf_temp_c": round(t_ecmwf, 2),
        "departure_from_normal_c": round(dep_blend, 2),
        "climatological_normal_c": round(climatological_normal, 2),
        "is_exceeded": blend_alert,
        "warning_level": alert_info["level"],
        "warning_color": alert_info["warning_color"],
        "severity_score": alert_info["severity"],
        "model_agreement": agreement,
        "is_coastal": is_coastal,
        "protocol": "IMD New Delhi Heat Wave Standard"
    }
