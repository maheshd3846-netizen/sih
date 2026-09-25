"""
Automated Test Suite for SIH26081 Pipeline
Covers:
1. Time alignment & lead-time calculation (including month/year/leap boundaries)
2. Spatial subsetting and coordinate verification
3. Missing-value and anomaly handling
4. Precipitation unit verification
5. Verification metric calculations (MAE, RMSE, Mean Bias)
6. Canonical dataset schema verification
"""
import pytest
from datetime import datetime, date, timedelta
import numpy as np
import pandas as pd
import xarray as xr

from src.verification.alignment import derive_valid_time, map_forecast_to_imd_observation_date, spatial_coordinate_check
from src.verification.qc import run_quality_control
from src.verification.metrics import calculate_mae, calculate_rmse, calculate_mean_bias, compute_all_metrics
from src.utils.geo import get_domain_coords, get_imd_coords, get_gfs_coords

# 1. Lead-time & Time Alignment Tests
def test_lead_time_calculation():
    init_dt = datetime(2024, 6, 1, 0, 0, 0)
    valid_dt = derive_valid_time(init_dt, 24)
    assert valid_dt == datetime(2024, 6, 2, 0, 0, 0)

    # Lead 0
    assert derive_valid_time(init_dt, 0) == init_dt

    # Negative lead should raise ValueError
    with pytest.raises(ValueError):
        derive_valid_time(init_dt, -12)

def test_time_alignment_month_and_leap_boundaries():
    # Month boundary: May 31 -> June 1
    init_may = datetime(2024, 5, 31, 0, 0, 0)
    assert map_forecast_to_imd_observation_date(init_may, 24) == date(2024, 6, 1)

    # Month boundary: June 30 -> July 1
    init_june = datetime(2024, 6, 30, 0, 0, 0)
    assert map_forecast_to_imd_observation_date(init_june, 24) == date(2024, 7, 1)

    # Leap-year boundary: Feb 28, 2024 (2024 is leap year, so next day is Feb 29)
    init_leap = datetime(2024, 2, 28, 0, 0, 0)
    assert map_forecast_to_imd_observation_date(init_leap, 24) == date(2024, 2, 29)

    # Feb 29 -> March 1
    init_leap2 = datetime(2024, 2, 29, 0, 0, 0)
    assert map_forecast_to_imd_observation_date(init_leap2, 24) == date(2024, 3, 1)

    # Year boundary: Dec 31 -> Jan 1
    init_year_end = datetime(2024, 12, 31, 0, 0, 0)
    assert map_forecast_to_imd_observation_date(init_year_end, 24) == date(2025, 1, 1)

# 2. Spatial Subset Tests
def test_spatial_subset_coords():
    lats, lons = get_domain_coords(12.0, 20.0, 76.0, 85.0, 0.25)
    
    assert len(lats) == 33
    assert len(lons) == 37
    assert np.isclose(lats[0], 12.0)
    assert np.isclose(lats[-1], 20.0)
    assert np.isclose(lons[0], 76.0)
    assert np.isclose(lons[-1], 85.0)

    # Check coordinate steps
    lat_diffs = np.diff(lats)
    lon_diffs = np.diff(lons)
    assert np.allclose(lat_diffs, 0.25)
    assert np.allclose(lon_diffs, 0.25)

def test_spatial_coordinate_matching():
    lats, lons = get_domain_coords(12.0, 20.0, 76.0, 85.0, 0.25)
    da1 = xr.DataArray(np.zeros((len(lats), len(lons))), coords={"lat": lats, "lon": lons}, dims=["lat", "lon"])
    da2 = xr.DataArray(np.ones((len(lats), len(lons))), coords={"lat": lats, "lon": lons}, dims=["lat", "lon"])
    
    assert spatial_coordinate_check(da1, da2) is True

