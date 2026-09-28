"""
Weight Map Generator for the 791 Terrestrial Grid Cells.
Generates complete spatial distributions of:
- GFS Weights (w_GFS)
- ECMWF Weights (w_ECMWF)
- AI Adaptation Magnitude (delta_w_AI)
- Dominant Model Classification
- Shannon Weight Entropy
- Dynamically Blended Forecasts
"""
from typing import Dict, Any, List
import pandas as pd
import numpy as np

from src.blending.context_blender import ContextAwareAIBlender
from src.features.regime import (
    classify_precipitation_regime,
    classify_temperature_regime,
    classify_wind_regime,
)


class WeightMapGenerator:
    def __init__(self):
        self.blender = ContextAwareAIBlender()

    def generate_weight_map(
        self,
        grid_df: pd.DataFrame,
        variable: str = "precipitation",
        lead_hours: int = 24,
        season: str = "Southwest Monsoon",
        gfs_hist_mae: float = 5.0,
        ecmwf_hist_mae: float = 5.0
    ) -> List[Dict[str, Any]]:
        """
        Generate spatial weight records across all cells in grid_df.
        grid_df must contain: 'lat', 'lon', 'gfs', 'ecmwf', and optionally 'subregion'.
        """
        records = []
        for _, row in grid_df.iterrows():
            lat = round(float(row["lat"]), 2)
            lon = round(float(row["lon"]), 2)
            subregion = str(row.get("subregion", "Telangana"))
            gfs_val = round(float(row["gfs"]), 2)
            ecmwf_val = round(float(row["ecmwf"]), 2)
            consensus_val = round(0.5 * gfs_val + 0.5 * ecmwf_val, 2)
            disagreement = round(abs(gfs_val - ecmwf_val), 2)

            # Classify regime from consensus
            if variable == "precipitation":
                regime = classify_precipitation_regime(consensus_val)
            elif variable == "temperature":
                regime = classify_temperature_regime(consensus_val)
            elif variable == "wind":
                regime = classify_wind_regime(consensus_val)
            else:
                regime = "Moderate"

            alloc = self.blender.allocate_weights(
                variable=variable,
                lead_hours=lead_hours,
                subregion=subregion,
                season=season,
                gfs_hist_mae=gfs_hist_mae,
                ecmwf_hist_mae=ecmwf_hist_mae,
                regime=regime
            )

            w_gfs = alloc["w_gfs"]
            w_ec = alloc["w_ecmwf"]
            blended_val = round(float(w_gfs * gfs_val + w_ec * ecmwf_val), 2)

            rec = {
                "lat": lat,
                "lon": lon,
                "subregion": subregion,
                "regime": regime,
                "gfs_val": gfs_val,
                "ecmwf_val": ecmwf_val,
                "baseline_50_50": consensus_val,
                "blended_val": blended_val,
                "disagreement": disagreement,
                "w_gfs": w_gfs,
                "w_ecmwf": w_ec,
                "delta_w_ai": alloc["delta_w_ai"],
                "dominant_model": alloc["dominant_model"],
                "weight_entropy": alloc["weight_entropy"],
                "attribution": alloc["attribution"]
            }

            # If IMD retrospective observation is present, calculate errors
            if "obs" in row and not pd.isna(row["obs"]):
                obs_val = round(float(row["obs"]), 2)
                rec["obs_val"] = obs_val
                rec["baseline_abs_err"] = round(abs(consensus_val - obs_val), 2)
                rec["blended_abs_err"] = round(abs(blended_val - obs_val), 2)
                rec["skill_delta_mm"] = round(rec["baseline_abs_err"] - rec["blended_abs_err"], 2)
            else:
                rec["obs_val"] = None
                rec["baseline_abs_err"] = None
                rec["blended_abs_err"] = None
                rec["skill_delta_mm"] = None

            records.append(rec)

        return records
