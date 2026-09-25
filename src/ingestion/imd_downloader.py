"""
IMD Gridded Rainfall Data Acquisition Module
Downloads official 0.25° gridded daily rainfall binary datasets from IMD Pune.
"""
import os
import urllib.request
import urllib.parse
import hashlib
from typing import Optional
from src.utils.logger import setup_logger

logger = setup_logger("IMD_Downloader")

IMD_PUNE_POST_URL = "https://www.imdpune.gov.in/cmpg/Griddata/rainfall.php"

def download_imd_rainfall_year(
    year: int,
    output_dir: str = "data/raw/imd",
    force_download: bool = False
) -> str:
    """
    Downloads the official IMD 0.25° gridded rainfall binary file for a specified year.
    
    Args:
        year: Calendar year (e.g. 2024)
        output_dir: Directory where raw file will be stored
        force_download: If True, re-downloads even if file already exists
        
    Returns:
        Path to downloaded .grd file
    """
    os.makedirs(output_dir, exist_ok=True)
    filename = f"ind{year}_rfp25.grd"
    dest_path = os.path.join(output_dir, filename)

    is_leap = (year % 4 == 0 and year % 100 != 0) or (year % 400 == 0)
    days = 366 if is_leap else 365
    expected_bytes = days * 129 * 135 * 4

    if os.path.exists(dest_path) and not force_download:
        actual_bytes = os.path.getsize(dest_path)
        if actual_bytes == expected_bytes:
            logger.info(f"IMD file already exists and size matches ({actual_bytes} bytes): {dest_path}")
            return dest_path
        else:
            logger.warning(f"Existing file size ({actual_bytes}) does not match expected ({expected_bytes}). Re-downloading.")

    logger.info(f"Downloading IMD 0.25° rainfall data for year {year} from {IMD_PUNE_POST_URL}...")
    post_data = urllib.parse.urlencode({"rain": str(year)}).encode("utf-8")
    req = urllib.request.Request(
        IMD_PUNE_POST_URL,
        data=post_data,
        headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) SIH26081/1.0"}
    )

    with urllib.request.urlopen(req, timeout=120) as resp:
        content = resp.read()

    with open(dest_path, "wb") as f:
        f.write(content)

    file_size = os.path.getsize(dest_path)
    md5_hash = hashlib.md5(content).hexdigest()
    sha256_hash = hashlib.sha256(content).hexdigest()

    logger.info(f"Successfully downloaded {filename}: {file_size} bytes. MD5: {md5_hash}, SHA256: {sha256_hash}")

    if file_size != expected_bytes:
        raise ValueError(
            f"Downloaded IMD file size ({file_size} bytes) does not match expected "
            f"dimension ({expected_bytes} bytes for {days} days)."
        )

    return dest_path

if __name__ == "__main__":
    download_imd_rainfall_year(2024)
