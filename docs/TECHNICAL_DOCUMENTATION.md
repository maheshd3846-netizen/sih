# SIH26081 — Technical System Documentation
## Multi-Model Meteorological Consensus & Confidence Engine
**Adaptive Forecast-Observation Fusion & Extreme Weather Guidance System**

---

### Document Control & Metadata
* **Project Code:** SIH26081
* **Repository:** `c:\sih`
* **Release Version:** 2.0.0-COMPLIANCE (Operational Prototype)
* **Authoritative Reference Commit:** `ce8e9216aeacfa13cba14d3efbb8be0be38ff02a`
* **Document Status:** Complete Technical Specification & Architectural Reference
* **Classification:** Open Meteorological Software Specification

---

## 1. Executive Summary & Problem Context

### 1.1 Problem Statement (SIH26081)
Operational numerical weather prediction (NWP) models—such as the National Oceanic and Atmospheric Administration’s Global Forecast System (NOAA GFS) and the European Centre for Medium-Range Weather Forecasts Integrated Forecasting System (ECMWF IFS)—frequently diverge significantly in predicting local monsoonal precipitation, high-temperature anomalies, and surface kinetic winds across complex peninsular topography. 

Standard operational workflows often rely on single-model guidance or uncalibrated multi-model displays, leading to:
1. Unresolved spatial discrepancies between premier global forecasting systems.
2. Inability of field meteorologists and disaster response agencies to rapidly assess forecast reliability.
3. Lack of automated, standardized extreme weather guidance conforming strictly to national standards (e.g., India Meteorological Department — IMD).
4. Vulnerability to artificial overconfidence or ungrounded machine learning post-processing models that overfit high-frequency synoptic noise or violate physical boundaries.

### 1.2 Technical Mission & Scope
The **SIH26081 System** is an end-to-end, scientifically grounded, zero-black-box operational meteorological software platform. It ingests open 0.25° NWP data, standardizes coordinate geometries over peninsular India (specifically **Andhra Pradesh & Telangana**, bounded by $12.0^\circ\text{N} - 20.0^\circ\text{N}$, $76.0^\circ\text{E} - 85.0^\circ\text{E}$), applies strict quality control, executes convex simplex ensemble blending, quantifies uncertainty directly via empirical inter-model disagreement, generates deterministic extreme weather guidance, and serves both REST APIs and a mission-control dashboard.

```
+--------------------------------------------------------------------------------------------------+
|                                    SIH26081 SYSTEM AT A GLANCE                                   |
+--------------------------------------------------------------------------------------------------+
| Domain Coverage     | 791 Terrestrial 0.25° Grid Cells across AP & Telangana (12-20°N, 76-85°E)  |
| Primary NWP Models  | NOAA GFS (0.25° Global, APCP/TMP/WIND) + ECMWF IFS (0.25° Open Data, tp/2t/10u/v) |
| Observational Bench | IMD Pune 0.25° Daily Gridded Rainfall Analysis (ind2024_rfp25.grd)          |
| Evaluation Rigor    | 72,772 empirical grid-pairs across 92 continuous monsoon days (June-August) |
| Blending Framework  | Convex Simplex Optimizer: w_GFS >= 0, w_ECMWF >= 0, sum(w_i) == 1.0        |
| Operational Baseline| 50/50 Static Consensus (MAE 7.321 mm; retained via Block Bootstrap Gate)   |
| Uncertainty Engine  | Calibrated Disagreement Bins: High (<0.11 mm), Mod (0.11-2.06), Low (>=2.06)|
| Operational Latency | Strict Causal T-1 Lag (zero data leakage from future observations)          |
| Execution Stack     | Python 3.10+ ThreadingHTTPServer, NumPy, Pandas, Leaflet.js, Three.js      |
+--------------------------------------------------------------------------------------------------+
```

---

## 2. High-Level System Architecture

The SIH26081 platform is structured as an 8-tier decoupled operational pipeline designed for fault tolerance, deterministic reproducibility, and zero dependency on heavy web application servers.

```mermaid
flowchart TD
    subgraph Data_Layer [1. Data Layer: Ingestion & Storage]
        S3[NOAA GFS 0.25°<br/>AWS Open Data S3<br/>Range-Request .idx]
        GCS[ECMWF IFS 0.25°<br/>GCS Open Data<br/>Range-Request .index]
        IMD[IMD Gridded Analysis<br/>0.25° Binary Archive<br/>Pune CRS]
    end

    subgraph Processing_Layer [2. Processing & Standardization]
        QC[QC Range Checks<br/>0-1500 mm / -20-60°C]
        Grid[0.25° Coordinate Align<br/>12°N-20°N, 76°E-85°E]
        Mask[Terrestrial Mask<br/>791 Land Cells AP/TS]
    end

    subgraph Core_Engines [3. Mathematical & Guidance Engines]
        Simplex[Context-Aware Simplex Blender<br/>w_GFS + w_ECMWF = 1.0<br/>Bounded AI Adaptation]
        Baseline[50/50 Operational Reference<br/>P_fused = 0.5*P_GFS + 0.5*P_ECMWF]
        Uncertainty[Inter-Model Disagreement Engine<br/>D = |P_GFS - P_ECMWF|<br/>Frozen Confidence Bins]
        Extremes[Deterministic Extreme Guidance<br/>IMD Rain / Heat / WMO Wind<br/>Model Consensus Flags]
    end

    subgraph Verification_Layer [4. Verification & Audit Gate]
        AuditGate[Day-Level Block Bootstrap Gate<br/>B=1,000 iterations<br/>p=0.016 Honest Disclosure]
        Causal[Causal Latency Enforcer<br/>T-1 Operational Reference]
    end

    subgraph Serving_Layer [5. Operational Runtime & UI]
        Server[Robust ThreadingHTTPServer<br/>Port 8080 - REST APIs]
        UI2D[Leaflet 2D Mission Control<br/>791 Interactive Land Cells<br/>6-Level Progressive Inspector]
        UI3D[Three.js 3D Isosurface View<br/>Dynamic Terrain Altitude Mesh]
    end

    S3 --> QC
    GCS --> QC
    IMD --> Causal
    QC --> Grid --> Mask
    Mask --> Simplex & Baseline & Uncertainty & Extremes
    Baseline & Simplex --> AuditGate
    AuditGate --> Server
    Uncertainty & Extremes --> Server
    Server --> UI2D & UI3D
```

