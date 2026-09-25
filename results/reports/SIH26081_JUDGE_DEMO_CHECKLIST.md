# SIH26081 Judge Demonstration Checklist & Script

**Project Code:** SIH26081  
**Application Name:** Precipitation Fusion & Confidence Engine  
**Target Event:** Smart India Hackathon Grand Finale  
**Estimated Time:** 5 – 7 Minutes  

---

## Pre-Flight Setup Checklist

- [ ] Python virtual environment active (`.venv`)
- [ ] Operational HTTP API server running on port 8080 (`python -m src.operational.server`)
- [ ] Browser navigated to `http://127.0.0.1:8080/`
- [ ] Status pill reads: `SYSTEM: ONLINE` (green indicator dot)
- [ ] Domain verified: `791 Terrestrial Grid Cells`
- [ ] Default date set: `2024-07-15` (Peak Monsoon Active Phase)
- [ ] All 32 automated tests passed (`pytest tests/ -v`)

---

## 10-Step Judge Presentation Script

### STEP 1 — Open Dashboard & Mission Control Overview
* **Action:** Direct judge's attention to the top navigation bar and the main map interface.
* **Talking Point:**
  > *"Respected Judges, this is SIH26081: the Precipitation Fusion & Confidence Engine. When extreme weather strikes, decision-makers are often caught between conflicting forecasts from global models like NOAA GFS and ECMWF IFS. Picking one model blindly creates catastrophic blind spots. Our platform combines independent models through a scientifically validated 50/50 ensemble and provides a calibrated uncertainty indicator based on inter-model disagreement."*
* **Visual Check:**
  * Brand badge shows `SIH26081`.
  * Title reads `PRECIPITATION FUSION`.
  * Header shows `00 UTC Initialization | +24h Lead | Strictly Causal (T-1)`.

---

### STEP 2 — Select a Representative Historical Date
* **Action:** Click the date picker or scrubber to show July 15, 2024.
* **Talking Point:**
  > *"We evaluate our system across the complete 92 continuous days of the 2024 Southwest Monsoon (June 1 through August 31, 2024). Let's examine July 15, 2024, during a vigorous active monsoon phase over Telangana and Coastal Andhra Pradesh."*
* **Visual Check:**
  * Date indicator updates to `2024-07-15`.
  * Map refreshes with 791 terrestrial cells in $< 100\text{ ms}$.

---

### STEP 3 — Show Fused Precipitation Forecast
* **Action:** Point to the choropleth map with the `50/50 Fused Forecast` layer active.
* **Talking Point:**
  > *"Every 0.25° grid cell (~27 km resolution) displays the fused 24-hour rainfall forecast: $P_{\text{fused}} = 0.5 \times P_{\text{GFS}} + 0.5 \times P_{\text{ECMWF}}$. In EXP002 and EXP004 across 72,772 samples, this equal-weight consensus reduced Mean Absolute Error by over 5% compared to standalone GFS and ECMWF, taking advantage of complementary physics without dynamic overfitting."*
* **Visual Check:**
  * Rainfall legend is visible with clear physical categories ($<0.1\text{ mm}$ dry up to $\ge 60\text{ mm}$ extreme).
  * KPI cards display Domain Mean, Max Rainfall, and Active Rain Area.

---

### STEP 4 — Inspect a High-Disagreement Grid Cell
* **Action:** Click the quick demonstration button: `Inspect Highest Disagreement Cell` (or click an orange/red cell on the map).
* **Talking Point:**
  > *"Notice how the Grid Cell Inspector opens on the right, providing 6 levels of progressive disclosure. Here in northern Telangana, NOAA GFS predicted heavy rainfall, whereas ECMWF IFS predicted moderate rainfall. The inter-model disagreement is significant."*
* **Visual Check:**
  * Selected cell is highlighted with an emerald pulsing boundary.
  * Inspector opens showing Level 1 (Fused Rainfall & Confidence).

---

### STEP 5 — Explain Model Disagreement & Calibrated Confidence
* **Action:** Switch the map layer to `Confidence` or `Disagreement`, and highlight Level 2 ("Why this confidence?") in the inspector.
* **Talking Point:**
  > *"We do not compute artificial percentage probabilities. Instead, we compute inter-model disagreement $D = |P_{\text{GFS}} - P_{\text{ECMWF}}|$. When models agree ($D < 0.11\text{ mm}$), historical error is low: Historical MAE is 2.02 mm. When models strongly diverge ($D \ge 2.06\text{ mm}$), historical error escalates nearly 5× to 9.46 mm. We translate this into transparent High, Moderate, and Low confidence categories."*
