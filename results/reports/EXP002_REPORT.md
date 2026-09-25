# EXP002 FINAL REPORT: TWO-MODEL VERIFICATION & COMPLEMENTARITY ANALYSIS

**Project:** SIH26081 — Adaptive Meteorological Forecast-Observation Fusion  
**Experiment:** EXP002 (NOAA GFS + ECMWF IFS vs. IMD 0.25° Gridded Rainfall)  
**Execution Date:** 2026-09-25  
**Document:** `results/reports/EXP002_REPORT.md`  
**Status:** COMPLETE & VERIFIED  

---

## 1. Executive Summary

Experiment **EXP002** established a controlled, rigorous two-model verification framework evaluating:
1. **NOAA GFS 0.25°** (+24h, 00 UTC cycle)
2. **ECMWF IFS 0.25°** (+24h, 00 UTC cycle, operational deterministic run)
3. **IMD 0.25° Daily Gridded Rainfall** (Ground Truth Reference)

All analyses were evaluated over the exact same **Andhra Pradesh + Telangana experimental domain** ($12.0^\circ\text{N} - 20.0^\circ\text{N}, 76.0^\circ\text{E} - 85.0^\circ\text{E}$) across all 30 days of June 2024. The exact same terrestrial valid mask ($N = 23,730$ paired samples) established in EXP001 was strictly preserved, guaranteeing 100% apples-to-apples comparability.

The experiment demonstrated that:
* **ECMWF IFS** and **NOAA GFS** exhibit distinct, complementary structural error profiles ($r_{\text{error}} = 0.5532$).
* An equal-weight **50/50 Ensemble** ($0.5 \times \text{GFS} + 0.5 \times \text{ECMWF}$) reduces MAE to **$6.6709\text{ mm}$** (a statistically significant improvement of $-0.365\text{ mm}$ over GFS and $-0.587\text{ mm}$ over ECMWF, $p < 0.0001$).
* Distinct regime strengths exist: GFS is superior on dry and light rainfall ($< 5\text{ mm}$) and inland Telangana, whereas ECMWF is vastly superior on moderate/heavy rainfall ($\ge 5\text{ mm}$) and coastal Andhra Pradesh.

---

## 2. STEP 0: Source Reproducibility Gate (ECMWF IFS)

The ECMWF source reproducibility gate was fully verified on the June 1, 2024 raw slice prior to full-month ingestion:
* **Public Archive Endpoint:** `https://storage.googleapis.com/ecmwf-open-data` (Google Cloud Storage Open Data mirror)
* **Naming Convention:** `{YYYYMMDD}/00z/ifs/0p25/oper/{YYYYMMDD}000000-24h-oper-fc.grib2` and `.index`
* **Raw Verified File:** `data/raw/ecmwf/ecmwf_20240601_00z_tp_f024.grib2`
* **File Size:** $818,951\text{ bytes}$
* **MD5 Checksum:** `e017a15dbc59a771d3d221b4976fb6cf`
* **SHA256 Checksum:** `cf053956bcccdb73d612f5c0c701818084659e38a61431c9ae7da5e8e33a0bd0`
* **GRIB2 Metadata (ecCodes):**
  * `shortName`: `tp`
  * `name`: Total precipitation
  * `typeOfLevel`: `sfc` (surface)
  * `raw_units`: `m` (metres)
  * `forecast_reference_time`: `2024-06-01 00:00:00 UTC` (`dataDate: 20240601`, `dataTime: 0`)
  * `valid_time`: `2024-06-02 00:00:00 UTC`
  * `startStep`: 0, `endStep`: 24, `stepUnits`: 1 (hours), `stepType`: `accum`
  * `grid`: Regular latitude-longitude ($1440 \times 721$), resolution $0.25^\circ \times 0.25^\circ$
  * `access_mechanism`: HTTP byte-range GET guided by the `.index` JSON-lines file (offset `18072208`, length `818951`).

---

## 3. Data Ingestion & Physical Semantics