### Layer Separation Breakdown
1. **Data Ingestion Layer (`src/ingestion/`)**: Network-resilient byte-range HTTP fetchers downloading individual parameter slices from GRIB2 files in real time without downloading multi-gigabyte global archives.
2. **Preprocessing Layer (`src/preprocessing/`, `src/variables/`)**: Harmonizes coordinate spatial references, converts physical units ($m \to mm$, $K \to ^\circ C$, $m/s \to km/h$), strips ocean cells, and applies quality-control thresholds.
3. **Core Fusion & Blending Engine (`src/blending/`, `src/operational/v2_engine.py`)**: Computes convex simplex weight maps and ensemble solutions with 4-factor contextual attribution.
4. **Uncertainty & Confidence Engine (`src/operational/engine.py`)**: Computes raw ($D$) and normalized ($D_{\text{norm}}$) inter-model spread, mapping to empirical expected error intervals calibrated on historical training baselines.
5. **Extreme Weather Guidance Protocols (`src/extremes/`)**: Applies multi-tiered deterministic thresholds conforming to IMD Pune and New Delhi standards with unanimous vs. divergent consensus flags.
6. **Statistical Acceptance Gate (`src/verification/acceptance_gate.py`)**: Validates candidate algorithmic modifications using day-level block bootstrapping before promoting any model over the 50/50 baseline.
7. **Operational Server Runtime (`src/operational/server.py`)**: Zero-dependency Python standard library `ThreadingHTTPServer` exposing REST API endpoints and serving web assets.
8. **Mission-Control Presentation Layer (`frontend/`)**: High-density interactive client interface supporting 2D Leaflet mapping, 3D Canvas visualizer, progressive disclosure drawer, timeline scrubber, and guided judge tour.

---

## 3. Spatial Domain & Terrestrial Land Mask

### 3.1 Domain Definition
The operational system monitors the Deccan Plateau and Eastern Coastal Plains of peninsular India, focusing on the states of **Andhra Pradesh** and **Telangana**:

$$\text{Domain Bounding Box}: \quad \phi \in [12.00^\circ\text{N}, 20.00^\circ\text{N}], \quad \lambda \in [76.00^\circ\text{E}, 85.00^\circ\text{E}]$$

* **Grid Resolution:** $0.25^\circ \times 0.25^\circ$ regular spherical coordinates ($\approx 27.5\text{ km} \times 26.5\text{ km}$ per cell).
* **Total Bounding Grid:** 33 latitude steps $\times$ 37 longitude steps $= 1,221$ grid intersections.
* **Terrestrial Land Mask:** Active computation is strictly limited to **791 verified terrestrial land cells**. All 430 open maritime cells (Bay of Bengal and Arabian Sea) and exterior non-reporting cells are masked using IMD observational indicators.

### 3.2 Subregional Distribution
The 791 land cells are categorized into distinct meteorological subregions to account for terrain effects, rain-shadow regimes, and maritime moisture advection:

| Subregion Identifier | Terrestrial Cell Count | Geographic & Meteorological Characteristics |
| :--- | :---: | :--- |
| **Telangana (Interior)** | 341 cells | Continental semi-arid plateau, convective thunderstorms, monsoon depressions. |
| **Rayalaseema (Interior AP)** | 224 cells | Leeward rain-shadow zone, high temperature extremes, dry spells. |
| **Coastal Andhra Pradesh** | 136 cells | Lowland maritime fringe, cyclonic squalls, orographic monsoon bursts. |
| **Border / Western Fringe** | 90 cells | Western Ghats fringe / northern border interfaces with elevated relief. |
| **Total Operational Domain** | **791 cells** | Complete validated operational monitoring territory. |

---

## 4. Data Ingestion & Preprocessing Subsystems

### 4.1 Ingestion Sources

```
+----------------------------------------------------------------------------------------------------+
| SOURCE IDENTIFIER      | ACCESS PROTOCOL          | PARAMETER IDENTIFIER      | TEMPORAL INTERVAL  |
+----------------------------------------------------------------------------------------------------+
| NOAA GFS 0.25°         | AWS Open Data S3 (HTTPS) | APCP (Surface Total Precip)| 00 UTC Lead: +24h  |
|                        | s3://noaa-gfs-bdp-pds    | TMP (2m above ground)     | Cycle Lead: +48h   |
|                        | Byte-range index (.idx)  | UGRD/VGRD (10m wind)      | Cycle Lead: +72h   |
+----------------------------------------------------------------------------------------------------+
| ECMWF IFS 0.25°        | Google Cloud Open Data   | tp (Total Precipitation)   | 00 UTC Lead: +24h  |
|                        | gs://ecmwf-open-data     | 2t (2m Temperature)       | Cycle Lead: +48h   |
|                        | Byte-range index (.index)| 10u/10v (10m kinetic wind)| Cycle Lead: +72h   |
+----------------------------------------------------------------------------------------------------+
| IMD Gridded Rainfall   | IMD Pune binary archive  | Gridded Daily Rainfall    | 08:30 IST to 08:30 |
|                        | ind2024_rfp25.grd        | Accumulation (mm)         | IST (03-03 UTC)    |
+----------------------------------------------------------------------------------------------------+
```

