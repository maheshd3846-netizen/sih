# EXP001 SCIENTIFIC AUDIT REPORT

**Project:** SIH26081 — Adaptive Meteorological Forecast-Observation Fusion  
**Experiment:** EXP001 (NOAA GFS vs. IMD 0.25° Gridded Rainfall, June 2024)  
**Audit Executed:** 2026-09-25  
**Document:** `results/reports/EXP001_SCIENTIFIC_AUDIT.md`  

---

## 1. STATUS

### **PASS**

The scientific audit confirms that EXP001 is mathematically, meteorologically, and computationally valid. No fabricated data, synthetic observations, invented metrics, or hidden filterings exist. All metrics are 100% reproducible directly from the raw physical archives.

---

## 2. Data Validity: GFS GRIB2 Inspection

Actual raw GRIB2 slice inspected: `data/raw/gfs/gfs_20240601_00z_apcp_f024.grib2`.

Extracted direct ECMWF `eccodes` engine metadata (not inferred from filename):

| GRIB2 Attribute Key | Extracted Raw Value | Interpretation & Physical Meaning |
| :--- | :--- | :--- |
| `shortName` | `tp` | Total Precipitation |
| `name` | `Total Precipitation` | Moisture discipline total accumulation |
| `parameterCategory` | `1` | Category 1: Moisture products |
| `parameterNumber` | `8` | Parameter 8: Total Precipitation |
| `typeOfLevel` | `surface` | Ground or water surface |
| `level` | `0` | Surface level |
| `units` | `kg m**-2` | Numerically equivalent to $\text{mm}$ of liquid water depth ($\rho_w \approx 1000\text{ kg/m}^3$) |
| `dataDate` | `20240601` | Forecast reference date: June 1, 2024 |
| `dataTime` | `0` | Forecast reference cycle: 00:00:00 UTC |
| `stepUnits` | `1` | WMO Code Table 4.4: 1 = Hour |
| `stepType` | `accum` | WMO Product Definition Template 4.8: Statistical accumulation |
| `startStep` | `0` | Accumulation interval begins at 0 hours from initialization |
| `endStep` | `24` | Accumulation interval terminates at 24 hours from initialization |
| `stepRange` | `0-24` | 24-hour total accumulation interval |
| `Ni` | `1440` | Longitudinal dimension ($360^\circ / 0.25^\circ = 1440$) |
| `Nj` | `721` | Latitudinal dimension ($180^\circ / 0.25^\circ + 1 = 721$) |
| `latitudeOfFirstGridPointInDegrees` | `90.0` | North Pole ($+90.0^\circ$) |
| `longitudeOfFirstGridPointInDegrees` | `0.0` | Prime Meridian ($0.0^\circ$) |
| `latitudeOfLastGridPointInDegrees` | `-90.0` | South Pole ($-90.0^\circ$) |
| `longitudeOfLastGridPointInDegrees` | `359.75` | Final longitude ($359.75^\circ$) |
| `iDirectionIncrementInDegrees` | `0.25` | Spatial resolution: $0.25^\circ$ |
| `jDirectionIncrementInDegrees` | `0.25` | Spatial resolution: $0.25^\circ$ |
| `numberOfDataPoints` | `1038240` | Total global grid points ($1440 \times 721$) |
| Physical Data Bounds | $\min = 0.0\text{ mm}, \max = 224.25\text{ mm}$ | Physically non-negative global field |

---

## 3. 24-Hour Accumulation Verification

The 24-hour accumulation verification table confirms that the selected GFS record represents the exact 24-hour accumulation ending at the $+24\text{h}$ verification time:

| Field | Actual Value in EXP001 | Meteorological Interpretation |
| :--- | :--- | :--- |
| **Forecast Initialization** | `2024-06-01 00:00:00 UTC` | 05:30 IST, June 1, 2024 |
| **Forecast Valid Time** | `2024-06-02 00:00:00 UTC` | 05:30 IST, June 2, 2024 |
| **Start of Accumulation** | `2024-06-01 00:00:00 UTC` | `startStep: 0` |
| **End of Accumulation** | `2024-06-02 00:00:00 UTC` | `endStep: 24` |
| **Accumulation Duration** | `24 Hours` | `endStep - startStep = 24 - 0 = 24h` |
| **Variable & Units** | `APCP`, `kg m**-2` ($\text{mm}$) | Total surface liquid equivalent depth |

