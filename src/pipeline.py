"""
SIH26081 EXP001 Pipeline Orchestration
End-to-end reproducible pipeline for GFS vs IMD forecast verification.
"""
import os
import sys

project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

import json
import yaml
from datetime import datetime, date, timedelta
from typing import Dict, Any, List
import numpy as np
import pandas as pd
import xarray as xr
import matplotlib.pyplot as plt

from src.utils.logger import setup_logger
from src.ingestion.imd_downloader import download_imd_rainfall_year
from src.ingestion.gfs_downloader import download_gfs_forecast_day
from src.preprocessing.imd_parser import parse_imd_date
from src.preprocessing.gfs_parser import parse_gfs_apcp_grib2
from src.verification.alignment import derive_valid_time, map_forecast_to_imd_observation_date, align_forecast_and_observation
from src.verification.qc import run_quality_control
from src.verification.metrics import compute_all_metrics

logger = setup_logger("EXP001_Pipeline")

def load_config(config_path: str = "configs/experiment_001.yaml") -> Dict[str, Any]:
    with open(config_path, "r") as f:
        return yaml.safe_load(f)

def run_exp001(config_path: str = "configs/experiment_001.yaml") -> Dict[str, Any]:
    """
    Executes Experiment EXP001.
    """
    cfg = load_config(config_path)
    logger.info(f"Loaded configuration for {cfg['experiment']}")

    region = cfg["region"]
    bbox = (region["lat_min"], region["lat_max"], region["lon_min"], region["lon_max"])
    start_date = datetime.strptime(cfg["period"]["start"], "%Y-%m-%d").date()
    end_date = datetime.strptime(cfg["period"]["end"], "%Y-%m-%d").date()
    lead_hours = cfg["forecast"]["lead_hours"]
    cycle = str(cfg["forecast"]["cycle"]).zfill(2)

    # 1. Ensure IMD observation data is acquired
    imd_file = download_imd_rainfall_year(start_date.year)

    # 2. Iterate through each forecast initialization date
    curr_date = start_date
    records: List[Dict[str, Any]] = []
    daily_datasets: List[xr.Dataset] = []

    logger.info(f"Starting acquisition & alignment loop from {start_date} to {end_date}...")
    
    while curr_date <= end_date:
        init_dt = datetime(curr_date.year, curr_date.month, curr_date.day, int(cycle), 0, 0)
        valid_dt = derive_valid_time(init_dt, lead_hours)
        obs_date = map_forecast_to_imd_observation_date(init_dt, lead_hours)

        logger.info(f"Processing cycle: Init={init_dt.isoformat()}, Valid={valid_dt.isoformat()}, ObsDate={obs_date.isoformat()}")

        # A. Download/acquire GFS 24h accumulation record
        gfs_file = download_gfs_forecast_day(
            init_date=curr_date,
            cycle=cycle,
            lead_hours=lead_hours
        )

        # B. Parse GFS slice for domain
        gfs_da = parse_gfs_apcp_grib2(gfs_file, bounding_box=bbox)

        # C. Parse IMD observation for domain
        imd_da = parse_imd_date(imd_file, target_date=obs_date, bounding_box=bbox)

        # D. Align grids
        aligned_ds = align_forecast_and_observation(gfs_da, imd_da)
        aligned_ds = aligned_ds.assign_coords(valid_time=valid_dt)
        daily_datasets.append(aligned_ds)

        # Convert to tabular records
        gfs_vals = aligned_ds["gfs_precipitation"].values
        imd_vals = aligned_ds["imd_precipitation"].values
        lats = aligned_ds.coords["lat"].values
        lons = aligned_ds.coords["lon"].values

        for i, lat in enumerate(lats):
            for j, lon in enumerate(lons):
                records.append({
                    "init_time": init_dt.isoformat(),
                    "valid_time": valid_dt.isoformat(),
                    "lead_hours": lead_hours,
                    "latitude": float(lat),
                    "longitude": float(lon),
                    "gfs_precipitation": float(gfs_vals[i, j]),
                    "imd_precipitation": float(imd_vals[i, j]),
                    "gfs_units": "mm",
                    "imd_units": "mm",
                    "source_id": "NOAA_GFS_0p25",
                    "region": region["name"]
                })

        curr_date += timedelta(days=1)

    # 3. Create tabular Canonical DataFrame
    df_raw = pd.DataFrame(records)
    logger.info(f"Constructed raw paired dataset: {len(df_raw)} records")

    # 4. Quality Control
    df_clean, qc_summary = run_quality_control(df_raw)

    # 5. Save canonical datasets
    os.makedirs("data/processed", exist_ok=True)
    parquet_path = "data/processed/exp001_canonical_dataset.parquet"
    df_clean.to_parquet(parquet_path, index=False)
    logger.info(f"Saved canonical parquet dataset: {parquet_path}")

    # Combine xarray datasets across valid_time
    combined_nc_path = "data/processed/exp001_canonical_dataset.nc"
    if daily_datasets:
        combined_ds = xr.concat(daily_datasets, dim="valid_time")
        combined_ds.to_netcdf(combined_nc_path)
        logger.info(f"Saved canonical NetCDF dataset: {combined_nc_path}")

    # 6. Compute baseline verification metrics
    metrics = compute_all_metrics(
        predictions=df_clean["gfs_precipitation"].values,
        observations=df_clean["imd_precipitation"].values
    )
    
    os.makedirs("results/metrics", exist_ok=True)
    metrics_path = "results/metrics/exp001_metrics.json"
    with open(metrics_path, "w") as f:
        json.dump(metrics, f, indent=2)
    logger.info(f"Verification Metrics: {metrics}")

    # 7. Generate Evaluation Plots
    os.makedirs("results/plots", exist_ok=True)
    generate_plots(df_clean)

    return {
        "metrics": metrics,
        "qc_summary": qc_summary,
        "parquet_path": parquet_path,
        "netcdf_path": combined_nc_path
    }

