"""
ECMWF IFS Forecast Data Ingestion Module
Downloads 24-hour total precipitation accumulation records from ECMWF IFS 0.25°
via Google Cloud Storage Open Data mirror using HTTP byte-range indexing.
"""
import os
import sys

project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

import urllib.request
import json
import hashlib
from datetime import date
from typing import Tuple, Dict, Any, Optional
import eccodes
from src.utils.logger import setup_logger

logger = setup_logger("ECMWF_Downloader")

GCS_ECMWF_BASE = "https://storage.googleapis.com/ecmwf-open-data"

def get_ecmwf_tp_byte_range(index_content: str) -> Tuple[int, int]:
    """
    Parses ECMWF .index JSON lines to find byte offset and length for 24h total precipitation.
    """
    for line in index_content.strip().splitlines():
        if not line.strip():
            continue
        entry = json.loads(line)
        if (
            entry.get("param") == "tp" and
            entry.get("levtype") == "sfc" and
            str(entry.get("step")) == "24"
        ):
            offset = int(entry["_offset"])
            length = int(entry["_length"])
            return offset, length
            
    raise ValueError("Total precipitation (param='tp', levtype='sfc', step='24') not found in index.")

def download_ecmwf_forecast_day(
    init_date: date,
    cycle: str = "00",
    lead_hours: int = 24,
    output_dir: str = "data/raw/ecmwf",
    force_download: bool = False
) -> Dict[str, Any]:
    """
    Downloads the 24-hour accumulated precipitation field for a specific ECMWF IFS run.
    
    Args:
        init_date: Forecast initialization date
        cycle: Forecast cycle (e.g. "00")
        lead_hours: Forecast lead time (e.g. 24)
        output_dir: Local destination directory
        force_download: Overwrite existing local file
        
    Returns:
        Dict with filepath, hashes, and GRIB metadata
    """
    os.makedirs(output_dir, exist_ok=True)
    date_str = init_date.strftime("%Y%m%d")
    out_filename = f"ecmwf_{date_str}_{cycle}z_tp_f{lead_hours:03d}.grib2"
    dest_path = os.path.join(output_dir, out_filename)

    if os.path.exists(dest_path) and not force_download and os.path.getsize(dest_path) > 10000:
        logger.info(f"ECMWF file already exists: {dest_path} ({os.path.getsize(dest_path)} bytes)")
    else:
        index_url = f"{GCS_ECMWF_BASE}/{date_str}/{cycle}z/ifs/0p25/oper/{date_str}{cycle}0000-{lead_hours}h-oper-fc.index"
        data_url = f"{GCS_ECMWF_BASE}/{date_str}/{cycle}z/ifs/0p25/oper/{date_str}{cycle}0000-{lead_hours}h-oper-fc.grib2"

        logger.info(f"Fetching ECMWF index from {index_url}...")
        req_idx = urllib.request.Request(index_url, headers={"User-Agent": "SIH26081-Research/1.0"})
        with urllib.request.urlopen(req_idx, timeout=20) as resp:
            index_content = resp.read().decode("utf-8")

        offset, length = get_ecmwf_tp_byte_range(index_content)
        end_byte = offset + length - 1
        logger.info(f"Located ECMWF tp offset: {offset} to {end_byte} ({length} bytes)")

        req_data = urllib.request.Request(
            data_url,
            headers={
                "Range": f"bytes={offset}-{end_byte}",
                "User-Agent": "SIH26081-Research/1.0"
            }
        )
        with urllib.request.urlopen(req_data, timeout=60) as resp:
            raw_grib = resp.read()

        with open(dest_path, "wb") as f:
            f.write(raw_grib)

        logger.info(f"Saved ECMWF tp record to {dest_path} ({len(raw_grib)} bytes)")

    # Read and audit metadata with eccodes
    with open(dest_path, "rb") as f:
        file_bytes = f.read()
        md5_hash = hashlib.md5(file_bytes).hexdigest()
        sha256_hash = hashlib.sha256(file_bytes).hexdigest()
        
    with open(dest_path, "rb") as f:
        gid = eccodes.codes_grib_new_from_file(f)
        if gid is None:
            raise ValueError(f"Corrupt GRIB2 slice in {dest_path}")
        try:
            meta = {
                "filepath": dest_path,
                "file_size": os.path.getsize(dest_path),
                "md5": md5_hash,
                "sha256": sha256_hash,
                "shortName": eccodes.codes_get(gid, "shortName"),
                "name": eccodes.codes_get(gid, "name"),
                "units": eccodes.codes_get(gid, "units"),
                "dataDate": eccodes.codes_get(gid, "dataDate"),
                "dataTime": eccodes.codes_get(gid, "dataTime"),
                "stepRange": eccodes.codes_get(gid, "stepRange"),
                "startStep": eccodes.codes_get(gid, "startStep"),
                "endStep": eccodes.codes_get(gid, "endStep"),
                "stepUnits": eccodes.codes_get(gid, "stepUnits"),
                "stepType": eccodes.codes_get(gid, "stepType"),
                "Ni": eccodes.codes_get(gid, "Ni"),
                "Nj": eccodes.codes_get(gid, "Nj"),
                "lat1": eccodes.codes_get(gid, "latitudeOfFirstGridPointInDegrees"),
                "lon1": eccodes.codes_get(gid, "longitudeOfFirstGridPointInDegrees"),
                "lat2": eccodes.codes_get(gid, "latitudeOfLastGridPointInDegrees"),
                "lon2": eccodes.codes_get(gid, "longitudeOfLastGridPointInDegrees"),
                "dx": eccodes.codes_get(gid, "iDirectionIncrementInDegrees"),
                "dy": eccodes.codes_get(gid, "jDirectionIncrementInDegrees"),
            }
        finally:
            eccodes.codes_release(gid)

    return meta

if __name__ == "__main__":
    sample_meta = download_ecmwf_forecast_day(date(2024, 6, 1))
    print(json.dumps(sample_meta, indent=2))
