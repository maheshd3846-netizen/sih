# SIH26081 — Full Problem-Statement Compliance Upgrade Plan (Revised)
**Architecture, Data Acquisition, Machine Learning Blending, Extreme Weather Guidance, and Operational Dashboard Specification**

**System Version:** 2.0.0-COMPLIANCE-REVISED  
**Date:** September 28, 2026  
**Status:** Awaiting User Approval Before Code Implementation

---

## 1. Architectural Clarifications & Scope Corrections

Based on user feedback, two critical architectural issues have been explicitly resolved and unified across the mathematical formulation, APIs, weight maps, UI components, and automated test specifications:

### 1.1 Resolution 1: Role of the AI Component
* **Exact Role:** The AI component is strictly a **Context-Aware Dynamic Weight Allocator / Meta-Learner ($\mathcal{M}_{\text{AI}}$)**. It is **NOT** a third physical numerical forecast source (such as an end-to-end neural NWP emulator).
* **Physical Forecast Sources:** The system utilizes exactly two independent, validated physical Numerical Weather Prediction (NWP) models:
  1. NOAA Global Forecast System (GFS 0.25°) $\rightarrow y_{\text{GFS}}$
  2. ECMWF Integrated Forecasting System (IFS 0.25°) $\rightarrow y_{\text{ECMWF}}$
* **Mathematical Blending Formula:**
  $$\hat{y}_{\text{blended}}(s, t, \tau) = w_{\text{GFS}}(s, t, \tau) \cdot y_{\text{GFS}}(s, t, \tau) + w_{\text{ECMWF}}(s, t, \tau) \cdot y_{\text{ECMWF}}(s, t, \tau)$$
  Subject to:
  $$w_{\text{GFS}}(s, t, \tau) \ge 0, \quad w_{\text{ECMWF}}(s, t, \tau) \ge 0, \quad w_{\text{GFS}}(s, t, \tau) + w_{\text{ECMWF}}(s, t, \tau) = 1.0$$
* **Rule on $w_{\text{AI}}$:** There is **NO** $w_{\text{AI}}$ term in the convex forecast combination, because AI does not emit an independent physical forecast field.
* **Model Weight Maps Specification:**
  Across all 791 terrestrial grid cells and active forecast views, the system produces:
  1. **GFS Weight Map ($w_{\text{GFS}}$)**: Continuous weight assigned to GFS $[0.05, 0.95]$.
  2. **ECMWF Weight Map ($w_{\text{ECMWF}} = 1.0 - w_{\text{GFS}}$)**: Continuous weight assigned to ECMWF $[0.05, 0.95]$.
  3. **AI Adaptation Magnitude Map ($\Delta w_{\text{AI}} = |w_{\text{GFS}} - 0.50|$)**: Measures the spatial intensity of the AI allocator's departure from the 50/50 equal-weight baseline (0.0 = pure neutral baseline; 0.45 = maximum AI-steered reweighting).
  4. **Dominant Model Map**: Categorical assignment for every grid point:
     - `GFS Dominant` if $w_{\text{GFS}} > 0.55$
     - `ECMWF Dominant` if $w_{\text{ECMWF}} > 0.55$
     - `Consensus (Balanced)` if $0.45 \le w_{\text{GFS}} \le 0.55$
  5. **Weight Shannon Entropy Map**: Quantifies allocation dispersion:
     $$H(s) = - \left( w_{\text{GFS}} \ln(w_{\text{GFS}}) + w_{\text{ECMWF}} \ln(w_{\text{ECMWF}}) \right)$$
     Ranges from $H = \ln(2) \approx 0.693$ (maximum uncertainty / equal blend) to $H \approx 0.198$ (high certainty in a single dominant model).

---

