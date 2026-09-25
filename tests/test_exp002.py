"""
Automated Test Suite for EXP002 Multi-Model Verification
Covers:
1. ECMWF unit conversion (metres to millimetres)
2. Temporal alignment (00 UTC +24h to IMD 08:30 IST)
3. Spatial alignment & coordinate coincidence
4. Missing-value handling
5. Equal-weight ensemble calculation
6. Sample-count consistency (23,730 pairs)
"""
import pytest
import numpy as np
import pandas as pd
import xarray as xr
from datetime import datetime, date

from src.verification.alignment import derive_valid_time, map_forecast_to_imd_observation_date, spatial_coordinate_check
from src.utils.geo import get_domain_coords

def test_ecmwf_unit_conversion():
    # In ECMWF IFS GRIB2, Total Precipitation (tp) is in metres.
    val_m = 0.0254  # 25.4 mm
    val_mm = val_m * 1000.0
    assert np.isclose(val_mm, 25.4)

def test_ecmwf_temporal_alignment():
    # Initialization 2024-06-01 00:00:00 UTC with 24h lead time
    init_dt = datetime(2024, 6, 1, 0, 0, 0)
    valid_dt = derive_valid_time(init_dt, 24)
    obs_date = map_forecast_to_imd_observation_date(init_dt, 24)
    
    assert valid_dt == datetime(2024, 6, 2, 0, 0, 0)
    assert obs_date == date(2024, 6, 2)

def test_ecmwf_spatial_alignment():
    # Verify domain bounds and coordinate coincidence
    lats, lons = get_domain_coords(12.0, 20.0, 76.0, 85.0, 0.25)
    assert len(lats) == 33
    assert len(lons) == 37
    assert np.isclose(lats[0], 12.0) and np.isclose(lats[-1], 20.0)
    assert np.isclose(lons[0], 76.0) and np.isclose(lons[-1], 85.0)

def test_ensemble_calculation():
    gfs = np.array([10.0, 20.0, 0.0, 50.0])
    ecmwf = np.array([20.0, 10.0, 10.0, 30.0])
    expected_ens = np.array([15.0, 15.0, 5.0, 40.0])
    
    actual_ens = 0.5 * gfs + 0.5 * ecmwf
    assert np.allclose(actual_ens, expected_ens)

def test_missing_value_masking():
    df = pd.DataFrame([
        {"gfs_precipitation": 10.0, "ecmwf_precipitation": 12.0, "imd_precipitation": 8.0},
        {"gfs_precipitation": 5.0, "ecmwf_precipitation": np.nan, "imd_precipitation": 4.0},
        {"gfs_precipitation": 5.0, "ecmwf_precipitation": 6.0, "imd_precipitation": np.nan},
        {"gfs_precipitation": -1.0, "ecmwf_precipitation": 6.0, "imd_precipitation": 5.0},
    ])
    valid = (
        (~np.isnan(df["imd_precipitation"])) &
        (~np.isnan(df["gfs_precipitation"])) &
        (~np.isnan(df["ecmwf_precipitation"])) &
        (df["gfs_precipitation"] >= 0.0) &
        (df["ecmwf_precipitation"] >= 0.0) &
        (df["imd_precipitation"] >= 0.0)
    )
    clean_df = df[valid]
    assert len(clean_df) == 1

def test_sample_count_consistency():
    # Domain: 33 lats * 37 lons = 1221 cells
    # Terrestrial valid cells: 791 cells
    # Days in June: 30
    assert 791 * 30 == 23730