### 4.2 HTTP Range-Request Optimization (`src/ingestion/`)
Global 0.25° GRIB2 files exceed 500 MB to 1.2 GB per forecast step. The SIH26081 ingestion pipeline avoids downloading entire global files by parsing lightweight sidecar index files (`.idx` for GFS, `.index` for ECMWF). 

1. **Step 1:** Download index file (~10–30 KB).
2. **Step 2:** Locate the exact byte offset and length of target variables (e.g., `:APCP:surface:0-24 day acc fcst:`).
3. **Step 3:** Issue an HTTP `Range: bytes={start}-{end}` request.
4. **Step 4:** Ingest only the target message (~1.5–3.0 MB), reducing network transfer and latency by **>98%**.

### 4.3 Physical Unit Harmonization & Quality Control (`src/variables/`)
All inputs are transformed into standard meteorological units:
* **Precipitation:** ECMWF meters ($m$) multiplied by $1000.0 \to mm$; NOAA GFS $kg/m^2 \to mm$ ($1\text{ }kg/m^2 \equiv 1\text{ }mm$).
* **Temperature:** Kelvin ($K$) converted to Celsius ($^\circ C$) via $T_{^\circ C} = T_K - 273.15$.
* **Wind:** Meridional ($u$) and zonal ($v$) components transformed to scalar speed $S = \sqrt{u^2 + v^2}$ and converted from $m/s$ to $km/h$ via $S_{km/h} = S_{m/s} \times 3.6$.

```python
# Quality Control Guardrails (src/variables/base.py)
class VariableHandler(ABC):
    def validate_qc(self, values: np.ndarray) -> Tuple[bool, Optional[str]]:
        if np.isnan(values).any():
            return False, "NaN values detected in forecast field"
        if (values < self.valid_min).any() or (values > self.valid_max).any():
            return False, f"Values exceed physical limits [{self.valid_min}, {self.valid_max}]"
        return True, None
```

Physical bounds enforced:
* **Precipitation:** $[0.0\text{ mm}, 1500.0\text{ mm}]$ (records $>1500\text{ mm}$ rejected as corrupted).
* **Temperature:** $[-20.0^\circ\text{C}, 65.0^\circ\text{C}]$.
* **Wind Speed:** $[0.0\text{ km/h}, 400.0\text{ km/h}]$.

---

## 5. Mathematical Formulation & Blending Framework

### 5.1 Convex Simplex Optimization
Let $P_m(s, t)$ denote the forecast from model $m \in \{\text{GFS}, \text{ECMWF}\}$ for spatial cell $s$ at forecast lead $t$. The blended consensus forecast $P_{\text{blended}}(s, t)$ is defined by a convex linear combination:

$$P_{\text{blended}}(s, t) = w_{\text{GFS}}(s, t) \cdot P_{\text{GFS}}(s, t) + w_{\text{ECMWF}}(s, t) \cdot P_{\text{ECMWF}}(s, t)$$

Subject to strict convex simplex constraints:

$$w_{\text{GFS}} \ge 0, \quad w_{\text{ECMWF}} \ge 0, \quad w_{\text{GFS}} + w_{\text{ECMWF}} = 1.0$$

The simplex constraint prevents unbounded extrapolations, negative rainfall, and unrealistic variance amplification common in unconstrained regression models.

### 5.2 Context-Aware AI Adaptation Engine (`src/blending/context_blender.py`)
Rather than assigning static weights globally or using uninterpretable neural weights, the AI blending engine allocates weight dynamically around the 50/50 baseline based on four physically grounded attribution factors:

$$w_{\text{GFS}} = 0.50 + \Delta w_{\text{skill}} + \Delta w_{\text{lead}} + \Delta w_{\text{subregion}} + \Delta w_{\text{regime}}$$

To prevent overfitting to transient synoptic noise, the total AI adaptation magnitude is strictly clamped:

$$\Delta w_{\text{AI}} = \sum \Delta w_k, \quad \Delta w_{\text{AI}} \in [-0.20, +0.20] \implies w_{\text{GFS}} \in [0.30, 0.70]$$

$$w_{\text{ECMWF}} = 1.0 - w_{\text{GFS}}$$

#### The 4 Attribution Dimensions:
1. **Historical Skill ($\Delta w_{\text{skill}}$):** Derived from causal rolling Mean Absolute Error over the past $W=5$ days with mandatory 1-day observation latency ($T-1$):
   $$\text{Ratio} = \frac{\text{MAE}_{\text{ECMWF}}^{(T-1)}}{\text{MAE}_{\text{GFS}}^{(T-1)} + \epsilon}, \quad \Delta w_{\text{skill}} = \text{clip}(0.10 \times (\text{Ratio} - 1.0), -0.10, +0.10)$$
2. **Lead Time Degradation ($\Delta w_{\text{lead}}$):** Accounts for differential model error growth at extended forecast horizons (+24h, +48h, +72h).
3. **Subregional Terrain & Maritime Physics ($\Delta w_{\text{subregion}}$):** Captures ECMWF's superior coastal moisture handling along the Bay of Bengal coastline versus GFS's performance over continental plateau interiors.
4. **Precipitation / Temperature Regime ($\Delta w_{\text{regime}}$):** Calibrated using empirical conditional error distributions across Light, Moderate, and Heavy precipitation regimes.

### 5.3 Information-Theoretic Weight Entropy
To monitor model consensus confidence, the system computes the normalized Shannon Entropy of the weight distribution for every grid cell:

$$H(w) = - \sum_{m} w_m \log_2 w_m$$

