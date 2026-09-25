"""
Verification Metrics Module for SIH26081
Calculates MAE, RMSE, and Mean Bias for forecast-observation pairs.
Adheres strictly to scientific meteorological definitions.
"""
from typing import Dict, Any, Union
import numpy as np
import pandas as pd

def calculate_mae(predictions: np.ndarray, observations: np.ndarray) -> float:
    """
    Mean Absolute Error (MAE):
    mean(abs(prediction - observation))
    """
    if len(predictions) == 0:
        return np.nan
    return float(np.mean(np.abs(predictions - observations)))

def calculate_rmse(predictions: np.ndarray, observations: np.ndarray) -> float:
    """
    Root Mean Squared Error (RMSE):
    sqrt(mean((prediction - observation)^2))
    """
    if len(predictions) == 0:
        return np.nan
    return float(np.sqrt(np.mean((predictions - observations) ** 2)))

def calculate_mean_bias(predictions: np.ndarray, observations: np.ndarray) -> float:
    """
    Mean Bias:
    mean(prediction - observation)
    """
    if len(predictions) == 0:
        return np.nan
    return float(np.mean(predictions - observations))

def compute_all_metrics(
    predictions: Union[np.ndarray, pd.Series],
    observations: Union[np.ndarray, pd.Series]
) -> Dict[str, Any]:
    """
    Computes all standard verification metrics on paired arrays.
    """
    pred = np.asarray(predictions, dtype=np.float64)
    obs = np.asarray(observations, dtype=np.float64)

    # Filter out NaNs if present
    valid = (~np.isnan(pred)) & (~np.isnan(obs))
    pred = pred[valid]
    obs = obs[valid]

    n = len(pred)
    if n == 0:
        return {
            "MAE": np.nan,
            "RMSE": np.nan,
            "Bias": np.nan,
            "N": 0
        }

    mae = calculate_mae(pred, obs)
    rmse = calculate_rmse(pred, obs)
    bias = calculate_mean_bias(pred, obs)

    return {
        "MAE": round(mae, 4),
        "RMSE": round(rmse, 4),
        "Bias": round(bias, 4),
        "N": int(n)
    }