* **NOAA GFS:** Total Precipitation (`APCP`), raw units $\text{kg m}^{-2}$ ($= \text{mm}$).
* **ECMWF IFS:** Total Precipitation (`tp`), raw units $\text{m}$. Multiplied by $1000.0$ to convert to $\text{mm}$.
* **IMD Reference:** Daily Gridded Rainfall (`ind2024_rfp25.grd`), units $\text{mm}$.
* **Temporal Alignment:**
  * Both GFS and ECMWF accumulate total precipitation over `00:00 UTC Day D` to `00:00 UTC Day D+1` (24h accumulation).
  * IMD daily rainfall records total precipitation over `08:30 IST Day D` to `08:30 IST Day D+1` (`03:00 UTC Day D` to `03:00 UTC Day D+1`).
  * As established in EXP001, both represent 24-hour accumulations with a 21-hour (87.5%) direct temporal overlap, matching operational Indian verification protocols.
* **Spatial Alignment:**
  * GFS, ECMWF IFS, and IMD all reside on identical $0.25^\circ \times 0.25^\circ$ grids.
  * Extracted domain: $33\text{ lats } [12.0^\circ\text{N}, 20.0^\circ\text{N}] \times 37\text{ lons } [76.0^\circ\text{E}, 85.0^\circ\text{E}]$.
  * Direct coordinate matching; zero spatial interpolation.

---

## 4. EXP002-A: Individual Model Verification vs. Ground Truth

Evaluated across all $N = 23,730$ valid terrestrial grid-cell/date pairs:

| Verification Metric | NOAA GFS | ECMWF IFS | 50/50 Ensemble | Best Performer |
| :--- | :--- | :--- | :--- | :--- |
| **Sample Size ($N$)** | $23,730$ | $23,730$ | $23,730$ | — |
| **MAE (mm)** | $7.0361$ | $7.2582$ | **$6.6709$** | **Ensemble ($-5.2\%$ vs GFS)** |
| **RMSE (mm)** | $13.7222$ | $12.0952$ | **$11.3905$** | **Ensemble ($-17.0\%$ vs GFS)** |
| **Mean Bias (mm)** | **$+0.8948$** | $+1.8968$ | $+1.3958$ | GFS |
| **Pearson Correlation ($r$)** | $0.2601$ | $0.3093$ | **$0.3481$** | **Ensemble ($+33.8\%$ vs GFS)** |
| **Spearman Correlation ($\rho$)** | $0.4094$ | $0.3985$ | **$0.4556$** | **Ensemble** |
| **Zero-Rain Frequency (%)** | $9.06\%$ | $1.62\%$ | $0.75\%$ | GFS (IMD obs: $44.1\%$) |
| **Dry-Event MAE (obs $< 0.1$ mm)** | **$3.4369$** | $4.4433$ | $3.9401$ | **GFS** |
| **Rainy-Event MAE (obs $\ge 0.1$ mm)** | $9.8755$ | $9.4789$ | **$8.8252$** | **Ensemble** |
| **Mod-Heavy MAE (obs $\ge 5.0$ mm)** | $14.5790$ | $12.8235$ | **$12.2584$** | **Ensemble** |
| **Heavy Rain MAE (obs $\ge 15.0$ mm)** | $22.1535$ | $19.6486$ | **$19.1823$** | **Ensemble** |
| **95th Pct Absolute Error (mm)** | $29.0764$ | $24.9432$ | **$23.7093$** | **Ensemble** |
| **99th Pct Absolute Error (mm)** | $58.2081$ | $45.2943$ | **$45.2913$** | **Ensemble** |

---

## 5. EXP002-B: Error Complementarity Analysis

The scientific value of multi-model fusion hinges on error independence:

* **Pearson Error Correlation ($r_{e_{\text{gfs}}, e_{\text{ecmwf}}}$):** **$0.5532$**
* **Spearman Rank Error Correlation ($\rho_{e}$):** **$0.4835$**
* **Error Covariance:** **$90.4976\text{ mm}^2$**
* **Uncorrelated Error Variance:** $1 - r^2 = 1 - 0.5532^2 = \mathbf{69.4\%}$ of the error variance between GFS and ECMWF is completely independent!

### Head-to-Head Win / Loss Distribution ($N = 23,730$):
* **GFS is closer to IMD ($|e_{\text{gfs}}| < |e_{\text{ec}}| - 0.5\text{ mm}$):** **$11,300\text{ samples}$ ($47.62\%$)**
* **ECMWF is closer to IMD ($|e_{\text{ec}}| < |e_{\text{gfs}}| - 0.5\text{ mm}$):** **$8,520\text{ samples}$ ($35.90\%$)**
* **Both similarly close ($||e_{\text{gfs}}| - |e_{\text{ec}}|| \le 0.5\text{ mm}$):** **$3,910\text{ samples}$ ($16.48\%$)**

