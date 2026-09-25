# EXP004 Historical Data Availability Audit & Decision Gate

**Document:** `results/reports/EXP004_DATA_AVAILABILITY.md`  
**Execution Stage:** Stage 0 — Mandatory Data Availability Audit  
**Date of Audit:** September 25, 2026  
**Audited Sources:**
1. **NOAA Global Forecast System (GFS)** 0.25° operational archive
2. **ECMWF Integrated Forecasting System (IFS)** 0.25° operational open data archive
3. **India Meteorological Department (IMD)** 0.25° daily gridded rainfall analysis (`ind2024_rfp25.grd`)

---

## 1. Executive Summary & Audit Findings

An exhaustive data availability audit was conducted to evaluate whether multi-period temporal generalization for **EXP004** can be established reproducibly without synthetic data or proxy products.

### Key Audit Findings:
1. **Local Disk Baseline:**
   - **45 coincident days** are currently downloaded and verified on local disk:
     - May 17, 2024 – May 31, 2024 (15 days, $N = 11,865$ valid land grid-pairs)
     - June 1, 2024 – June 30, 2024 (30 days, $N = 23,730$ valid land grid-pairs)
2. **IMD Ground Truth Availability:**
   - Local file `data/raw/imd/ind2024_rfp25.grd` is verified at **25,495,560 bytes**.
   - Exactly **366 days** (full leap year: January 1, 2024 to December 31, 2024) are present.
   - Missing IMD dates across 2024: **0 days**.
3. **Remote NWP Archive Verification:**
   - **July 1–31, 2024 (31 days):** Probed 100% of daily GFS and ECMWF index files. **Missing GFS = 0, Missing ECMWF = 0**.
   - **August 1–31, 2024 (31 days):** Probed 100% of daily GFS and ECMWF index files. **Missing GFS = 0, Missing ECMWF = 0**.
4. **Decision Gate Resolution:**
   - **CASE B applies:** Additional real NWP forecast data exists on open public cloud archives and can be acquired via byte-range slicing with minimal network bandwidth (~146 MB per month).

---

## 2. Comprehensive Inventory of Data Availability

| Dimension | NOAA GFS | ECMWF IFS (oper) | IMD Gridded Rainfall | Common Coincidence |
| :--- | :--- | :--- | :--- | :--- |
| **Earliest Available Date** | 2021-01-01 | 2024-03-01 | 2024-01-01 | **2024-03-01** |
| **Latest Available Date** | Present | Present | 2024-12-31 | **2024-12-31** |
| **Audited Common Range** | 2024-05-01 to 2024-08-31 | 2024-05-01 to 2024-08-31 | 2024-01-01 to 2024-12-31 | **2024-05-01 to 2024-08-31** |
| **Currently on Disk** | 45 days (May 17–Jun 30) | 45 days (May 17–Jun 30) | 366 days (Full 2024) | **45 days** (35,595 pairs) |
| **Available in Remote Archive**| May (31), Jun (30), Jul (31), Aug (31) | May (31), Jun (30), Jul (31), Aug (31) | May (31), Jun (30), Jul (31), Aug (31) | **123 continuous days** |
| **Missing GFS Dates** | **0** in May–Aug 2024 | N/A | N/A | **0** |
| **Missing ECMWF Dates** | N/A | **0** in May–Aug 2024 | N/A | **0** |
| **Missing IMD Dates** | N/A | N/A | **0** in 2024 | **0** |
| **Forecast Cycle** | 00:00 UTC | 00:00 UTC | 08:30 IST (Daily accumulation) | Synchronized |
| **Forecast Lead Time** | +24 hours (`f024`) | +24 hours (`step=24`) | 24-hour accumulation | Synchronized |
| **Target Variable** | `APCP` (surface) | `tp` (surface) | `rain` (daily gridded) | Converted to $\text{mm}$ |
| **Raw Units** | $\text{kg m}^{-2}$ ($= \text{mm}$) | $\text{m}$ ($\times 1000 = \text{mm}$) | $\text{mm}$ | Exactly 1:1 $\text{mm}$ |
| **Spatial Grid Resolution** | $0.25^\circ \times 0.25^\circ$ | $0.25^\circ \times 0.25^\circ$ | $0.25^\circ \times 0.25^\circ$ | Identical integer grid |
| **Domain Bounds** | $12.0^\circ\text{N}-20.0^\circ\text{N}, 76.0^\circ\text{E}-85.0^\circ\text{E}$ | $12.0^\circ\text{N}-20.0^\circ\text{N}, 76.0^\circ\text{E}-85.0^\circ\text{E}$ | $12.0^\circ\text{N}-20.0^\circ\text{N}, 76.0^\circ\text{E}-85.0^\circ\text{E}$ | Coincident 33 lats $\times$ 37 lons |
| **Ocean Masking** | Evaluated on land | Evaluated on land | Negative/Ocean = -999.0 | 791 terrestrial points/day |

