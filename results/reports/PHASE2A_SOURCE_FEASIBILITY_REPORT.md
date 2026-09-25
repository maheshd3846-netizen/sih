# PHASE 2A: CANDIDATE FORECAST SOURCE FEASIBILITY REPORT

**Project:** SIH26081 — Adaptive Meteorological Forecast-Observation Fusion  
**Phase:** 2A — Multi-Model Expansion & Feasibility Assessment  
**Document:** `results/reports/PHASE2A_SOURCE_FEASIBILITY_REPORT.md`  
**Generated Date:** 2026-09-25  
**Status:** PROPOSED (Awaiting User Confirmation Before Acquisition)  

---

## 1. Executive Summary

To enable scientifically meaningful adaptive forecast fusion, the system requires a **second operational Numerical Weather Prediction (NWP) model** that is:
1. **Genuinely independent** from NOAA GFS in dynamical core, physical parameterizations, and data assimilation.
2. **Temporally identical** to EXP001 (June 2024, 00 UTC initialization cycle, +24h forecast lead time, 24-hour total precipitation accumulation).
3. **Spatially coincident** with our existing $0.25^\circ \times 0.25^\circ$ IMD verification grid over the Andhra Pradesh + Telangana domain ($12^\circ\text{N} - 20^\circ\text{N}, 76^\circ\text{E} - 85^\circ\text{E}$).
4. **Publicly and reproducibly accessible** without proprietary restrictions, paywalls, or rate-limiting blockers.

Following multi-source probing, **ECMWF IFS 0.25° Operational Forecast** is identified as the optimal second source.

---

## 2. Evaluation of Candidate Sources

| Candidate Model | Institutional Origin & Model Independence | June 2024 Availability | Access Mechanism | Grid & Resolution Match | Verdict |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **ECMWF IFS 0.25° (oper)** | **ECMWF (Reading, UK)**<br>• Spectral transform dynamical core<br>• 4D-Var data assimilation<br>• Fully distinct from NOAA FV3 | **30 / 30 Days (100%)** verified on public cloud mirror | Public Google Cloud Storage Open Data mirror (`ecmwf-open-data`) with byte-range index support | **$0.25^\circ \times 0.25^\circ$** regular grid coincident with IMD and GFS | **RECOMMENDED PRIMARY CANDIDATE** |
| **DWD ICON 0.25°** | **Deutscher Wetterdienst (Germany)**<br>• Icosahedral Nonhydrostatic dynamical core<br>• Distinct physics | Rolling 24-48h on DWD server; historical June 2024 accessible via Open-Meteo API | REST API / point-grid querying | Native icosahedral grid interpolated to $0.25^\circ$ | **Viable Fallback / Tertiary Model** |
| **NOAA GEFS** | **NOAA / NCEP (USA)**<br>• Same institution and core FV3 dynamical architecture as GFS | Available on AWS (`noaa-gefs-pds`) | S3 Open Data | $0.25^\circ$ | **REJECTED**: Not institutionally or physically distinct from GFS |
| **NCMRWF NCUM** | **NCMRWF (MoES, India)**<br>• UK Met Office Unified Model core | Restricted historical daily archive | No open unauthenticated API for historical grids | $0.12^\circ$ (requires regridding) | **BLOCKED**: Lacks public unauthenticated open data access |

---

## 3. Recommended Source: ECMWF IFS 0.25° Operational Forecast

### A. Architectural & Meteorological Independence from GFS
* **Dynamical Core:** ECMWF IFS utilizes a hydrostatic, two-time-level semi-implicit semi-Lagrangian spectral transform core ($T_{\text{Co}}1279$), fundamentally distinct from NOAA GFS which uses the finite-volume cubed-sphere dynamical core (FV3).
* **Data Assimilation:** IFS employs an advanced continuous 4-Dimensional Variational Data Assimilation (4D-Var) system with an ensemble of data assimilations (EDA), contrasting with NOAA GFS hybrid 4D-EnVar.
* **Convective & Cloud Physics:** Independent European parameterizations for deep/shallow convection (Tiedtke-Bechtold scheme) and cloud microphysics, providing complementary structural errors ideal for adaptive multi-model fusion.

### B. Raw Dataset & Accumulation Semantics (Verified via Physical Probe)
Probe executed on actual raw slice: `20240601/00z/ifs/0p25/oper/20240601000000-24h-oper-fc.grib2`