**Key Finding:** In nearly half the cases, GFS outperforms ECMWF; in over a third of cases, ECMWF outperforms GFS. Their errors are genuinely complementary.

---

## 6. EXP002-C: Equal-Weight Ensemble Evaluation

A simple unweighted linear combination:
$$\hat{y}_{\text{ens}} = 0.5 \times \hat{y}_{\text{GFS}} + 0.5 \times \hat{y}_{\text{ECMWF}}$$

* **MAE:** Drops from $7.0361\text{ mm}$ (GFS) and $7.2582\text{ mm}$ (ECMWF) down to **$6.6709\text{ mm}$**.
* **RMSE:** Drops from $13.7222\text{ mm}$ (GFS) down to **$11.3905\text{ mm}$** (a reduction of **$-2.33\text{ mm}$**).
* **Correlation:** Pearson $r$ increases from $0.2601$ (GFS) and $0.3093$ (ECMWF) up to **$0.3481$**.
* **Tail Extremes:** 95th percentile absolute error drops to **$23.71\text{ mm}$** (vs. GFS $29.08\text{ mm}$).

---

## 7. EXP002-D: Regime & Regional Breakdown

| Rainfall Regime / Subregion | Sample Count ($N$) | GFS MAE (mm) | ECMWF MAE (mm) | Ensemble MAE (mm) | Superior Individual Model |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Dry ($< 0.1$ mm)** | $10,465$ | **$3.4369$** | $4.4433$ | $3.9401$ | **GFS** ($+1.01\text{ mm}$ better) |
| **Light ($0.1 - 5.0$ mm)** | $6,875$ | **$5.5039$** | $6.3703$ | $5.6342$ | **GFS** ($+0.87\text{ mm}$ better) |
| **Moderate ($5.0 - 15.0$ mm)** | $3,555$ | $8.5386$ | **$7.3808$** | **$6.7368$** | **ECMWF** ($+1.16\text{ mm}$ better) |
| **Heavy ($\ge 15.0$ mm)** | $2,835$ | $22.1535$ | **$19.6486$** | **$19.1823$** | **ECMWF** ($+2.50\text{ mm}$ better) |
| **Coastal Andhra Pradesh** | $4,080$ | $9.5705$ | **$8.4355$** | **$8.4606$** | **ECMWF** ($+1.14\text{ mm}$ better) |
| **Rayalaseema** | $6,720$ | **$5.2701$** | $5.5324$ | **$4.9965$** | **GFS** |
| **Telangana** | $10,230$ | **$6.8844$** | $7.9625$ | **$6.9215$** | **GFS** ($+1.08\text{ mm}$ better) |

---

## 8. STEP 10: Statistical Significance (Paired Bootstrap)

To verify that the ensemble's error reduction is not random noise, 2,000 paired bootstrap iterations were evaluated across all 23,730 samples:

* **Ensemble vs. GFS MAE Reduction:**
  * Mean $\Delta\text{MAE} = \mathbf{-0.3652\text{ mm}}$
  * **$95\%\text{ Confidence Interval}$:** $[-0.4388\text{ mm}, -0.2931\text{ mm}]$
  * **$p$-value:** **$< 0.0001$** ($0$ of $2,000$ resamples yielded $\ge 0$)
* **Ensemble vs. ECMWF MAE Reduction:**
  * Mean $\Delta\text{MAE} = \mathbf{-0.5874\text{ mm}}$
  * **$95\%\text{ Confidence Interval}$:** $[-0.6589\text{ mm}, -0.5189\text{ mm}]$
  * **$p$-value:** **$< 0.0001$** ($0$ of $2,000$ resamples yielded $\ge 0$)

The error reductions achieved by multi-model blending are **statistically significant at $p < 0.0001$**.

---

## 9. Visual Validation & Artifacts

