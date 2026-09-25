# SIH26081 Operational System Architecture

**Project Code:** SIH26081  
**Application Name:** Precipitation Fusion & Confidence Engine  
**Research Title:** Adaptive Meteorological Forecast-Observation Fusion  
**System Version:** 1.0.0 (Validated Operational Prototype)  

---

## 1. High-Level Architecture Overview

The SIH26081 system is designed as a decoupled, multi-tier operational architecture that ingests raw Numerical Weather Prediction (NWP) outputs, standardizes them onto a common regular grid, performs quality control, executes deterministic 50/50 fusion, derives calibrated confidence from inter-model disagreement, and serves both REST APIs and an interactive mission-control dashboard.

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                             1. DATA LAYER                                   │
│  • NOAA GFS 0.25° Global Forecast (AWS S3 Open Data, APCP)                  │
│  • ECMWF IFS 0.25° Operational Forecast (GCS Open Data, tp)                 │
│  • IMD 0.25° Gridded Daily Rainfall Analysis (IMD Pune binary archive)      │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
┌──────────────────────────────────────▼──────────────────────────────────────┐
│                          2. PROCESSING LAYER                                │
│  • HTTP Range-request guided byte downloading via index parsing             │
│  • Unit harmonization: m -> mm (ECMWF) and kg/m² -> mm (GFS)                │
│  • 0.25° integer grid alignment over 12°N–20°N, 76°E–85°E                   │
│  • Quality Control (QC): range checks [0, 1500 mm], NaN/ocean masking       │
│  • Terrestrial Land Masking: 791 verified land cells (AP + Telangana)       │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
┌──────────────────────────────────────▼──────────────────────────────────────┐
│                            3. FUSION LAYER                                  │
│  • Formula: P_fused = 0.5 × P_GFS + 0.5 × P_ECMWF                           │
│  • Statistically validated over 72,772 monsoon pairs                        │
│  • Zero dynamic tuning, zero neural networks, zero ML overfitting           │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
┌──────────────────────────────────────▼──────────────────────────────────────┐
│                         4. UNCERTAINTY LAYER                                │
│  • Inter-Model Disagreement: D = |P_GFS - P_ECMWF|                          │
│  • Normalized Disagreement: D_norm = D / (1.0 + P_fused)                    │
│  • Frozen Calibrated Confidence Engine (May 17–31 baseline):                │
│    - High Confidence: D < 0.11 mm     (Historical MAE: 2.02 mm)             │
│    - Moderate Confidence: 0.11 ≤ D < 2.06 mm (Historical MAE: 3.75 mm)     │
│    - Low Confidence: D ≥ 2.06 mm      (Historical MAE: 9.46 mm)             │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
┌──────────────────────────────────────▼──────────────────────────────────────┐
│                        5. VERIFICATION LAYER                                │
│  • IMD Retrospective Verification with strict causal T-1 latency            │
│  • Error calculation: e_abs = |P_fused - P_IMD|                             │
│  • Documented 87.5% temporal accumulation overlap disclosure                │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
┌──────────────────────────────────────▼──────────────────────────────────────┐
│                            6. API LAYER                                     │
│  • Python ThreadingHTTPServer on port 8080 (src/operational/server.py)       │
│  • /api/system/health, /api/dates, /api/forecast, /api/forecast/point,      │
│    /api/verification/bins, /api/verification/cross-period                   │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
┌──────────────────────────────────────▼──────────────────────────────────────┐
│                       7. PRESENTATION LAYER                                 │
│  • Light-neutral mission-control UI (Inter & JetBrains Mono)                │
│  • Interactive Leaflet.js gridded map (791 clickable 0.25° cells)           │
│  • 6 Layer toggles: Fused, Confidence, Disagreement, GFS, ECMWF, IMD        │
│  • 6-Level Progressive Disclosure Grid Cell Inspector                       │
│  • Interactive Timeline Scrubber & 6-Step Guided Judge Tour                 │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Layer-by-Layer Technical Specification

### 2.1 Data Layer

1. **NOAA Global Forecast System (GFS 0.25°):**
   * Source: NOAA / NCEP via AWS Open Data Registry (`s3://noaa-gfs-bdp-pds`).
   * Cycle: 00:00:00 UTC initialization.
   * Parameter: Total accumulation `APCP` at surface level.
   * Forecast Lead: +24 hours (accumulated from 00 UTC Day $T$ to 00 UTC Day $T+1$).
   * Access Method: HTTP byte-range retrieval parsed from `.idx` file.
2. **ECMWF Integrated Forecasting System (IFS 0.25°):**
   * Source: European Centre for Medium-Range Weather Forecasts via Google Cloud Storage Open Data.
   * Cycle: 00:00:00 UTC operational deterministic run.
   * Parameter: Total precipitation `tp` at surface level.
   * Forecast Lead: +24 hours (`step=24`, accumulated from 00 UTC Day $T$ to 00 UTC Day $T+1$).
   * Access Method: HTTP byte-range retrieval parsed from `.index` metadata.
3. **IMD Daily Gridded Rainfall Analysis (0.25°):**
   * Source: Climate Research & Services, India Meteorological Department (IMD) Pune.
   * Dataset: `ind2024_rfp25.grd` (binary regular grid).
   * Accumulation Window: 08:30 IST on Day $T$ to 08:30 IST on Day $T+1$ (03:00 UTC to 03:00 UTC).

---

### 2.2 Processing Layer

