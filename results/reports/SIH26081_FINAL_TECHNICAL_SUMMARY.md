# SIH26081 Final Technical Summary

**Project Code:** SIH26081  
**Application Name:** Precipitation Fusion & Confidence Engine  
**Research Title:** Adaptive Meteorological Forecast-Observation Fusion  
**Domain:** Andhra Pradesh & Telangana ($12.0^\circ\text{N} - 20.0^\circ\text{N}, 76.0^\circ\text{E} - 85.0^\circ\text{E}$, 791 terrestrial grid points at $0.25^\circ \times 0.25^\circ$ resolution)  
**Evaluation Scope:** June 1 – August 31, 2024 (92 continuous monsoon days, $N = 72,772$ verified forecast-observation pairs)  
**Status:** VALIDATED & FROZEN OPERATIONAL PROTOTYPE  

---

## 1. Project Identity

* **Project Code:** SIH26081
* **Application Name:** Precipitation Fusion & Confidence Engine
* **Research Title:** Adaptive Meteorological Forecast-Observation Fusion
* **Target Users:** Disaster management authorities, agricultural extension officers, hydrological engineers, and municipal emergency planners across Andhra Pradesh and Telangana.

---

## 2. Problem Statement

Numerical Weather Prediction (NWP) models are the primary foundation for daily precipitation forecasting and disaster preparedness. However, operational decision-makers routinely confront a critical dilemma: **independent leading global models (e.g., NOAA GFS and ECMWF IFS) often diverge significantly in their 24-hour rainfall predictions.** 

When one model forecasts torrential precipitation ($> 50\text{ mm}$) while another predicts trace precipitation ($< 5\text{ mm}$), decision-makers face high operational risk:
1. **Blind Model Picking:** Selecting a single "favorite" model results in unmitigated single-model biases and localized forecast busts.
2. **Opaque Uncertainty:** Traditional forecasts report deterministic precipitation totals without indicating how confident or uncertain the forecast actually is.
3. **Unverified Complexity:** Applying complex black-box machine learning to non-stationary monsoon precipitation often results in temporal data leakage and severe overfitting to chaotic observational noise.

---

## 3. Validated Solution Architecture

The SIH26081 system solves this challenge by engineering a transparent, reproducible, and mathematically verified pipeline that combines independent numerical forecasts and exposes calibrated forecast uncertainty:

```text
       NOAA GFS 0.25°                       ECMWF IFS 0.25°
    (00 UTC Cycle, +24h)                 (00 UTC Cycle, +24h)
             │                                    │
             └─────────────────┬──────────────────┘
                               ▼
                 Common 0.25° Terrestrial Grid
                 (Quality Control & AP/TG Mask)
                               │
                               ▼
                   50/50 Equal-Weight Fusion
             P_fused = 0.5 × P_GFS + 0.5 × P_ECMWF
                               │
               ┌───────────────┴───────────────┐
               ▼                               ▼
       Fused Precipitation           Inter-Model Disagreement
        Forecast Field (mm)             D = |P_GFS - P_ECMWF|
               │                               │
               │                               ▼
               │                   Calibrated Confidence Engine
               │                 D < 0.11 mm    → HIGH CONFIDENCE
               │                 0.11 ≤ D < 2.06 → MODERATE CONFIDENCE
               │                 D ≥ 2.06 mm    → LOW CONFIDENCE
               │                               │
               └───────────────┬───────────────┘
                               ▼
                   IMD Retrospective Verification
                   (Historical Skill Analysis, T-1)
                               │
                               ▼
               Interactive Mission-Control Dashboard
```

1. **Deterministic Fusion:** Computes an equal-weight multi-model consensus ($P_{\text{fused}} = 0.5 \times P_{\text{GFS}} + 0.5 \times P_{\text{ECMWF}}$).
2. **Explainable Uncertainty:** Quantifies inter-model disagreement $D = |P_{\text{GFS}} - P_{\text{ECMWF}}|$ (mm) and normalized disagreement $D_{\text{norm}} = D / (1.0 + P_{\text{fused}})$.
3. **Calibrated Confidence:** Categorizes each grid point into empirical confidence classes tied directly to historical Mean Absolute Error (MAE).
4. **Retrospective Verification:** Validates past forecasts against reference IMD gridded daily rainfall under strict causal latency ($T-1$).

---

## 4. Scientific Progression (EXP001 → EXP004)

The operational system was developed through four rigorous, reproducible experiments:

```text
EXP001: Baseline Verification
Evaluated single-model NOAA GFS 0.25° against IMD observations (June 2024, N=23,730).
Result: GFS MAE = 7.0361 mm, RMSE = 13.7222 mm, Bias = +0.8948 mm. Established 791-cell spatial domain.
        ↓
EXP002: Two-Model Verification & Complementarity
Introduced ECMWF IFS 0.25° and compared against GFS (June 2024, N=23,730).
Result: GFS and ECMWF errors are complementary (r_error = 0.5532). 
50/50 ensemble reduced MAE to 6.6709 mm (-0.365 mm vs GFS, -0.587 mm vs ECMWF, p < 0.0001).
        ↓
EXP003: Causal Adaptive Fusion Experiment
Evaluated 7 adaptive weighting architectures trained on May 17–31 under strict causal T-1 latency.
Result: Model 7 reduced RMSE (11.2900 mm, p < 0.0001), but overall June MAE improvement over 50/50 
was not statistically significant (6.6707 mm vs 6.6709 mm, p = 0.505).
        ↓
EXP004: Multi-Period Robustness & Model Disagreement Analysis
Expanded validation across the entire 2024 monsoon (June, July, August, N=72,772).
Result: 50/50 ensemble achieved superior full-season MAE (7.321 mm vs 7.372 mm for adaptive, p = 0.016).
Disagreement strongly predicts error magnitude (r = 0.4915, ρ = 0.5843), but provides zero directional skill.
        ↓
FINAL OPERATIONAL SYSTEM
Retained 50/50 equal-weight fusion + frozen EXP004 disagreement-based confidence engine.
```

