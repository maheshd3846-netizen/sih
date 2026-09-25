"""
Download Historical Training Data for EXP003: May 17 to May 31, 2024
Ensures a clean, non-leaking pre-June calibration period.
"""
import os
import sys

project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

from datetime import date
from src.ingestion.gfs_downloader import download_gfs_forecast_day
from src.ingestion.ecmwf_downloader import download_ecmwf_forecast_day
from src.utils.logger import setup_logger

logger = setup_logger("May_Training_Downloader")

def download_may_training(start_day: int = 17, end_day: int = 31):
    logger.info(f"Downloading pre-June training data from May {start_day} to May {end_day}, 2024...")
    for day in range(start_day, end_day + 1):
        d = date(2024, 5, day)
        logger.info(f"--- Fetching May {day}, 2024 ---")
        gfs_path = download_gfs_forecast_day(d)
        ecmwf_meta = download_ecmwf_forecast_day(d)
        logger.info(f"May {day}: GFS OK ({os.path.getsize(gfs_path)} bytes), ECMWF OK ({ecmwf_meta['file_size']} bytes)")
    logger.info("May training data acquisition complete.")

if __name__ == "__main__":
    download_may_training(17, 31)