* **Maximum Entropy ($H = 1.0\text{ bit}$):** Perfect 50/50 consensus; maximum uncertainty between constituent models.
* **Low Entropy ($H < 0.88\text{ bit}$):** Strong dominance by a single model based on empirical contextual skill.

---

## 6. Uncertainty Quantification & Calibrated Confidence

### 6.1 Inter-Model Disagreement Formulation
Uncertainty is quantified directly from physical disagreement between the two leading forecasting systems:

$$\text{Raw Disagreement } D(s, t) = |P_{\text{GFS}}(s, t) - P_{\text{ECMWF}}(s, t)| \quad [\text{mm}]$$

$$\text{Normalized Disagreement } D_{\text{norm}}(s, t) = \frac{D(s, t)}{1.0 + |P_{\text{blended}}(s, t)|}$$

The normalized metric prevents high precipitation values from artificially triggering extreme relative uncertainty flags when both models agree closely on proportional scale.

### 6.2 Frozen Calibrated Confidence Engine
Thresholds were empirically calibrated on the May 17–31, 2024 independent training period ($N = 11,865$ pairs) and frozen for all subsequent operations.

| Confidence Tier | Disagreement Interval ($D$) | Percentile of Training Set | Historical Validation MAE | Historical Validation RMSE | Operational Interpretation |
| :--- | :---: | :---: | :---: | :---: | :--- |
| **High Confidence** | $D < 0.11\text{ mm}$ | Bottom 33.3% | **$2.02\text{ mm}$** | **$5.54\text{ mm}$** | Tight multi-model alignment; high forecast certainty. |
| **Moderate Confidence** | $0.11\text{ mm} \le D < 2.06\text{ mm}$ | Middle 33.3% | **$3.75\text{ mm}$** | **$7.97\text{ mm}$** | Standard operational uncertainty; minor spatial variance. |
| **Low Confidence** | $D \ge 2.06\text{ mm}$ | Upper 33.3% | **$9.46\text{ mm}$** | **$15.13\text{ mm}$** | Pronounced model divergence; high risk of forecast error. |

### 6.3 Empirical Grounding of Disagreement
In EXP004 ($N = 72,772$ pairs across 92 days), inter-model disagreement was evaluated against actual subsequent observation errors ($e = |P_{\text{fused}} - P_{\text{IMD}}|$):
* **Pearson Correlation:** $r = 0.4915 \quad (p < 0.0001)$
* **Spearman Rank Correlation:** $\rho = 0.5843 \quad (p < 0.0001)$
* **Monotonic Error Progression:** In August 2024, High Confidence cells had a mean MAE of $2.91\text{ mm}$, whereas Low Confidence cells exhibited an MAE of **$11.83\text{ mm}$** (a **4.06$\times$ increase** in forecast error).

This confirms that inter-model disagreement serves as an authoritative, real-time surrogate for forecast reliability.

---

## 7. Deterministic Extreme Weather Guidance Protocols

To avoid probabilistic ambiguity, the SIH26081 engine implements deterministic classification protocols strictly following the statutory guidelines of the **India Meteorological Department (IMD)** and the **World Meteorological Organization (WMO)**.

### 7.1 IMD Heavy Rainfall Classification (`src/extremes/heavy_rain.py`)

$$\text{Parameter: 24-Hour Accumulated Rainfall } (P_{24})$$

```
+----------------------------------------------------------------------------------------------------+
| SEVERITY LEVEL     | 24H RAINFALL THRESHOLD | IMD COLOR CODE | ACTION / OPERATIONAL GUIDANCE        |
+----------------------------------------------------------------------------------------------------+
| Very Light Rain    | 0.1 <= P < 2.5 mm      | Green          | Routine operations; no disruption.   |
| Light Rain         | 2.5 <= P < 15.5 mm     | Green          | Routine agricultural activity.       |
| Moderate Rain      | 15.6 <= P < 64.4 mm    | Yellow (Watch) | Waterlogging in low-lying sectors.   |
| Heavy Rain         | 64.5 <= P < 115.5 mm   | Orange (Alert) | Localized urban flooding; transport. |
| Very Heavy Rain    | 115.6 <= P < 204.4 mm  | Red (Warning)  | Major inundation, riverine surges.   |
| Extremely Heavy    | P >= 204.5 mm          | Crimson (Risk) | Catastrophic flooding; evacuation.   |
+----------------------------------------------------------------------------------------------------+
```

### 7.2 IMD Heat Wave Classification (`src/extremes/heat_wave.py`)

$$\text{Parameter: 2m Maximum Daily Temperature } (T_{\text{max}})$$

* **Climatological Baseline:** Normal threshold for plains: $T_{\text{norm}} \ge 40.0^\circ\text{C}$; coastal stations: $T_{\text{norm}} \ge 37.0^\circ\text{C}$.
* **Heat Wave Criteria (Plains):**
  * Departure from normal: $+4.5^\circ\text{C} \le \Delta T \le +6.4^\circ\text{C}$ (or absolute $T_{\text{max}} \ge 45.0^\circ\text{C}$).
  * Color Code: **Yellow / Orange Alert**.
* **Severe Heat Wave Criteria:**
  * Departure from normal: $\Delta T > +6.4^\circ\text{C}$ (or absolute $T_{\text{max}} \ge 47.0^\circ\text{C}$).
  * Color Code: **Red Warning**.

### 7.3 IMD / WMO Beaufort High Wind Classification (`src/extremes/high_wind.py`)

$$\text{Parameter: 10m Mean Wind Speed & Gust Potential } (S_{10m})$$

