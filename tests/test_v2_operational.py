"""
Integration Tests for V2 Operational Engine and Compliance APIs.
"""
import pytest
from src.operational.v2_engine import V2OperationalEngine


@pytest.fixture(scope="module")
def v2_engine():
    return V2OperationalEngine()


def test_v2_engine_master_data_loaded(v2_engine):
    assert v2_engine.df_master is not None
    assert len(v2_engine.df_master) >= 72772
    assert v2_engine.df_master["forecast_day"].nunique() >= 92


def test_v2_grid_forecast_produces_791_cells(v2_engine):
    res = v2_engine.get_grid_forecast("2024-07-15", variable="precipitation", lead_hours=24)
    assert res["status"] == "SUCCESS"
    assert res["total_land_points"] == 791
    assert len(res["points"]) == 791
    assert res["variable"] == "precipitation"
    assert res["unit"] == "mm"

    # Verify each point has valid weights and bounds
    for pt in res["points"][:10]:
        assert 0.05 <= pt["w_gfs"] <= 0.95
        assert 0.05 <= pt["w_ecmwf"] <= 0.95
        assert round(pt["w_gfs"] + pt["w_ecmwf"], 4) == 1.0
        assert pt["dominant_model"] in ["GFS Dominant", "ECMWF Dominant", "Consensus (Balanced)"]
        assert pt["weight_entropy"] > 0.0
        assert pt["extreme_guidance"] is not None


def test_v2_grid_forecast_multi_variable(v2_engine):
    # Temperature
    res_temp = v2_engine.get_grid_forecast("2024-07-15", variable="temperature", lead_hours=24)
    assert res_temp["status"] == "SUCCESS"
    assert res_temp["unit"] == "°C"
    assert res_temp["points"][0]["blended_val"] > 10.0 # Plausible daytime temperature

    # Wind
    res_wind = v2_engine.get_grid_forecast("2024-07-15", variable="wind", lead_hours=24)
    assert res_wind["status"] == "SUCCESS"
    assert res_wind["unit"] == "km/h"
    assert res_wind["points"][0]["blended_val"] >= 0.0


def test_v2_grid_forecast_multi_lead(v2_engine):
    # Lead 48h
    res_48 = v2_engine.get_grid_forecast("2024-07-15", variable="precipitation", lead_hours=48)
    assert res_48["status"] == "SUCCESS"
    assert res_48["lead_hours"] == 48

    # Lead 72h
    res_72 = v2_engine.get_grid_forecast("2024-07-15", variable="precipitation", lead_hours=72)
    assert res_72["status"] == "SUCCESS"
    assert res_72["lead_hours"] == 72


def test_v2_point_forecast_query(v2_engine):
    # Query Hyderabad coordinates (17.3850 N, 78.4867 E)
    pt_res = v2_engine.get_point_forecast(17.385, 78.4867, "2024-07-15", variable="precipitation")
    assert pt_res["status"] == "SUCCESS"
    matched = pt_res["matched_grid_cell"]
    assert matched["subregion"] == "Telangana"
    assert abs(matched["lat"] - 17.5) <= 0.25
    assert abs(matched["lon"] - 78.5) <= 0.25

    # Out of domain query (e.g. Delhi: 28.6 N, 77.2 E)
    pt_out = v2_engine.get_point_forecast(28.6, 77.2, "2024-07-15")
    assert pt_out["status"] == "POINT_OUT_OF_DOMAIN"