* **GRIB2 Metadata Extracted:**
  * `shortName`: `tp` (Total Precipitation)
  * `typeOfLevel`: `sfc` (surface)
  * `dataDate`: `20240601`
  * `dataTime`: `0000` (00 UTC cycle)
  * `stepRange`: `0-24` (`startStep: 0`, `endStep: 24`, `stepUnits: 1` [hour], `stepType: accum`)
  * `Ni`, `Nj`: $1,440 \times 721$ ($0.25^\circ \times 0.25^\circ$ grid)
  * `Raw Units`: `m` (meters of liquid water depth)
  * `Unit Conversion`: $\text{Value (mm)} = \text{Value (m)} \times 1000.0$
* **Accumulation Semantics:**
  ```text
  forecast_initialization_time = 2024-06-01 00:00:00 UTC
  forecast_valid_time          = 2024-06-02 00:00:00 UTC
  accumulation_start           = 2024-06-01 00:00:00 UTC
  accumulation_end             = 2024-06-02 00:00:00 UTC
  accumulation_duration        = 24 hours
  ```
  **100% identical accumulation window to GFS, matching IMD observation period with 87.5% direct co-occurrence.**

### C. Spatial Compatibility with IMD Domain
* Grid spacing is exactly $0.25^\circ$ in both latitude and longitude.
* Coordinates align directly on multiples of $0.25^\circ$ ($12.0, 12.25, \dots, 20.0^\circ\text{N}$; $76.0, 76.25, \dots, 85.0^\circ\text{E}$).
* Zero spatial interpolation error: direct 1-to-1 coordinate indexing.

### D. Data Acquisition & Storage Efficiency
* **Access URL Pattern:**
  * Index: `https://storage.googleapis.com/ecmwf-open-data/{YYYYMMDD}/00z/ifs/0p25/oper/{YYYYMMDD}000000-24h-oper-fc.index`
  * Data: `https://storage.googleapis.com/ecmwf-open-data/{YYYYMMDD}/00z/ifs/0p25/oper/{YYYYMMDD}000000-24h-oper-fc.grib2`
* **Byte-Range Download:** Using `.index`, we locate `param == 'tp'`, `levtype == 'sfc'`, `step == '24'`, requiring only **~820 KB per day** via HTTP Range requests.
* **Total 30-Day Transfer:** $\approx 24.5\text{ MB}$ total (downloads in $< 45\text{ seconds}$).
* **30-Day Availability Status:** **30 / 30 Days (100%) confirmed active and reachable.**

---

## 4. Phase 2 Architecture (EXP002 Plan)

```text
       ┌───────────────────────────────┐
       │   IMD 0.25° Daily Rainfall    │  (Reference Ground Truth)
       └──────────────┬────────────────┘
                      │
           ┌──────────┴──────────┐
           ▼                     ▼
┌─────────────────────┐ ┌─────────────────────┐
│  NOAA GFS (00z +24) │ │ ECMWF IFS (00z +24) │  (Independent NWP Models)
│      EXP001         │ │      EXP002         │
└──────────┬──────────┘ └──────────┬──────────┘
           │                       │
           ▼                       ▼
┌─────────────────────────────────────────────┐
│  Multi-Model Evaluation & Error Covariance  │
│         (MAE, RMSE, Bias, Correlation)      │
└─────────────────────────────────────────────┘
```

1. **EXP001 remains completely untouched and preserved.**
2. A parallel module `src/ingestion/ecmwf_downloader.py` and `src/preprocessing/ecmwf_parser.py` will acquire and parse the ECMWF IFS 24h slice.
3. A multi-model canonical dataset `data/processed/exp002_multimodel_canonical.parquet` will be constructed containing:
   * `init_time`, `valid_time`, `latitude`, `longitude`
   * `gfs_precipitation` (mm)
   * `ecmwf_precipitation` (mm)
   * `imd_precipitation` (mm)
4. Baseline comparative metrics will be computed:
   * GFS vs IMD (MAE, RMSE, Bias)
   * ECMWF vs IMD (MAE, RMSE, Bias)
   * Inter-model correlation ($r_{\text{GFS, ECMWF}}$) and error divergence.

---

## 5. Decision Request

We seek user authorization to proceed with:
1. Creating `configs/experiment_002.yaml` defining ECMWF IFS operational forecast parameters.
2. Ingesting the 30 daily slices of ECMWF IFS 0.25° 24h accumulated precipitation (~24.5 MB total transfer).
3. Generating the standalone EXP002 baseline verification report.
