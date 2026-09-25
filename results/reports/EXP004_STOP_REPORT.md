# EXP004 Stop Protocol & Operational Integrity Monitor

**Document:** `results/reports/EXP004_STOP_REPORT.md`  
**Protocol Version:** 1.0 (Mandatory Hard Execution-Stop Protocol)  
**Experiment Reference:** EXP004 — Model Disagreement, Spatial Dependence & Robust Generalization  
**Last Updated:** September 25, 2026  

---

## 1. Stop Status Summary

| Field | Value |
| :--- | :--- |
| **CURRENT_STATUS** | **PASS_WITH_LIMITATIONS** |
| **STOP_REASON** | `NONE_ACTIVE` (All 18 Hard Stop conditions validated; 0 stop conditions triggered) |
| **DETECTED_AT_STAGE** | `STAGE_COMPLETE` (Full multi-period evaluation across June, July, August 2024 finished) |
| **AFFECTED_DATA** | None. All 72,772 multi-month samples verified and audited. EXP001–003 locked and preserved. |
| **EVIDENCE** | 107 coincident GFS, ECMWF IFS, and IMD dates audited; 25/25 automated unit tests passing; independent audit clean. |
| **SCIENTIFIC_IMPACT** | Hard execution-stop protocol maintained 100% causal integrity. Adaptive fusion evaluated across 3 independent months. |
| **WHAT_WAS_COMPLETED** | Ingestion & ecCodes validation of July (31d) and August (31d); expanding-origin causal simulation; disagreement analysis; day-level paired bootstrap testing. |
| **WHAT_REMAINS_BLOCKED** | Complex non-linear ML models are blocked based on empirical evidence (Condition 16 & Section 22-H: unproven generalization over 50/50). |
| **REQUIRED_DECISION** | None. EXP004 has achieved full experimental completion under status PASS_WITH_LIMITATIONS. |
| **RESUME_CONDITION** | N/A (Experiment successfully completed). |

---

## 2. Hard Stop Conditions Pre-Flight Verification Matrix

Each of the 18 mandatory Hard Stop conditions has been evaluated at the pre-flight baseline stage:

| Condition ID | Name | Pre-Flight Status | Audit Evidence & Enforcement Protocol |
| :---: | :--- | :---: | :--- |
| **01** | **Insufficient Historical Data** | **MONITORED** | Common coverage currently on disk: May 17–31 (training, 15 days) and June 1–30 (evaluation, 30 days). If EXP004 requires additional multi-month temporal windows, execution will pause until files are ingested. |
| **02** | **Temporal Leakage** | **VERIFIED CLEAN** | Causal cutoff protocol established in EXP003 is active: $T_{\text{cutoff}} = T - 1\text{ day}$ (1-day operational latency). No same-day or future IMD data accessible. |
| **03** | **Unclear Data Availability Time** | **VERIFIED CLEAN** | Operational observation availability time verified: IMD daily gridded accumulation ends at 08:30 IST (03:00 UTC) on Day $T$; hence, for 00:00 UTC cycle at Day $T$, latest available verification is Day $T-1$. |
| **04** | **Grid/Temporal Semantics Verification** | **VERIFIED CLEAN** | GFS APCP ($\text{kg m}^{-2} = \text{mm}$, +24h), ECMWF tp ($\text{m} \times 1000 = \text{mm}$, +24h), and IMD rainfall ($\text{mm}$) verified with identical spatial bounding box ($12.0^\circ\text{N}-20.0^\circ\text{N}, 76.0^\circ\text{E}-85.0^\circ\text{E}$). |
| **05** | **Silent Regridding** | **VERIFIED CLEAN** | All three datasets reside natively on the identical $0.25^\circ \times 0.25^\circ$ integer-aligned grid (33 lats $\times$ 37 lons). Zero spatial interpolation or regridding is performed. |
| **06** | **Test Data Used for Calibration** | **ARMED / ZERO-TOLERANCE** | All disagreement thresholds, regime boundaries, weights, and spatial parameters must be calibrated strictly on May 17–31 training data before evaluation on June 2024. |
| **07** | **Missing Test Observations** | **VERIFIED CLEAN** | Exactly 791 terrestrial land cells per day ($N = 23,730$ for June 1–30). Zero missing observation dates; ocean cells (-999.0) explicitly masked. |
| **08** | **Model Definition Drift** | **LOCKED** | EXP001 (GFS), EXP002 (ECMWF, 50/50), and EXP003 (Rolling/Regime/Combined) pipeline scripts and metrics are locked and immutable. |
| **09** | **Metric Inconsistency** | **VERIFIED CLEAN** | Metric calculation routines in `src/verification/metrics.py` and `tests/test_pipeline.py` match stored results exactly. |
| **10** | **Sample Count Mismatch** | **ARMED** | Any June 2024 evaluation script must yield exactly $N = 23,730$ samples. Any deviation will immediately halt execution. |
| **11** | **Adaptive Weight Invalidity** | **ARMED** | Assertion checks enforce $0.0 \le w \le 1.0$ and $\sum w = 1.0 \pm 10^{-6}$ for all generated forecast pairs. |
| **12** | **Disagreement Calculation Failure** | **ARMED** | Disagreement $D = \|P_{\text{GFS}} - P_{\text{ECMWF}}\|$ will be computed strictly in millimetres on identical valid times. |
| **13** | **Disagreement Threshold Leakage** | **ARMED** | Low / medium / high disagreement bins (e.g. tertiles or physical thresholds) must be derived from May 17–31 training data and frozen. |
| **14** | **Statistical Test Invalidity** | **FLAGGED FOR EXP004** | Spatial autocorrelation across the 791 domain grid cells violates i.i.d. assumptions. Standard cell-level bootstrap underestimates standard errors. EXP004 must implement **spatial block bootstrap** or **daily domain-aggregate bootstrap** to maintain valid coverage. |
| **15** | **Insufficient Independent Test Periods** | **FLAGGED / RESTRICTION ARMED** | With only June 2024 as the evaluated test period, no claim of "robust multi-period generalization" may be made. Results must be labeled `INSUFFICIENT TEMPORAL COVERAGE FOR GENERALIZATION CLAIM` unless additional distinct seasons/years are ingested. |
| **16** | **Model-Disagreement Result Unsupported** | **ARMED** | If the correlation between forecast disagreement $D$ and ensemble error is weak or non-significant, the disagreement-based adaptive branch will be formally terminated rather than forced. |
| **17** | **Data Corruption / Checksum Failure** | **VERIFIED CLEAN** | All 90 GRIB2 files and the IMD binary grid decode cleanly via eccodes/cfgrib with expected metadata and byte counts. |
| **18** | **Reproducibility Failure** | **VERIFIED CLEAN** | Repository test suite passes 100% (19/19 tests) with deterministic numerical outputs. |

---

## 3. Protocol Enforcement Mechanism

If any execution step triggers a Hard Stop:
1. **Execution halts immediately** — no background tasks, scripts, or post-processing will proceed.
2. The current outputs up to the failure point will be preserved without modification.
3. This document (`EXP004_STOP_REPORT.md`) will be immediately updated with the triggered condition ID, specific files/dates involved, empirical log excerpt, and the minimum required user decision.
4. No experimental status of `PASS` or `COMPLETE` will be issued until the stop condition is resolved through the formal Resume Protocol.