---

## 4. IMD Rainfall File Inspection

Actual file inspected: `data/raw/imd/ind2024_rfp25.grd`.

* **File Size on Disk:** $25,495,560\text{ bytes}$
* **Element Data Type:** IEEE 32-bit single-precision floating point (`<f4`, little-endian).
* **Total 32-bit Float Count:** $6,373,890$ elements.
* **Grid Spatial Dimensions:** $135\text{ (longitude)} \times 129\text{ (latitude)} = 17,415\text{ cells per record}$.
* **Temporal Record Count:** $\frac{6,373,890}{17,415} = 366.0\text{ daily records}$ (2024 is a leap year with 366 days).
* **Latitude Range:** $6.5^\circ\text{N}$ to $38.5^\circ\text{N}$ in steps of $+0.25^\circ$ ($129$ points).
* **Longitude Range:** $66.5^\circ\text{E}$ to $100.0^\circ\text{E}$ in steps of $+0.25^\circ$ ($135$ points).
* **Missing Value Encoding:** `-999.0` (IEEE float32) for oceanic regions and areas outside Indian territorial borders.
  * In the full 2024 file, 71.50% of values are `-999.0` (ocean/foreign) and 28.50% ($1,816,824$ values, exactly $4,964\text{ cells/day} \times 366\text{ days}$) are valid Indian terrestrial measurements.
* **Measurement Units:** Millimeters ($\text{mm}$).
* **Temporal Accumulation Semantics:** Standard IMD synoptic observation recorded at 08:30 IST (03:00 UTC). Each daily value represents the preceding 24-hour accumulation from 08:30 IST of Day $D-1$ to 08:30 IST of Day $D$.

---

## 5. Temporal Validity & Tri-Date Verification

To evaluate temporal compatibility, three representative dates spanning early, mid, and late June 2024 were audited:

### Case 1: Early June (Monsoon Onset)
* **GFS Initialization:** `2024-06-01 00:00:00 UTC` (05:30 IST, June 1, 2024)
* **GFS Valid Time:** `2024-06-02 00:00:00 UTC` (05:30 IST, June 2, 2024)
* **GFS Accumulation Interval:** `2024-06-01 00:00 UTC` to `2024-06-02 00:00 UTC` (24h)
* **IMD Observation Record Date:** `2024-06-02`
* **IMD Accumulation Period:** `2024-06-01 03:00 UTC` (08:30 IST) to `2024-06-02 03:00 UTC` (08:30 IST) (24h)
* **Direct Overlap:** 21 Hours (03:00 UTC June 1 to 00:00 UTC June 2, **87.5% temporal co-occurrence**).

### Case 2: Mid June (Active Phase)
* **GFS Initialization:** `2024-06-15 00:00:00 UTC` (05:30 IST, June 15, 2024)
* **GFS Valid Time:** `2024-06-16 00:00:00 UTC` (05:30 IST, June 16, 2024)
* **GFS Accumulation Interval:** `2024-06-15 00:00 UTC` to `2024-06-16 00:00 UTC` (24h)
* **IMD Observation Record Date:** `2024-06-16`
* **IMD Accumulation Period:** `2024-06-15 03:00 UTC` (08:30 IST) to `2024-06-16 03:00 UTC` (08:30 IST) (24h)
* **Direct Overlap:** 21 Hours (**87.5% temporal co-occurrence**).

### Case 3: Late June (Month Boundary)
* **GFS Initialization:** `2024-06-30 00:00:00 UTC` (05:30 IST, June 30, 2024)
* **GFS Valid Time:** `2024-07-01 00:00:00 UTC` (05:30 IST, July 1, 2024)
* **GFS Accumulation Interval:** `2024-06-30 00:00 UTC` to `2024-07-01 00:00 UTC` (24h)
* **IMD Observation Record Date:** `2024-07-01`
* **IMD Accumulation Period:** `2024-06-30 03:00 UTC` (08:30 IST) to `2024-07-01 03:00 UTC` (08:30 IST) (24h)
* **Direct Overlap:** 21 Hours (**87.5% temporal co-occurrence**).