* **Gentle / Moderate Wind:** $S < 40\text{ km/h}$ (Normal).
* **Strong Wind (IMD Squall Warning):** $40\text{ km/h} \le S < 62\text{ km/h}$ (**Yellow Alert**; fishing restrictions).
* **Gale / Squall Force Wind:** $62\text{ km/h} \le S < 88\text{ km/h}$ (**Orange Warning**; structural damage, downed tree limbs).
* **Severe Storm / Cyclone Core:** $S \ge 88\text{ km/h}$ (**Red Severe Hazard**; widespread devastation).

### 7.4 Model Consensus Agreement Flags
Every extreme event warning contains a deterministic multi-model consensus status:
* **`UNANIMOUS_THRESHOLD_EXCEEDANCE`**: Both GFS and ECMWF independently cross the alert threshold.
* **`DIVERGENT_GFS_ONLY`**: GFS predicts an extreme event; ECMWF remains below threshold.
* **`DIVERGENT_ECMWF_ONLY`**: ECMWF predicts an extreme event; GFS remains below threshold.
* **`CONSENSUS_BELOW_THRESHOLD`**: Neither model predicts an extreme event.

---

## 8. Empirical Research & Scientific Validation (EXP001–EXP004)

The SIH26081 system is grounded in four comprehensive empirical benchmark experiments spanning **72,772 spatial grid pairs** across the complete 2024 Indian Summer Monsoon season.

```
+-------------------------------------------------------------------------------------------------------------+
| EXPERIMENT   | TEMPORAL WINDOW | PAIRS (N) | EVALUATED CONFIGURATIONS      | KEY SCIENTIFIC FINDING         |
+-------------------------------------------------------------------------------------------------------------+
| EXP001       | June 1-30, 2024 | 23,730    | Standalone NOAA GFS 0.25°     | Drizzle bias identified: GFS   |
|              |                 |           | vs. IMD Pune Ground Truth     | predicted rain in 90.9% of     |
|              |                 |           |                               | pairs vs. 44.1% dry in IMD.    |
+-------------------------------------------------------------------------------------------------------------+
| EXP002       | June 1-30, 2024 | 23,730    | NOAA GFS, ECMWF IFS,          | Error correlation r = 0.5532;  |
|              |                 |           | 50/50 Static Consensus        | 50/50 consensus reduces MAE    |
|              |                 |           |                               | by -0.365 mm over GFS (p<0.001)|
+-------------------------------------------------------------------------------------------------------------+
| EXP003       | June 1-30, 2024 | 23,730    | Causal Rolling Skill (W=5),   | Tested 1-day causal latency.   |
|              | (May 17-31 trn) |           | Dynamic Adaptive Weight (M7)  | Adaptive weighting showed NO   |
|              |                 |           | vs. 50/50 Ensemble            | stat-sig MAE gain (p = 0.505). |
+-------------------------------------------------------------------------------------------------------------+
| EXP004       | June 1 - Aug 31 | 72,772    | Full Season Multi-Period:     | 50/50 ensemble outperforms     |
|              | 2024 (92 days)  |           | GFS, ECMWF, 50/50, Adaptive M7| adaptive weighting (p = 0.016).|
|              |                 |           | Disagreement Correlation      | Disagreement correlates with   |
|              |                 |           |                               | error magnitude (r = 0.4915).  |
+-------------------------------------------------------------------------------------------------------------+
```

### 8.1 The Canonical Experiment Metrics Summary

| Evaluation Benchmark | Period / Dates | Sample Count ($N$) | Evaluation Method | GFS Baseline MAE | ECMWF Baseline MAE | 50/50 Consensus MAE | Adaptive Model (M7) MAE | Best Model RMSE |
| :--- | :--- | :---: | :--- | :---: | :---: | :---: | :---: | :---: |
| **EXP001 Baseline** | June 1–30, 2024 | 23,730 | GFS vs. IMD | 7.036 mm | — | — | — | 13.722 mm |
| **EXP002 Consensus** | June 1–30, 2024 | 23,730 | Dual NWP vs. IMD | 7.036 mm | 7.258 mm | **6.671 mm** | — | **11.391 mm** |
| **EXP003 Causal Latency**| June 1–30, 2024 | 23,730 | $T-1$ Operational Lag | 7.036 mm | 7.258 mm | 6.671 mm | **6.670 mm** | **11.290 mm** |
| **EXP004 Period 1 (June)**| June 1–30, 2024 | 23,730 | Onset Phase | 7.036 mm | 7.258 mm | **6.671 mm** | 6.670 mm | **11.391 mm** |
| **EXP004 Period 2 (July)**| July 1–31, 2024 | 24,521 | Peak Active Monsoon | 7.925 mm | 8.816 mm | **7.848 mm** | 7.940 mm | **13.560 mm** |
| **EXP004 Period 3 (Aug)** | Aug 1–31, 2024 | 24,521 | Break / Active Phase| 7.750 mm | 8.147 mm | **7.422 mm** | 7.483 mm | **13.626 mm** |
| **EXP004 Full Season** | **June 1 – Aug 31** | **72,772** | **92-Day Continuous** | **7.576 mm** | **8.083 mm** | **7.321 mm** | **7.372 mm** | **12.923 mm** |

### 8.2 The Statistical Acceptance Gate Protocol
In computational science, candidate models frequently appear superior on small test sets but degrade over multi-month seasonal distributions. To prevent deploying overfit algorithms, the system incorporates an automated **Statistical Acceptance Gate** (`src/verification/acceptance_gate.py`):