def generate_plots(df: pd.DataFrame):
    """
    Generates required verification plots:
    Plot 1: Scatter plot (Forecast vs Observation)
    Plot 2: Timeseries comparison for selected grid cell / regional mean
    Plot 3: Spatial error map (Mean Bias across lat-lon grid)
    """
    plt.style.use("default")
    
    # Plot 1: Scatter plot
    fig, ax = plt.subplots(figsize=(7, 6))
    max_val = max(df["gfs_precipitation"].max(), df["imd_precipitation"].max(), 50.0)
    ax.scatter(df["imd_precipitation"], df["gfs_precipitation"], alpha=0.25, color="#1f77b4", edgecolors="none", s=15)
    ax.plot([0, max_val], [0, max_val], "r--", linewidth=1.5, label="1:1 Perfect Agreement")
    ax.set_title("EXP001: NOAA GFS vs IMD 24h Precipitation (June 2024)", fontsize=12, fontweight="bold")
    ax.set_xlabel("IMD Observed Rainfall (mm)", fontsize=11)
    ax.set_ylabel("GFS Forecast Precipitation (mm)", fontsize=11)
    ax.set_xlim(0, max_val)
    ax.set_ylim(0, max_val)
    ax.grid(True, linestyle=":", alpha=0.6)
    ax.legend(loc="upper left")
    plot1_path = "results/plots/plot1_scatter_forecast_vs_obs.png"
    plt.tight_layout()
    plt.savefig(plot1_path, dpi=200)
    plt.close()
    logger.info(f"Saved Plot 1: {plot1_path}")

    # Plot 2: Timeseries of Domain-Mean Daily Precipitation
    df_ts = df.groupby("valid_time")[["gfs_precipitation", "imd_precipitation"]].mean().reset_index()
    df_ts["valid_date"] = pd.to_datetime(df_ts["valid_time"]).dt.strftime("%m-%d")
    
    fig, ax = plt.subplots(figsize=(11, 5))
    ax.plot(df_ts["valid_date"], df_ts["imd_precipitation"], "o-", color="#2ca02c", linewidth=2, label="IMD Observation (Domain Mean)")
    ax.plot(df_ts["valid_date"], df_ts["gfs_precipitation"], "s--", color="#1f77b4", linewidth=2, label="GFS Forecast (Domain Mean)")
    ax.set_title("EXP001: Daily Domain-Averaged Rainfall (AP + Telangana Domain, June 2024)", fontsize=12, fontweight="bold")
    ax.set_xlabel("Valid Date (June 2024)", fontsize=11)
    ax.set_ylabel("Mean Precipitation (mm / day)", fontsize=11)
    ax.tick_params(axis="x", rotation=45)
    ax.grid(True, linestyle=":", alpha=0.6)
    ax.legend(loc="upper left")
    plot2_path = "results/plots/plot2_timeseries_comparison.png"
    plt.tight_layout()
    plt.savefig(plot2_path, dpi=200)
    plt.close()
    logger.info(f"Saved Plot 2: {plot2_path}")

    # Plot 3: Spatial Error Map (Mean Bias = GFS - IMD)
    df["error"] = df["gfs_precipitation"] - df["imd_precipitation"]
    grid_error = df.groupby(["latitude", "longitude"])["error"].mean().reset_index()
    pivot_error = grid_error.pivot(index="latitude", columns="longitude", values="error")
    
    fig, ax = plt.subplots(figsize=(8, 6))
    c = ax.pcolormesh(
        pivot_error.columns,
        pivot_error.index,
        pivot_error.values,
        cmap="coolwarm",
        shading="auto",
        vmin=-15,
        vmax=15
    )
    cbar = plt.colorbar(c, ax=ax)
    cbar.set_label("Mean Forecast Bias: GFS - IMD (mm)", fontsize=10)
    ax.set_title("EXP001: Spatial Distribution of Mean Forecast Bias (June 2024)", fontsize=12, fontweight="bold")
    ax.set_xlabel("Longitude (°E)", fontsize=11)
    ax.set_ylabel("Latitude (°N)", fontsize=11)
    ax.grid(True, linestyle=":", alpha=0.4)
    plot3_path = "results/plots/plot3_spatial_error_map.png"
    plt.tight_layout()
    plt.savefig(plot3_path, dpi=200)
    plt.close()
    logger.info(f"Saved Plot 3: {plot3_path}")

if __name__ == "__main__":
    run_exp001()