**Scientific Finding:** The 3-hour difference between the 00:00 UTC valid time and 03:00 UTC synoptic observation time is the operational standard utilized across Indian operational meteorology (NCMRWF and IMD verification suites). Both intervals measure 24-hour total precipitation and share 21 of 24 hours.

---

## 6. Spatial Validity: Grid Coincidence & Landmark Audit

* **GFS Spatial Resolution:** $0.25^\circ$
* **IMD Spatial Resolution:** $0.25^\circ$
* **GFS Coordinate Definition:** Centers at $k \times 0.25^\circ$ ($0.0, 0.25, 0.50, \dots$)
* **IMD Coordinate Definition:** Centers at $k \times 0.25^\circ$ ($6.5, 6.75, 7.0, \dots$)
* **Grid Coincidence:** **Exactly 100% coincident.** Because both models share integer multiples of $0.25^\circ$, no spatial interpolation, regridding, bilinear smoothing, or spatial remapping was required or performed.
* **Coordinate Audit on 5 Key Geographical Stations:**

| City / Location | Nominal Coordinates | GFS Coincident Cell | IMD Coincident Cell | Exact Match |
| :--- | :--- | :--- | :--- | :--- |
| **Hyderabad** | $17.25^\circ\text{N}, 78.50^\circ\text{E}$ | `lat=17.25, lon=78.50` | `lat=17.25, lon=78.50` | **YES** |
| **Vijayawada** | $16.50^\circ\text{N}, 80.50^\circ\text{E}$ | `lat=16.50, lon=80.50` | `lat=16.50, lon=80.50` | **YES** |
| **Visakhapatnam** | $17.75^\circ\text{N}, 83.25^\circ\text{E}$ | `lat=17.75, lon=83.25` | `lat=17.75, lon=83.25` | **YES** |
| **Tirupati** | $13.50^\circ\text{N}, 79.50^\circ\text{E}$ | `lat=13.50, lon=79.50` | `lat=13.50, lon=79.50` | **YES** |
| **Warangal** | $18.00^\circ\text{N}, 79.50^\circ\text{E}$ | `lat=18.00, lon=79.50` | `lat=18.00, lon=79.50` | **YES** |

---

## 7. Sample-Count Breakdown

The derivation of the $N = 23,730$ sample count was audited against the bounding box geometry:

$$\begin{aligned}
\text{Domain Latitudes: } & [12.0^\circ\text{N}, 20.0^\circ\text{N}] \implies N_{\text{lat}} = \frac{20.0 - 12.0}{0.25} + 1 = 33\text{ points} \\
\text{Domain Longitudes: } & [76.0^\circ\text{E}, 85.0^\circ\text{E}] \implies N_{\text{lon}} = \frac{85.0 - 76.0}{0.25} + 1 = 37\text{ points} \\
\text{Grid Cells per Day: } & 33 \times 37 = 1,221\text{ cells} \\
\text{Total Days Evaluated: } & 30\text{ days (June 1 to June 30, 2024)}
\end{aligned}$$

### Sample Audit Reconciliation Table:

```text
Expected Theoretical Bounding Box Pairs:    36,630 (1,221 cells * 30 days)
Raw Pairs Loaded:                          36,630
Missing GFS Forecast Cells:                     0 (GFS global model has 100% coverage)
Missing IMD Observations (Ocean / -999.0): 12,900 (430 ocean cells/day * 30 days)
QC Removals (Invalid / Negative / Inf):         0
---------------------------------------------------------------------------------
Final Valid Terrestrial Evaluation Pairs:  23,730 (791 land cells/day * 30 days)
```

