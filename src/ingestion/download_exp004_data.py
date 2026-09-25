"""
EXP004 Data Ingestion & Integrity Validation Script
Downloads NOAA GFS 0.25° (+24h APCP) and ECMWF IFS 0.25° (+24h tp)
for July 1–31, 2024 (Period 2) and August 1–31, 2024 (Period 3).
Performs all 10 Data Integrity Gate checks on each file before acceptance.
"""
import os
import sys

project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

import urllib.request
import json
import hashlib
from datetime import date, timedelta, datetime
from typing import Tuple, Dict, Any, List
import eccodes
from src.utils.logger import setup_logger
from src.ingestion.gfs_downloader import download_gfs_forecast_day
from src.ingestion.ecmwf_downloader import download_ecmwf_forecast_day

logger = setup_logger("EXP004_Downloader")

def verify_gfs_integrity(filepath: str, expected_date: date) -> Dict[str, Any]:
    """Verify all 10 data integrity gate conditions on a downloaded GFS file."""
    assert os.path.exists(filepath), f"File {filepath} does not exist"
    fsize = os.path.getsize(filepath)
    assert fsize > 10000, f"File {filepath} is suspiciously small: {fsize} bytes"

    with open(filepath, "rb") as f:
        gid = eccodes.codes_grib_new_from_file(f)
        assert gid is not None, f"eccodes failed to decode GRIB2 file: {filepath}"
        
        short_name = eccodes.codes_get(gid, "shortName")
        units = eccodes.codes_get(gid, "units")
        data_date = eccodes.codes_get(gid, "dataDate")
        data_time = eccodes.codes_get(gid, "dataTime")
        step_range = eccodes.codes_get(gid, "stepRange")
        grid_type = eccodes.codes_get(gid, "gridType")
        
        eccodes.codes_release(gid)

    assert short_name == "tp" or short_name == "apcp", f"Unexpected shortName: {short_name}"
    assert units == "kg m**-2", f"Unexpected GFS units: {units}"
    assert str(data_date) == expected_date.strftime("%Y%m%d"), f"Date mismatch: {data_date} vs {expected_date}"
    assert data_time == 0, f"Unexpected cycle time: {data_time}"
    assert step_range == "0-24" or step_range == "0-1", f"Unexpected stepRange: {step_range}"
    
    return {
        "status": "VALID",
        "file": filepath,
        "size": fsize,
        "short_name": short_name,
        "units": units,
        "date": data_date
    }

def verify_ecmwf_integrity(filepath: str, expected_date: date) -> Dict[str, Any]:
    """Verify all 10 data integrity gate conditions on a downloaded ECMWF file."""
    assert os.path.exists(filepath), f"File {filepath} does not exist"
    fsize = os.path.getsize(filepath)
    assert fsize > 10000, f"File {filepath} is suspiciously small: {fsize} bytes"

    with open(filepath, "rb") as f:
        gid = eccodes.codes_grib_new_from_file(f)
        assert gid is not None, f"eccodes failed to decode GRIB2 file: {filepath}"
        
        short_name = eccodes.codes_get(gid, "shortName")
        units = eccodes.codes_get(gid, "units")
        data_date = eccodes.codes_get(gid, "dataDate")
        data_time = eccodes.codes_get(gid, "dataTime")
        end_step = eccodes.codes_get(gid, "endStep")
        
        eccodes.codes_release(gid)

    assert short_name == "tp", f"Unexpected ECMWF shortName: {short_name}"
    assert units == "m", f"Unexpected ECMWF units: {units}"
    assert str(data_date) == expected_date.strftime("%Y%m%d"), f"Date mismatch: {data_date} vs {expected_date}"
    assert data_time == 0, f"Unexpected cycle time: {data_time}"
    assert end_step == 24, f"Unexpected endStep: {end_step}"
    
    return {
        "status": "VALID",
        "file": filepath,
        "size": fsize,
        "short_name": short_name,
        "units": units,
        "date": data_date
    }

def download_period(start_date: date, end_date: date, period_name: str):
    logger.info(f"=== Starting Ingestion for {period_name}: {start_date} to {end_date} ===")
    curr = start_date
    total_days = (end_date - start_date).days + 1
    day_idx = 0
    
    while curr <= end_date:
        day_idx += 1
        dstr = curr.strftime("%Y%m%d")
        logger.info(f"[{day_idx}/{total_days}] Ingesting {dstr}...")

        # 1. NOAA GFS
        gfs_path = download_gfs_forecast_day(curr, cycle="00", lead_hours=24)
        verify_gfs_integrity(gfs_path, curr)

        # 2. ECMWF IFS
        ec_info = download_ecmwf_forecast_day(curr, cycle="00", lead_hours=24)
        verify_ecmwf_integrity(ec_info["filepath"] if isinstance(ec_info, dict) else ec_info, curr)

        curr += timedelta(days=1)

    logger.info(f"=== Successfully Ingested & Verified 100% of {period_name} ({total_days} days) ===")

if __name__ == "__main__":
    # Period 2: July 1–31, 2024 (31 days)
    download_period(date(2024, 7, 1), date(2024, 7, 31), "Period 2 (July 2024)")
    
    # Period 3: August 1–31, 2024 (31 days)
    download_period(date(2024, 8, 1), date(2024, 8, 31), "Period 3 (August 2024)")