* **Coordinate Grid Definition:**
  * Latitude: 33 points spanning $12.0^\circ\text{N}$ to $20.0^\circ\text{N}$ in steps of $0.25^\circ$.
  * Longitude: 37 points spanning $76.0^\circ\text{E}$ to $85.0^\circ\text{E}$ in steps of $0.25^\circ$.
  * Total bounding box cells: $33 \times 37 = 1,221$ cells.
* **Terrestrial Land Masking:**
  * Excludes all open water (Bay of Bengal, Arabian Sea) and points outside Indian land borders using IMD valid observation indicators.
  * Verified active terrestrial cells: **791 cells**.
  * Subregional breakdown:
    * Coastal Andhra Pradesh: 136 cells
    * Rayalaseema: 224 cells
    * Telangana: 341 cells
    * Border / Western Ghats / Northern fringe: 90 cells
* **Quality Control (QC):**
  * Numerical bounds: Every precipitation value must lie within $[0.0\text{ mm}, 1500.0\text{ mm}]$.
  * Missing value handling: No interpolation or silent imputation. If source data is missing, the system returns an explicit status (`DATE_NOT_FOUND`, `DATA_UNAVAILABLE`).

---

### 2.3 Fusion Layer

* **Mathematical Formula:**
  $$P_{\text{fused}}(i, j) = 0.5 \times P_{\text{GFS}}(i, j) + 0.5 \times P_{\text{ECMWF}}(i, j)$$
* **Scientific Rationale:**
  * Across 72,772 empirical samples in EXP004, the 50/50 equal-weight ensemble achieved a seasonal MAE of **$7.321\text{ mm}$**, outperforming complex causal adaptive weighting ($7.372\text{ mm}$) with statistical significance ($p = 0.016$).
  * The constituent models have an error correlation of $r_{\text{error}} \approx 0.553$, allowing linear equal weighting to cancel independent variance without introducing dynamic weight fitting to high-frequency synoptic noise.

---

### 2.4 Uncertainty & Confidence Engine

* **Raw Disagreement ($D$):**
  $$D(i, j) = |P_{\text{GFS}}(i, j) - P_{\text{ECMWF}}(i, j)| \quad (\text{mm})$$
* **Normalized Disagreement ($D_{\text{norm}}$):**
  $$D_{\text{norm}}(i, j) = \frac{D(i, j)}{1.0 + P_{\text{fused}}(i, j)}$$
* **Frozen Confidence Classification:**
  * **High Confidence ($D < 0.11\text{ mm}$):** Historical MAE = $2.02\text{ mm}$, RMSE = $5.54\text{ mm}$.
  * **Moderate Confidence ($0.11 \le D < 2.06\text{ mm}$):** Historical MAE = $3.75\text{ mm}$, RMSE = $7.97\text{ mm}$.
  * **Low Confidence ($D \ge 2.06\text{ mm}$):** Historical MAE = $9.46\text{ mm}$, RMSE = $15.13\text{ mm}$.
* **Empirical Grounding:** Disagreement correlates strongly with subsequent forecast error ($r = 0.4915, \rho = 0.5843$), establishing that high inter-model spread indicates elevated forecast error.

---

### 2.5 Verification Layer

* **Retrospective Audit:** Forecasts are audited against IMD observations.
* **Causal Latency ($T-1$):** At 00:00 UTC cycle initialization on Day $T$, IMD observations for Day $T$ are in the future. Verification is performed strictly retrospectively.
* **Temporal Overlap Disclosure:** Transparently discloses that NWP (00–00 UTC) and IMD (03–03 UTC) share an approximate 87.5% temporal accumulation overlap.

---

### 2.6 API Layer (Port 8080)

Implemented via Python standard library `ThreadingHTTPServer` in `src/operational/server.py`:

| Endpoint | Method | Parameters | Description |
| :--- | :---: | :--- | :--- |
| `/api/system/health` | GET | None | System status (`ONLINE`), active domain, total cells (791), available dates (92). |
| `/api/dates` | GET | None | Complete list of all 92 validated continuous dates with season flags. |
| `/api/forecast` | GET | `date=YYYY-MM-DD` | Complete 791-cell spatial grid with GFS, ECMWF, fused, $D$, $D_{\text{norm}}$, confidence, and IMD. |
| `/api/forecast/point` | GET | `lat=...&lon=...&date=...` | Single-cell query with nearest cell lookup and out-of-domain rejection. |
| `/api/verification/bins` | GET | None | EXP004 disagreement bin performance statistics. |
| `/api/verification/cross-period` | GET | None | Full-season cross-period benchmark metrics (June, July, August, Full Season). |

---

### 2.7 Presentation Layer

* Pure HTML5, CSS3, and modern Vanilla JavaScript (no external framework dependencies).
* Integrated Leaflet.js map with light-neutral cartography.
* 6-Level Progressive Disclosure Cell Inspector:
  * **Level 1:** Primary Fused Forecast, Regime, Confidence Badge.
  * **Level 2:** "Why this confidence?" Explainable rationale.
  * **Level 3:** Side-by-side NWP comparison (GFS vs. ECMWF vs. Fused).
  * **Level 4:** Retrospective IMD Verification Audit (with 87.5% overlap note).
  * **Level 5:** Technical grid geometry ($0.25^\circ$ cell boundaries, $D_{\text{norm}}$).
  * **Level 6:** Complete data provenance and initialization timestamps.
* Timeline controls: play/pause, step backward, step forward, direct date selection.
* 6-Step Guided Judge Demonstration Tour modal.
