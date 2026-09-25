# DATA SCHEMA & PRECIPITATION SEMANTICS REPORT

**Project:** SIH26081 — Phase 1 (Data Acquisition, Verification & EXP001)  
**Document:** `results/reports/DATA_SCHEMA_REPORT.md`  
**Generated Date:** 2026-09-25  

---

## 1. Executive Summary

This report documents the structural inspection, coordinate systems, data types, physical units, and accumulation semantics of the raw NOAA GFS forecast dataset and the reference IMD gridded observation dataset. All findings reflect physical inspection of the downloaded raw data files.

---

## 2. NOAA GFS 0.25° Dataset Schema

Raw sample inspected: `gfs.20240601/00/atmos/gfs.t00z.pgrb2.0p25.f024` (GRIB2 Edition 2).

* **Grid Dimensions:**
  * Longitudinal Points ($N_i$): $1,440$
  * Latitudinal Points ($N_j$): $721$
  * Total Grid Points: $1,038,240$
* **Latitude Coordinate:**
  * Range: $90.0^\circ\text{N}$ down to $-90.0^\circ\text{S}$
  * First grid point: $+90.0^\circ$
  * Last grid point: $-90.0^\circ$
  * Decrement ($\Delta\text{lat}$): $0.25^\circ$
  * Coordinate values: Array decreasing from $+90.00$ to $-90.00$
* **Longitude Coordinate:**
  * Range: $0.0^\circ\text{E}$ to $359.75^\circ\text{E}$
  * First grid point: $0.0^\circ$
  * Last grid point: $359.75^\circ$
  * Increment ($\Delta\text{lon}$): $0.25^\circ$
* **Temporal Coordinates & Reference Time:**
  * Forecast Reference / Initialization Time: `2024-06-01 00:00:00 UTC` (`dataDate: 20240601`, `dataTime: 0`)
  * Forecast Lead Time: $+24\text{ hours}$ (`endStep: 24`, `stepUnits: 1`)
  * Step Range: `0-24 hours`
  * Valid Time: `2024-06-02 00:00:00 UTC`
* **Precipitation Variable Details:**
  * Parameter Name: Total Precipitation (`shortName: tp`, `name: Total Precipitation`)
  * Discipline: 0 (Meteorological products), Category: 1 (Moisture), Parameter: 8 (Total Precipitation)
  * Surface Layer: Ground or water surface
  * Raw Units: $\text{kg m}^{-2}$ (equivalent to $\text{mm}$ of liquid water accumulation)
* **Accumulation Semantics:**
  ```text
  forecast_initialization_time = 2024-06-01 00:00:00 UTC
  forecast_valid_time          = 2024-06-02 00:00:00 UTC
  accumulation_start           = 2024-06-01 00:00:00 UTC
  accumulation_end             = 2024-06-02 00:00:00 UTC
  accumulation_duration        = 24 hours
  ```
* **Missing Value Representation:**
  * Continuous global physical model field. No missing points over land or ocean (masked only when subsetted or if corrupt).

---

## 3. IMD 0.25° Gridded Rainfall Dataset Schema

Raw file inspected: `data/raw/imd/ind2024_rfp25.grd`.

* **Storage Format & Structure:**
  * Direct access unformatted binary flat file (`.grd`).
  * Data type: IEEE 32-bit floating point (`<f4`, little-endian).
  * 366 daily records (leap year 2024).
  * Record Size: $135 \times 129 \times 4\text{ bytes} = 69,660\text{ bytes per day}$.
  * Total File Size: $25,495,560\text{ bytes}$.
* **Grid Dimensions:**
  * Longitudinal Points ($N_{\text{lon}}$): $135$
  * Latitudinal Points ($N_{\text{lat}}$): $129$
  * Points per day: $17,415$
* **Latitude Coordinate:**
  * Range: $6.5^\circ\text{N}$ to $38.5^\circ\text{N}$
  * Start: $6.5^\circ\text{N}$ (Row index 0)
  * End: $38.5^\circ\text{N}$ (Row index 128)
  * Increment ($\Delta\text{lat}$): $+0.25^\circ$
* **Longitude Coordinate:**
  * Range: $66.5^\circ\text{E}$ to $100.0^\circ\text{E}$
  * Start: $66.5^\circ\text{E}$ (Column index 0)
  * End: $100.0^\circ\text{E}$ (Column index 134)
  * Increment ($\Delta\text{lon}$): $+0.25^\circ$
* **Rainfall Variable Details:**
  * Variable Name: Gridded Daily Rainfall (`rainfall` or `rf`)
  * Units: Millimeters ($\text{mm}$)
  * Valid Land Grid Points over India: 4,964 cells
  * Typical Daily Range: $0.0\text{ mm}$ to $>100.0\text{ mm}$
* **Temporal Semantics:**
  ```text
  observation_record_date      = 2024-06-02
  accumulation_start           = 2024-06-01 08:30:00 IST (03:00:00 UTC)
  accumulation_end             = 2024-06-02 08:30:00 IST (03:00:00 UTC)
  accumulation_duration        = 24 hours
  ```
* **Missing Value Representation:**
  * Ocean and non-Indian terrestrial points are explicitly filled with $-999.0\text{f}$.
  * Valid measurements satisfy $0.0 \le \text{rainfall} < 1000.0\text{ mm}$.

---

## 4. Precipitation Compatibility Assessment

| Dimension | NOAA GFS | IMD Observation | Compatibility |
| :--- | :--- | :--- | :--- |
| **Physical Quantity** | Total liquid precipitation accumulation | Total accumulated rainfall | **Identical** |
| **Units** | $\text{kg m}^{-2}$ | $\text{mm}$ | **Directly Identical** ($1\text{ kg m}^{-2} = 1\text{ mm}$) |
| **Grid Resolution** | $0.25^\circ \times 0.25^\circ$ | $0.25^\circ \times 0.25^\circ$ | **Exact Match** |
| **Grid Alignment** | Regular integer multiples of $0.25^\circ$ | Regular integer multiples of $0.25^\circ$ | **Exact Co-location** |
| **Accumulation Duration** | 24 Hours | 24 Hours | **Identical** |
| **Time Window** | Day D 00 UTC to Day D+1 00 UTC | Day D 03 UTC to Day D+1 03 UTC | **Compatible (21h / 87.5% overlap)** |

**Alignment Conclusion:**
A GFS forecast initialized at Day D 00:00 UTC with $+24\text{h}$ lead time represents the 24-hour period ending Day D+1 00:00 UTC (05:30 IST). The IMD daily observation labeled Day D+1 records the 24-hour accumulation ending Day D+1 08:30 IST. They share an identical 24-hour duration with an 87.5% direct temporal overlap (differing only by the 3-hour synoptic reporting offset standard to Indian meteorological observations). Thus, **valid date Day D+1** pairs strictly with **IMD observation date Day D+1**.