### 1.2 Resolution 2: Extreme-Event Guidance (Zero Fabricated Probabilities)
* **Design Decision:** Because the operational NWP inputs are deterministic 00Z global runs (and not 50-member stochastic ensemble perturbations), **no pseudo-probabilities ($P(P \ge X)$) will be fabricated or displayed**.
* **Methodology:** The extreme-event engine implements **Deterministic Meteorological Threshold Exceedance Guidance with Inter-Model Agreement Classification**, strictly adhering to official India Meteorological Department (IMD) and World Meteorological Organization (WMO) protocols:
  1. **Heavy Rainfall Guidance (IMD Pune Protocol):**
     Evaluates blended 24h precipitation against official IMD alert tiers:
     - **No Warning / Light:** $P_{24} < 15.6\text{ mm}$
     - **Moderate Rain (Advisory):** $15.6 \le P_{24} < 64.4\text{ mm}$
     - **Heavy Rain (Yellow Warning):** $64.5 \le P_{24} < 115.5\text{ mm}$
     - **Very Heavy Rain (Orange Warning):** $115.6 \le P_{24} < 204.4\text{ mm}$
     - **Extremely Heavy Rain (Red Warning):** $P_{24} \ge 204.5\text{ mm}$
  2. **Heat-Wave Guidance (IMD New Delhi Protocol):**
     Evaluates blended 2m maximum temperature and climatological departure ($\Delta T = T_{\max} - T_{\text{norm}}$):
     - **Normal / No Warning:** $T_{\max} < 40.0^\circ\text{C}$ or $\Delta T < 4.5^\circ\text{C}$
     - **Heat Wave (Orange Warning):** $T_{\max} \ge 40.0^\circ\text{C}$ with $\Delta T \in [4.5^\circ\text{C}, 6.4^\circ\text{C}]$, OR $T_{\max} \ge 45.0^\circ\text{C}$
     - **Severe Heat Wave (Red Warning):** $T_{\max} \ge 40.0^\circ\text{C}$ with $\Delta T \ge 6.5^\circ\text{C}$, OR $T_{\max} \ge 47.0^\circ\text{C}$
     - *Coastal Stations:* $T_{\max} \ge 37.0^\circ\text{C}$ with $\Delta T \ge 4.5^\circ\text{C}$
  3. **High-Wind Guidance (IMD / WMO Beaufort Protocol):**
     Evaluates sustained 10m wind speed ($W_{10}$) and peak surface gust ($W_{\text{gust}}$):
     - **Normal / Moderate Breeze:** $W_{10} < 40\text{ km/h}$ and $W_{\text{gust}} < 50\text{ km/h}$
     - **Strong Wind (Yellow Advisory):** Sustained $40 \le W_{10} < 62\text{ km/h}$ or $W_{\text{gust}} \ge 50\text{ km/h}$
     - **Squall / Gale Force (Orange Warning):** Sustained $62 \le W_{10} < 88\text{ km/h}$ or $W_{\text{gust}} \ge 62\text{ km/h}$
     - **Severe Gale / Storm (Red Warning):** Sustained $W_{10} \ge 88\text{ km/h}$ or $W_{\text{gust}} \ge 90\text{ km/h}$
  4. **Inter-Model Consensus Agreement Status:**
     For every threshold alert, the system calculates model agreement:
     - `UNANIMOUS_EXCEEDANCE`: Both GFS and ECMWF independently exceed the warning threshold.
     - `DIVERGENT_GFS_ONLY`: Only GFS exceeds the warning threshold (ECMWF below).
     - `DIVERGENT_ECMWF_ONLY`: Only ECMWF exceeds the warning threshold (GFS below).
     - `BELOW_WARNING_THRESHOLD`: Neither model triggers warning criteria.
  5. **Calibrated Confidence Integration:**
     Exceedance alerts are cross-referenced with empirical confidence classes from EXP004 (High, Moderate, Low confidence based on inter-model spread $D$).

---

## 2. Updated Requirement-to-Component Traceability Matrix

