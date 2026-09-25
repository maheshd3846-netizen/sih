"""
Batch Ingestion Script for June 2024 ECMWF IFS Forecasts
"""
import os
import sys

project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

from datetime import date
from src.ingestion.ecmwf_downloader import download_ecmwf_forecast_day
from src.utils.logger import setup_logger

logger = setup_logger("ECMWF_Batch_Downloader")

def download_june_2024():
    logger.info("Starting batch acquisition of June 2024 ECMWF IFS 0.25 operational forecasts...")
    for day in range(1, 31):
        d = date(2024, 6, day)
        meta = download_ecmwf_forecast_day(d)
        logger.info(f"[{day}/30] Successfully verified {d.isoformat()}: {meta['file_size']} bytes, MD5={meta['md5']}")
    logger.info("All 30 days of June 2024 ECMWF IFS forecasts successfully acquired and verified.")

if __name__ == "__main__":
    download_june_2024()