* **Evaluation Sample:** $N = 72,772$ grid pairs across 92 continuous days.
* **Resampling Technique:** **Day-Level Paired Block Bootstrap** ($B = 1,000$ iterations), where entire 791-cell spatial fields are resampled simultaneously to preserve spatial autocorrelation.
* **Observed Difference:** $\Delta\text{MAE} = \text{MAE}_{\text{M7}} - \text{MAE}_{50/50} = +0.0514\text{ mm}$.
* **95% Bootstrap Confidence Interval:** $[+0.0033\text{ mm}, +0.1013\text{ mm}]$ (strictly positive).
* **Empirical $p$-value:** $p = 0.016$.
* **Gate Verdict:** **`BASELINE_RETAINED_HONEST_DISCLOSURE`**.
* **Operational Policy:** Because candidate adaptive weighting failed to achieve a statistically significant error reduction ($p < 0.05$ with $\Delta\text{MAE} < 0$), the 50/50 equal-weight ensemble is retained as the authoritative operational baseline.

---

## 9. Operational Dual-Mode Engine Architecture

The system enforces an explicit structural separation between **Retrospective Analysis** and **Live Forecasting** to preserve causal boundaries and prevent data leakage.

```
                           +------------------------------+
                           | INCOMING CLIENT HTTP REQUEST |
                           +--------------+---------------+
                                          |
                        +-----------------+-----------------+
                        |                                   |
              [Mode: RETROSPECTIVE]                    [Mode: LIVE]
                        |                                   |
             Routes to /api/v2/forecast             Routes to /api/live
                        |                                   |
            Loads Parquet Master Data            Fetches 00 UTC Slices from S3/GCS
                        |                                   |
            Historical Skill Available (T-1)     No Verification Observation Yet
                        |                                   |
            Full Dynamic Weight Attribution      Strict 50/50 Operational Consensus
                        |                                   |
             Audited against IMD Ground Truth    Verification Flag: PENDING_OBSERVATION
```

### 9.1 Mode Comparison Matrix

| Operational Attribute | Retrospective Benchmark Mode (`/api/v2/forecast`) | Live Real-Time Ingestion Mode (`/api/live`) |
| :--- | :--- | :--- |
| **Primary Engine Class** | `V2OperationalEngine` (`src/operational/v2_engine.py`) | `LiveForecastEngine` (`src/operational/live_engine.py`) |
| **Data Provenance** | Verified 92-day multi-month archive (Parquet) | Public cloud byte-range GRIB2 streams (AWS / GCS) |
| **Available Variables** | Precipitation ($mm$), Temperature ($^\circ C$), Wind ($km/h$) | 24-hour Accumulated Precipitation ($mm$) |
| **Available Lead Times**| +24 hours, +48 hours, +72 hours | +24 hours (operational cycle) |
| **Weight Allocation** | Dynamic Simplex Weights with 4-factor attribution | Fixed 50/50 equal-weight consensus |
| **Ground Truth Audit** | Grounded in IMD Pune binary gridded data | Observation marked `PENDING_OBSERVATION` |
| **Scientific Guarantee**| Causal latency enforcer ($T-1$) | Zero fabricated data; honest operational disclosure |

---

## 10. Complete REST API Specification

The operational HTTP server executes via `src/operational/server.py` using Python’s standard library `ThreadingHTTPServer` (Port 8080). It supports CORS, returns standardized JSON, and serves frontend static assets.

### 10.1 Core System & Health Endpoints

#### `GET /api/system/health`
Returns the status, active spatial domain, and metadata of the primary operational engine.
* **Response Status:** `200 OK`
* **Response Payload Example:**
```json
{
  "system_status": "ONLINE",
  "mode": "OPERATIONAL_PROTOTYPE",
  "core_fusion": "50/50 GFS + ECMWF Equal-Weight Ensemble",
  "confidence_engine": "EXP004 Disagreement Bins (Frozen May Thresholds)",
  "active_domain": "Andhra Pradesh & Telangana (12N-20N, 76E-85E)",
  "total_terrestrial_cells": 791,
  "loaded_samples": 72772,
  "available_days": 92,
  "data_integrity": "100% REAL DATA (Zero synthetic/interpolated values)",
  "timestamp_utc": "2026-09-29T14:15:00.000000+00:00"
}
```

#### `GET /api/v2/system/health`
Returns detailed V2 multi-variable and multi-lead capabilities.
* **Response Status:** `200 OK`
* **Parameters:** None.
* **Supported Variables:** `["precipitation", "temperature", "wind"]`.
* **Supported Leads:** `[24, 48, 72]`.

#### `GET /api/dates` and `GET /api/v2/dates`
Returns the complete list of 92 validated continuous dates with seasonal flags and ground-truth verification indicators.
* **Response Status:** `200 OK`

---

### 10.2 Spatial Forecast Endpoints

#### `GET /api/v2/forecast`
Primary grid endpoint returning all 791 terrestrial cells for a given date, variable, and lead time.
* **Query Parameters:**
  * `date` *(string, optional)*: Target date formatted as `YYYY-MM-DD` (e.g., `2024-07-15`). Default: `2024-07-15`.
  * `variable` *(string, optional)*: `precipitation`, `temperature`, or `wind`. Default: `precipitation`.
  * `lead` *(integer, optional)*: `24`, `48`, or `72`. Default: `24`.
* **Response Status:** `200 OK` or `400 Bad Request`.
* **Point Structure Example:**
```json
{
  "lat": 16.5,
  "lon": 80.5,
  "subregion": "Coastal Andhra Pradesh",
  "regime": "Moderate Rain (15.6 - 64.4 mm)",
  "variable": "precipitation",
  "unit": "mm",
  "lead_hours": 24,
  "gfs_val": 28.40,
  "ecmwf_val": 34.60,
  "baseline_50_50": 31.50,
  "blended_val": 32.12,
  "disagreement": 6.20,
  "disagreement_norm": 0.187,
  "confidence_class": "Low Confidence",
  "expected_mae": 9.46,
  "imd_mm": 29.80,
  "w_gfs": 0.40,
  "w_ecmwf": 0.60,
  "delta_w_ai": -0.10,
  "dominant_model": "ECMWF",
  "weight_entropy": 0.971,
  "attribution": {
    "historical_skill": 0.00,
    "lead_time": 0.00,
    "subregion": -0.05,
    "regime": -0.05
  },
  "extreme_guidance": {
    "hazard_type": "HEAVY_RAINFALL",
    "alert_level": "MODERATE_RAIN",
    "imd_color": "yellow",
    "severity_score": 1,
    "consensus_status": "UNANIMOUS_THRESHOLD_EXCEEDANCE",
    "action_guidance": "Waterlogging in low-lying sectors."
  }
}
```