| # | Requirement | Source Data | Features / Covariates | Algorithm / Mathematical Formulation | Verification Metric | API Endpoint | UI Component | Automated Test |
|---|-------------|-------------|-----------------------|--------------------------------------|---------------------|--------------|--------------|----------------|
| **1** | **Dynamically Blended Forecast** | NOAA GFS 0.25°, ECMWF IFS 0.25° | Forecast values, spread, regime, spatial embeddings | Constrained convex combination: $\hat{y} = w_{\text{GFS}} y_{\text{GFS}} + w_{\text{ECMWF}} y_{\text{ECMWF}}$, $w_m \ge 0, \sum w_m = 1$ | MAE, RMSE, Bias, Correlation, Tail Error | `/api/v2/forecast` | Dynamic Blend Map Layer & Inspector Card | `test_weights_sum_to_one`, `test_weights_non_negative` |
| **2** | **Historical Skill-Aware Weighting** | Causal lookback window $T-W$ to $T-1$ ($W \in \{5, 10, 15\}$) | Rolling model MAE & RMSE, rolling bias | Causal inverse-variance / hedge weighting: $w_m \propto \exp(-\eta \cdot \text{MAE}_{m, \text{hist}})$ | Rolling Skill vs Baseline Skill Gain | `/api/v2/weights/attribution` | "Why Did Weights Change?" Card | `test_causal_lookback_cutoff`, `test_no_future_leakage` |
| **3** | **Lead-Time-Aware Weighting** | +24h, +48h, +72h forecast cycles | Lead step $\tau \in \{24, 48, 72\}$, model degradation curves | Lead-conditioned parameter vectors: $\mathbf{w}(\tau) = \text{Softmax}(\mathbf{\theta}_\tau^T \mathbf{x})$ | Skill decay rate $\Delta \text{MAE} / \Delta \text{lead}$ | `/api/v2/forecast?lead=24,48,72` | Lead Time Selector (+24h, +48h, +72h) | `test_lead_time_decay_monotonicity` |
| **4** | **Region-Aware Weighting** | 791 terrestrial cells across 4 subregions | Latitude, Longitude, Subregion ID, Coastal Distance, Elevation | Subregion-specific calibration priors with spatial Laplacian smoothing | Spatial MAE distribution by subregion | `/api/v2/weights/map` | Subregion Filter & Regional Breakdown Inspector | `test_spatial_alignment_791_cells` |
| **5** | **Season-Aware Weighting** | Multi-month & multi-year historical dataset | Month, day-of-year, seasonal regime (Pre-monsoon, SW Monsoon, Post-monsoon) | Hierarchical Bayes / Season-specific priors | Seasonal MAE & Bias across distinct seasons | `/api/v2/verification/seasonal` | Seasonal Matrix Heatmap | `test_season_transition_continuity` |
| **6** | **Weather-Regime-Aware Weighting** | Consensus predicted intensity, synoptic indicators | Predicted regimes (Dry, Light, Moderate, Heavy / Heat / High Wind) | Regime-gated mixture of experts: $w_m = \sum_k P(R_k \mid \mathbf{x}) w_{m, k}$ | Contingency tables, CSI, ETS, POD, FAR per regime | `/api/v2/forecast/point` | Regime Indicator & Error Risk Badge | `test_regime_gating_boundaries` |
| **7** | **Model Weight Maps** | Grid cell weights across all 791 cells | $w_{\text{GFS}}(s), w_{\text{ECMWF}}(s)$, $\Delta w_{\text{AI}}(s)$, Dominant Model, Shannon Entropy | $H(s) = -\sum w_m \ln w_m$, Dominant Model classification | Spatial variance & entropy distribution | `/api/v2/weights/map` | Dedicated "Model Weight Maps" Dashboard Layer | `test_weight_map_full_coverage_791` |
| **8** | **Improved Forecast Skill Evaluation** | Out-of-sample held-out evaluation sets | Multi-period unseen validation partitions | Day-level paired block bootstrap hypothesis test ($N=2,000$ iterations) | Paired difference $\Delta \text{MAE}$, 95% CI, p-value | `/api/v2/verification/audit` | Verification Tab with Bootstrap Significance Table | `test_acceptance_gate_strict_threshold` |
| **9** | **Rainfall Forecast** | GFS APCP, ECMWF tp, IMD 0.25° Gridded Rainfall | 24h precipitation accumulation (mm) | Physics-bounded non-negative convex blend | MAE, RMSE, Bias, P99 tail error | `/api/v2/forecast?variable=precipitation` | Precipitation Colorbar [0–150 mm] | `test_precipitation_physical_bounds` |
| **10** | **Temperature Forecast** | GFS 2m Temp (`TMP:2 m`), ECMWF 2m Temp (`2t`), IMD Gridded / ERA5 Temp | 2m Dry Bulb Temperature (°C) | Lead-time and elevation-aware thermal blending | MAE, RMSE, Mean Bias (°C) | `/api/v2/forecast?variable=temperature` | Temperature Colorbar [15–48 °C] | `test_temperature_kelvin_to_celsius_bounds` |
| **11** | **Wind Forecast** | GFS 10m U/V, ECMWF 10m U/V, GFS Gust, ECMWF Gust | Wind Speed $W = \sqrt{u^2 + v^2}$ (km/h), Gust (km/h) | Vector-preserving component blending: $\hat{u} = \sum w_m u_m, \hat{v} = \sum w_m v_m, \hat{W} = \sqrt{\hat{u}^2 + \hat{v}^2}$ | Vector RMSE, Speed MAE | `/api/v2/forecast?variable=wind` | Wind Vector Arrows & Gust Contour Overlay | `test_wind_vector_reconstruction` |
| **12** | **Heavy-Rain Guidance** | Blended precipitation forecast + spread | Exceedance over official IMD tiers: 15.6, 64.5, 115.6, 204.5 mm | Deterministic IMD Warning Level + Model Consensus Agreement Flag | Critical Success Index (CSI), FAR, POD | `/api/v2/extremes/heavy-rain` | Heavy Rain Alert Banner & Warning Polygons | `test_heavy_rain_imd_classification` |
| **13** | **Heat-Wave Guidance** | Blended 2m Max Temperature + Climatological Normal | Daily $T_{\max}$, Departure $\Delta T = T_{\max} - T_{\text{norm}}$ | Deterministic IMD Heat Wave / Severe Heat Wave Criteria + Agreement Flag | Alert Accuracy, False Alarm Rate | `/api/v2/extremes/heat-wave` | Heat Wave Risk Level Map (Yellow/Orange/Red) | `test_heat_wave_imd_criteria` |
| **14** | **High-Wind Guidance** | Blended 10m Wind Speed + Peak Gust | Sustained 10m Speed, Gust Factor $G = \text{Gust} / W_{\text{sustained}}$ | Deterministic IMD/WMO Beaufort Squall/Gale Guidance + Agreement Flag | Warning Lead Time, Hit Rate | `/api/v2/extremes/high-wind` | High-Wind Swath Overlay & Marine Advisories | `test_high_wind_squall_thresholds` |
| **15** | **Automated Operational Workflow / Dashboard** | Live operational NWP endpoints + Retrospective Cache | Unified metadata, health status, live probe, model weights | Decoupled pipeline with automated caching, live probe, fallback prevention, REST API & Rich Web UI | Uptime, API latency (<50ms), 0% synthetic data integrity | `/api/v2/operational/pipeline` | Complete Mission Control Dashboard with 6 Modes | `test_live_vs_retrospective_isolation` |

