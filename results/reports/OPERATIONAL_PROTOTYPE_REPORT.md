# Operational Prototype: 50/50 GFS–ECMWF NWP Fusion & Confidence Engine

**Document:** `results/reports/OPERATIONAL_PROTOTYPE_REPORT.md`  
**System Status:** `ONLINE / OPERATIONAL`  
**Deployment URL:** `http://127.0.0.1:8080/`  
**Date of Release:** September 25, 2026  
**Experimental Foundation:** EXP001–EXP004 Frozen Scientific Baseline  

---

## 1. Executive Summary

In accordance with the scientific findings established across EXP001 through EXP004, the operational prototype has been constructed using:
1. **Validated 50/50 Equal-Weight Static NWP Fusion:**
   $$P_{\text{fused}} = 0.5 \times P_{\text{GFS}} + 0.5 \times P_{\text{ECMWF}}$$
   - The 50/50 equal-weight ensemble was retained because it demonstrated more robust overall MAE than the tested adaptive fusion across the June–August evaluation period ($7.321\text{ mm}$ vs $7.372\text{ mm}$, $p = 0.016$).
   - **Zero ML, zero neural networks, zero adaptive dynamic model weighting.**
2. **EXP004 Disagreement-Based Confidence Engine:**
   - Evaluates inter-model forecast disagreement:
     $$D = |P_{\text{GFS}} - P_{\text{ECMWF}}| \quad (\text{in mm})$$
     $$D_{\text{norm}} = \frac{|P_{\text{GFS}} - P_{\text{ECMWF}}|}{1.0 + P_{\text{fused}}}$$
   - Classifies every grid cell into frozen empirical confidence categories derived from calibration:
     - **High Confidence:** $D < 0.11\text{ mm}$ (Historical MAE: $2.02\text{ mm}$, RMSE: $5.54\text{ mm}$)
     - **Moderate Confidence:** $0.11 \le D < 2.06\text{ mm}$ (Historical MAE: $3.75\text{ mm}$, RMSE: $7.97\text{ mm}$)
     - **Low Confidence:** $D \ge 2.06\text{ mm}$ (Historical MAE: $9.46\text{ mm}$, RMSE: $15.13\text{ mm}$)
   - **No fabricated percentage probabilities:** Confidence is reported as an empirical class tied to rigorously verified error expectations.
3. **Causal Timing & Data Provenance Integrity:**
   - 00:00:00 UTC cycle initialization, +24h lead time, valid at 00:00:00 UTC on Day $T+1$.
   - IMD daily accumulation ends at 08:30 IST on Day $T+1$; verification is kept strictly isolated for retrospective audit.
   - Explicit system status returned on missing/corrupt source data (`DATE_NOT_FOUND`, `INVALID_DATE_FORMAT`, `POINT_OUT_OF_DOMAIN`)—zero silent data substitution or imputation.

---

## 2. System Architecture

The operational prototype consists of three decoupled, robust tiers:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       TIER 1: OPERATIONAL BACKEND                           │
│  src/operational/engine.py                                                  │
│  • Reads master 72,772 multi-period dataset (June–August 2024)              │
│  • Computes 50/50 GFS-ECMWF fusion & EXP004 confidence categorization       │
│  • Enforces 0.25° integer spatial grid (791 land points in AP + Telangana)  │
│  • Separates retrospective IMD verification                                 │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
┌──────────────────────────────────────▼──────────────────────────────────────┐
│                     TIER 2: MULTI-THREADED API SERVER                       │
│  src/operational/server.py (Port 8080)                                      │
│  • GET /api/system/health  -> Operational health, engine status, provenance │
│  • GET /api/dates          -> 92 verified operational dates (Jun-Aug 2024)   │
│  • GET /api/forecast?date= -> Full 791-cell spatial grid with NWP & D & conf│
│  • GET /api/forecast/point -> Single cell inspector query                   │
│  • Static asset server     -> Serves dashboard HTML/CSS/JS without deps     │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
┌──────────────────────────────────────▼──────────────────────────────────────┐
│                    TIER 3: INTERACTIVE MAP DASHBOARD                        │
│  frontend/index.html • style.css • app.js                                   │
│  • Leaflet 0.25° gridded choropleth over Andhra Pradesh & Telangana         │
│  • Layer toggles: 50/50 Fused, Confidence, Disagreement, GFS, ECMWF, IMD    │
│  • Interactive Cell Inspector: NWP side-by-side, D_norm, Historical MAE     │
│  • Timeline slider, play/pause sequence animator, domain diagnostics bar    │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Data Provenance & Exposure Standards

Every forecast query, whether accessed via REST API or visualized on the dashboard, exposes:

| Parameter | Operational Definition | Example Value |
| :--- | :--- | :--- |
| **NOAA GFS** | NOAA 0.25° oper APCP surface field | `10.50 mm` |
| **ECMWF IFS** | ECMWF 0.25° oper total precipitation (`tp`) | `37.95 mm` |
| **50/50 Fused Forecast** | $0.5 \times \text{GFS} + 0.5 \times \text{ECMWF}$ | `24.23 mm` |
| **Raw Disagreement ($D$)** | $|P_{\text{GFS}} - P_{\text{ECMWF}}|$ | `27.45 mm` |
| **Normalized Disagreement ($D_{\text{norm}}$)** | $\frac{D}{1.0 + P_{\text{fused}}}$ | `1.088` |
| **Confidence Class** | Binned against frozen May thresholds | `Low Confidence` |
| **Historical MAE**| Derived from EXP004 validation | `9.46 mm` |
| **Initialization Time** | UTC forecast run start | `2024-07-15T00:00:00Z` |
| **Valid Time** | UTC valid target (+24h) | `2024-07-16T00:00:00Z` |
| **Subregion** | Geographically delineated zone | `Telangana` |
| **Retrospective IMD** | Retrospective verification (if available) | `14.32 mm` |
| **Fused Absolute Error** | $|P_{\text{fused}} - P_{\text{IMD}}|$ | `9.91 mm` |

---

## 4. Verification & Automated Testing Suite

All 32 automated tests in the repository pass with 100% compliance:

```text
============================= test session starts =============================
tests/test_exp002.py::test_ecmwf_unit_conversion PASSED                  [  3%]
tests/test_exp002.py::test_ecmwf_temporal_alignment PASSED               [  6%]
tests/test_exp002.py::test_ecmwf_spatial_alignment PASSED                [  9%]
tests/test_exp002.py::test_ensemble_calculation PASSED                   [ 12%]
tests/test_exp002.py::test_missing_value_masking PASSED                  [ 15%]
tests/test_exp002.py::test_sample_count_consistency PASSED               [ 18%]
tests/test_exp003.py::test_temporal_leakage_guarantee PASSED             [ 21%]
tests/test_exp003.py::test_weight_conservation_and_bounds PASSED         [ 25%]
tests/test_exp003.py::test_sample_count_consistency PASSED               [ 28%]
tests/test_exp003.py::test_rolling_inverse_mae_logic PASSED              [ 31%]
tests/test_exp003.py::test_required_artifacts_exist PASSED               [ 34%]
tests/test_exp004.py::test_exp004_sample_count_gate PASSED               [ 37%]
tests/test_exp004.py::test_disagreement_calculation PASSED               [ 40%]
tests/test_exp004.py::test_disagreement_bounds_and_non_negativity PASSED [ 43%]
tests/test_exp004.py::test_expanding_origin_causal_latency PASSED        [ 46%]
tests/test_exp004.py::test_weight_conservation PASSED                    [ 50%]
tests/test_exp004.py::test_required_artifacts_exist PASSED               [ 53%]
tests/test_operational_prototype.py::test_equal_weight_fusion_formula PASSED [ 56%]
tests/test_operational_prototype.py::test_disagreement_calculation PASSED [ 59%]
tests/test_operational_prototype.py::test_confidence_engine_classification PASSED [ 62%]
tests/test_operational_prototype.py::test_grid_coverage_and_provenance PASSED [ 65%]
tests/test_operational_prototype.py::test_explicit_error_on_invalid_and_missing_dates PASSED [ 68%]
tests/test_operational_prototype.py::test_point_query_and_boundary_rejection PASSED [ 71%]
tests/test_operational_prototype.py::test_live_http_server PASSED        [ 75%]
tests/test_pipeline.py::test_lead_time_calculation PASSED                [ 78%]
tests/test_pipeline.py::test_time_alignment_month_and_leap_boundaries PASSED [ 81%]
tests/test_pipeline.py::test_spatial_subset_coords PASSED                [ 84%]
tests/test_pipeline.py::test_spatial_coordinate_matching PASSED          [ 87%]
tests/test_pipeline.py::test_quality_control_missing_values PASSED       [ 90%]
tests/test_pipeline.py::test_precipitation_units PASSED                  [ 93%]
tests/test_pipeline.py::test_metric_calculations PASSED                  [ 96%]
tests/test_pipeline.py::test_canonical_dataset_schema PASSED             [100%]
============================= 32 passed in 2.04s ==============================
```

---

## 5. Browser UI Visual Verification Summary

A headless automated browser session navigated to `http://127.0.0.1:8080/` and recorded live operational behavior:
1. **Header System Status:** Verified active green badge displaying `SYSTEM: ONLINE`.
2. **Interactive Map:** Verified rendering of 791 land cells across Andhra Pradesh and Telangana.
3. **Inspector Drawer:** Verified that clicking on a grid cell (e.g., $17.75^\circ\text{N}, 80.25^\circ\text{E}$ in Telangana) opens the inspection panel showing side-by-side NWP outputs, disagreement analysis, confidence class, and provenance details.
4. **Layer Switching:** Verified switching to the *Forecast Confidence* layer dynamically recolors the map into Emerald Green (High Confidence), Amber (Moderate Confidence), and Coral Red (Low Confidence) with active legend updates.

---

## 6. How to Run the Prototype

To run the operational prototype server locally:

```bash
# From workspace root
.venv\Scripts\python.exe src/operational/server.py 8080
```

Access the interactive dashboard in any modern web browser:
`http://127.0.0.1:8080/`