#### `GET /api/v2/forecast/point`
Returns a detailed single-cell point inspection with nearest-neighbor lookup and out-of-domain rejection.
* **Query Parameters:**
  * `lat` *(float, required)*: Latitude in degrees North.
  * `lon` *(float, required)*: Longitude in degrees East.
  * `date` *(string, optional)*: Target date (`YYYY-MM-DD`).
  * `variable` *(string, optional)*: Target variable.
  * `lead` *(integer, optional)*: Lead time (hours).
* **Response Status:** `200 OK`, `400 Bad Request`, or `404 Not Found`.

---

### 10.3 Weight Maps & Extreme Weather Endpoints

#### `GET /api/v2/weights/map`
Returns dedicated model weight maps and entropy distribution across all 791 cells.
* **Query Parameters:** `date`, `variable`, `lead`.
* **Returned Fields:** `w_gfs`, `w_ecmwf`, `delta_w_ai`, `dominant_model`, `weight_entropy`, `attribution`.

#### `GET /api/v2/extremes`
Filters the domain for active hazardous weather cells crossing Yellow, Orange, or Red alerts.
* **Query Parameters:** `date`, `variable`, `lead`.
* **Returned Fields:** Domain extreme summary, count of active warnings, and filtered list of alerting cells.

#### `GET /api/v2/verification/audit`
Executes an on-the-fly Paired Block Bootstrap Acceptance Gate audit over evaluation data.
* **Response Status:** `200 OK`
* **Response Payload:** Contains delta MAE, 95% bootstrap confidence intervals, empirical $p$-value, and official certification status (`BASELINE_RETAINED_HONEST_DISCLOSURE`).

---

### 10.4 Live Forecasting Endpoints

#### `GET /api/live`
Fetches and serves live 24-hour precipitation forecasts for the current operational date.
* **Query Parameters:**
  * `date` *(string, optional)*: Target date.
  * `refresh` *(boolean, optional)*: Force cache refresh from cloud mirrors.
  * `variable` *(string, optional)*: Must be `precipitation` (other variables return guidance modal).
  * `lead` *(integer, optional)*: Must be `24`.
* **Response Status:** `200 OK` or `503 Service Unavailable`.

#### `GET /api/live/status`
Returns the status of live cloud mirrors, download latency, and active cache state.

---

## 11. Presentation Layer & Frontend Architecture

The user interface (`frontend/`) is engineered as a zero-framework, high-performance web dashboard utilizing standard HTML5, modern CSS3, Vanilla JavaScript (ES2022), and Leaflet.js.

```
frontend/
├── index.html                  # Semantic dashboard structure & control layouts
├── style.css                   # Custom light-neutral design system & styling
├── app.js                      # Core state management, Leaflet engine, UI controllers
├── threed_view.js              # 3D canvas isosurface & terrain altitude renderer
├── domain_boundaries.geojson   # High-resolution Andhra Pradesh & Telangana border vectors
└── vendor/                     # Self-contained third-party libraries (Leaflet, Lucide icons)
```

### 11.1 Progressive Disclosure Inspector (6 Information Tiers)
When a user clicks any of the 791 cells on the interactive map, the slide-out inspector exposes six progressive depth levels:
1. **Level 1 (Operational Summary):** Blended forecast value, primary regime classification, and high-visibility calibrated confidence badge.
2. **Level 2 (Explainable Confidence Rationale):** Plain-language explanation of inter-model disagreement ($D$ and $D_{\text{norm}}$) with historical MAE expectation.
3. **Level 3 (Side-by-Side Model Comparison):** Direct comparison between NOAA GFS, ECMWF IFS, and the fused consensus value.
4. **Level 4 (Retrospective Verification Audit):** Verification against IMD Pune ground truth observations with an explicit note regarding the 87.5% temporal accumulation overlap.
5. **Level 5 (Technical Cell Geometry):** Exact $0.25^\circ$ cell boundaries, subregional tag, and Shannon weight entropy.
6. **Level 6 (Data Provenance & Initialization):** Complete data sources, cycle initialization timestamps (00 UTC), and range-request byte verification.

### 11.2 3D Isosurface Visualization Subsystem (`frontend/threed_view.js`)
In addition to 2D chloropleth mapping, the system includes a 3D Terrain & Isosurface visualizer:
* Renders a 3D perspective grid matching the 791 land coordinates.
* Height deformation corresponds dynamically to precipitation intensity, temperature elevation, or kinetic wind shear.
* Allows orbit rotation, altitude panning, and spatial contour inspection.

---

## 12. Quality Assurance & Regression Testing Suite

The repository contains an exhaustive test suite executed via `pytest`. All 71 tests execute in approximately 25 seconds, verifying scientific constraints, data boundaries, and network pipelines.

