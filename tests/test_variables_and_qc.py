"""
Unit Tests for Multi-Variable Ingestion, Unit Conversion, and Quality Control (QC).
"""
import pytest
import numpy as np
from src.variables import (
    get_variable_handler,
    PrecipitationHandler,
    TemperatureHandler,
    WindHandler,
    VARIABLE_REGISTRY,
)


def test_registry_contains_required_variables():
    assert "precipitation" in VARIABLE_REGISTRY
    assert "temperature" in VARIABLE_REGISTRY
    assert "wind" in VARIABLE_REGISTRY


def test_precipitation_unit_conversion_and_qc():
    handler = PrecipitationHandler()
    assert handler.standard_unit == "mm"
    assert handler.valid_range == (0.0, 1500.0)

    # GFS APCP (kg/m^2 == mm)
    raw_gfs = np.array([0.0, 15.5, 120.0, -0.001])
    converted_gfs = handler.convert_gfs(raw_gfs)
    assert converted_gfs[0] == 0.0
    assert converted_gfs[1] == 15.5
    assert converted_gfs[3] == 0.0 # Clipped negative artifact

    # ECMWF tp (m -> mm)
    raw_ecmwf = np.array([0.0, 0.0155, 0.120])
    converted_ecmwf = handler.convert_ecmwf(raw_ecmwf)
    assert np.isclose(converted_ecmwf[1], 15.5)
    assert np.isclose(converted_ecmwf[2], 120.0)

    # QC validation
    ok, err = handler.validate_qc(converted_gfs)
    assert ok is True
    assert err is None

    # QC out-of-bounds rejection
    bad_data = np.array([1600.0]) # Exceeds 1500 mm
    ok_bad, err_bad = handler.validate_qc(bad_data)
    assert ok_bad is False
    assert "exceeds upper QC bound" in err_bad


def test_temperature_unit_conversion_and_qc():
    handler = TemperatureHandler()
    assert handler.standard_unit == "°C"
    assert handler.valid_range == (-10.0, 60.0)

    # Kelvin to Celsius conversion: 300.15 K -> 27.0 °C
    raw_k = np.array([300.15, 313.15, 273.15])
    converted = handler.convert_gfs(raw_k)
    assert np.isclose(converted[0], 27.0)
    assert np.isclose(converted[1], 40.0)
    assert np.isclose(converted[2], 0.0)

    # Values already in Celsius should be preserved
    already_c = np.array([28.5, 42.0])
    converted_c = handler.convert_ecmwf(already_c)
    assert np.isclose(converted_c[0], 28.5)

    # QC bound test
    ok, _ = handler.validate_qc(converted)
    assert ok is True

    # Bad extreme value
    ok_bad, err_bad = handler.validate_qc(np.array([75.0]))
    assert ok_bad is False
    assert "exceeds upper QC bound" in err_bad


def test_wind_speed_vector_reconstruction_and_qc():
    handler = WindHandler()
    assert handler.standard_unit == "km/h"
    assert handler.valid_range == (0.0, 300.0)

    # Vector calculation: u = 3 m/s, v = 4 m/s -> W = 5 m/s = 18 km/h
    u = np.array([3.0, 0.0])
    v = np.array([4.0, 10.0])
    speed_kmh = WindHandler.compute_speed_from_uv(u, v, to_kmh=True)
    assert np.isclose(speed_kmh[0], 18.0)
    assert np.isclose(speed_kmh[1], 36.0)

    # Direction: u = 0, v = 10 (southerly wind blowing north) -> 180 degrees
    dir_deg = WindHandler.compute_direction_degrees(np.array([0.0]), np.array([10.0]))
    assert np.isclose(dir_deg[0], 180.0)

    # QC validation
    ok, _ = handler.validate_qc(speed_kmh)
    assert ok is True

    # Bad speed
    ok_bad, err_bad = handler.validate_qc(np.array([350.0]))
    assert ok_bad is False
    assert "exceeds upper QC bound" in err_bad