* **Key Distinction for Judges:**
  > *"High disagreement does not mean we fabricate a low probability. It directly signals to disaster management authorities that model uncertainty is elevated and flood teams should exercise increased operational caution."*

---

### STEP 6 — Switch to IMD Retrospective Verification Layer
* **Action:** Click the `IMD Retrospective Verification` layer button in the layer bar.
* **Talking Point:**
  > *"We hold ourselves to strict scientific accountability. By switching to the IMD Retrospective Verification layer, judges can audit what actually occurred against the India Meteorological Department's gridded observations. Notice our explicit caveat: IMD daily accumulation ends at 08:30 IST while NWP accumulation ends at 00:00 UTC, providing approximately 87.5% temporal overlap. We never claim 100% identical windows or hide this operational reality."*
* **Visual Check:**
  * IMD observed precipitation is displayed.
  * Cell inspector Level 4 shows the observation and absolute error.

---

### STEP 7 — Demonstrate Regional Filtering
* **Action:** Click through the region pills: `Coastal AP`, `Rayalaseema`, `Telangana`, and back to `All`.
* **Talking Point:**
  > *"The system supports targeted subregional monitoring. Clicking 'Telangana' automatically zooms the viewport, subsets the 341 terrestrial cells, recalculates the subregional statistics, and maintains identical temporal synchronization. We do not claim all-India coverage—our rigorous verification is strictly grounded in Andhra Pradesh and Telangana."*
* **Visual Check:**
  * Map smoothly pans and zooms to the selected region.
  * KPI summary cards update dynamically to reflect the subregional distribution.

---

### STEP 8 — Open the Verification Tab & Present Empirical Evidence
* **Action:** Click the `Verification` tab in the top navigation.
* **Talking Point:**
  > *"In this dedicated Verification module, we present the complete empirical audit across 72,772 observation-forecast pairs. Judges can inspect the cross-period performance across June (monsoon onset), July (active monsoon), and August (active/break phase). Across the entire season, 50/50 static fusion achieved an overall MAE of 7.321 mm, outperforming individual models consistently."*
* **Visual Check:**
  * Cross-period KPI cards and benchmark tables render cleanly.
  * Disagreement bin table shows monotonic error escalation from 2.02 mm to 9.46 mm.

---

### STEP 9 — Explain Why 50/50 Equal Weighting Was Retained
* **Action:** Scroll down to the scientific rationale card in the Verification / Methodology tab.
* **Talking Point:**
  > *"A critical question judges often ask is: 'Why not use machine learning or adaptive weighting?' In EXP003 and EXP004, we rigorously evaluated 7 causal adaptive weighting architectures with expanding-origin historical memory. While adaptive weighting yielded minor RMSE reductions in isolated periods, 50/50 equal weighting outperformed adaptive fusion across the full season (7.321 mm vs 7.372 mm MAE, p = 0.016). Equal weighting avoids fitting to synoptic observational noise. Retaining 50/50 is an evidence-based scientific decision."*

---

### STEP 10 — Conclude with Future Scalability & Architecture
* **Action:** Navigate to the `About` tab to display system governance, or launch the automated `⚡ SIH Judge Demo` modal.
* **Talking Point:**
  > *"Our system is architected for modular scale. Because our data ingestion, common-grid remapping, quality control, and disagreement engines are completely decoupled, the pipeline can readily incorporate additional numerical models (such as NCMRWF or UKMO) and scale to all-India meteorological sub-divisions. Thank you, Judges. We welcome your questions."*

---

## Quick Reference for Demo Fail-Safe

| Situation | Action |
| :--- | :--- |
| Judge asks for automated walk-through | Click `⚡ SIH Judge Demo` in the top right header to launch the 6-step guided modal. |
| Judge wants to see extreme rain | Click `🌧️ Inspect Peak Rainfall Cell` shortcut button below the confidence bar. |
| Judge wants to see low confidence | Click `⚡ Inspect Highest Disagreement Cell` shortcut button below the confidence bar. |
| Judge asks about API | Show `http://127.0.0.1:8080/api/system/health` in a browser tab. |
| Judge asks about unit tests | Run `pytest tests/ -v` in terminal (shows 32/32 tests passed). |