```
tests/
├── conftest.py                     # Global fixtures, mock datasets, coordinate bounds
├── test_acceptance_gate.py         # Block bootstrap mathematics & certification logic
├── test_blending_constraints.py    # Simplex sum-to-one, non-negativity, entropy limits
├── test_causal_boundaries.py       # T-1 latency checks, anti-leakage verification
├── test_exp002.py                  # Dual-model correlation & paired bootstrap metrics
├── test_exp003.py                  # Operational 1-day latency adaptive tests
├── test_exp004.py                  # 92-day multi-period metrics & disagreement binning
├── test_extreme_guidance.py        # IMD heavy rain, heat wave, WMO wind thresholds
├── test_live_engine.py             # HTTP range-request mock parsing, live status
├── test_operational_prototype.py   # Engine initialization, coordinate alignment
├── test_pipeline.py                # End-to-end ingestion and preprocessing pipeline
├── test_v2_operational.py          # Multi-variable, multi-lead, weight map integrity
└── test_variables_and_qc.py        # Physical bounds, NaN rejection, unit conversions
```

### 12.1 Key Test Commands
* **Run Entire Test Suite:**
  ```powershell
  pytest tests/ -v
  ```
* **Verify Causal Boundaries & Leakage:**
  ```powershell
  pytest tests/test_causal_boundaries.py -v
  ```
* **Verify Simplex Blending Constraints:**
  ```powershell
  pytest tests/test_blending_constraints.py -v
  ```
* **Verify Statistical Acceptance Gate:**
  ```powershell
  pytest tests/test_acceptance_gate.py -v
  ```

---

## 13. System Installation, Configuration & Runbook

### 13.1 System Requirements
* **Operating System:** Windows 10/11, Ubuntu 22.04 LTS, or macOS 13+.
* **Python Runtime:** Python 3.10, 3.11, or 3.12.
* **Memory:** Minimum 4 GB RAM (8 GB recommended for multi-month Parquet caching).
* **Disk Space:** 500 MB for core repository; ~2.5 GB if full season raw GRIB2 archives are cached.

### 13.2 Installation Steps

1. **Clone the Repository:**
   ```bash
   git clone <repository_url> c:\sih
   cd c:\sih
   ```

2. **Set Up Python Virtual Environment:**
   ```powershell
   python -m venv .venv
   .\.venv\Scripts\Activate.ps1
   ```

3. **Install Dependencies:**
   ```powershell
   pip install -r requirements.txt
   ```

4. **Verify Installation via Regression Tests:**
   ```powershell
   pytest tests/
   # Expected output: 71 passed
   ```

### 13.3 Starting the Operational Server
Launch the server on localhost port 8080:

```powershell
python src/operational/server.py 8080
```

* **Web Mission Control:** Open `http://127.0.0.1:8080/` in any modern web browser.
* **REST API Endpoint:** `http://127.0.0.1:8080/api/system/health`
* **V2 Compliance API:** `http://127.0.0.1:8080/api/v2/system/health`

### 13.4 Running Ingestion & Experiment Pipelines
* **Execute EXP004 Multi-Month Benchmark Pipeline:**
  ```powershell
  python src/exp004_pipeline.py
  ```
* **Run Live Forecast Generation (Manual CLI Trigger):**
  ```powershell
  python -c "from src.operational.live_engine import LiveForecastEngine; eng = LiveForecastEngine(); print(eng.generate_live_forecast())"
  ```

---

## 14. Troubleshooting & Maintenance Guide

| Symptom / Error | Root Cause | Remediation Procedure |
| :--- | :--- | :--- |
| `DATE_NOT_FOUND` on `/api/forecast` | Requested date outside the continuous June 1 – Aug 31, 2024 range. | Query `/api/dates` for the list of available verified dates. |
| `LIVE_PARAM_NOT_SUPPORTED` | Live stream queried for Temperature or Wind. | Temperature and Wind operate in Retrospective mode. Switch mode to Retrospective or query `/api/v2/forecast`. |
| Port 8080 Binding Error | Another process is occupying port 8080. | Launch server on alternate port: `python src/operational/server.py 8085`. |
| ConnectionResetError in server logs | Browser aborted HTTP connection prematurely during tile pan/zoom. | Normal HTTP client behavior. Server utilizes `RobustThreadingHTTPServer` to suppress these safely without crashing. |
| Missing IMD Verification Values | Observation date is within current operational cycle. | IMD gridded rasters have an operational compilation latency of 24–48 hours. Values are marked `PENDING_OBSERVATION`. |

---

## 15. Compliance & Certification Checklist

* [x] **Multi-Model NWP Ingestion:** Ingests independent NOAA GFS and ECMWF IFS feeds on regular 0.25° grids.
* [x] **Zero Synthetic Data:** 100% evaluated on physical operational model forecasts and IMD observations.
* [x] **Convex Simplex Weights:** All weights strictly satisfy $w_i \ge 0$ and $\sum w_i = 1.0$.
* [x] **Context Attribution:** Weight adaptations grounded in Historical Skill, Lead Time, Terrain/Subregion, and Meteorological Regime.
* [x] **Multi-Variable Architecture:** Full operational support for Precipitation, Temperature, and Kinetic Wind.
* [x] **Multi-Lead Horizons:** Validated across +24h, +48h, and +72h forecast horizons.
* [x] **Deterministic Extreme Guidance:** Conforms strictly to IMD Pune (Rain), IMD New Delhi (Heat), and WMO Beaufort (Wind) standards.
* [x] **Calibrated Confidence Engine:** Grounded in empirical inter-model disagreement with statistically verified error tiers.
* [x] **Causal Operational Boundaries:** Strict $T-1$ latency enforcer preventing data leakage.
* [x] **Statistical Acceptance Gate:** Block bootstrap hypothesis testing prevents unverified model deployment.
* [x] **Operational Separation:** Strict physical separation between Live cloud streams and Retrospective benchmarks.
* [x] **Zero Prohibited Terminology:** Zero false probabilistic claims or misleading marketing terminology across code, APIs, and UI.

---
*Document compiled and certified for SIH26081 Technical Release.*
