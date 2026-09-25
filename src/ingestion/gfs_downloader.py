"""
NOAA GFS Forecast Data Ingestion Module
Downloads 24-hour total precipitation accumulation records from NOAA GFS 0.25°
via AWS Open Data S3 archive using HTTP byte-range indexing.
"""
import os
import urllib.request
from typing import Optional, Tuple
from datetime import datetime, date
from src.utils.logger import setup_logger

logger = setup_logger("GFS_Downloader")

AWS_GFS_BASE = "https://noaa-gfs-bdp-pds.s3.amazonaws.com"

def get_apcp_byte_range(idx_content: str) -> Tuple[int, Optional[int]]:
    """
    Parses a GFS .idx index file to locate the byte offsets for 24-hour APCP.
    Targets 'APCP:surface:0-1 day acc fcst:'.
    """
    lines = idx_content.strip().splitlines()
    target_idx = None
    start_byte = None
    
    for i, line in enumerate(lines):
        parts = line.split(":")
        if len(parts) >= 6:
            var_name = parts[3]
            level = parts[4]
            forecast = parts[5]
            if var_name == "APCP" and "surface" in level and "0-1 day" in forecast:
                target_idx = i
                start_byte = int(parts[1])
                break

    if target_idx is None or start_byte is None:
        raise ValueError("Could not find 24-hour APCP record in GFS .idx file.")

    end_byte = None
    if target_idx + 1 < len(lines):
        next_parts = lines[target_idx + 1].split(":")
        end_byte = int(next_parts[1]) - 1

    return start_byte, end_byte

def download_gfs_forecast_day(
    init_date: date,
    cycle: str = "00",
    lead_hours: int = 24,
    output_dir: str = "data/raw/gfs",
    force_download: bool = False
) -> str:
    """
    Downloads the 24-hour accumulated precipitation field for a specific GFS run.
    
    Args:
        init_date: Forecast initialization date
        cycle: Forecast cycle (e.g. "00")
        lead_hours: Forecast lead time (e.g. 24)
        output_dir: Local destination directory
        force_download: Overwrite existing local file
        
    Returns:
        Path to local GRIB2 slice file
    """
    os.makedirs(output_dir, exist_ok=True)
    date_str = init_date.strftime("%Y%m%d")
    out_filename = f"gfs_{date_str}_{cycle}z_apcp_f{lead_hours:03d}.grib2"
    dest_path = os.path.join(output_dir, out_filename)

    if os.path.exists(dest_path) and not force_download and os.path.getsize(dest_path) > 10000:
        logger.info(f"GFS file already exists: {dest_path} ({os.path.getsize(dest_path)} bytes)")
        return dest_path

    idx_url = f"{AWS_GFS_BASE}/gfs.{date_str}/{cycle}/atmos/gfs.t{cycle}z.pgrb2.0p25.f{lead_hours:03d}.idx"
    data_url = f"{AWS_GFS_BASE}/gfs.{date_str}/{cycle}/atmos/gfs.t{cycle}z.pgrb2.0p25.f{lead_hours:03d}"

    logger.info(f"Fetching index from {idx_url}...")
    req_idx = urllib.request.Request(idx_url, headers={"User-Agent": "Mozilla/5.0 SIH26081/1.0"})
    with urllib.request.urlopen(req_idx, timeout=20) as resp:
        idx_content = resp.read().decode("utf-8")

    start_byte, end_byte = get_apcp_byte_range(idx_content)
    logger.info(f"Located APCP byte range: {start_byte} to {end_byte}")

    headers = {"User-Agent": "Mozilla/5.0 SIH26081/1.0"}
    if end_byte is not None:
        headers["Range"] = f"bytes={start_byte}-{end_byte}"
    else:
        headers["Range"] = f"bytes={start_byte}-"

    req_data = urllib.request.Request(data_url, headers=headers)
    with urllib.request.urlopen(req_data, timeout=60) as resp:
        raw_grib = resp.read()

    with open(dest_path, "wb") as f:
        f.write(raw_grib)

    logger.info(f"Saved GFS APCP record to {dest_path} ({len(raw_grib)} bytes)")
    return dest_path