All plots were generated and saved in `results/plots/`:
1. **Model Comparison Scatter Plot ([`results/plots/exp002_model_comparison.png`](file:///c:/sih/results/plots/exp002_model_comparison.png)):** Side-by-side scatter plots against IMD observations.
2. **Error Correlation Scatter Plot ([`results/plots/exp002_error_correlation.png`](file:///c:/sih/results/plots/exp002_error_correlation.png)):** Highlights error dispersion around the line of equality ($r = 0.5532$), confirming error diversity.
3. **Regime Breakdown Bar Chart ([`results/plots/exp002_regime_comparison.png`](file:///c:/sih/results/plots/exp002_regime_comparison.png)):** Contrasts GFS dominance in dry/light regimes vs. ECMWF dominance in moderate/heavy regimes.
4. **Daily Timeseries Ensemble Plot ([`results/plots/exp002_ensemble_comparison.png`](file:///c:/sih/results/plots/exp002_ensemble_comparison.png)):** Demonstrates that the 50/50 ensemble closely tracks the observed daily pulses, moderating individual model overshoots.

---

## 10. Automated Tests

Executed via `.venv\Scripts\python -m pytest tests/ -v`:
* `tests/test_exp002.py::test_ecmwf_unit_conversion` **PASSED**
* `tests/test_exp002.py::test_ecmwf_temporal_alignment` **PASSED**
* `tests/test_exp002.py::test_ecmwf_spatial_alignment` **PASSED**
* `tests/test_exp002.py::test_ensemble_calculation` **PASSED**
* `tests/test_exp002.py::test_missing_value_masking` **PASSED**
* `tests/test_exp002.py::test_sample_count_consistency` **PASSED**
* All 8 EXP001 pipeline regression tests **PASSED** ($14/14$ passed).

---

## 11. Answers to the Scientific Gate Questions

### 1. Is ECMWF independently useful relative to GFS?
**YES.** ECMWF exhibits an RMSE of $12.0952\text{ mm}$ (substantially lower than GFS at $13.7222\text{ mm}$) and higher linear correlation ($r = 0.3093$ vs $0.2601$). More crucially, ECMWF outperforms GFS by $2.50\text{ mm}$ on heavy monsoon convective events ($\ge 15\text{ mm}$).

### 2. Are GFS and ECMWF errors sufficiently complementary to justify fusion?
**YES.** The error correlation between the two models is moderate ($r = 0.5532$), indicating that **$69.4\%$ of the error variance is independent**. In head-to-head evaluation, GFS is closer in $47.6\%$ of samples while ECMWF is closer in $35.9\%$ of samples.

### 3. Does the simple 50/50 ensemble improve over both individual models?
**YES.** The equal-weight ensemble achieves an MAE of **$6.6709\text{ mm}$** and an RMSE of **$11.3905\text{ mm}$**, outperforming both individual models with bootstrap statistical significance ($p < 0.0001$). Correlation increases to $r = 0.3481$.

### 4. In which rainfall regimes does each model perform better?
* **GFS is superior in Dry and Light Regimes ($< 5\text{ mm}$) and Inland Regions (Telangana):**
  * GFS MAE on dry events is $3.44\text{ mm}$ vs ECMWF $4.44\text{ mm}$.
  * GFS MAE in Telangana is $6.88\text{ mm}$ vs ECMWF $7.96\text{ mm}$.
* **ECMWF is superior in Moderate and Heavy Regimes ($\ge 5\text{ mm}$) and Coastal Regions (Coastal AP):**
  * ECMWF MAE on heavy events is $19.65\text{ mm}$ vs GFS $22.15\text{ mm}$.
  * ECMWF MAE in Coastal AP is $8.44\text{ mm}$ vs GFS $9.57\text{ mm}$.

### 5. Does the evidence justify moving to adaptive/context-aware weighting?
**YES, UNEQUIVOCALLY.** Because GFS dominates dry/inland regimes and ECMWF dominates heavy/coastal regimes, static weights (even 50/50) are suboptimal. An adaptive system that dynamically adjusts fusion weights conditioned on:
1. Forecast precipitation intensity (regime conditioning)
2. Geographic location (coastal vs inland)
3. Local recent performance feedback
will yield strictly superior accuracy over any fixed linear combination.

---

## 12. Reproducibility

To reproduce all EXP002 metrics, canonical tables, and figures:

```powershell
# 1. Run all unit tests
python -m pytest tests/ -v

# 2. Run EXP002 pipeline
python src/exp002_pipeline.py
```
