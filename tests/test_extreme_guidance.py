"""
Unit Tests for Deterministic Extreme Weather Guidance Engines and Agreement Classifiers.
"""
import pytest
from src.extremes.heavy_rain import evaluate_heavy_rain_guidance, classify_rain_alert_level
from src.extremes.heat_wave import evaluate_heat_wave_guidance, classify_heat_wave_level
from src.extremes.high_wind import evaluate_high_wind_guidance, classify_wind_alert_level


def test_heavy_rain_alert_levels():
    assert classify_rain_alert_level(5.0)["level"] == "No Warning / Light Rain"
    assert classify_rain_alert_level(25.0)["level"] == "Moderate Rain"
    assert classify_rain_alert_level(75.0)["level"] == "Heavy Rain"
    assert classify_rain_alert_level(150.0)["level"] == "Very Heavy Rain"
    assert classify_rain_alert_level(220.0)["level"] == "Extremely Heavy Rain"


def test_heavy_rain_consensus_agreement_flags():
    # Both models exceed 64.5 mm
    res_unan = evaluate_heavy_rain_guidance(blended_precip=70.0, gfs_precip=80.0, ecmwf_precip=68.0, threshold=64.5)
    assert res_unan["model_agreement"] == "UNANIMOUS_EXCEEDANCE"
    assert res_unan["is_exceeded"] is True

    # GFS only exceeds
    res_gfs = evaluate_heavy_rain_guidance(blended_precip=55.0, gfs_precip=75.0, ecmwf_precip=35.0, threshold=64.5)
    assert res_gfs["model_agreement"] == "DIVERGENT_GFS_ONLY"

    # ECMWF only exceeds
    res_ec = evaluate_heavy_rain_guidance(blended_precip=58.0, gfs_precip=40.0, ecmwf_precip=76.0, threshold=64.5)
    assert res_ec["model_agreement"] == "DIVERGENT_ECMWF_ONLY"

    # Neither exceeds
    res_below = evaluate_heavy_rain_guidance(blended_precip=10.0, gfs_precip=12.0, ecmwf_precip=8.0, threshold=64.5)
    assert res_below["model_agreement"] == "BELOW_WARNING_THRESHOLD"
    assert res_below["is_exceeded"] is False


def test_heat_wave_criteria_and_agreement():
    # Heat wave in plains: T >= 40.0 and departure >= 4.5
    res = evaluate_heat_wave_guidance(blended_temp=42.0, gfs_temp=43.0, ecmwf_temp=41.0, climatological_normal=36.0)
    assert res["is_exceeded"] is True
    assert res["model_agreement"] == "UNANIMOUS_EXCEEDANCE"
    assert res["warning_level"] in ["Heat Wave", "Severe Heat Wave"]

    # Severe Heat Wave: absolute >= 47.0 °C
    severe = classify_heat_wave_level(47.5, departure=6.0, is_coastal=False)
    assert severe["level"] == "Severe Heat Wave"
    assert severe["warning_color"] == "RED"


def test_high_wind_squall_criteria_and_agreement():
    # Squall/gale force >= 62 km/h
    res = evaluate_high_wind_guidance(blended_speed_kmh=65.0, gfs_speed_kmh=68.0, ecmwf_speed_kmh=62.0)
    assert res["is_exceeded"] is True
    assert res["model_agreement"] == "UNANIMOUS_EXCEEDANCE"
    assert "Gale" in res["warning_level"] or "Squall" in res["warning_level"]
