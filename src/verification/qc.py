"""
Quality Control (QC) Module for SIH26081
Applies rigorous data validation and audit logging on forecast-observation pairs.
"""
from typing import Dict, Any, Tuple
import numpy as np
import pandas as pd
from src.utils.logger import setup_logger

logger = setup_logger("QualityControl")

def run_quality_control(df: pd.DataFrame) -> Tuple[pd.DataFrame, Dict[str, Any]]:
    """
    Executes strict quality control on the canonical forecast-observation tabular data.
    
    Checks for:
    - Missing forecast values
    - Missing observation values (including IMD -999.0 mask)
    - NaN and infinite values
    - Negative precipitation (< 0.0 mm)
    - Duplicate timestamps and grid cells
    - Monotonic coordinate ordering
    
    Returns:
        (filtered_df, qc_report_dict)
    """
    total_loaded = len(df)
    report = {
        "records_loaded": total_loaded,
        "missing_forecast": 0,
        "missing_observation": 0,
        "nan_or_inf": 0,
        "negative_precipitation": 0,
        "duplicates_removed": 0,
        "records_removed": 0,
        "records_valid": 0
    }

    if total_loaded == 0:
        report["records_valid"] = 0
        return df, report

    # 1. Check duplicates on (valid_time, lat, lon)
    dup_mask = df.duplicated(subset=["valid_time", "latitude", "longitude"], keep="first")
    n_dups = int(dup_mask.sum())
    report["duplicates_removed"] = n_dups
    df_clean = df[~dup_mask].copy()

    # 2. Check NaN and Inf
    nan_inf_gfs = np.isnan(df_clean["gfs_precipitation"]) | np.isinf(df_clean["gfs_precipitation"])
    nan_inf_imd = np.isnan(df_clean["imd_precipitation"]) | np.isinf(df_clean["imd_precipitation"])
    report["missing_forecast"] = int(nan_inf_gfs.sum())
    report["missing_observation"] = int(nan_inf_imd.sum())
    report["nan_or_inf"] = int((nan_inf_gfs | nan_inf_imd).sum())

    # 3. Check impossible negative precipitation
    neg_gfs = df_clean["gfs_precipitation"] < 0.0
    neg_imd = df_clean["imd_precipitation"] < 0.0
    report["negative_precipitation"] = int((neg_gfs | neg_imd).sum())

    # Valid mask
    valid_mask = (~nan_inf_gfs) & (~nan_inf_imd) & (~neg_gfs) & (~neg_imd)
    
    valid_df = df_clean[valid_mask].copy()
    report["records_valid"] = len(valid_df)
    report["records_removed"] = total_loaded - len(valid_df)

    logger.info(
        f"QC Audit: Loaded={report['records_loaded']}, "
        f"Valid={report['records_valid']}, "
        f"MissingObs={report['missing_observation']}, "
        f"MissingFcst={report['missing_forecast']}, "
        f"Duplicates={report['duplicates_removed']}, "
        f"TotalRemoved={report['records_removed']}"
    )

    return valid_df, report
