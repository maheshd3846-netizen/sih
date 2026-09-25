# PHASE 1 ENVIRONMENT REPORT

**Project:** SIH26081 — Adaptive Meteorological Forecast-Observation Fusion  
**Phase:** 1 — Data Acquisition, Verification & EXP001  
**Generated Date:** 2026-09-25  

---

## 1. Operating System & Host Environment
* **Operating System:** Microsoft Windows 11 Pro (64-bit), Version 10.0.22621
* **Host Platform:** x86_64
* **Shell:** PowerShell

---

## 2. Python Environment
* **System Python Version:** Python 3.13.14 (64-bit)
* **Active Virtual Environment:** `.venv` (created via `python -m venv .venv` in repository root `C:\sih`)
* **Environment Executables:**
  * Python: `C:\sih\.venv\Scripts\python.exe`
  * Pip: `C:\sih\.venv\Scripts\pip.exe`

---

## 3. Installed Relevant Libraries
Key scientific and data engineering libraries available on the host system:
* **Numerical & Array Computing:** `numpy` (2.5.1), `scipy` (1.18.0)
* **Dataframes & Tabular:** `pandas` (3.0.3)
* **Plotting & Visualization:** `matplotlib` (3.11.0), `seaborn` (0.13.2)
* **Networking & HTTP:** `requests` (2.34.2), `httpx` (0.28.1), `urllib3` (2.7.0)
* **Configuration & Serialization:** `PyYAML` (6.0.3)

Target packages to be installed in `.venv` as needed for meteorological file parsing:
* `xarray`, `netCDF4`, `pyarrow`, `pytest`

---

## 4. Git State
* **Git Status:** Initial empty workspace (`c:\sih`), not yet a git repository.
* **Preservation Status:** Clean repository initialization; no pre-existing user code or files were present to be deleted or overwritten.

---

## 5. Repository Structure
The canonical SIH26081 directory structure has been created:
```text
C:\sih\
│
├── .venv/                      # Isolated virtual environment
├── configs/                    # Experiment configuration files
│   └── experiment_001.yaml
├── data/
│   ├── raw/
│   │   ├── gfs/                # Raw NOAA GFS 0.25° forecast files
│   │   └── imd/                # Raw IMD 0.25° gridded rainfall files
│   ├── processed/              # Aligned, QC'd canonical datasets
│   └── metadata/               # Data source documentation and checksums
├── src/
│   ├── ingestion/              # Download and fetch routines
│   ├── preprocessing/          # Unit conversions and schema standardization
│   ├── verification/           # Time/spatial alignment and metrics
│   └── utils/                  # Coordinate utilities, logging, IO
├── notebooks/                  # Interactive evaluation notebooks
├── results/
│   ├── metrics/                # Benchmark metrics (MAE, RMSE, Bias)
│   ├── plots/                  # Visual validation figures (scatter, spatial, timeseries)
│   └── reports/                # Schema reports and execution summaries
├── docs/                       # Architectural and pipeline documentation
└── tests/                      # Automated unit tests for pipeline components
```

---

## 6. Existing Files Preserved
* Workspace was empty prior to initialization. No user files were modified or deleted.

---

## 7. Proposed Files to be Added in Phase 1
* `configs/experiment_001.yaml`: Experiment configuration for AP & Telangana domain (12°N-20°N, 76°E-85°E), 24h lead.
* `data/metadata/DATA_SOURCES.md`: Full provenance, URLs, schemas, and coordinate definitions.
* `src/ingestion/gfs_downloader.py`: NOAA GFS 0.25° sub-region or forecast downloader.
* `src/ingestion/imd_downloader.py`: IMD 0.25° gridded rainfall acquisition routine.
* `src/preprocessing/gfs_parser.py`: GFS GRIB2/NetCDF reader and accumulation interval handler.
* `src/preprocessing/imd_parser.py`: IMD binary/grd/netCDF reader and coordinate aligner.
* `src/verification/alignment.py`: Deterministic temporal and spatial alignment module.
* `src/verification/metrics.py`: MAE, RMSE, Mean Bias calculations.
* `results/reports/DATA_SCHEMA_REPORT.md`: Raw dataset dimension, coordinate, and semantic verification.
* `results/plots/*`: Scatter, spatial error, and temporal validation figures.
* `results/metrics/exp001_metrics.json`: Evaluated baseline metrics.
* `tests/*`: Unit tests covering temporal math, spatial matching, unit conversion, and quality control.
* `PHASE1_FINAL_REPORT.md`: Comprehensive Phase 1 milestone report.
