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

    # Pearson correlation
    if n > 1 and np.std(pred) > 1e-6 and np.std(obs) > 1e-6:
        corr = float(np.corrcoef(pred, obs)[0, 1])
    else:
        corr = 0.0

    # P99 tail error
    tail_p99 = float(np.percentile(np.abs(pred - obs), 99))

    return {
        "MAE": round(mae, 4),
        "RMSE": round(rmse, 4),
        "Bias": round(bias, 4),
        "Correlation": round(corr, 4),
        "P99_Tail_Error": round(tail_p99, 4),
        "N": int(n)
    }


def compute_contingency_metrics(
    predictions: np.ndarray,
    observations: np.ndarray,
    threshold: float
) -> Dict[str, float]:
    """
    Computes standard 2x2 contingency table metrics for extreme weather threshold exceedance:
    - Hits (H): Pred >= T and Obs >= T
    - False Alarms (F): Pred >= T and Obs < T
    - Misses (M): Pred < T and Obs >= T
    - Correct Negatives (C): Pred < T and Obs < T

    Metrics:
    - Probability of Detection (POD / Hit Rate) = H / (H + M)
    - False Alarm Ratio (FAR) = F / (H + F)
    - Critical Success Index (CSI / Threat Score) = H / (H + F + M)
    - Equitable Threat Score (ETS)
    """
    p = np.asarray(predictions, dtype=float)
    o = np.asarray(observations, dtype=float)
    valid = (~np.isnan(p)) & (~np.isnan(o))
    p = p[valid]
    o = o[valid]

    n = len(p)
    if n == 0:
        return {"POD": 0.0, "FAR": 0.0, "CSI": 0.0, "ETS": 0.0, "Hits": 0, "False_Alarms": 0, "Misses": 0}

    pred_event = (p >= threshold)
    obs_event = (o >= threshold)

    h = int(np.sum(pred_event & obs_event))
    f = int(np.sum(pred_event & (~obs_event)))
    m = int(np.sum((~pred_event) & obs_event))
    c = int(np.sum((~pred_event) & (~obs_event)))

    pod = h / (h + m) if (h + m) > 0 else 0.0
    far = f / (h + f) if (h + f) > 0 else 0.0
    csi = h / (h + f + m) if (h + f + m) > 0 else 0.0

    # Random hit reference for ETS
    dr = ((h + m) * (h + f)) / n if n > 0 else 0.0
    ets = (h - dr) / (h + f + m - dr) if (h + f + m - dr) > 0 else 0.0

    return {
        "POD": round(pod, 4),
        "FAR": round(far, 4),
        "CSI": round(csi, 4),
        "ETS": round(ets, 4),
        "Hits": h,
        "False_Alarms": f,
        "Misses": m,
        "Correct_Negatives": c,
        "Total_Samples": n,
        "Threshold": threshold
    }

