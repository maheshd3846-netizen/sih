# DATA SOURCES METADATA SPECIFICATION

**Project:** SIH26081 — Phase 1 (Data Acquisition, Verification & EXP001)  
**Document:** `data/metadata/DATA_SOURCES.md`  
**Generated Date:** 2026-09-25  

---

## 1. Primary Verification Dataset: IMD 0.25° Daily Gridded Rainfall

* **Dataset Name:** India Meteorological Department (IMD) High Spatial Resolution (0.25° × 0.25°) Daily Gridded Rainfall Data Set Over India
* **Issuing Authority:** IMD Pune, Climate Research and Services, Ministry of Earth Sciences, Government of India
* **Citation Reference:** Pai, D. S., et al. (2014). *Development of a new high spatial resolution (0.25° × 0.25°) long period (1901–2010) daily gridded rainfall data set over India and its comparison with existing data sets over the region.* MAUSAM, 65(1), 1-18.
* **Source Portal URL:** `https://www.imdpune.gov.in/cmpg/Griddata/Rainfall_25_Bin.html`
* **Download Endpoint:** `https://www.imdpune.gov.in/cmpg/Griddata/rainfall.php` (POST request with `rain=2024`)
* **Variable:** Daily Total Rainfall (`rf` or `rainfall`)
* **Variable Units:** Millimeters (mm)
* **Spatial Resolution:** 0.25° × 0.25°
* **Grid Spatial Dimensions:** 135 grid points (Longitude) × 129 grid points (Latitude) = 17,415 grid cells per day
* **Spatial Extent:**
  * Latitude: 6.5°N to 38.5°N (increments of 0.25°)
  * Longitude: 66.5°E to 100.0°E (increments of 0.25°)
* **Temporal Resolution:** Daily
* **Observation Period / Semantics:**
  * Daily observational window: 08:30 IST (03:00 UTC) of Day D-1 to 08:30 IST (03:00 UTC) of Day D (24-hour accumulated rainfall recorded at 08:30 IST on Day D).
* **Missing Value Representation:** `-999.0` (IEEE float32) for oceanic or non-Indian land grid cells.
* **File Format:** Direct access unformatted binary flat file (`.grd`), IEEE 32-bit single precision float (`<f4` little-endian).
* **Raw File Path:** `data/raw/imd/ind2024_rfp25.grd`
* **File Size:** 25,495,560 bytes (366 days × 129 lat × 135 lon × 4 bytes/float)
* **Checksums:**
  * **MD5:** `0e0c21e898bbd48b59814650fd793bd6`
  * **SHA256:** `09d3c89a084f13f3ec534170ce9d98fafc6ff8c29b87d1c83cc2fcd82b495601`
* **Download Timestamp:** 2026-09-25T08:07:30Z

---

## 2. Forecast Dataset: NOAA GFS 0.25° Operational Forecast

* **Dataset Name:** NOAA National Centers for Environmental Prediction (NCEP) Global Forecast System (GFS) 0.25 Degree Gridded Forecast
* **Issuing Authority:** National Oceanic and Atmospheric Administration (NOAA) / NCEP
* **Source Archive:** Registry of Open Data on AWS (`noaa-gfs-bdp-pds` bucket)
* **Source URL Base:** `https://noaa-gfs-bdp-pds.s3.amazonaws.com`
* **Object Path Pattern:** `gfs.YYYYMMDD/00/atmos/gfs.t00z.pgrb2.0p25.f024` and index `gfs.t00z.pgrb2.0p25.f024.idx`
* **Variable:** Total Precipitation (`APCP` / `tp`)
* **Layer:** `surface:0-1 day acc fcst` (24-hour total accumulated precipitation from step 0 to step 24)
* **Variable Units:** `kg m**-2` (equivalent to mm of liquid water)
* **Spatial Resolution:** 0.25° × 0.25° global regular latitude-longitude grid
* **Grid Spatial Dimensions:** 1,440 (Longitude) × 721 (Latitude) = 1,038,240 grid cells globally
* **Spatial Extent:**
  * Latitude: 90.0°N to -90.0°N (increments of 0.25°)
  * Longitude: 0.0°E to 359.75°E (increments of 0.25°)
* **Temporal Resolution:** 00 UTC Initialization cycle, +24 hour forecast lead time
* **Forecast / Accumulation Semantics:**
  * Forecast Initialization Time: `YYYY-MM-DD 00:00:00 UTC`
  * Forecast Valid Time: `YYYY-MM-DD+1 00:00:00 UTC`
  * Accumulation Start: `YYYY-MM-DD 00:00:00 UTC`
  * Accumulation End: `YYYY-MM-DD+1 00:00:00 UTC`
  * Accumulation Duration: 24 hours
* **Missing Value Representation:** Global continuous physical field (NaN or None; land/ocean covered).
* **Access Mechanism:** HTTP GET with byte-range requests targeting the exact `APCP` record index offsets listed in `.idx` to avoid full-file 500MB transfers.
* **File Format:** WMO GRIB Edition 2 (`.grib2`) / extracted NetCDF4 / NumPy arrays.
* **Storage Location:** `data/raw/gfs/`
* **Coverage for EXP001:** June 1, 2024 to June 30, 2024 (30 complete forecast cycles at 00 UTC).

---

## 3. Geographical Domain Definition: AP + Telangana Experimental Domain

* **Domain Name:** `AP_Telangana_experimental_domain`
* **Bounding Box:**
  * Minimum Latitude: 12.0°N
  * Maximum Latitude: 20.0°N
  * Minimum Longitude: 76.0°E
  * Maximum Longitude: 85.0°E
* **Domain Dimensions:**
  * Latitudes: 33 grid points (`12.0, 12.25, ..., 20.0`)
  * Longitudes: 37 grid points (`76.0, 76.25, ..., 85.0`)
  * Total Grid Points: 1,221 points
* **Clarification:** This domain represents a rectangular bounding box covering Andhra Pradesh, Telangana, and surrounding regions. It is an experimental domain, not a strict administrative political state polygon.