---

## 3. Modular Engineering Architecture

```
src/
├── variables/               # Multi-variable handlers: precipitation, temperature, wind
│   ├── __init__.py
│   ├── base.py              # VariableHandler abstract base class
│   ├── precipitation.py     # APCP/tp handling, mm units, [0, 1500] QC
│   ├── temperature.py       # TMP/2t handling, Kelvin to Celsius, [-10, 60] QC
│   └── wind.py              # U/V/Gust handling, vector reconstruction, [0, 150] km/h QC
├── features/                # Causal spatial, temporal, rolling skill, and regime features
│   ├── __init__.py
│   ├── spatial.py           # lat, lon, subregion, coastal distance
│   ├── temporal.py          # lead time, day-of-year, season
│   ├── historical_skill.py  # causal rolling MAE/RMSE with strict T-1 cutoff
│   └── regime.py            # dynamic meteorological regime classifiers
├── blending/                # Constrained dynamic AI weight allocation & weight maps
│   ├── __init__.py
│   ├── constrained_optimizer.py # Convex weights: w_GFS >= 0, w_ECMWF >= 0, sum = 1
│   ├── context_blender.py       # Multi-context AI weight allocator (skill, lead, region, regime)
│   └── weight_map_generator.py  # Calculates w_GFS, w_ECMWF, delta_w_AI, dominance, entropy
├── extremes/                # Meteorological guidance engines (IMD heavy rain, heat wave, high wind)
│   ├── __init__.py
│   ├── heavy_rain.py        # IMD rainfall classifications: 15.6, 64.5, 115.6, 204.5 mm
│   ├── heat_wave.py         # IMD heat wave criteria: 40°C, 45°C, 4.5°C/6.5°C departure
│   └── high_wind.py         # IMD/WMO squall/gale criteria: 40, 62, 88 km/h
├── verification/            # Multi-variable verification, paired block bootstrap, acceptance gates
│   ├── __init__.py
│   ├── alignment.py         # Spatial/temporal alignment [PRESERVED]
│   ├── metrics.py           # Verification metrics [PRESERVED & EXTENDED: CSI, FAR, POD]
│   ├── bootstrap.py         # Day-level paired block bootstrap with p-values
│   └── acceptance_gate.py   # Formal statistical verification gate for champion model
└── operational/             # V2 operational engine, live NWP probe, unified REST API
    ├── __init__.py
    ├── engine.py            # EXP004 50/50 baseline engine [PRESERVED]
    ├── live_engine.py       # Live NWP ingestion [PRESERVED]
    ├── v2_engine.py         # Upgraded multi-variable, multi-lead operational engine
    └── server.py            # Enhanced HTTP server exposing V2 APIs and 6 UI modes
```