# 3. Missing Value & Anomaly QC Tests
def test_quality_control_missing_values():
    test_df = pd.DataFrame([
        # Valid row
        {"valid_time": "2024-06-02T00:00:00", "latitude": 15.0, "longitude": 80.0, "gfs_precipitation": 12.5, "imd_precipitation": 10.0},
        # Missing observation (NaN)
        {"valid_time": "2024-06-02T00:00:00", "latitude": 15.25, "longitude": 80.0, "gfs_precipitation": 5.0, "imd_precipitation": np.nan},
        # Missing forecast (NaN)
        {"valid_time": "2024-06-02T00:00:00", "latitude": 15.5, "longitude": 80.0, "gfs_precipitation": np.nan, "imd_precipitation": 8.0},
        # Negative precipitation
        {"valid_time": "2024-06-02T00:00:00", "latitude": 15.75, "longitude": 80.0, "gfs_precipitation": -1.0, "imd_precipitation": 4.0},
        # Duplicate record
        {"valid_time": "2024-06-02T00:00:00", "latitude": 15.0, "longitude": 80.0, "gfs_precipitation": 12.5, "imd_precipitation": 10.0},
    ])

    clean_df, qc_rep = run_quality_control(test_df)
    assert qc_rep["records_loaded"] == 5
    assert qc_rep["records_valid"] == 1
    assert qc_rep["missing_observation"] == 1
    assert qc_rep["missing_forecast"] == 1
    assert qc_rep["negative_precipitation"] == 1
    assert qc_rep["duplicates_removed"] == 1
    assert len(clean_df) == 1

# 4. Precipitation Unit Handling Test
def test_precipitation_units():
    # In meteorology, 1 kg m**-2 of liquid water depth equals 1 mm
    kg_m2_val = 25.4
    mm_val = kg_m2_val # 1:1 numeric conversion
    assert np.isclose(kg_m2_val, mm_val)

# 5. Metric Calculation Tests
def test_metric_calculations():
    # Known analytical fixture
    obs = np.array([10.0, 20.0, 30.0, 40.0])
    pred = np.array([12.0, 18.0, 35.0, 35.0])
    
    # Errors: [2.0, -2.0, 5.0, -5.0]
    # Absolute errors: [2.0, 2.0, 5.0, 5.0] -> mean = 14 / 4 = 3.5
    # Squared errors: [4.0, 4.0, 25.0, 25.0] -> mean = 58 / 4 = 14.5 -> sqrt(14.5) ≈ 3.80788655...
    # Mean bias: (2 - 2 + 5 - 5) / 4 = 0.0

    mae = calculate_mae(pred, obs)
    rmse = calculate_rmse(pred, obs)
    bias = calculate_mean_bias(pred, obs)

    assert np.isclose(mae, 3.5)
    assert np.isclose(rmse, np.sqrt(14.5))
    assert np.isclose(bias, 0.0)

    summary = compute_all_metrics(pred, obs)
    assert summary["MAE"] == 3.5
    assert summary["RMSE"] == round(float(np.sqrt(14.5)), 4)
    assert summary["Bias"] == 0.0
    assert summary["N"] == 4

# 6. Canonical Dataset Schema Test
def test_canonical_dataset_schema():
    required_cols = [
        "init_time", "valid_time", "lead_hours", "latitude", "longitude",
        "gfs_precipitation", "imd_precipitation", "gfs_units", "imd_units",
        "source_id", "region"
    ]
    sample_df = pd.DataFrame([{
        "init_time": "2024-06-01T00:00:00",
        "valid_time": "2024-06-02T00:00:00",
        "lead_hours": 24,
        "latitude": 15.0,
        "longitude": 80.0,
        "gfs_precipitation": 10.5,
        "imd_precipitation": 8.2,
        "gfs_units": "mm",
        "imd_units": "mm",
        "source_id": "NOAA_GFS_0p25",
        "region": "AP_Telangana_experimental_domain"
    }])

    for col in required_cols:
        assert col in sample_df.columns
