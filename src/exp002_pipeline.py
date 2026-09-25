"""
EXP002 Multi-Model Verification & Complementarity Pipeline
Ingests and verifies NOAA GFS and ECMWF IFS against IMD observations.
"""
import os
import sys

project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

import json
import yaml
from datetime import datetime, date, timedelta
from typing import Dict, Any, List, Tuple
import numpy as np
import pandas as pd
from scipy import stats
import matplotlib.pyplot as plt

from src.utils.logger import setup_logger
from src.preprocessing.gfs_parser import parse_gfs_apcp_grib2
from src.preprocessing.ecmwf_parser import parse_ecmwf_tp_grib2
from src.preprocessing.imd_parser import parse_imd_date
from src.verification.alignment import derive_valid_time, map_forecast_to_imd_observation_date
from src.verification.qc import run_quality_control

logger = setup_logger("EXP002_Pipeline")

def run_exp002(config_path: str = "configs/experiment_002.yaml"):
    logger.info("Initializing EXP002 Multi-Model Verification Pipeline...")
    with open(config_path, "r") as f:
        cfg = yaml.safe_load(f)

    region = cfg["region"]
    bbox = (region["lat_min"], region["lat_max"], region["lon_min"], region["lon_max"])
    start_date = datetime.strptime(cfg["period"]["start"], "%Y-%m-%d").date()
    end_date = datetime.strptime(cfg["period"]["end"], "%Y-%m-%d").date()
    imd_file = "data/raw/imd/ind2024_rfp25.grd"

    # Step 1 & 2: Parse and assemble multi-model canonical records
    records = []
    curr_date = start_date
    logger.info(f"Processing multi-model dates from {start_date} to {end_date}...")

    while curr_date <= end_date:
        date_str = curr_date.strftime("%Y%m%d")
        init_dt = datetime(curr_date.year, curr_date.month, curr_date.day, 0, 0, 0)
        valid_dt = derive_valid_time(init_dt, 24)
        obs_date = map_forecast_to_imd_observation_date(init_dt, 24)

        gfs_path = f"data/raw/gfs/gfs_{date_str}_00z_apcp_f024.grib2"
        ecmwf_path = f"data/raw/ecmwf/ecmwf_{date_str}_00z_tp_f024.grib2"

        gfs_da = parse_gfs_apcp_grib2(gfs_path, bounding_box=bbox)
        ecmwf_da = parse_ecmwf_tp_grib2(ecmwf_path, bounding_box=bbox)
        imd_da = parse_imd_date(imd_file, target_date=obs_date, bounding_box=bbox)

        gfs_vals = gfs_da.values
        ecmwf_vals = ecmwf_da.values
        imd_vals = imd_da.values

        lats = imd_da.lat.values
        lons = imd_da.lon.values

        for i, lat in enumerate(lats):
            for j, lon in enumerate(lons):
                records.append({
                    "init_time": init_dt.isoformat(),
                    "valid_time": valid_dt.isoformat(),
                    "lead_hours": 24,
                    "lat": float(lat),
                    "lon": float(lon),
                    "gfs_precipitation": float(gfs_vals[i, j]),
                    "ecmwf_precipitation": float(ecmwf_vals[i, j]),
                    "imd_precipitation": float(imd_vals[i, j]),
                })

        curr_date += timedelta(days=1)

    df_raw = pd.DataFrame(records)
    logger.info(f"Total raw multi-model records assembled: {len(df_raw)}")

    # Strict QC: Filter ocean/non-Indian points (where IMD is NaN / -999.0)
    valid_mask = (
        (~np.isnan(df_raw["imd_precipitation"])) &
        (~np.isnan(df_raw["gfs_precipitation"])) &
        (~np.isnan(df_raw["ecmwf_precipitation"])) &
        (df_raw["gfs_precipitation"] >= 0.0) &
        (df_raw["ecmwf_precipitation"] >= 0.0) &
        (df_raw["imd_precipitation"] >= 0.0)
    )
    df_clean = df_raw[valid_mask].copy()
    logger.info(f"Valid canonical multi-model records: {len(df_clean)} (expected 23,730)")
    assert len(df_clean) == 23730, f"Sample count {len(df_clean)} does not match EXP001 baseline 23,730!"

    # Step 5: Save canonical dataset
    parquet_path = "data/processed/exp002_multimodel_canonical.parquet"
    df_clean.to_parquet(parquet_path, index=False)
    logger.info(f"Saved canonical multi-model dataset to {parquet_path}")

    # Step 8: Compute 50/50 equal-weight ensemble
    df_clean["ensemble_50_50"] = 0.5 * df_clean["gfs_precipitation"] + 0.5 * df_clean["ecmwf_precipitation"]

    # Compute errors
    df_clean["gfs_error"] = df_clean["gfs_precipitation"] - df_clean["imd_precipitation"]
    df_clean["ecmwf_error"] = df_clean["ecmwf_precipitation"] - df_clean["imd_precipitation"]
    df_clean["ensemble_error"] = df_clean["ensemble_50_50"] - df_clean["imd_precipitation"]

    # Step 6: EXP002-A Individual model & ensemble metrics
    models = ["gfs_precipitation", "ecmwf_precipitation", "ensemble_50_50"]
    model_names = ["NOAA GFS", "ECMWF IFS", "50/50 Ensemble"]
    metrics_list = []

    for col, name in zip(models, model_names):
        pred = df_clean[col].values
        obs = df_clean["imd_precipitation"].values
        abs_err = np.abs(pred - obs)

        p_corr, _ = stats.pearsonr(pred, obs)
        s_corr, _ = stats.spearmanr(pred, obs)

        # Dry vs Wet sub-regimes
        dry_mask = obs < 0.1
        rain_mask = obs >= 0.1
        mod_heavy_mask = obs >= 5.0
        heavy_mask = obs >= 15.0

        metrics_list.append({
            "Model": name,
            "N": len(pred),
            "MAE (mm)": round(float(np.mean(abs_err)), 4),
            "RMSE (mm)": round(float(np.sqrt(np.mean((pred - obs) ** 2))), 4),
            "Mean Bias (mm)": round(float(np.mean(pred - obs)), 4),
            "Pearson Correlation": round(float(p_corr), 4),
            "Spearman Correlation": round(float(s_corr), 4),
            "Zero-Rain Freq (%)": round(float((pred == 0.0).sum() / len(pred) * 100), 2),
            "Dry-Event MAE (<0.1mm)": round(float(np.mean(abs_err[dry_mask])), 4),
            "Rainy-Event MAE (>=0.1mm)": round(float(np.mean(abs_err[rain_mask])), 4),
            "Mod-Heavy MAE (>=5mm)": round(float(np.mean(abs_err[mod_heavy_mask])), 4),
            "Heavy Rain MAE (>=15mm)": round(float(np.mean(abs_err[heavy_mask])), 4),
            "95th Pct Abs Error (mm)": round(float(np.percentile(abs_err, 95)), 4),
            "99th Pct Abs Error (mm)": round(float(np.percentile(abs_err, 99)), 4),
        })

    df_model_metrics = pd.DataFrame(metrics_list)
    df_model_metrics.to_csv("results/metrics/exp002_model_metrics.csv", index=False)
    logger.info("Saved model metrics to results/metrics/exp002_model_metrics.csv")

    # Step 7: EXP002-B Error Complementarity
    e_gfs = df_clean["gfs_error"].values
    e_ec = df_clean["ecmwf_error"].values

    p_err_corr, _ = stats.pearsonr(e_gfs, e_ec)
    s_err_corr, _ = stats.spearmanr(e_gfs, e_ec)
    cov_err = np.cov(e_gfs, e_ec)[0, 1]

    # Win / Loss analysis
    abs_e_gfs = np.abs(e_gfs)
    abs_e_ec = np.abs(e_ec)
    gfs_closer = (abs_e_gfs < abs_e_ec - 0.5).sum()
    ec_closer = (abs_e_ec < abs_e_gfs - 0.5).sum()
    similar = (np.abs(abs_e_gfs - abs_e_ec) <= 0.5).sum()
    n_tot = len(df_clean)

    error_comp_dict = {
        "Metric": [
            "Pearson Error Correlation",
            "Spearman Error Correlation",
            "Error Covariance",
            "GFS Closer (>0.5mm)",
            "ECMWF Closer (>0.5mm)",
            "Similarly Close (<=0.5mm)"
        ],
        "Value": [
            round(float(p_err_corr), 4),
            round(float(s_err_corr), 4),
            round(float(cov_err), 4),
            f"{gfs_closer} ({gfs_closer/n_tot*100:.2f}%)",
            f"{ec_closer} ({ec_closer/n_tot*100:.2f}%)",
            f"{similar} ({similar/n_tot*100:.2f}%)"
        ]
    }
    df_error_comp = pd.DataFrame(error_comp_dict)
    df_error_comp.to_csv("results/metrics/exp002_error_correlation.csv", index=False)
    logger.info("Saved error complementarity to results/metrics/exp002_error_correlation.csv")

    # Step 9: EXP002-D Regime & Regional Breakdown
    regimes = [
        ("Dry (<0.1mm)", df_clean["imd_precipitation"] < 0.1),
        ("Light (0.1-5mm)", (df_clean["imd_precipitation"] >= 0.1) & (df_clean["imd_precipitation"] < 5.0)),
        ("Moderate (5-15mm)", (df_clean["imd_precipitation"] >= 5.0) & (df_clean["imd_precipitation"] < 15.0)),
        ("Heavy (>=15mm)", df_clean["imd_precipitation"] >= 15.0),
    ]

    regime_results = []
    for r_name, mask in regimes:
        sub = df_clean[mask]
        regime_results.append({
            "Regime": r_name,
            "N": len(sub),
            "GFS MAE": round(float(np.mean(np.abs(sub["gfs_precipitation"] - sub["imd_precipitation"]))), 4),
            "ECMWF MAE": round(float(np.mean(np.abs(sub["ecmwf_precipitation"] - sub["imd_precipitation"]))), 4),
            "Ensemble MAE": round(float(np.mean(np.abs(sub["ensemble_50_50"] - sub["imd_precipitation"]))), 4),
        })

    # Subregions
    # Coastal AP: lon >= 80.5, lat <= 19.0
    # Rayalaseema: lat < 15.5, lon < 80.0
    # Telangana: lat >= 15.5, lon < 80.5
    subregions = [
        ("Coastal Andhra Pradesh", (df_clean["lon"] >= 80.5) & (df_clean["lat"] <= 19.0)),
        ("Rayalaseema", (df_clean["lat"] < 15.5) & (df_clean["lon"] < 80.0)),
        ("Telangana", (df_clean["lat"] >= 15.5) & (df_clean["lon"] < 80.5)),
    ]

    for reg_name, mask in subregions:
        sub = df_clean[mask]
        regime_results.append({
            "Regime": f"Subregion: {reg_name}",
            "N": len(sub),
            "GFS MAE": round(float(np.mean(np.abs(sub["gfs_precipitation"] - sub["imd_precipitation"]))), 4),
            "ECMWF MAE": round(float(np.mean(np.abs(sub["ecmwf_precipitation"] - sub["imd_precipitation"]))), 4),
            "Ensemble MAE": round(float(np.mean(np.abs(sub["ensemble_50_50"] - sub["imd_precipitation"]))), 4),
        })

    df_regimes = pd.DataFrame(regime_results)
    df_regimes.to_csv("results/metrics/exp002_regime_metrics.csv", index=False)

    # Step 10: Paired Bootstrap Significance
    logger.info("Computing paired bootstrap significance (1,000 iterations)...")
    np.random.seed(42)
    boot_diff_gfs = []
    boot_diff_ec = []
    n_samples = len(df_clean)
    abs_ens = np.abs(df_clean["ensemble_50_50"] - df_clean["imd_precipitation"]).values
    abs_gfs = np.abs(df_clean["gfs_precipitation"] - df_clean["imd_precipitation"]).values
    abs_ec = np.abs(df_clean["ecmwf_precipitation"] - df_clean["imd_precipitation"]).values

    for _ in range(1000):
        idx = np.random.randint(0, n_samples, size=n_samples)
        m_ens = np.mean(abs_ens[idx])
        m_gfs = np.mean(abs_gfs[idx])
        m_ec = np.mean(abs_ec[idx])
        boot_diff_gfs.append(m_ens - m_gfs)
        boot_diff_ec.append(m_ens - m_ec)

    ci_diff_gfs = (np.percentile(boot_diff_gfs, 2.5), np.percentile(boot_diff_gfs, 97.5))
    ci_diff_ec = (np.percentile(boot_diff_ec, 2.5), np.percentile(boot_diff_ec, 97.5))
    p_val_gfs = (np.array(boot_diff_gfs) >= 0).mean()
    p_val_ec = (np.array(boot_diff_ec) >= 0).mean()

    significance_dict = {
        "Ensemble vs GFS MAE Reduction (mm)": round(float(np.mean(boot_diff_gfs)), 4),
        "95% CI (Ensemble - GFS)": [round(float(ci_diff_gfs[0]), 4), round(float(ci_diff_gfs[1]), 4)],
        "p-value (Ensemble < GFS)": round(float(p_val_gfs), 5),
        "Ensemble vs ECMWF MAE Reduction (mm)": round(float(np.mean(boot_diff_ec)), 4),
        "95% CI (Ensemble - ECMWF)": [round(float(ci_diff_ec[0]), 4), round(float(ci_diff_ec[1]), 4)],
        "p-value (Ensemble < ECMWF)": round(float(p_val_ec), 5),
    }

    # Generate Plots
    logger.info("Generating evaluation plots...")
    generate_exp002_plots(df_clean, df_regimes, df_model_metrics)

    return {
        "model_metrics": df_model_metrics,
        "error_complementarity": df_error_comp,
        "regime_metrics": df_regimes,
        "significance": significance_dict
    }