---

## 4. Strict Scientific & Information Boundary Rules
1. **Convex Weight Simplex:** For every cell and variable, $w_{\text{GFS}} \ge 0$, $w_{\text{ECMWF}} \ge 0$, and $w_{\text{GFS}} + w_{\text{ECMWF}} = 1.0$. No fictitious $w_{\text{AI}}$.
2. **Causal Data Cutoff:** For a forecast issued at $T$, feature generation uses only historical observations from $t \le T-1$.
3. **No Synthetic Data:** Real NWP and observationally constrained data only; missing observations are explicitly tagged as `PENDING_OBSERVATIONS`.
4. **No Fabricated Probabilities:** All extreme weather alerts use deterministic threshold exceedances with consensus agreement status.
5. **Honest Acceptance Gate:** If the dynamic blend does not achieve statistically significant out-of-sample improvement ($p < 0.05$) over the 50/50 baseline, the system honestly reports this finding and retains the 50/50 baseline as the operational standard.

---

## 5. UI Mission Control Dashboard Structure (6 Operational Modes)
1. **Forecast Mode:** Interactive maps for Precipitation, Temperature, Wind Speed & Gust across leads (+24h, +48h, +72h).
2. **Model Weight Maps Mode:** Spatial visualization of GFS Weight, ECMWF Weight, AI Adaptation ($\Delta w_{\text{AI}}$), Dominant Model, and Shannon Entropy.
3. **Confidence / Disagreement Mode:** EXP004 calibrated disagreement tiers, normalized disagreement, empirical expected error bounds.
4. **Extreme Weather Guidance Mode:** IMD Heavy Rain, Heat Wave, and High Wind alert tiers with Model Consensus Agreement flags.
5. **Verification Mode:** Multi-variable MAE/RMSE/Bias, Paired Block Bootstrap significance table, CSI contingency tables.
6. **Methodology Mode:** Transparent documentation of the AI weight allocator, causal boundaries, IMD thresholds, and architecture.

---

## 6. Execution Plan (Phase-by-Phase)
* **Phase 1:** Core Variables & QC (`src/variables/`) + Causal Features (`src/features/`)
* **Phase 2:** Constrained AI Weight Allocator & Weight Maps (`src/blending/`)
* **Phase 3:** Deterministic Meteorological Extremes Engine (`src/extremes/`)
* **Phase 4:** Statistical Verification & Acceptance Gate (`src/verification/`)
* **Phase 5:** Operational V2 Engine & REST API (`src/operational/`)
* **Phase 6:** UI 6-Mode Mission Control Dashboard Redesign (`frontend/`)
* **Phase 7:** Automated Compliance Test Suite (`tests/`) & Scientific Audit