---

## 3. Remote Archive Specifications & Reproducible Access Paths

### 3.1 NOAA GFS 0.25° Archive
- **Repository Base URL:** `https://noaa-gfs-bdp-pds.s3.amazonaws.com`
- **Archive Type:** AWS Public Dataset (NOAA Open Data Dissemination / NODD)
- **File Pattern:**
  - Index: `gfs.{YYYYMMDD}/00/atmos/gfs.t00z.pgrb2.0p25.f024.idx`
  - GRIB2 Data: `gfs.{YYYYMMDD}/00/atmos/gfs.t00z.pgrb2.0p25.f024`
- **Variable Slicing Mechanism:** HTTP `Range: bytes={start}-{end}` parsed from `.idx` line matching `APCP:surface:0-1 day acc fcst:`.
- **Expected Download Size:** $\approx 3.5\text{ MB}$ per daily slice ($\approx 108.5\text{ MB}$ per 31-day month).

### 3.2 ECMWF IFS 0.25° Operational Archive
- **Repository Base URL:** `https://storage.googleapis.com/ecmwf-open-data` (Google Cloud Storage) / `https://ecmwf-forecasts.s3.eu-central-1.amazonaws.com` (AWS S3 mirror)
- **Archive Type:** ECMWF Open Data Public Bucket
- **File Pattern:**
  - Index: `{YYYYMMDD}/00z/ifs/0p25/oper/{YYYYMMDD}000000-24h-oper-fc.index`
  - GRIB2 Data: `{YYYYMMDD}/00z/ifs/0p25/oper/{YYYYMMDD}000000-24h-oper-fc.grib2`
- **Variable Slicing Mechanism:** HTTP `Range: bytes={_offset}-{_offset+_length-1}` parsed from JSON line matching `param="tp"`, `levtype="sfc"`, `step="24"`.
- **Expected Download Size:** $\approx 1.2\text{ MB}$ per daily slice ($\approx 37.2\text{ MB}$ per 31-day month).

### 3.3 IMD 0.25° Observational Ground Truth
- **Local Path:** `data/raw/imd/ind2024_rfp25.grd`
- **Source:** India Meteorological Department National Climate Centre (Pune)
- **Status:** Already complete on local disk for all 366 days of 2024. No download required.

---

## 4. Evaluation Windows for EXP004 Multi-Period Design

To achieve true multi-period temporal generalization across distinct meteorological phases of the 2024 Indian summer monsoon:

| Window ID | Calendar Dates | Days ($N_{\text{days}}$) | Land Pairs ($N$) | Monsoon Synoptic Regime | Role in EXP004 |
| :---: | :---: | :---: | :---: | :--- | :--- |
| **Calibration Window (W0)** | May 17 – May 31, 2024 | 15 | 11,865 | Pre-monsoon / early onset | Initial rule & threshold calibration |
| **Test Period 1 (P1)** | June 1 – June 30, 2024 | 30 | 23,730 | Monsoon advance / onset phase | Unseen Test Window 1 (EXP001–003 locked baseline) |
| **Test Period 2 (P2)** | July 1 – July 31, 2024 | 31 | 24,521 | Peak monsoon / active depression phase | Unseen Test Window 2 (Generalization target) |
| **Test Period 3 (P3)** | August 1 – August 31, 2024 | 31 | 24,521 | Peak monsoon / active-break cycles | Unseen Test Window 3 (Generalization target) |

---

## 5. Data Availability Decision Gate Resolution

According to the criteria established in **Section 1 of the EXP004 Protocol**:

- **[ ] CASE A — Sufficient historical coverage already on disk:**  
  *Rejected.* Only May 17–June 30 (45 days) currently resides on disk. June 2024 alone cannot substantiate a multi-period temporal generalization claim.
- **[x] CASE B — Additional data exists but requires downloading:**  
  *CONFIRMED AND APPROVED.* 
  - Complete data for July 2024 (31 days) and August 2024 (31 days) has been verified 100% present on remote public archives with zero missing dates.
  - Slicing protocol will download only the required 24h accumulation slices (~146 MB per month).
  - No synthetic data, reanalysis, or proxy products are needed.
- **[ ] CASE C — Insufficient historical coverage exists (HARD STOP):**  
  *Not triggered.* Continuous historical coverage is verified available.

### Stage 0 Status: PASS
Stage 0 Data Availability Audit is complete. The repository is authorized to enter Stage 1 download and evaluation for July 2024 and August 2024 multi-period temporal validation.