def generate_exp002_plots(df: pd.DataFrame, df_regimes: pd.DataFrame, df_model_metrics: pd.DataFrame):
    plt.style.use("default")
    
    # Plot 1: Model Comparison (Scatter of GFS vs IMD and ECMWF vs IMD)
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(13, 6))
    max_val = 150.0

    ax1.scatter(df["imd_precipitation"], df["gfs_precipitation"], alpha=0.15, color="#1f77b4", s=10)
    ax1.plot([0, max_val], [0, max_val], "r--", linewidth=1.5)
    ax1.set_title("NOAA GFS vs IMD Observation", fontsize=11, fontweight="bold")
    ax1.set_xlabel("IMD Rainfall (mm)", fontsize=10)
    ax1.set_ylabel("GFS Forecast (mm)", fontsize=10)
    ax1.set_xlim(0, max_val)
    ax1.set_ylim(0, max_val)
    ax1.grid(True, linestyle=":", alpha=0.5)

    ax2.scatter(df["imd_precipitation"], df["ecmwf_precipitation"], alpha=0.15, color="#ff7f0e", s=10)
    ax2.plot([0, max_val], [0, max_val], "r--", linewidth=1.5)
    ax2.set_title("ECMWF IFS vs IMD Observation", fontsize=11, fontweight="bold")
    ax2.set_xlabel("IMD Rainfall (mm)", fontsize=10)
    ax2.set_ylabel("ECMWF Forecast (mm)", fontsize=10)
    ax2.set_xlim(0, max_val)
    ax2.set_ylim(0, max_val)
    ax2.grid(True, linestyle=":", alpha=0.5)

    plt.suptitle("EXP002: Individual NWP Forecast Accuracy Comparison (June 2024)", fontsize=13, fontweight="bold")
    plt.tight_layout()
    plt.savefig("results/plots/exp002_model_comparison.png", dpi=200)
    plt.close()

    # Plot 2: Error Correlation Scatter
    fig, ax = plt.subplots(figsize=(7, 7))
    ax.scatter(df["gfs_error"], df["ecmwf_error"], alpha=0.2, color="#2ca02c", s=10)
    ax.axhline(0, color="k", linestyle="--", linewidth=0.8)
    ax.axvline(0, color="k", linestyle="--", linewidth=0.8)
    ax.plot([-60, 60], [-60, 60], "r:", label="Identical Error Line (r=1)")
    ax.set_title("EXP002: Forecast Error Correlation (GFS Error vs ECMWF Error)", fontsize=12, fontweight="bold")
    ax.set_xlabel("GFS Error: Forecast - IMD (mm)", fontsize=11)
    ax.set_ylabel("ECMWF Error: Forecast - IMD (mm)", fontsize=11)
    ax.set_xlim(-60, 60)
    ax.set_ylim(-60, 60)
    ax.grid(True, linestyle=":", alpha=0.5)
    ax.legend(loc="upper left")
    plt.tight_layout()
    plt.savefig("results/plots/exp002_error_correlation.png", dpi=200)
    plt.close()

    # Plot 3: Regime Breakdown Bar Chart
    fig, ax = plt.subplots(figsize=(10, 5))
    reg_names = df_regimes["Regime"].values[:4]
    x = np.arange(len(reg_names))
    width = 0.25

    ax.bar(x - width, df_regimes["GFS MAE"].values[:4], width, label="NOAA GFS", color="#1f77b4")
    ax.bar(x, df_regimes["ECMWF MAE"].values[:4], width, label="ECMWF IFS", color="#ff7f0e")
    ax.bar(x + width, df_regimes["Ensemble MAE"].values[:4], width, label="50/50 Ensemble", color="#2ca02c")

    ax.set_ylabel("MAE (mm)", fontsize=11)
    ax.set_title("EXP002: MAE Breakdown by Rainfall Intensity Regime", fontsize=12, fontweight="bold")
    ax.set_xticks(x)
    ax.set_xticklabels(reg_names, fontsize=10)
    ax.grid(axis="y", linestyle=":", alpha=0.6)
    ax.legend(loc="upper left")
    plt.tight_layout()
    plt.savefig("results/plots/exp002_regime_comparison.png", dpi=200)
    plt.close()

    # Plot 4: Ensemble Comparison Timeseries
    daily = df.groupby("valid_time")[["gfs_precipitation", "ecmwf_precipitation", "ensemble_50_50", "imd_precipitation"]].mean().reset_index()
    daily["date"] = pd.to_datetime(daily["valid_time"]).dt.strftime("%m-%d")

    fig, ax = plt.subplots(figsize=(12, 5))
    ax.plot(daily["date"], daily["imd_precipitation"], "k-o", linewidth=2.2, label="IMD Observation")
    ax.plot(daily["date"], daily["gfs_precipitation"], "b--s", alpha=0.7, label="NOAA GFS")
    ax.plot(daily["date"], daily["ecmwf_precipitation"], "m--^", alpha=0.7, label="ECMWF IFS")
    ax.plot(daily["date"], daily["ensemble_50_50"], "g-D", linewidth=2.0, label="50/50 Equal-Weight Ensemble")

    ax.set_title("EXP002: Domain-Averaged Daily Rainfall - GFS vs ECMWF vs 50/50 Ensemble", fontsize=12, fontweight="bold")
    ax.set_xlabel("Valid Date (June 2024)", fontsize=11)
    ax.set_ylabel("Precipitation (mm/day)", fontsize=11)
    ax.tick_params(axis="x", rotation=45)
    ax.grid(True, linestyle=":", alpha=0.5)
    ax.legend(loc="upper left")
    plt.tight_layout()
    plt.savefig("results/plots/exp002_ensemble_comparison.png", dpi=200)
    plt.close()

if __name__ == "__main__":
    res = run_exp002()
    print("EXP002 Execution finished successfully.")