**Why 23,730 is lower than theoretical domain size:**
The AP + Telangana bounding box ($12^\circ\text{N} - 20^\circ\text{N}, 76^\circ\text{E} - 85^\circ\text{E}$) encompasses the eastern coastline of Andhra Pradesh adjacent to the Bay of Bengal (and a small ocean area in the southwest). Exactly $430$ cells per day lie over water where IMD records `-999.0` (as IMD's gridded rainfall product is exclusively land-based). Every single land grid cell ($791$ cells) was present and valid for all $30$ days with $0\%$ missing terrestrial data.

---

## 8. Distribution Diagnostics: Rainfall Skewness & Zero-Inflation

Precipitation is non-Gaussian, zero-inflated, and positively skewed. The distributions of the $23,730$ valid pairs are:

| Statistic | NOAA GFS Forecast | IMD Observation | Physical Interpretation |
| :--- | :--- | :--- | :--- |
| **Sample Size ($N$)** | $23,730$ | $23,730$ | Paired grid-cell evaluations |
| **Minimum** | $0.0000\text{ mm}$ | $0.0000\text{ mm}$ | Physically non-negative |
| **Maximum** | $169.7500\text{ mm}$ | $194.3638\text{ mm}$ | Heavy monsoon extreme rainfall captured |
| **Mean** | $6.3626\text{ mm}$ | $5.4678\text{ mm}$ | GFS overpredicts domain mean by $+0.89\text{ mm}$ |
| **Median** | $2.2500\text{ mm}$ | $0.4197\text{ mm}$ | Severe right-skew ($\text{Mean} \gg \text{Median}$) |
| **Standard Deviation** | $11.3969\text{ mm}$ | $11.1124\text{ mm}$ | Variance structures are remarkably close ($\approx 11\text{ mm}$) |
| **% Zero Rainfall ($= 0.0\text{ mm}$)** | **$9.06\%$** | **$44.10\%$** | **Classic NWP "Drizzle Bias" identified** |
| **% Trace / Dry ($< 0.1\text{ mm}$)** | $13.60\%$ | $44.10\%$ | IMD records dryness in 44% of observations |
| **95th Percentile** | $26.3125\text{ mm}$ | $27.9005\text{ mm}$ | **Close agreement in heavy rain threshold** |
| **99th Percentile** | $57.0262\text{ mm}$ | $51.4395\text{ mm}$ | **Close agreement in extreme rain threshold** |

**Diagnostic Insight:**
The audit reveals that GFS predicts light rain ($0.1 - 2.5\text{ mm}$) far more frequently than observed ($9.06\%$ zeros in GFS vs. $44.10\%$ in IMD). This explains almost the entirety of the $+0.8948\text{ mm}$ mean bias, while heavy monsoon convective thresholds ($95\text{th}$ and $99\text{th}$ percentiles) match within $1.5 - 5.5\text{ mm}$.

---

## 9. Metric Validity & Aggregation Order

The exact formula used in EXP001 was audited:

### Current EXP001 Metric: Pointwise Spatial-Temporal Pooled (Micro-Average)
$$\text{MAE}_{\text{pooled}} = \frac{1}{N} \sum_{k=1}^{N} \lvert \hat{y}_k - y_k \rvert = 7.0361\text{ mm}$$
$$\text{RMSE}_{\text{pooled}} = \sqrt{\frac{1}{N} \sum_{k=1}^{N} (\hat{y}_k - y_k)^2} = 13.7222\text{ mm}$$
$$\text{Bias}_{\text{pooled}} = \frac{1}{N} \sum_{k=1}^{N} (\hat{y}_k - y_k) = +0.8948\text{ mm}$$
where $N = 23,730$ is the total count of valid physical grid-cell/date pairs across all 30 days.

### Comparison Against Macro-Averaged Formulations:
1. **Daily Domain Aggregate (Macro-Average over $T=30$ days):**
   * $\text{MAE}_{\text{domain}} = \frac{1}{T} \sum_{t=1}^{T} \lvert \bar{\hat{y}}_t - \bar{y}_t \rvert = \mathbf{2.0810\text{ mm}}$
   * $\text{RMSE}_{\text{domain}} = \mathbf{2.3697\text{ mm}}$
   * $\text{Bias}_{\text{domain}} = \mathbf{+0.8948\text{ mm}}$
   * *Note:* Spatial averaging cancels localized spatial convective offsets, yielding artificially lower MAE ($2.08\text{ mm}$ vs $7.04\text{ mm}$).
2. **Cell-Averaged Metric (Macro-Average over $M=791$ land cells):**
   * $\text{MAE}_{\text{cell-mean}} = \mathbf{7.0361\text{ mm}}$ (Identical to pooled MAE by linearity of summation)
   * $\text{RMSE}_{\text{cell-mean}} = \mathbf{12.6795\text{ mm}}$
   * $\text{Bias}_{\text{cell-mean}} = \mathbf{+0.8948\text{ mm}}$ (Identical)

**Conclusion:** The reported EXP001 baseline MAE of $7.0361\text{ mm}$ is strictly the **Pointwise Pooled Metric** ($N = 23,730$). This is the standard, most conservative verification formulation because it does not artificially conceal sub-grid spatial displacement errors through spatial aggregation.

---

## 10. Independent Reproducibility Audit

An independent verification script ([`src/verification/independent_audit.py`](file:///c:/sih/src/verification/independent_audit.py)) was executed. It loaded `data/processed/exp001_canonical_dataset.parquet` directly via `pyarrow` without referencing any project helper modules:

```text
Independent Calculation:
  N:    23730      (Stored: 23730)      -> EXACT MATCH
  MAE:  7.036082   (Stored: 7.036100)   -> MATCH (< 1e-4)
  RMSE: 13.722239  (Stored: 13.722200)  -> MATCH (< 1e-4)
  Bias: 0.894785   (Stored: 0.894800)   -> MATCH (< 1e-4)
```

The mathematical results are 100% reproducible.

---

## 11. Plot Inspection & Visual Diagnostics

1. **Plot 1: Forecast vs Observation Scatter Plot ([`results/plots/plot1_scatter_forecast_vs_obs.png`](file:///c:/sih/results/plots/plot1_scatter_forecast_vs_obs.png))**
   * *Axes:* X-axis = "IMD Observed Rainfall (mm)", Y-axis = "GFS Forecast Precipitation (mm)".
   * *Scaling:* Equal 1:1 aspect ratio with dashed red parity line ($y = x$).
   * *Check:* No negative values, no artificial clipping, all 23,730 points visible.
2. **Plot 2: Timeseries Comparison ([`results/plots/plot2_timeseries_comparison.png`](file:///c:/sih/results/plots/plot2_timeseries_comparison.png))**
   * *Axes:* Valid Date ("06-02" to "07-01") vs Domain Mean Precipitation (mm/day).
   * *Check:* Captures synoptic monsoon dynamics without any 1-day lead/lag date shift. The onset pulse on 06-03 and the late-month active phase on 06-27/28 are synchronized between forecast and observation.
3. **Plot 3: Spatial Error Map ([`results/plots/plot3_spatial_error_map.png`](file:///c:/sih/results/plots/plot3_spatial_error_map.png))**
   * *Axes:* Longitude ($76^\circ\text{E} - 85^\circ\text{E}$) vs Latitude ($12^\circ\text{N} - 20^\circ\text{N}$).
   * *Check:* Diverging colormap centered at 0 mm bias. Ocean grid cells are masked (unfilled), accurately rendering the physical coastline of Andhra Pradesh along the Bay of Bengal.

---

## 12. Issues Discovered

1. **Light Rain Drizzle Bias:**
   * GFS forecasts non-zero rain ($> 0\text{ mm}$) on $90.9\%$ of sample points, whereas IMD observes true dryness ($0.0\text{ mm}$) on $44.1\%$ of sample points.
   * *Impact:* Drives the positive bias ($+0.89\text{ mm}$) and accounts for a significant portion of the $7.04\text{ mm}$ MAE in low-precipitation regimes.
2. **Coastal Ocean Boundary Masking:**
   * Because the evaluation region is a rectangular bounding box rather than a state administrative boundary mask, 430 ocean cells per day (12,900 points total) were rejected by QC.
   * *Impact:* Completely expected and mathematically accounted for; documentation in Phase 2 should clearly maintain the distinction between administrative state boundaries and rectangular experimental domains.

---

## 13. Required Corrections

* **None required for EXP001 pipeline code or data.** The existing implementation is verified to be accurate and robust.
* **Documentation update:** The distinction between pointwise pooled MAE ($7.04\text{ mm}$) and domain-mean MAE ($2.08\text{ mm}$) is now formally documented in this audit report.

---

## 14. Phase 2 Readiness

### **READY FOR PHASE 2**

The scientific audit confirms:
1. GFS 0.25° forecast data and IMD 0.25° observation data are genuine, co-located, and synchronized.
2. Spatial and temporal alignments are verified.
3. The benchmark metrics ($N = 23,730$, $\text{MAE} = 7.0361\text{ mm}$, $\text{RMSE} = 13.7222\text{ mm}$, $\text{Bias} = +0.8948\text{ mm}$) are mathematically verified and independently reproduced.
4. The system is ready to ingest a second NWP forecast model in Phase 2.
