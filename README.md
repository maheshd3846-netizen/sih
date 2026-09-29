# SIH26081 — Multi-Model Meteorological Consensus & Confidence Engine
### Adaptive Forecast-Observation Fusion & Extreme Weather Guidance System

[![Tests](https://img.shields.io/badge/pytest-71%20passed-brightgreen.svg)]()
[![Python](https://img.shields.io/badge/python-3.10%20%7C%203.11%20%7C%203.12-blue.svg)]()
[![Domain](https://img.shields.io/badge/domain-Andhra%20Pradesh%20%26%20Telangana-orange.svg)]()
[![Validation](https://img.shields.io/badge/ground%20truth-IMD%20Pune%200.25%C2%B0-success.svg)]()

SIH26081 is an operational meteorological forecasting and verification platform that ingests Numerical Weather Prediction (NWP) model outputs from **NOAA GFS** and **ECMWF IFS**, harmonizes them onto a regular 0.25° grid over **Andhra Pradesh & Telangana** (791 terrestrial cells), executes convex simplex blending, quantifies uncertainty directly from physical inter-model disagreement, provides deterministic extreme weather guidance, and serves both REST APIs and an interactive mission-control dashboard.

---

## 📖 Technical Documentation

For the complete technical specification, mathematical formulation, REST API schemas, and deployment instructions, refer to:
👉 **[Comprehensive Technical Documentation](file:///c:/sih/docs/TECHNICAL_DOCUMENTATION.md)**

---

## 🚀 Quick Start

### 1. Environment Setup
```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

### 2. Run Test Suite
```powershell
.\.venv\Scripts\pytest tests/ -q
# Output: 71 passed in ~22s
```

### 3. Launch Operational Prototype Server
```powershell
python src/operational/server.py 8080
```
* **Mission-Control Dashboard:** [http://127.0.0.1:8080/](http://127.0.0.1:8080/)
* **Health Check API:** [http://127.0.0.1:8080/api/system/health](http://127.0.0.1:8080/api/system/health)
* **V2 Compliance API:** [http://127.0.0.1:8080/api/v2/system/health](http://127.0.0.1:8080/api/v2/system/health)

---

## 🔬 Core Benchmark Summary (EXP001–EXP004)

* **EXP001:** Standalone NOAA GFS baseline vs. IMD ground truth (MAE 7.036 mm; drizzle bias identified).
* **EXP002:** Dual NWP consensus ($0.5\text{ GFS} + 0.5\text{ ECMWF}$) reduces seasonal MAE to 6.671 mm ($p < 0.0001$; error correlation $r = 0.5532$).
* **EXP003:** Causal adaptive weighting evaluated with 1-day operational latency ($T-1$).
* **EXP004:** Full season multi-period evaluation across 72,772 grid pairs. Disagreement ($D$) correlates strongly with error ($r = 0.4915$). The Statistical Acceptance Gate protocol retains the 50/50 static consensus as the primary operational baseline with honest empirical disclosure ($p = 0.016$).