---

## 5. Key Verified Results

All numerical results reflect empirical data serialized in the repository:

### 5.1 EXP002 June 2024 Benchmark ($N = 23,730$)

| Model / Ensemble | MAE (mm) | RMSE (mm) | Mean Bias (mm) | Improvement vs GFS ($p$-value) |
| :--- | :---: | :---: | :---: | :---: |
| **NOAA GFS Standalone** | 7.0361 | 13.7222 | +0.8948 | Baseline |
| **ECMWF IFS Standalone** | 7.2582 | 12.0952 | +1.8968 | $+0.2221\text{ mm}$ ($p < 0.0001$) |
| **50/50 Equal-Weight Ensemble** | **6.6709** | **11.3905** | **+1.3958** | **$-0.3652\text{ mm}$ ($p < 0.0001$)** |

### 5.2 EXP004 Full Season Validation (June 1 – August 31, 2024, $N = 72,772$)

* **50/50 Static Ensemble Season MAE:** **$7.321\text{ mm}$**
* **Adaptive Fusion (Model 7) Season MAE:** **$7.372\text{ mm}$**
* **Statistical Significance:** 50/50 is significantly superior across the season ($p = 0.016$, day-level block bootstrap).
* **Selection Decision:** The 50/50 equal-weight ensemble was retained because it demonstrated more robust overall MAE than the tested adaptive fusion across the June–August evaluation period.

### 5.3 Model Disagreement vs. Subsequent Forecast Error

| Confidence Class | Disagreement Range ($D$) | Sample Count ($N$) | Mean $D$ (mm) | Historical MAE (mm) | 50/50 RMSE (mm) |
| :--- | :--- | :---: | :---: | :---: | :---: |
| **High Confidence** | $D < 0.11\text{ mm}$ | 2,950 | 0.047 | **2.02 mm** | 5.54 mm |
| **Moderate Confidence** | $0.11 \le D < 2.06\text{ mm}$ | 33,636 | 0.817 | **3.75 mm** | 7.97 mm |
| **Low Confidence** | $D \ge 2.06\text{ mm}$ | 36,186 | 8.898 | **9.46 mm** | 15.13 mm |

* Correlation between Disagreement $D$ and Ensemble Absolute Error: Pearson $r = 0.4915$, Spearman $\rho = 0.5843$ ($p < 0.0001$).
* Correlation between Disagreement and Relative Model Skill ($|e_{\text{GFS}}| - |e_{\text{ECMWF}}|$): $r = -0.0011$ ($p = 0.7607$). Disagreement indicates spread, not which model to favor.

---

## 6. Documented Scientific Limitations

To maintain scientific integrity, the following boundaries are explicitly disclosed:

1. **Geographic Domain:** Validated exclusively over the Andhra Pradesh and Telangana study domain ($12.0^\circ\text{N} - 20.0^\circ\text{N}$, $76.0^\circ\text{E} - 85.0^\circ\text{E}$, 791 terrestrial grid cells). It does not claim all-India coverage.
2. **Temporal Coverage:** Evaluated on the 92 continuous days of the 2024 Southwest Monsoon (June 1 – August 31, 2024). It is a retrospective research prototype and does not claim live 2026 operational forecasting.
3. **Temporal Window Overlap (87.5%):** IMD daily gridded rainfall measures precipitation accumulated from 08:30 IST to 08:30 IST (03:00 UTC to 03:00 UTC next day), whereas NWP model accumulation spans 00:00 UTC to 00:00 UTC next day. The two accumulation windows overlap by approximately 87.5% (21 hours). This limitation is acknowledged transparently.
4. **Adaptive Weighting Conclusion:** Dynamic weighting was thoroughly investigated across 7 models but was not adopted operationally because equal weighting proved more robust against synoptic monsoon variability across the full season.
5. **Nature of Disagreement:** Disagreement informs forecast reliability (spread magnitude), but cannot identify which model will be closer to truth on a given day.

---

## 7. Future Scope

The operational architecture provides a modular foundation for planned extensions:

* **Geographic Expansion:** Scaling the common-grid pipeline and terrestrial masking to cover all meteorological sub-divisions across India.
* **Multi-Season Evaluation:** Validating performance across Northeast Monsoon (October–December) and pre-monsoon convective seasons.
* **Additional NWP Systems:** Integrating additional independent numerical centers, such as NCMRWF (India), UK Met Office, and JMA.
* **Multi-Year Climatological Baselines:** Expanding historical retrospective audits across 5–10 years of archived forecasts.
* **Probabilistic Calibration:** Transitioning from empirical error classes to full parametric/non-parametric precipitation probability distributions.
* **Automated Operational Ingestion:** Building automated real-time daemon pipelines with fallback handling for live weather monitoring.
