/**
  SIH26081 Precipitation Fusion — Professional Meteorological Workstation
  Multi-Model NWP Consensus (NOAA GFS + ECMWF IFS) & Empirical Disagreement Engine
  Zero ML, 100% Real Data, Scientifically Frozen Baselines.
*/

// Application State
const state = {
  operationalMode: "live", // "live" | "retrospective" (DEFAULT: live)
  currentDate: "2024-07-15",
  activeVariable: "precipitation", // "precipitation" | "temperature" | "wind"
  activeLead: 24, // 24 | 48 | 72
  liveForecastData: null,
  liveStatus: null,
  activeLayer: "blended", // "blended" | "fused" | "gfs" | "ecmwf" | "w_gfs" | "w_ecmwf" | "dominant_model" | "weight_entropy" | "extreme_guidance" | "confidence" | "disagreement" | "imd"
  activeRegion: "All",
  activeView: "forecast",
  allDates: [],
  currentGridData: null,
  selectedPoint: null,
  isPlaying: false,
  playTimer: null,
  isDarkMode: false,
  showGridLines: false,
  map: null,
  baseTileLayer: null,
  rasterOverlay: null,
  boundaryLayerGroup: null,
  gridLinesLayerGroup: null,
  interactiveLayerGroup: null,
  selectedCellHighlight: null,
  demoStep: 1,
  viewDimension: "2d", // "2d" | "3d"
  threeMode: "rain", // "rain" | "disagreement"
  threeShowLowConf: false,
};
window.state = state;

// Basemap Tiles (Zero Watermark / Clean Restrained GIS Basemaps)
const TILES = {
  light: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}",
    attribution: "Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ"
  },
  dark: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}",
    attribution: "Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ"
  }
};

// Distinct Meteorological Palettes (Multi-Variable, Weights, Extremes)
const PALETTES = {
  // 1. Meteorological Rainfall Intensity Palette (mm / 24h)
  rain: [
    { min: 65.0, color: "#7e22ce", label: "&ge; 65 mm (Extreme)" },
    { min: 35.0, color: "#dc2626", label: "35 &ndash; 65 mm (Very Heavy)" },
    { min: 15.0, color: "#ea580c", label: "15 &ndash; 35 mm (Heavy)" },
    { min: 7.5,  color: "#16a34a", label: "7.5 &ndash; 15 mm (Moderate)" },
    { min: 2.5,  color: "#2563eb", label: "2.5 &ndash; 7.5 mm (Light)" },
    { min: 0.1,  color: "#7dd3fc", label: "0.1 &ndash; 2.5 mm (Trace)" },
    { min: 0.0,  color: "rgba(241, 245, 249, 0.05)", label: "&lt; 0.1 mm (Dry)" },
  ],
  // 2. 2m Air Temperature Palette (°C)
  temperature: [
    { min: 45.0, color: "#7e22ce", label: "&ge; 45.0 &deg;C (Severe Heat Wave)" },
    { min: 42.0, color: "#dc2626", label: "42.0 &ndash; 45.0 &deg;C (Heat Wave Warning)" },
    { min: 38.0, color: "#ea580c", label: "38.0 &ndash; 42.0 &deg;C (Hot / High Thermal)" },
    { min: 32.0, color: "#f59e0b", label: "32.0 &ndash; 38.0 &deg;C (Warm / Moderate)" },
    { min: 24.0, color: "#10b981", label: "24.0 &ndash; 32.0 &deg;C (Mild / Temperate)" },
    { min: 16.0, color: "#06b6d4", label: "16.0 &ndash; 24.0 &deg;C (Cool)" },
    { min: -10.0, color: "#3b82f6", label: "&lt; 16.0 &deg;C (Cold)" },
  ],
  // 3. 10m Wind Speed Palette (km/h)
  wind: [
    { min: 88.0, color: "#7e22ce", label: "&ge; 88 km/h (Storm / Severe Gale)" },
    { min: 62.0, color: "#dc2626", label: "62 &ndash; 88 km/h (Gale Warning)" },
    { min: 45.0, color: "#ea580c", label: "45 &ndash; 62 km/h (Strong Breeze)" },
    { min: 30.0, color: "#f59e0b", label: "30 &ndash; 45 km/h (Moderate Wind)" },
    { min: 15.0, color: "#10b981", label: "15 &ndash; 30 km/h (Breeze)" },
    { min: 0.0,  color: "rgba(56, 189, 248, 0.25)", label: "&lt; 15 km/h (Light / Calm)" },
  ],
  // 4. Model Blending Weights Simplex Palette (w in [0.05, 0.95])
  weights: [
    { min: 0.70, color: "#c2410c", label: "w &ge; 0.70 (Strong Dominance)" },
    { min: 0.58, color: "#ea580c", label: "0.58 &ndash; 0.70 (Dominant)" },
    { min: 0.52, color: "#f59e0b", label: "0.52 &ndash; 0.58 (Slight Bias)" },
    { min: 0.48, color: "#64748b", label: "0.48 &ndash; 0.52 (Consensus 50/50)" },
    { min: 0.42, color: "#0284c7", label: "0.42 &ndash; 0.48 (Slight Subordinate)" },
    { min: 0.30, color: "#0369a1", label: "0.30 &ndash; 0.42 (Subordinate)" },
    { min: 0.0,  color: "#0c4a6e", label: "&lt; 0.30 (Suppressed)" },
  ],
  // 5. Shannon Weight Entropy Palette (H(s) in [0, ln(2) = 0.693])
  entropy: [
    { min: 0.68, color: "#0d9488", label: "H &ge; 0.68 (Balanced Uncertainty, ~50/50)" },
    { min: 0.62, color: "#0284c7", label: "0.62 &ndash; 0.68 (Mild Model Preference)" },
    { min: 0.50, color: "#d97706", label: "0.50 &ndash; 0.62 (Moderate Preference)" },
    { min: 0.0,  color: "#7e22ce", label: "&lt; 0.50 (Strong Single-Model Bias)" },
  ],
  // 6. Confidence Palettes (RULE: Red is NOT used for Low Confidence)
  confidence: [
    { key: "High Confidence", color: "#0d9488", label: "High Confidence (D &lt; 0.11, Hist. MAE: 2.02)" },
    { key: "Moderate Confidence", color: "#d97706", label: "Moderate Confidence (0.11 &le; D &lt; 2.06, Hist. MAE: 3.75)" },
    { key: "Low Confidence", color: "#86198f", label: "Low Confidence (D &ge; 2.06, Hist. MAE: 9.46)" },
  ],
  // 7. Disagreement Palettes (Monochromatic Analytical Scale)
  disagreement: [
    { min: 10.0, color: "#312e81", label: "&ge; 10.0 (Extreme Divergence)" },
    { min: 5.0,  color: "#4338ca", label: "5.0 &ndash; 10.0 (Very High Disagreement)" },
    { min: 2.06, color: "#6366f1", label: "2.06 &ndash; 5.0 (High Disagreement)" },
    { min: 0.5,  color: "#818cf8", label: "0.5 &ndash; 2.06 (Moderate Disagreement)" },
    { min: 0.11, color: "#a5b4fc", label: "0.11 &ndash; 0.5 (Low Disagreement)" },
    { min: 0.0,  color: "rgba(224, 231, 255, 0.25)", label: "&lt; 0.11 (Consensus Agreement)" },
  ]
};

// Subregion Bounds & Centroids
const REGION_BOUNDS = {
  "All": { center: [16.2, 80.2], zoom: 7 },
  "Coastal Andhra Pradesh": { center: [16.4, 81.2], zoom: 8 },
  "Rayalaseema": { center: [14.6, 78.4], zoom: 8 },
  "Telangana": { center: [17.8, 79.2], zoom: 8 },
};

// Domain Bounding Box for Raster Rendering
const DOMAIN_BOUNDS = {
  latMin: 11.875,
  latMax: 20.125,
  lonMin: 75.875,
  lonMax: 85.125,
};

// Initialize Application
document.addEventListener("DOMContentLoaded", async () => {
  initMap();
  init3DViewer();
  setupNavigation();
  setupEventListeners();
  loadBoundaryGeoJSON();
  loadVerificationData();
  loadAvailableDates(); // Preload for retrospective mode
  await loadLiveForecast(); // Default: LIVE FORECAST MODE
});

/* ========================================================
   3D METEOROLOGICAL VIEWPORT INITIALIZATION & CONTROL
   ======================================================== */
function init3DViewer() {
  const container = document.getElementById("three-container");
  if (!container || typeof Meteorological3DViewer === "undefined") return;

  state.threeViewer = new Meteorological3DViewer();
  const ok = state.threeViewer.init(
    container,
    (pt) => {
      // Cell clicked in 3D: open existing Cell Inspector
      inspectCell(pt);
    },
    (pt) => {
      // Cell hover callback
    }
  );

  if (!ok) {
    console.warn("WebGL 3D Viewer could not be initialized.");
  }
}

function switchDimension(dim) {
  state.viewDimension = dim;

  // Toggle button active states
  const btn2D = document.getElementById("btn-view-2d");
  const btn3D = document.getElementById("btn-view-3d");
  if (btn2D) btn2D.classList.toggle("active", dim === "2d");
  if (btn3D) btn3D.classList.toggle("active", dim === "3d");

  // Toggle toolbar clusters
  const cluster2D = document.getElementById("cluster-2d-layers");
  const cluster3D = document.getElementById("cluster-3d-layers");
  if (cluster2D) cluster2D.classList.toggle("hidden", dim === "3d");
  if (cluster3D) cluster3D.classList.toggle("hidden", dim === "2d");

  const mapCanvas = document.getElementById("map");
  const threeContainer = document.getElementById("three-container");
  const imdBanner = document.getElementById("imd-mode-banner");

  if (dim === "3d") {
    if (imdBanner) imdBanner.classList.add("hidden");
    if (mapCanvas) mapCanvas.style.opacity = "0";
    if (threeContainer) {
      threeContainer.classList.remove("hidden");
      threeContainer.style.opacity = "1";
    }
    if (state.threeMode !== "disagreement") {
      state.threeMode = state.activeVariable === "temperature" ? "temperature" : state.activeVariable === "wind" ? "wind" : "rain";
    }
    document.querySelectorAll("[data-3dmode]").forEach((b) => {
      b.classList.toggle("active", (b.dataset["3dmode"] || b.getAttribute("data-3dmode")) === state.threeMode);
    });
    update3DNoticeBanner();
    if (state.threeViewer) {
      state.threeViewer.start();
      if (state.currentGridData) {
        state.threeViewer.renderData(
          state.currentGridData,
          state.threeMode,
          state.threeShowLowConf,
          state.activeRegion,
          state.activeVariable
        );
        if (state.selectedPoint) {
          state.threeViewer.highlightCell(state.selectedPoint);
        }
      }
    }
  } else {
    if (threeContainer) {
      threeContainer.classList.add("hidden");
      threeContainer.style.opacity = "0";
    }
    if (mapCanvas) {
      mapCanvas.style.opacity = "1";
      if (state.map) {
        setTimeout(() => state.map.invalidateSize(), 50);
      }
    }
    if (imdBanner && state.activeLayer === "imd") {
      imdBanner.classList.remove("hidden");
    }
    if (state.threeViewer) {
      state.threeViewer.stop();
    }
  }

  updateLegend();
  updateMapContextBadge();
}

function update3DNoticeBanner() {
  const noteElem = document.getElementById("three-variable-note");
  if (!noteElem) return;
  if (state.threeMode === "rain") {
    noteElem.innerHTML = "<strong>3D RAINFALL:</strong> Height = forecast rainfall magnitude &bull; Color = rainfall intensity (Z-axis is a visualization coordinate only).";
  } else if (state.threeMode === "disagreement") {
    noteElem.innerHTML = "<strong>3D MODEL DISAGREEMENT:</strong> Height = inter-model disagreement &bull; Color = disagreement intensity. Higher disagreement indicates a lower empirical-confidence regime under the validated thresholds.";
  } else if (state.activeVariable === "temperature") {
    noteElem.innerHTML = "<strong>3D TEMPERATURE:</strong> Height = forecast temperature magnitude &bull; Color = temperature (Z-axis is a visualization coordinate only).";
  } else if (state.activeVariable === "wind") {
    noteElem.innerHTML = "<strong>3D WIND:</strong> Height = forecast wind-speed magnitude &bull; Color = wind speed (Z-axis is a visualization coordinate only).";
  }
}

function updateMapContextBadge() {
  const badge = document.getElementById("map-context-badge");
  const titleEl = document.getElementById("map-context-title");
  const unitEl = document.getElementById("map-context-unit");
  const helperEl = document.getElementById("map-context-helper");
  if (!badge || !titleEl || !unitEl || !helperEl) return;

  const varName = state.activeVariable === "temperature" ? "TEMPERATURE" : state.activeVariable === "wind" ? "WIND SPEED" : "RAINFALL";
  const varUnit = state.activeVariable === "temperature" ? "°C" : state.activeVariable === "wind" ? "km/h" : "mm / 24h";
  const leadTag = `+${state.activeLead || 24}h Lead`;

  if (state.viewDimension === "3d") {
    if (state.threeMode === "rain") {
      titleEl.textContent = `3D ${varName} (${leadTag})`;
      unitEl.textContent = varUnit;
      helperEl.innerHTML = `Height = forecast ${varName.toLowerCase()} magnitude &bull; Color = intensity. Click any column to inspect.`;
    } else if (state.threeMode === "disagreement") {
      titleEl.textContent = `3D MODEL DISAGREEMENT (${leadTag})`;
      unitEl.textContent = `|GFS − ECMWF| (${varUnit})`;
      helperEl.innerHTML = "Height = inter-model disagreement &bull; Color = disagreement intensity. Higher disagreement indicates a lower empirical-confidence regime.";
    } else if (state.threeMode === "temperature") {
      titleEl.textContent = `3D ${varName} (${leadTag})`;
      unitEl.textContent = varUnit;
      helperEl.innerHTML = `Height = forecast ${varName.toLowerCase()} magnitude &bull; Color = temperature. Click any column to inspect.`;
    } else if (state.threeMode === "wind") {
      titleEl.textContent = `3D ${varName} (${leadTag})`;
      unitEl.textContent = varUnit;
      helperEl.innerHTML = `Height = forecast ${varName.toLowerCase()} magnitude &bull; Color = wind speed. Click any column to inspect.`;
    }
    return;
  }

  // 2D Map modes
  switch (state.activeLayer) {
    case "blended":
      titleEl.textContent = `CONTEXT-AWARE BLEND — ${varName} (${leadTag})`;
      unitEl.textContent = varUnit;
      helperEl.textContent = "Context-aware simplex weighting (w_GFS · GFS + w_ECMWF · ECMWF). Click any location to inspect.";
      break;
    case "fused":
      titleEl.textContent = `50/50 BASELINE — ${varName} (${leadTag})`;
      unitEl.textContent = varUnit;
      helperEl.textContent = "Equal-weight reference centroid (50% GFS + 50% ECMWF). Click any location to inspect.";
      break;
    case "gfs":
      titleEl.textContent = `NOAA GFS — ${varName} (${leadTag})`;
      unitEl.textContent = varUnit;
      helperEl.textContent = "Global Forecast System 0.25° NWP forecast estimate. Click any location to inspect.";
      break;
    case "ecmwf":
      titleEl.textContent = `ECMWF IFS — ${varName} (${leadTag})`;
      unitEl.textContent = varUnit;
      helperEl.textContent = "Integrated Forecasting System 0.25° NWP forecast estimate. Click any location to inspect.";
      break;
    case "w_gfs":
      titleEl.textContent = `GFS MODEL WEIGHT MAP (${leadTag})`;
      unitEl.textContent = "w_GFS ∈ [0.05, 0.95]";
      helperEl.textContent = "Simplex weight allocated to NOAA GFS based on regional priors, lead time, historical skill, and regime.";
      break;
    case "w_ecmwf":
      titleEl.textContent = `ECMWF MODEL WEIGHT MAP (${leadTag})`;
      unitEl.textContent = "w_ECMWF ∈ [0.05, 0.95]";
      helperEl.textContent = "Simplex weight allocated to ECMWF IFS (strictly complements GFS: w_GFS + w_ECMWF = 1.0).";
      break;
    case "dominant_model":
      titleEl.textContent = `DOMINANT MODEL DISTRIBUTION (${leadTag})`;
      unitEl.textContent = "GFS (>0.55) / ECMWF (>0.55) / Consensus";
      helperEl.textContent = "Spatial mapping of which dynamical core has dominant allocation over each 0.25° cell.";
      break;
    case "weight_entropy":
      titleEl.textContent = `SHANNON WEIGHT ENTROPY (${leadTag})`;
      unitEl.textContent = "H(s) ∈ [0, 0.693] nats";
      helperEl.textContent = "H = -∑ w ln w. Measures ensemble dispersion. High entropy indicates balanced model consensus.";
      break;
    case "extreme_guidance":
      titleEl.textContent = `EXTREME WEATHER GUIDANCE (${leadTag})`;
      unitEl.textContent = "Deterministic Thresholds";
      helperEl.textContent = "IMD/WMO deterministic exceedance alerts (Heavy Rain ≥ 15/64.5mm, Heat Wave ≥ 40°C, High Wind ≥ 45/62km/h).";
      break;
    case "disagreement":
      titleEl.textContent = `MODEL DISAGREEMENT D (${leadTag})`;
      unitEl.textContent = `|GFS − ECMWF| (${varUnit})`;
      helperEl.textContent = "Inter-model spread. Higher disagreement is associated with higher historical forecast error.";
      break;
    case "confidence":
      titleEl.textContent = `EMPIRICAL CONFIDENCE REGIMES (${leadTag})`;
      unitEl.textContent = "High / Moderate / Low";
      helperEl.textContent = "Confidence is based on historical model disagreement and observed forecast error.";
      break;
    case "imd":
      titleEl.textContent = `IMD RETROSPECTIVE OBSERVATION (${leadTag})`;
      unitEl.textContent = varUnit;
      helperEl.textContent = "Historical gridded gauge observation (0.25° NCC Pune) for retrospective verification.";
      break;
    default:
      titleEl.textContent = `${varName} FORECAST (${leadTag})`;
      unitEl.textContent = varUnit;
      helperEl.textContent = "Click any location to inspect the forecast.";
      break;
  }
}

/* ========================================================
   MAP INITIALIZATION
   ======================================================== */
function initMap() {
  state.map = L.map("map", {
    center: [16.2, 80.2],
    zoom: 7,
    minZoom: 6,
    maxZoom: 12,
    zoomControl: false, // Custom position
  });

  // Zoom control top-left below floating toolbar
  L.control.zoom({ position: "bottomright" }).addTo(state.map);

  // Default to Esri World Light Gray Base (clean, restrained, zero watermark)
  state.baseTileLayer = L.tileLayer(TILES.light.url, {
    attribution: TILES.light.attribution,
    maxZoom: 16,
  }).addTo(state.map);

  // Layer groups for boundaries, raster, gridlines, interactive hits
  state.boundaryLayerGroup = L.layerGroup().addTo(state.map);
  state.gridLinesLayerGroup = L.layerGroup().addTo(state.map);
  state.interactiveLayerGroup = L.layerGroup().addTo(state.map);

  // Click on map snaps directly to underlying 0.25° grid point
  state.map.on("click", (e) => {
    if (!state.currentGridData || !state.currentGridData.points) return;
    const clickLat = e.latlng.lat;
    const clickLon = e.latlng.lng;

    // Nearest 0.25 integer snapping
    const snappedLat = Math.round(clickLat * 4) / 4;
    const snappedLon = Math.round(clickLon * 4) / 4;

    const matchedPt = state.currentGridData.points.find(
      (p) => Math.abs(p.lat - snappedLat) < 0.13 && Math.abs(p.lon - snappedLon) < 0.13
    );

    if (matchedPt) {
      inspectCell(matchedPt);
    } else {
      clearSelection();
    }
  });
}

function toggleBasemap() {
  state.isDarkMode = !state.isDarkMode;
  const btn = document.getElementById("btn-basemap-toggle");
  if (btn) btn.classList.toggle("active", state.isDarkMode);
  const config = state.isDarkMode ? TILES.dark : TILES.light;
  state.map.removeLayer(state.baseTileLayer);
  state.baseTileLayer = L.tileLayer(config.url, {
    attribution: config.attribution,
    maxZoom: 16,
  }).addTo(state.map);
}

function toggleGridLines() {
  state.showGridLines = !state.showGridLines;
  const btn = document.getElementById("btn-grid-toggle");
  if (btn) btn.classList.toggle("active", state.showGridLines);
  renderGridLines();
}

async function loadBoundaryGeoJSON() {
  try {
    const res = await fetch("domain_boundaries.geojson");
    if (!res.ok) return;
    const geojson = await res.json();
    state.boundaryLayerGroup.clearLayers();
    L.geoJSON(geojson, {
      style: {
        color: "#475569",
        weight: 1.2,
        opacity: 0.65,
        fill: false,
        dashArray: "3, 3",
      }
    }).addTo(state.boundaryLayerGroup);
  } catch (e) {
    // Graceful fallback if geojson fetch fails
  }
}

/* ========================================================
   NAVIGATION & VIEW SWITCHING
   ======================================================== */
function setupNavigation() {
  const tabs = document.querySelectorAll(".nav-tab");
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const viewName = tab.dataset.view;
      switchView(viewName);
    });
  });
}

function switchView(viewName) {
  state.activeView = viewName;
  document.querySelectorAll(".nav-tab").forEach((t) => {
    t.classList.toggle("active", t.dataset.view === viewName);
  });
  document.querySelectorAll(".view-panel").forEach((panel) => {
    panel.classList.toggle("active", panel.id === `view-${viewName}`);
  });
  if (viewName === "forecast" && state.map) {
    setTimeout(() => state.map.invalidateSize(), 150);
  } else if (viewName === "weights") {
    updateWeightsModeView();
  } else if (viewName === "extremes") {
    updateExtremesModeView();
  } else if (viewName === "verification") {
    loadVerificationData();
  }
}

/* ========================================================
   EVENT LISTENERS SETUP
   ======================================================== */
function setupEventListeners() {
  // Mode Switcher Buttons (LIVE FORECAST vs RETROSPECTIVE)
  const btnLive = document.getElementById("btn-mode-live");
  const btnRetro = document.getElementById("btn-mode-retro");
  if (btnLive) btnLive.addEventListener("click", () => setOperationalMode("live"));
  if (btnRetro) btnRetro.addEventListener("click", () => setOperationalMode("retrospective"));

  // Target Variable Buttons (Rain / Temp / Wind)
  document.querySelectorAll(".var-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const targetVar = btn.dataset.var;
      if (state.operationalMode === "live") {
        if (targetVar !== "precipitation") {
          showErrorModal(
            "LIVE INGESTION CONFIGURATION",
            "Live operational NWP ingestion is currently active for 24-Hour Precipitation (00Z NOAA GFS + 00Z ECMWF IFS).",
            "For multi-variable (Temperature, Wind Speed) and multi-lead (+48h, +72h) analysis, please switch to Retrospective mode."
          );
          return;
        }
        document.querySelectorAll(".var-btn").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        state.activeVariable = "precipitation";
        if (state.threeMode !== "disagreement") state.threeMode = "rain";
        document.querySelectorAll("[data-3dmode]").forEach((b) => {
          b.classList.toggle("active", (b.dataset["3dmode"] || b.getAttribute("data-3dmode")) === state.threeMode);
        });
        update3DNoticeBanner();
        updateMapContextBadge();
        loadLiveForecast();
      } else {
        document.querySelectorAll(".var-btn").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        state.activeVariable = targetVar;
        if (state.threeMode !== "disagreement") {
          state.threeMode = targetVar === "precipitation" ? "rain" : targetVar;
        }
        document.querySelectorAll("[data-3dmode]").forEach((b) => {
          b.classList.toggle("active", (b.dataset["3dmode"] || b.getAttribute("data-3dmode")) === state.threeMode);
        });
        update3DNoticeBanner();
        updateMapContextBadge();
        if (state.currentGridData) {
          loadForecastForDate(state.currentDate);
        }
      }
    });
  });

  // Forecast Lead Time Buttons (+24h / +48h / +72h)
  document.querySelectorAll(".lead-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const targetLead = parseInt(btn.dataset.lead, 10);
      if (state.operationalMode === "live") {
        if (targetLead !== 24) {
          showErrorModal(
            "LIVE INGESTION CONFIGURATION",
            "Live operational NWP ingestion is currently active for the +24h lead cycle.",
            "For +48h and +72h extended lead analysis, please switch to Retrospective mode."
          );
          return;
        }
        document.querySelectorAll(".lead-btn").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        state.activeLead = 24;
        updateMapContextBadge();
        loadLiveForecast();
      } else {
        document.querySelectorAll(".lead-btn").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        state.activeLead = targetLead;
        updateMapContextBadge();
        if (state.currentGridData) {
          loadForecastForDate(state.currentDate);
        }
      }
    });
  });

  // Date Picker
  const datePicker = document.getElementById("date-picker");
  datePicker.addEventListener("change", (e) => {
    const val = e.target.value;
    if (val < "2024-06-01" || val > "2024-08-31") {
      showErrorModal(
        "FORECAST UNAVAILABLE",
        `No operational forecast is available for ${val}.`,
        "Available period covers 01 June 2024 to 31 August 2024 (92 continuous monsoon days)."
      );
      datePicker.value = state.currentDate;
      return;
    }
    state.currentDate = val;
    updateDateDisplay();
    loadForecastForDate(state.currentDate);
  });

  // Timeline Slider
  const slider = document.getElementById("timeline-slider");
  slider.addEventListener("input", (e) => {
    const idx = parseInt(e.target.value, 10);
    if (state.allDates[idx]) {
      state.currentDate = state.allDates[idx].date;
      datePicker.value = state.currentDate;
      updateDateDisplay();
      loadForecastForDate(state.currentDate);
    }
  });

  // Step buttons
  document.getElementById("btn-prev-day").addEventListener("click", () => stepDay(-1));
  document.getElementById("btn-next-day").addEventListener("click", () => stepDay(1));

  // Play / Pause Animation
  document.getElementById("btn-play-pause").addEventListener("click", togglePlay);

  // Basemap & Gridline Toggles
  document.getElementById("btn-basemap-toggle").addEventListener("click", toggleBasemap);
  document.getElementById("btn-grid-toggle").addEventListener("click", toggleGridLines);

  // 1. [ Layers ] Drawer / Popover Toggle and Items
  const btnLayersToggle = document.getElementById("btn-layers-toggle");
  const layersPopover = document.getElementById("layers-popover");
  if (btnLayersToggle && layersPopover) {
    btnLayersToggle.addEventListener("click", (e) => {
      e.stopPropagation();
      const isExpanded = !layersPopover.classList.contains("hidden");
      layersPopover.classList.toggle("hidden", isExpanded);
      btnLayersToggle.setAttribute("aria-expanded", String(!isExpanded));
    });

    document.addEventListener("click", (e) => {
      if (!layersPopover.contains(e.target) && !btnLayersToggle.contains(e.target)) {
        layersPopover.classList.add("hidden");
        btnLayersToggle.setAttribute("aria-expanded", "false");
      }
    });
  }

  // Popover Item Selection
  document.querySelectorAll(".layer-popover-item").forEach((btn) => {
    btn.addEventListener("click", () => {
      const layer = btn.dataset.layer;
      if (state.operationalMode === "live" && layer === "imd") {
        showErrorModal(
          "IMD OBSERVATIONS NOT AVAILABLE",
          "IMD retrospective observations for the current 24-hour live forecast run have not occurred yet.",
          "Verification is strictly retrospective. IMD retrospective observations will become available only after the 24-hour accumulation window concludes."
        );
        return;
      }

      document.querySelectorAll(".layer-popover-item").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      state.activeLayer = layer;

      // Update badge label on button
      const labelSpan = btn.querySelector(".layer-item-label");
      const badge = document.getElementById("active-layer-badge");
      if (labelSpan && badge) {
        badge.textContent = labelSpan.textContent.trim();
      }

      // Close Popover
      if (layersPopover) {
        layersPopover.classList.add("hidden");
        if (btnLayersToggle) btnLayersToggle.setAttribute("aria-expanded", "false");
      }

      // Update IMD verification banner visibility
      const imdBanner = document.getElementById("imd-mode-banner");
      if (imdBanner) {
        imdBanner.classList.toggle("hidden", state.activeLayer !== "imd");
      }

      updateMapContextBadge();
      renderGrid();
      updateLegend();
    });
  });

  // View Dimension Switcher Buttons (2D MAP / 3D PRECIPITATION)
  const btn2D = document.getElementById("btn-view-2d");
  const btn3D = document.getElementById("btn-view-3d");
  if (btn2D) btn2D.addEventListener("click", () => switchDimension("2d"));
  if (btn3D) btn3D.addEventListener("click", () => switchDimension("3d"));

  // 3D Variable Buttons (RAIN / DISAGREEMENT / TEMPERATURE / WIND)
  document.querySelectorAll("[data-3dmode]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const target3dMode = btn.dataset["3dmode"] || btn.getAttribute("data-3dmode");
      if (state.operationalMode === "live" && (target3dMode === "temperature" || target3dMode === "wind")) {
        showErrorModal(
          "LIVE INGESTION CONFIGURATION",
          "Live operational NWP ingestion is currently active for 24-Hour Precipitation (00Z NOAA GFS + 00Z ECMWF IFS).",
          "For multi-variable (Temperature, Wind Speed) and multi-lead (+48h, +72h) analysis, please switch to Retrospective mode."
        );
        document.querySelectorAll("[data-3dmode]").forEach((b) => {
          b.classList.toggle("active", (b.dataset["3dmode"] || b.getAttribute("data-3dmode")) === state.threeMode);
        });
        return;
      }

      document.querySelectorAll("[data-3dmode]").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      state.threeMode = target3dMode;

      if (target3dMode === "rain") {
        state.activeVariable = "precipitation";
        document.querySelectorAll(".var-btn").forEach((b) => b.classList.toggle("active", b.dataset.var === "precipitation"));
        if (state.operationalMode === "live") loadLiveForecast();
        else if (state.currentGridData) loadForecastForDate(state.currentDate);
      } else if (target3dMode === "temperature") {
        state.activeVariable = "temperature";
        document.querySelectorAll(".var-btn").forEach((b) => b.classList.toggle("active", b.dataset.var === "temperature"));
        if (state.currentGridData) loadForecastForDate(state.currentDate);
      } else if (target3dMode === "wind") {
        state.activeVariable = "wind";
        document.querySelectorAll(".var-btn").forEach((b) => b.classList.toggle("active", b.dataset.var === "wind"));
        if (state.currentGridData) loadForecastForDate(state.currentDate);
      } else if (target3dMode === "disagreement") {
        if (state.threeViewer && state.currentGridData) {
          state.threeViewer.renderData(
            state.currentGridData,
            state.threeMode,
            state.threeShowLowConf,
            state.activeRegion,
            state.activeVariable
          );
        }
      }

      update3DNoticeBanner();
      updateMapContextBadge();
      updateLegend();
    });
  });

  // Low-Confidence Area Overlay Toggle (D >= 2.06 mm)
  const lowConfBtn = document.getElementById("btn-3d-low-conf");
  if (lowConfBtn) {
    lowConfBtn.addEventListener("click", () => {
      state.threeShowLowConf = !state.threeShowLowConf;
      lowConfBtn.classList.toggle("active", state.threeShowLowConf);
      if (state.threeViewer && state.currentGridData) {
        state.threeViewer.renderData(
          state.currentGridData,
          state.threeMode,
          state.threeShowLowConf,
          state.activeRegion,
          state.activeVariable
        );
      }
      updateLegend();
    });
  }

  // Camera Reset Button
  const resetCamBtn = document.getElementById("btn-reset-3d-cam");
  if (resetCamBtn) {
    resetCamBtn.addEventListener("click", () => {
      if (state.threeViewer) {
        state.threeViewer.resetCamera();
      }
    });
  }

  // WebGL Fallback Switch Button
  const fallbackSwitchBtn = document.getElementById("btn-fallback-switch");
  if (fallbackSwitchBtn) {
    fallbackSwitchBtn.addEventListener("click", () => switchDimension("2d"));
  }

  // Subregion Quick Filters
  document.querySelectorAll(".region-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".region-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      const region = btn.dataset.region;
      state.activeRegion = region;
      
      if (REGION_BOUNDS[region] && state.map) {
        const target = REGION_BOUNDS[region];
        state.map.flyTo(target.center, target.zoom, { duration: 0.8 });
      }

      renderGrid();
      if (state.currentGridData) {
        updateDomainStats(state.currentGridData);
        if (state.threeViewer && state.viewDimension === "3d") {
          state.threeViewer.renderData(
            state.currentGridData,
            state.threeMode,
            state.threeShowLowConf,
            state.activeRegion,
            state.activeVariable
          );
        }
      }
    });
  });

  // Close Inspector Button
  document.getElementById("btn-close-inspector").addEventListener("click", () => {
    clearSelection();
  });

  // Quick Demo Shortcuts
  document.getElementById("btn-inspect-highest-d").addEventListener("click", inspectHighestDisagreementCell);
  document.getElementById("btn-inspect-peak-rain").addEventListener("click", inspectPeakRainfallCell);

  // Judge Demo Tour Triggers
  const btnStartDemo = document.getElementById("btn-start-demo");
  if (btnStartDemo) btnStartDemo.addEventListener("click", startDemoTour);
  const btnCloseDemo = document.getElementById("btn-close-demo");
  if (btnCloseDemo) btnCloseDemo.addEventListener("click", closeDemoTour);
  const btnDemoPrev = document.getElementById("btn-demo-prev");
  if (btnDemoPrev) btnDemoPrev.addEventListener("click", () => stepDemo(-1));
  const btnDemoNext = document.getElementById("btn-demo-next");
  if (btnDemoNext) btnDemoNext.addEventListener("click", () => stepDemo(1));

  // Error Modal Dismiss
  document.getElementById("btn-error-dismiss").addEventListener("click", hideErrorModal);

  // Why Weights Modal
  const btnWhyWeights = document.getElementById("btn-why-weights");
  if (btnWhyWeights) btnWhyWeights.addEventListener("click", openWhyWeightsModal);
  const btnCloseWW = document.getElementById("btn-close-ww-modal");
  if (btnCloseWW) btnCloseWW.addEventListener("click", closeWhyWeightsModal);
  const wwOverlay = document.getElementById("why-weights-overlay");
  if (wwOverlay) wwOverlay.addEventListener("click", (e) => { if (e.target === wwOverlay) closeWhyWeightsModal(); });
}

/* ========================================================
   WHY-WEIGHTS MODAL CONTROLS
   ======================================================== */
function openWhyWeightsModal() {
  const overlay = document.getElementById("why-weights-overlay");
  if (overlay) overlay.classList.remove("hidden");
}

function closeWhyWeightsModal() {
  const overlay = document.getElementById("why-weights-overlay");
  if (overlay) overlay.classList.add("hidden");
}

/* ========================================================
   DATA INGESTION & PIPELINE FETCH
   ======================================================== */
async function loadAvailableDates() {
  try {
    const res = await fetch("/api/dates");
    const json = await res.json();
    if (json.status === "SUCCESS") {
      state.allDates = json.dates;
      const slider = document.getElementById("timeline-slider");
      slider.max = state.allDates.length - 1;
      updateDateDisplay();
    }
  } catch (err) {
    console.error("Failed to load available dates:", err);
  }
}

function updateDateDisplay() {
  const d = new Date(state.currentDate + "T00:00:00Z");
  const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
  const formatted = `${String(d.getUTCDate()).padStart(2, "0")} ${months[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
  
  const headerDate = document.getElementById("header-date-text");
  if (headerDate) headerDate.textContent = formatted;
  
  const timelineDate = document.getElementById("timeline-date-display");
  if (timelineDate) timelineDate.textContent = formatted;

  const idx = state.allDates.findIndex((item) => item.date === state.currentDate);
  if (idx !== -1) {
    document.getElementById("timeline-slider").value = idx;
  }
}

async function loadForecastForDate(dateStr) {
  try {
    const varParam = state.activeVariable || "precipitation";
    const leadParam = state.activeLead || 24;
    const res = await fetch(`/api/v2/forecast?date=${dateStr}&variable=${varParam}&lead=${leadParam}`);
    const data = await res.json();
    
    if (data.status === "SUCCESS") {
      // Normalise point attributes for complete multi-variable and backwards compatibility
      data.points.forEach((pt) => {
        pt.blend_val = pt.blended_val !== undefined ? pt.blended_val : pt.fused_mm;
        pt.baseline_val = pt.baseline_50_50 !== undefined ? pt.baseline_50_50 : pt.fused_mm;
        pt.fused_mm = pt.blend_val;
        pt.gfs_mm = pt.gfs_val !== undefined ? pt.gfs_val : pt.gfs_mm;
        pt.ecmwf_mm = pt.ecmwf_val !== undefined ? pt.ecmwf_val : pt.ecmwf_mm;
        pt.disagreement_mm = pt.disagreement !== undefined ? pt.disagreement : pt.disagreement_mm;
        pt.imd_mm = pt.obs_val !== undefined ? pt.obs_val : (pt.imd_mm !== undefined ? pt.imd_mm : null);
        pt.fused_error_mm = pt.error_blended !== undefined ? pt.error_blended : (pt.error_baseline || 0.0);
        pt.predicted_regime = pt.regime || pt.predicted_regime;
      });

      state.retroForecastData = data;
      state.currentGridData = data;
      updateDomainStats(data);
      renderGrid();
      updateLegend();
      
      // Update 3D viewer if present
      if (state.threeViewer && state.viewDimension === "3d") {
        state.threeViewer.renderData(
          state.currentGridData,
          state.threeMode,
          state.threeShowLowConf,
          state.activeRegion,
          state.activeVariable
        );
      }

      // Update inspector if cell selected
      if (state.selectedPoint) {
        const updatedPt = data.points.find(
          (p) => Math.abs(p.lat - state.selectedPoint.lat) < 0.05 && Math.abs(p.lon - state.selectedPoint.lon) < 0.05
        );
        if (updatedPt) {
          inspectCell(updatedPt);
        } else {
          clearSelection();
        }
      }
    } else {
      showErrorModal("FORECAST UNAVAILABLE", data.error || `No forecast found for ${dateStr}.`, "Explicit system status returned. No missing data has been silently fabricated.");
    }
  } catch (err) {
    console.error("Failed to fetch forecast grid:", err);
    showErrorModal("NETWORK ERROR", "Unable to communicate with the operational forecast backend.", "Check if operational server is active on port 8080.");
  }
}

/* ========================================================
   LIVE 24-HOUR NWP FORECAST FETCH & MODE CONTROL
   ======================================================== */
async function loadLiveForecast(forceRefresh = false) {
  try {
    const url = `/api/live${forceRefresh ? '?refresh=true' : ''}`;
    const res = await fetch(url);
    const data = await res.json();

    if (data.status === "SUCCESS") {
      // Normalise points with simplex weights and extreme guidance defaults
      if (data.points) {
        data.points.forEach((pt) => {
          pt.blend_val = pt.fused_mm;
          pt.baseline_val = pt.fused_mm;
          pt.w_gfs = 0.50;
          pt.w_ecmwf = 0.50;
          pt.dominant_model = "Consensus (Balanced)";
          pt.weight_entropy = 0.693;
          pt.delta_w_ai = 0.00;
          pt.attribution = {
            base_regional_weight: 0.50,
            lead_time_adjustment: 0.00,
            historical_skill_delta: 0.00,
            weather_regime_delta: 0.00
          };
          const isExceeded = pt.fused_mm >= 15.6;
          pt.extreme_guidance = {
            is_exceeded: isExceeded,
            warning_level: pt.fused_mm >= 64.5 ? "Heavy Rain" : pt.fused_mm >= 15.6 ? "Moderate Rain" : "Normal",
            model_agreement: pt.gfs_mm >= 15.6 && pt.ecmwf_mm >= 15.6 ? "UNANIMOUS_EXCEEDANCE" : isExceeded ? "DIVERGENT_MODEL_EXCEEDANCE" : "BELOW_WARNING_THRESHOLD",
            protocol: "IMD Pune 24-Hour Rainfall Classification Standard"
          };
        });
      }
      state.liveForecastData = data;
      state.currentGridData = data;

      // Extract and format initialization and valid dates
      const initDate = new Date(data.initialization_time_utc);
      const validDate = new Date(data.valid_time_utc);
      const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
      const initFmt = `${String(initDate.getUTCDate()).padStart(2, "0")} ${months[initDate.getUTCMonth()]} ${initDate.getUTCFullYear()} 00 UTC`;
      const validFmt = `${String(validDate.getUTCDate()).padStart(2, "0")} ${months[validDate.getUTCMonth()]} ${validDate.getUTCFullYear()} 00 UTC`;

      // Update header banner & badges
      const initEl = document.getElementById("header-live-init");
      if (initEl) initEl.textContent = initFmt;
      const validEl = document.getElementById("header-live-valid");
      if (validEl) validEl.textContent = validFmt;
      const dockValidEl = document.getElementById("dock-live-valid");
      if (dockValidEl) dockValidEl.textContent = validFmt;

      // Update strip date badge & summary badge
      const stripBadge = document.getElementById("strip-date-badge");
      if (stripBadge) stripBadge.textContent = initFmt;
      const summaryBadge = document.getElementById("summary-date-badge");
      if (summaryBadge) summaryBadge.textContent = initFmt;

      // Update side panel titles for live mode
      const summaryRegion = document.getElementById("summary-region-label");
      if (summaryRegion) summaryRegion.textContent = "CURRENT 24-HOUR FORECAST";
      const kicker = document.querySelector(".strip-kicker");
      if (kicker) kicker.textContent = "CURRENT 24-HOUR NWP CONSENSUS";
      const subtext = document.querySelector(".strip-subtext");
      if (subtext) subtext.textContent = "Combining NOAA GFS and ECMWF IFS into one equal-weight forward forecast.";
      const mwPeriod = document.getElementById("mw-ctx-period");
      if (mwPeriod) mwPeriod.textContent = "Current Live Run";

      updateDomainStats(data);
      renderGrid();
      updateLegend();

      // Update 3D viewer if present
      if (state.threeViewer && state.viewDimension === "3d") {
        state.threeViewer.renderData(
          state.currentGridData,
          state.threeMode,
          state.threeShowLowConf,
          state.activeRegion,
          state.activeVariable
        );
      }

      // Update inspector if cell selected
      if (state.selectedPoint) {
        const updatedPt = data.points.find(
          (p) => Math.abs(p.lat - state.selectedPoint.lat) < 0.05 && Math.abs(p.lon - state.selectedPoint.lon) < 0.05
        );
        if (updatedPt) {
          inspectCell(updatedPt);
        } else {
          clearSelection();
        }
      }
    } else {
      // Explicit failure state: Never silently fall back to 2024!
      showErrorModal(
        data.error || "LATEST FORECAST RUN NOT YET AVAILABLE",
        data.reason || "The operational NWP sources for today have not both been published yet. The system will not substitute an older run.",
        "Operational Integrity: Stale historical forecasts are strictly prevented from masquerading as current."
      );
    }
  } catch (err) {
    console.error("Failed to fetch live forecast:", err);
    showErrorModal(
      "NETWORK ERROR",
      "Unable to communicate with the live forecasting engine.",
      "Check if operational server is active on port 8080."
    );
  }
}

async function setOperationalMode(mode) {
  if (state.operationalMode === mode) return;
  state.operationalMode = mode;

  const btnLive = document.getElementById("btn-mode-live");
  const btnRetro = document.getElementById("btn-mode-retro");
  const liveBanner = document.getElementById("live-run-banner");
  const retroControl = document.getElementById("retro-date-control");
  const retroBadge = document.getElementById("header-retro-badge");
  const retroTimeline = document.getElementById("timeline-retro-controls");
  const liveTimeline = document.getElementById("timeline-live-dock-bar");
  const imdLayerBtn = document.getElementById("layer-btn-imd");
  const blendTag = document.getElementById("summary-blend-tag");
  const inspectBlendTag = document.getElementById("inspect-blend-tag");
  const popoverBlendedLabel = document.getElementById("popover-label-blended");

  if (mode === "live") {
    if (btnLive) btnLive.classList.add("active");
    if (btnRetro) btnRetro.classList.remove("active");
    if (liveBanner) liveBanner.classList.remove("hidden");
    if (retroControl) retroControl.classList.add("hidden");
    if (retroBadge) retroBadge.classList.add("hidden");
    if (retroTimeline) retroTimeline.classList.add("hidden");
    if (liveTimeline) liveTimeline.classList.remove("hidden");

    // Scientific labeling: 50/50 Operational Reference (never dynamic blend in live mode)
    if (blendTag) blendTag.textContent = "50/50 Operational Reference";
    if (inspectBlendTag) inspectBlendTag.textContent = "50/50 Operational Reference";
    if (popoverBlendedLabel) popoverBlendedLabel.textContent = "50/50 Baseline";
    // Live mode: explicit GFS/ECMWF weights display
    const mwGfsPct = document.getElementById("mw-pct-gfs");
    const mwEcmwfPct = document.getElementById("mw-pct-ecmwf");
    if (mwGfsPct) mwGfsPct.textContent = "50%";
    if (mwEcmwfPct) mwEcmwfPct.textContent = "50%";
    const mwStrategy = document.getElementById("mw-strategy-text");
    if (mwStrategy) mwStrategy.textContent = "50/50 Operational Reference";

    // Enforce live variable & lead buttons to precipitation & 24h
    document.querySelectorAll(".var-btn").forEach((b) => b.classList.toggle("active", b.dataset.var === "precipitation"));
    document.querySelectorAll(".lead-btn").forEach((b) => b.classList.toggle("active", b.dataset.lead === "24"));
    state.activeVariable = "precipitation";
    state.activeLead = 24;

    // If IMD layer was active, switch to blended forecast
    if (state.activeLayer === "imd") {
      state.activeLayer = "blended";
      document.querySelectorAll(".layer-popover-item").forEach(b => b.classList.toggle("active", b.dataset.layer === "blended"));
      const badge = document.getElementById("active-layer-badge");
      if (badge) badge.textContent = "Blended";
    }

    if (imdLayerBtn) {
      imdLayerBtn.title = "IMD retrospective observations are pending for the live forecast run.";
      const label = imdLayerBtn.querySelector(".layer-item-label");
      if (label) label.textContent = "IMD Retrospective (Pending)";
    }

    // Update side panel titles
    const regLabel = document.getElementById("summary-region-label");
    if (regLabel) regLabel.textContent = "CURRENT 24-HOUR FORECAST";
    const mwCtxPeriod = document.getElementById("mw-ctx-period");
    if (mwCtxPeriod) mwCtxPeriod.textContent = "50/50 Operational Reference";

    await loadLiveForecast();
  } else {
    if (btnLive) btnLive.classList.remove("active");
    if (btnRetro) btnRetro.classList.add("active");
    if (liveBanner) liveBanner.classList.add("hidden");
    if (retroControl) retroControl.classList.remove("hidden");
    if (retroBadge) retroBadge.classList.remove("hidden");
    if (retroTimeline) retroTimeline.classList.remove("hidden");
    if (liveTimeline) liveTimeline.classList.add("hidden");

    // Retrospective labeling: Context-Aware Model Weights
    if (blendTag) blendTag.textContent = "Context-Aware Model Weights";
    if (inspectBlendTag) inspectBlendTag.textContent = "Context-Aware Model Weights";
    if (popoverBlendedLabel) popoverBlendedLabel.textContent = "Context-Aware Weights";

    if (imdLayerBtn) {
      imdLayerBtn.title = "Observed rainfall used for historical verification (IMD 0.25° NCC Pune)";
      const label = imdLayerBtn.querySelector(".layer-item-label");
      if (label) label.textContent = "IMD Retrospective";
    }

    // Update side panel titles
    const regLabel = document.getElementById("summary-region-label");
    if (regLabel) regLabel.textContent = "AP & Telangana Domain";
    const mwCtxPeriod = document.getElementById("mw-ctx-period");
    if (mwCtxPeriod) mwCtxPeriod.textContent = "Jun–Aug 2024 Historical Analysis";

    updateDateDisplay();
    await loadForecastForDate(state.currentDate);
  }
}

/* ========================================================
   DOMAIN DIAGNOSTICS & SUMMARY CALCULATIONS
   ======================================================== */
function updateDomainStats(data) {
  if (!data || !data.points) return;

  const visiblePoints = state.activeRegion === "All" 
    ? data.points 
    : data.points.filter((p) => p.subregion === state.activeRegion);

  if (!visiblePoints.length) return;

  const fusedArr = visiblePoints.map((p) => p.fused_mm);
  const gfsArr = visiblePoints.map((p) => p.gfs_mm);
  const ecmwfArr = visiblePoints.map((p) => p.ecmwf_mm);
  const dArr = visiblePoints.map((p) => p.disagreement_mm);
  const confClasses = visiblePoints.map((p) => p.confidence_class);

  const meanFused = (fusedArr.reduce((a, b) => a + b, 0) / fusedArr.length).toFixed(2);
  const maxFused = Math.max(...fusedArr).toFixed(2);
  const meanGfs = (gfsArr.reduce((a, b) => a + b, 0) / gfsArr.length).toFixed(2);
  const meanEcmwf = (ecmwfArr.reduce((a, b) => a + b, 0) / ecmwfArr.length).toFixed(2);
  const meanD = (dArr.reduce((a, b) => a + b, 0) / dArr.length).toFixed(2);

  const highCount = confClasses.filter((c) => c === "High Confidence").length;
  const modCount = confClasses.filter((c) => c === "Moderate Confidence").length;
  const lowCount = confClasses.filter((c) => c === "Low Confidence").length;
  const total = visiblePoints.length;

  const highPct = ((highCount / total) * 100).toFixed(1);
  const modPct = ((modCount / total) * 100).toFixed(1);
  const lowPct = ((lowCount / total) * 100).toFixed(1);

  // Peak point
  const peakPt = visiblePoints.find((p) => p.fused_mm === parseFloat(maxFused));
  const peakLoc = peakPt ? `(${peakPt.lat.toFixed(2)}°N, ${peakPt.lon.toFixed(2)}°E)` : "";

  // Update Summary DOM
  const d = new Date(data.forecast_date + "T00:00:00Z");
  const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
  const dateFormatted = `${String(d.getUTCDate()).padStart(2, "0")} ${months[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
  
  const dateBadge = document.getElementById("summary-date-badge");
  if (dateBadge) dateBadge.textContent = dateFormatted;
  const regionLabel = document.getElementById("summary-region-label");
  if (regionLabel) regionLabel.textContent = state.activeRegion === "All"
    ? `AP & Telangana Domain (${total} Cells)`
    : `${state.activeRegion} (${total} Cells)`;

  const elMean = document.getElementById("val-domain-mean");
  if (elMean) elMean.textContent = meanFused;
  const elMax = document.getElementById("val-domain-max");
  if (elMax) elMax.textContent = `${maxFused} mm`;
  const elMaxLoc = document.getElementById("val-domain-max-loc");
  if (elMaxLoc) elMaxLoc.textContent = peakLoc;
  const elDis = document.getElementById("val-domain-dis");
  if (elDis) elDis.textContent = meanD;
  const elWarn = document.getElementById("val-domain-warn");
  if (elWarn) elWarn.textContent = `${lowPct}%`;

  // Pipeline summary readings (if legacy elements exist)
  const sumGfs = document.getElementById("summary-gfs-val");
  if (sumGfs) sumGfs.textContent = `${meanGfs} mm`;
  const sumEcmwf = document.getElementById("summary-ecmwf-val");
  if (sumEcmwf) sumEcmwf.textContent = `${meanEcmwf} mm`;
  const sumFused = document.getElementById("summary-fused-val");
  if (sumFused) sumFused.textContent = `${meanFused} mm`;
  const sumDis = document.getElementById("summary-dis-val");
  if (sumDis) sumDis.textContent = `${meanD} mm`;

  // Confidence distribution
  const barHigh = document.getElementById("bar-seg-high");
  if (barHigh) barHigh.style.width = `${highPct}%`;
  const barMod = document.getElementById("bar-seg-mod");
  if (barMod) barMod.style.width = `${modPct}%`;
  const barLow = document.getElementById("bar-seg-low");
  if (barLow) barLow.style.width = `${lowPct}%`;

  const pctHigh = document.getElementById("pct-high");
  if (pctHigh) pctHigh.textContent = `${highPct}%`;
  const pctMod = document.getElementById("pct-mod");
  if (pctMod) pctMod.textContent = `${modPct}%`;
  const pctLow = document.getElementById("pct-low");
  if (pctLow) pctLow.textContent = `${lowPct}%`;

  // ── Forecast Explanation Strip (Section 5) ──
  const stripFused = document.getElementById("strip-fused-val");
  if (stripFused) stripFused.textContent = meanFused;
  const stripGfs = document.getElementById("strip-gfs-val");
  if (stripGfs) stripGfs.textContent = meanGfs;
  const stripEcmwf = document.getElementById("strip-ecmwf-val");
  if (stripEcmwf) stripEcmwf.textContent = meanEcmwf;
  const stripDis = document.getElementById("strip-dis-val");
  if (stripDis) stripDis.textContent = meanD;

  const stripConfBadge = document.getElementById("strip-conf-badge");
  const stripConfVal = document.getElementById("strip-conf-val");
  const stripConfSub = document.getElementById("strip-conf-sub");
  const stripDateBadge = document.getElementById("strip-date-badge");
  if (stripDateBadge) stripDateBadge.textContent = dateFormatted;

  let dominantConfClass = "conf-high";
  let dominantConfText = "HIGH";
  let dominantSub = `${highPct}% High Confidence`;
  if (parseFloat(lowPct) >= parseFloat(highPct) && parseFloat(lowPct) >= parseFloat(modPct)) {
    dominantConfClass = "conf-low";
    dominantConfText = "LOW";
    dominantSub = `${lowPct}% Low Confidence`;
  } else if (parseFloat(modPct) >= parseFloat(highPct)) {
    dominantConfClass = "conf-mod";
    dominantConfText = "MODERATE";
    dominantSub = `${modPct}% Moderate Confidence`;
  }

  if (stripConfBadge) {
    stripConfBadge.className = `s-conf-badge ${dominantConfClass}`;
  }
  if (stripConfVal) stripConfVal.textContent = dominantConfText;
  if (stripConfSub) stripConfSub.textContent = dominantSub;

  updateMapContextBadge();

  // ── UI ENHANCEMENT v2: Update new intelligence panels ──
  updateIntelHero(meanFused, highPct, modPct, lowPct, data);
  updateWeightsCard(meanGfs, meanEcmwf, meanFused);
  updateExtremeEvents(maxFused, visiblePoints);
}

/* ========================================================
   INTELLIGENCE HERO BAR UPDATE
   ======================================================== */
function updateIntelHero(meanFused, highPct, modPct, lowPct, data) {
  const heroNum = document.getElementById("hero-fused-val");
  if (heroNum) heroNum.textContent = meanFused;

  // Determine dominant confidence class
  const hp = parseFloat(highPct), mp = parseFloat(modPct), lp = parseFloat(lowPct);
  let confClass, confLabel;
  if (hp >= mp && hp >= lp) { confClass = "conf-high"; confLabel = "HIGH CONFIDENCE"; }
  else if (lp >= hp && lp >= mp) { confClass = "conf-low"; confLabel = "LOW CONFIDENCE"; }
  else { confClass = "conf-mod"; confLabel = "MODERATE CONFIDENCE"; }

  const badge = document.getElementById("hero-conf-badge");
  const text = document.getElementById("hero-conf-text");
  if (badge) {
    badge.className = `intel-conf-badge ${confClass}`;
    badge.querySelector(".intel-conf-dot").style.background = "currentColor";
  }
  if (text) text.textContent = confLabel;

  // Why-Fused dynamic text
  const whyText = document.getElementById("why-fused-text");
  if (whyText) {
    whyText.innerHTML = `The 50/50 equal-weight ensemble was retained as the operational strategy after empirical evaluation showed no statistically robust MAE advantage for adaptive weighting (p = 0.016). Both NOAA GFS and ECMWF IFS are equally weighted because their historical errors over the AP &amp; Telangana domain are comparable. Model disagreement D determines the empirical confidence class &mdash; <strong>${lp.toFixed(1)}%</strong> of domain cells are currently in the low-confidence regime.`;
  }
}

/* ========================================================
   MODEL WEIGHTS CARD UPDATE (uses real domain values)
   ======================================================== */
function updateWeightsCard(meanGfs, meanEcmwf, meanFused) {
  const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

  // Side panel weights card
  setEl("mw-val-gfs", `${meanGfs} mm`);
  setEl("mw-val-ecmwf", `${meanEcmwf} mm`);
  setEl("mw-val-fused-w", `${meanFused} mm`);
  setEl("mw-ctx-region", state.activeRegion === "All" ? "AP & Telangana" : state.activeRegion);
  setEl("mw-ctx-period", state.operationalMode === "live" ? "Current Live Run" : "Jun–Aug 2024");

  // Full weights page
  setEl("wpage-gfs-val", `${meanGfs} mm`);
  setEl("wpage-ecmwf-val", `${meanEcmwf} mm`);
  setEl("wpage-fused-val", `${meanFused} mm`);
  setEl("wpage-ctx-domain", state.activeRegion === "All" ? "AP & TG" : state.activeRegion);
}

/* ========================================================
   EXTREME EVENTS GUIDANCE (derived from real forecast data)
   IMD Categories: Heavy ≥ 15mm, Very Heavy ≥ 35mm, Extreme ≥ 65mm
   ======================================================== */
function updateExtremeEvents(maxFused, visiblePoints) {
  const sub = document.getElementById("ee-rainfall-sub");
  const badge = document.getElementById("ee-rainfall-risk");
  if (!sub || !badge) return;

  // Count cells exceeding IMD heavy rain thresholds
  const heavyCells = visiblePoints.filter(p => p.fused_mm >= 15).length;
  const vheavyCells = visiblePoints.filter(p => p.fused_mm >= 35).length;
  const extCells = visiblePoints.filter(p => p.fused_mm >= 65).length;
  const total = visiblePoints.length;

  let riskClass = "ee-risk-na", riskLabel = "No signal", subText = "No heavy rainfall cells detected";

  if (extCells > 0) {
    riskClass = "ee-risk-high";
    riskLabel = "EXTREME RISK";
    subText = `${extCells} cell${extCells > 1 ? "s" : ""} ≥ 65mm (Extreme) · Peak: ${maxFused} mm`;
  } else if (vheavyCells > 0) {
    riskClass = "ee-risk-high";
    riskLabel = "VERY HEAVY";
    subText = `${vheavyCells} cell${vheavyCells > 1 ? "s" : ""} ≥ 35mm (Very Heavy) · Peak: ${maxFused} mm`;
  } else if (heavyCells > 0) {
    riskClass = "ee-risk-moderate";
    riskLabel = "HEAVY RAIN";
    subText = `${heavyCells} cell${heavyCells > 1 ? "s" : ""} ≥ 15mm (Heavy) · Peak: ${maxFused} mm`;
  } else if (parseFloat(maxFused) > 5) {
    riskClass = "ee-risk-low";
    riskLabel = "LIGHT RAIN";
    subText = `Peak ${maxFused} mm · Below heavy rain threshold (15mm)`;
  } else {
    subText = `Peak ${maxFused} mm · Dry to very light conditions`;
  }

  badge.className = `ee-risk-badge ${riskClass}`;
  badge.textContent = riskLabel;
  sub.textContent = subText;

  // ── Also update the full Extreme Events page detailed signals ──
  const setExtRow = (subId, badgeId, count, threshold, label, cls) => {
    const s = document.getElementById(subId);
    const b = document.getElementById(badgeId);
    if (!s || !b) return;
    if (count > 0) {
      s.textContent = `${count} cell${count > 1 ? "s" : ""} forecast ≥ ${threshold} mm · Peak: ${maxFused} mm`;
      b.className = `ee-risk-badge ${cls}`;
      b.textContent = label;
    } else {
      s.textContent = `IMD Category: ≥ ${threshold} mm/24h · No cells detected`;
      b.className = "ee-risk-badge ee-risk-na";
      b.textContent = "Clear";
    }
  };
  setExtRow("ext-extreme-sub", "ext-extreme-badge", extCells,   65, "EXTREME",   "ee-risk-high");
  setExtRow("ext-veryheavy-sub", "ext-veryheavy-badge", vheavyCells, 35, "VERY HEAVY", extCells > 0 ? "ee-risk-high" : "ee-risk-moderate");
  setExtRow("ext-heavy-sub", "ext-heavy-badge", heavyCells,   15, "HEAVY",     vheavyCells > 0 ? "ee-risk-moderate" : "ee-risk-low");
}

/* ========================================================
   DEDICATED VIEW PANEL UPDATES: WEIGHTS & EXTREMES
   ======================================================== */
function updateWeightsModeView() {
  if (!state.currentGridData || !state.currentGridData.points) return;
  const pts = state.currentGridData.points;
  const n = pts.length;
  if (!n) return;

  const isLive = state.operationalMode === "live";
  const sumGfs = isLive ? n * 0.50 : pts.reduce((acc, p) => acc + (p.w_gfs !== undefined ? p.w_gfs : 0.50), 0);
  const sumEc = isLive ? n * 0.50 : pts.reduce((acc, p) => acc + (p.w_ecmwf !== undefined ? p.w_ecmwf : 0.50), 0);
  const sumEntropy = isLive ? n * 0.693 : pts.reduce((acc, p) => acc + (p.weight_entropy !== undefined ? p.weight_entropy : 0.693), 0);
  const sumAi = isLive ? 0.00 : pts.reduce((acc, p) => acc + (p.delta_w_ai !== undefined ? p.delta_w_ai : Math.abs((p.w_gfs || 0.5) - 0.5)), 0);

  const meanGfs = (sumGfs / n).toFixed(3);
  const meanEc = (sumEc / n).toFixed(3);
  const meanEntropy = (sumEntropy / n).toFixed(3);
  const meanAi = (sumAi / n).toFixed(3);

  const gfsDominant = isLive ? 0 : pts.filter(p => (p.w_gfs || 0.5) > 0.55).length;
  const ecDominant = isLive ? 0 : pts.filter(p => (p.w_ecmwf || 0.5) > 0.55).length;
  const consensus = isLive ? n : n - gfsDominant - ecDominant;

  const pctGfs = ((gfsDominant / n) * 100).toFixed(1);
  const pctEc = ((ecDominant / n) * 100).toFixed(1);
  const pctConsensus = ((consensus / n) * 100).toFixed(1);

  const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  setEl("weights-mode-mean-gfs", meanGfs);
  setEl("weights-mode-mean-ec", meanEc);
  setEl("weights-mode-mean-entropy", meanEntropy);
  setEl("weights-mode-mean-ai", meanAi);
  setEl("weights-mode-pct-gfs", `${pctGfs}%`);
  setEl("weights-mode-pct-ec", `${pctEc}%`);
  setEl("weights-mode-pct-consensus", `${pctConsensus}%`);
  setEl("weights-mode-dominant-label", isLive ? "Consensus (50/50)" : (parseFloat(pctEc) >= parseFloat(pctGfs) ? `ECMWF (${pctEc}%)` : `GFS (${pctGfs}%)`));

  const barGfs = document.getElementById("weights-bar-gfs");
  const barCon = document.getElementById("weights-bar-consensus");
  const barEc = document.getElementById("weights-bar-ec");
  if (barGfs) barGfs.style.width = `${pctGfs}%`;
  if (barCon) barCon.style.width = `${pctConsensus}%`;
  if (barEc) barEc.style.width = `${pctEc}%`;
}

async function updateExtremesModeView() {
  if (!state.currentGridData || !state.currentGridData.points) return;
  const pts = state.currentGridData.points;
  const maxRain = Math.max(...pts.map(p => p.fused_mm || 0));
  const elRainVal = document.getElementById("ext-rain-forecast-val");
  const elRainStatus = document.getElementById("ext-rain-status");
  const elRainAggr = document.getElementById("ext-rain-agreement");
  if (elRainVal) elRainVal.textContent = `${maxRain.toFixed(1)} mm (Domain Peak)`;
  if (elRainStatus) {
    if (maxRain >= 115.6) {
      elRainStatus.className = "extreme-badge status-extreme";
      elRainStatus.textContent = "Very Heavy (Orange)";
    } else if (maxRain >= 64.5) {
      elRainStatus.className = "extreme-badge status-warning";
      elRainStatus.textContent = "Heavy (Yellow)";
    } else {
      elRainStatus.className = "extreme-badge status-normal";
      elRainStatus.textContent = "Normal (< 64.5 mm)";
    }
  }

  // Count alerts
  if (state.operationalMode === "retrospective") {
    try {
      const res = await fetch(`/api/v2/extremes/summary?date=${state.currentDate}&lead=${state.activeLead || 24}`);
      const data = await res.json();
      if (data.status === "SUCCESS" && data.summary) {
        const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
        setEl("extremes-mode-active-count", data.summary.active_alerts_count);
        setEl("extremes-mode-unanimous-count", data.summary.unanimous_exceedance_count);
        setEl("extremes-mode-divergent-count", data.summary.divergent_exceedance_count);
      }
    } catch (e) {
      console.warn("Failed to fetch extremes summary:", e);
    }
  } else {
    // In live mode, calculate from active points
    const activeAlerts = pts.filter(p => (p.fused_mm || 0) >= 15.6).length;
    const unanimous = pts.filter(p => (p.gfs_mm || 0) >= 15.6 && (p.ecmwf_mm || 0) >= 15.6).length;
    const divergent = activeAlerts - unanimous;
    const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    setEl("extremes-mode-active-count", activeAlerts);
    setEl("extremes-mode-unanimous-count", unanimous);
    setEl("extremes-mode-divergent-count", Math.max(0, divergent));
  }
}

/* ========================================================
   METEOROLOGICAL COLOR CALIBRATION
   ======================================================== */
function getPointColorAndOpacity(point) {
  const layer = state.activeLayer;

  // 1. Empirical Confidence
  if (layer === "confidence") {
    const confItem = PALETTES.confidence.find((c) => c.key === point.confidence_class);
    return { color: confItem ? confItem.color : "#94a3b8", opacity: 0.85 };
  }

  // 2. Inter-Model Disagreement
  if (layer === "disagreement") {
    const val = point.disagreement !== undefined ? point.disagreement : point.disagreement_mm;
    for (const item of PALETTES.disagreement) {
      if (val >= item.min) {
        return { color: item.color, opacity: val < 0.11 ? 0.2 : 0.85 };
      }
    }
    return { color: "#a5b4fc", opacity: 0.3 };
  }

  // 3. Model Weight Maps
  if (layer === "w_gfs") {
    const val = point.w_gfs !== undefined ? point.w_gfs : 0.50;
    for (const item of PALETTES.weights) {
      if (val >= item.min) {
        return { color: item.color, opacity: 0.88, val: val };
      }
    }
    return { color: "#0c4a6e", opacity: 0.85, val: val };
  }

  if (layer === "w_ecmwf") {
    const val = point.w_ecmwf !== undefined ? point.w_ecmwf : 0.50;
    for (const item of PALETTES.weights) {
      if (val >= item.min) {
        return { color: item.color, opacity: 0.88, val: val };
      }
    }
    return { color: "#0c4a6e", opacity: 0.85, val: val };
  }

  // 4. Dominant Model Distribution
  if (layer === "dominant_model") {
    const dom = point.dominant_model || "Consensus";
    if (dom.includes("GFS")) {
      return { color: "#0284c7", opacity: 0.88 }; // GFS blue
    } else if (dom.includes("ECMWF")) {
      return { color: "#d97706", opacity: 0.88 }; // ECMWF amber
    } else {
      return { color: "#0d9488", opacity: 0.85 }; // Balanced teal
    }
  }

  // 5. Shannon Weight Entropy
  if (layer === "weight_entropy") {
    const val = point.weight_entropy !== undefined ? point.weight_entropy : 0.693;
    for (const item of PALETTES.entropy) {
      if (val >= item.min) {
        return { color: item.color, opacity: 0.85, val: val };
      }
    }
    return { color: "#7e22ce", opacity: 0.85, val: val };
  }

  // 6. Extreme Guidance Alerts
  if (layer === "extreme_guidance") {
    const ext = point.extreme_guidance;
    if (ext && ext.is_exceeded) {
      const score = ext.severity_score || 1;
      if (score >= 3) return { color: "#7e22ce", opacity: 0.95 };
      if (score === 2) return { color: "#dc2626", opacity: 0.90 };
      if (score === 1) return { color: "#ea580c", opacity: 0.88 };
      return { color: "#f59e0b", opacity: 0.85 };
    }
    return { color: "rgba(16, 185, 129, 0.2)", opacity: 0.25 };
  }

  // 7. Forecast Layers (blended, fused, gfs, ecmwf, imd)
  let val = point.blend_val !== undefined ? point.blend_val : point.fused_mm;
  if (layer === "fused") val = point.baseline_val !== undefined ? point.baseline_val : point.fused_mm;
  else if (layer === "gfs") val = point.gfs_val !== undefined ? point.gfs_val : point.gfs_mm;
  else if (layer === "ecmwf") val = point.ecmwf_val !== undefined ? point.ecmwf_val : point.ecmwf_mm;
  else if (layer === "imd") {
    val = point.obs_val !== undefined ? point.obs_val : (point.imd_mm !== null ? point.imd_mm : 0.0);
  }

  // Temperature Variable Palette
  if (state.activeVariable === "temperature") {
    for (const item of PALETTES.temperature) {
      if (val >= item.min) {
        return { color: item.color, opacity: 0.85, val: val };
      }
    }
    return { color: "#3b82f6", opacity: 0.85, val: val };
  }

  // Wind Variable Palette
  if (state.activeVariable === "wind") {
    for (const item of PALETTES.wind) {
      if (val >= item.min) {
        return { color: item.color, opacity: val < 10.0 ? 0.25 : 0.85, val: val };
      }
    }
    return { color: "#10b981", opacity: 0.3, val: val };
  }

  // Rainfall Variable Palette
  for (const item of PALETTES.rain) {
    if (val >= item.min) {
      return {
        color: item.color,
        opacity: val < 0.1 ? 0.0 : 0.88, // Dry areas transparent
        val: val
      };
    }
  }
  return { color: "#7dd3fc", opacity: 0.0, val: val };
}

/* ========================================================
   MAP PRESENTATION RENDERING (Smooth Raster & Interactive Hits)
   ======================================================== */
function renderGrid() {
  if (!state.currentGridData || !state.currentGridData.points) return;
  
  // 1. Create dynamic offscreen canvas for smooth raster precipitation visualization
  const canvas = document.createElement("canvas");
  const cWidth = 740;
  const cHeight = 660;
  canvas.width = cWidth;
  canvas.height = cHeight;
  const ctx = canvas.getContext("2d");

  const minLat = DOMAIN_BOUNDS.latMin;
  const maxLat = DOMAIN_BOUNDS.latMax;
  const minLon = DOMAIN_BOUNDS.lonMin;
  const maxLon = DOMAIN_BOUNDS.lonMax;

  const latSpan = maxLat - minLat;
  const lonSpan = maxLon - minLon;

  const cellW = (0.25 / lonSpan) * cWidth;
  const cellH = (0.25 / latSpan) * cHeight;

  // Draw discrete cell colored blocks onto primary canvas
  state.currentGridData.points.forEach((pt) => {
    if (state.activeRegion !== "All" && pt.subregion !== state.activeRegion) {
      return;
    }

    const x = ((pt.lon - 0.125 - minLon) / lonSpan) * cWidth;
    const y = ((maxLat - (pt.lat + 0.125)) / latSpan) * cHeight;

    const style = getPointColorAndOpacity(pt);
    if (style.opacity > 0) {
      ctx.fillStyle = style.color;
      ctx.globalAlpha = style.opacity;
      // Draw seamless cell block
      ctx.fillRect(Math.floor(x), Math.floor(y), Math.ceil(cellW) + 1, Math.ceil(cellH) + 1);
    }
  });

  // Apply subtle presentation-layer meteorological smoothing if rainfall or disagreement
  const smoothCanvas = document.createElement("canvas");
  smoothCanvas.width = cWidth;
  smoothCanvas.height = cHeight;
  const smoothCtx = smoothCanvas.getContext("2d");

  if (state.activeLayer === "confidence") {
    // For categorical confidence, preserve sharp zone boundaries
    smoothCtx.drawImage(canvas, 0, 0);
  } else {
    // For scalar continuous precipitation & disagreement fields, apply gentle smoothing
    smoothCtx.filter = "blur(4px)";
    smoothCtx.drawImage(canvas, 0, 0);
    // Draw crisp center over blurred edges for perfect balance of sharpness & continuity
    smoothCtx.filter = "none";
    smoothCtx.globalAlpha = 0.55;
    smoothCtx.drawImage(canvas, 0, 0);
  }

  // Update or add Leaflet ImageOverlay
  const imgDataUrl = smoothCanvas.toDataURL();
  const bounds = [
    [minLat, minLon],
    [maxLat, maxLon]
  ];

  if (state.rasterOverlay) {
    state.map.removeLayer(state.rasterOverlay);
  }

  state.rasterOverlay = L.imageOverlay(imgDataUrl, bounds, {
    opacity: 0.90,
    interactive: false,
    zIndex: 400,
  }).addTo(state.map);

  // 2. Clear & rebuild interactive invisible grid hits for hover tooltips & click handlers
  state.interactiveLayerGroup.clearLayers();
  const half = 0.125;

  state.currentGridData.points.forEach((pt) => {
    if (state.activeRegion !== "All" && pt.subregion !== state.activeRegion) {
      return;
    }

    const cellBounds = [
      [pt.lat - half, pt.lon - half],
      [pt.lat + half, pt.lon + half]
    ];

    // Transparent interactive polygon
    const hitRect = L.rectangle(cellBounds, {
      stroke: false,
      fillColor: "#000000",
      fillOpacity: 0.0,
      interactive: true,
    });

    // Meteorological tooltip
    const unit = state.activeVariable === "temperature" ? "°C" : state.activeVariable === "wind" ? "km/h" : "mm";
    let layerValText = `<strong>${pt.blend_val !== undefined ? pt.blend_val : pt.fused_mm} ${unit}</strong> (Context-Aware Blend)`;
    if (state.activeLayer === "fused") layerValText = `<strong>${pt.baseline_val !== undefined ? pt.baseline_val : pt.fused_mm} ${unit}</strong> (50/50 Baseline)`;
    else if (state.activeLayer === "gfs") layerValText = `<strong>${pt.gfs_val !== undefined ? pt.gfs_val : pt.gfs_mm} ${unit}</strong> (NOAA GFS)`;
    else if (state.activeLayer === "ecmwf") layerValText = `<strong>${pt.ecmwf_val !== undefined ? pt.ecmwf_val : pt.ecmwf_mm} ${unit}</strong> (ECMWF IFS)`;
    else if (state.activeLayer === "w_gfs") layerValText = `<strong>w_GFS: ${(pt.w_gfs || 0.5).toFixed(3)}</strong>`;
    else if (state.activeLayer === "w_ecmwf") layerValText = `<strong>w_EC: ${(pt.w_ecmwf || 0.5).toFixed(3)}</strong>`;
    else if (state.activeLayer === "dominant_model") layerValText = `<strong>${pt.dominant_model || 'Consensus'}</strong>`;
    else if (state.activeLayer === "weight_entropy") layerValText = `<strong>H: ${(pt.weight_entropy || 0.693).toFixed(3)} nats</strong>`;
    else if (state.activeLayer === "extreme_guidance") layerValText = pt.extreme_guidance ? `<strong>${pt.extreme_guidance.warning_level}</strong> (${pt.extreme_guidance.model_agreement})` : "Normal";
    else if (state.activeLayer === "disagreement") layerValText = `<strong>${pt.disagreement_mm} ${unit}</strong> (Spread D)`;
    else if (state.activeLayer === "confidence") layerValText = `<strong>${pt.confidence_class}</strong>`;
    else if (state.activeLayer === "imd") {
      layerValText = pt.imd_mm !== null ? `<strong>${pt.imd_mm} ${unit}</strong> (IMD Obs)` : "IMD Pending";
    }

    hitRect.bindTooltip(`
      <div style="font-family: var(--font-sans); font-size: 11px; line-height: 1.4; color: #0f172a; padding: 2px;">
        <div style="font-weight: 700; color: #1e293b; border-bottom: 1px solid #e2e8f0; padding-bottom: 2px; margin-bottom: 3px;">
          ${pt.lat.toFixed(2)}°N, ${pt.lon.toFixed(2)}°E • <span style="font-weight: 500; color: #64748b;">${pt.subregion}</span>
        </div>
        <div>Reading: ${layerValText}</div>
        <div style="margin-top: 2px; font-size: 10px; color: #475569;">
          Weights: GFS ${(pt.w_gfs || 0.5).toFixed(2)} / EC ${(pt.w_ecmwf || 0.5).toFixed(2)} &bull; ${pt.confidence_class}
        </div>
      </div>
    `, { sticky: true, opacity: 0.95 });

    hitRect.on("click", (e) => {
      L.DomEvent.stopPropagation(e);
      inspectCell(pt);
    });

    state.interactiveLayerGroup.addLayer(hitRect);
  });

  // Render high zoom grid lines if active
  renderGridLines();
}

function renderGridLines() {
  state.gridLinesLayerGroup.clearLayers();
  if (!state.showGridLines || !state.currentGridData || !state.currentGridData.points) return;

  const half = 0.125;
  state.currentGridData.points.forEach((pt) => {
    if (state.activeRegion !== "All" && pt.subregion !== state.activeRegion) return;
    const b = [
      [pt.lat - half, pt.lon - half],
      [pt.lat + half, pt.lon + half]
    ];
    const wire = L.rectangle(b, {
      color: "rgba(148, 163, 184, 0.4)",
      weight: 0.7,
      fill: false,
      dashArray: "2, 3",
      interactive: false,
    });
    state.gridLinesLayerGroup.addLayer(wire);
  });
}

/* ========================================================
   FLOATING METEOROLOGICAL LEGEND
   ======================================================== */
function updateLegend() {
  const container = document.getElementById("map-legend");
  if (!container) return;

  const varUnit = state.activeVariable === "temperature" ? "°C" : state.activeVariable === "wind" ? "km/h" : "mm / 24h";

  // 3D Specific Analytical Legend
  if (state.viewDimension === "3d") {
    if (state.threeMode === "rain") {
      let html = `
        <div class="legend-title">3D ${state.activeVariable.toUpperCase()}</div>
        <div class="legend-3d-dims">
          <div class="dim-row"><span class="dim-k">HEIGHT:</span><span class="dim-v">Forecast magnitude (${varUnit})</span></div>
          <div class="dim-row"><span class="dim-k">COLOR:</span><span class="dim-v">Intensity</span></div>
          <div class="dim-row"><span class="dim-k">GRID:</span><span class="dim-v">Native 0.25° forecast field (791 cells)</span></div>
        </div>
        <div class="legend-items">
      `;
      const pal = state.activeVariable === "temperature" ? PALETTES.temperature : state.activeVariable === "wind" ? PALETTES.wind : PALETTES.rain;
      pal.forEach((item) => {
        html += `
          <div class="legend-row">
            <span class="legend-swatch" style="background: ${item.color};"></span>
            <span>${item.label}</span>
          </div>
        `;
      });
      html += `</div>`;
      if (state.threeShowLowConf) {
        html += `<div style="margin-top: 6px; padding: 4px 6px; background: rgba(245, 158, 11, 0.2); border: 1px solid #f59e0b; border-radius: 2px; font-size: 0.65rem; color: #fde68a;"><strong>LOW-CONFIDENCE OVERLAY:</strong> D &ge; 2.06</div>`;
      }
      const legend3dNote = state.activeVariable === "temperature" ? "Height = forecast temperature magnitude." : state.activeVariable === "wind" ? "Height = forecast wind-speed magnitude." : "Height = forecast rainfall magnitude.";
      html += `<div class="legend-3d-note">${legend3dNote}</div>`;
      container.innerHTML = html;
      return;
    } else {
      let html = `
        <div class="legend-title">3D MODEL DISAGREEMENT</div>
        <div class="legend-3d-dims">
          <div class="dim-row"><span class="dim-k">HEIGHT:</span><span class="dim-v">|GFS − ECMWF| (${varUnit})</span></div>
          <div class="dim-row"><span class="dim-k">COLOR:</span><span class="dim-v">Model disagreement</span></div>
          <div class="dim-row"><span class="dim-k">GRID:</span><span class="dim-v">Native 0.25° forecast field (791 cells)</span></div>
          <div class="dim-row"><span class="dim-k">INTERPRET:</span><span class="dim-v">Higher disagreement indicates lower empirical confidence</span></div>
        </div>
        <div class="legend-items">
      `;
      PALETTES.disagreement.forEach((item) => {
        html += `
          <div class="legend-row">
            <span class="legend-swatch" style="background: ${item.color};"></span>
            <span>${item.label}</span>
          </div>
        `;
      });
      html += `</div>`;
      container.innerHTML = html;
      return;
    }
  }

  // 2D Map Legend
  const layer = state.activeLayer;
  let title = "CONTEXT-AWARE BLEND";
  let items = [];

  const varPal = state.activeVariable === "temperature" ? PALETTES.temperature : state.activeVariable === "wind" ? PALETTES.wind : PALETTES.rain;

  if (layer === "blended") {
    title = `CONTEXT-AWARE BLEND (${varUnit})`;
    items = varPal;
  } else if (layer === "fused") {
    title = `50/50 EQUAL-WEIGHT BASELINE (${varUnit})`;
    items = varPal;
  } else if (layer === "gfs") {
    title = `NOAA GFS Forecast (${varUnit})`;
    items = varPal;
  } else if (layer === "ecmwf") {
    title = `ECMWF IFS Forecast (${varUnit})`;
    items = varPal;
  } else if (layer === "w_gfs") {
    title = "GFS SIMPLEX WEIGHT (w_GFS)";
    items = PALETTES.weights;
  } else if (layer === "w_ecmwf") {
    title = "ECMWF SIMPLEX WEIGHT (w_ECMWF)";
    items = PALETTES.weights;
  } else if (layer === "dominant_model") {
    title = "DOMINANT NWP MODEL";
    items = [
      { color: "#0284c7", label: "NOAA GFS Dominant (w > 0.55)" },
      { color: "#d97706", label: "ECMWF IFS Dominant (w > 0.55)" },
      { color: "#0d9488", label: "Balanced Consensus (0.45 ≤ w ≤ 0.55)" }
    ];
  } else if (layer === "weight_entropy") {
    title = "SHANNON WEIGHT ENTROPY H(s) (nats)";
    items = PALETTES.entropy;
  } else if (layer === "extreme_guidance") {
    title = "EXTREME WEATHER GUIDANCE (Deterministic)";
    items = [
      { color: "#7e22ce", label: "Extreme Warning (Severe Exceedance)" },
      { color: "#dc2626", label: "Warning (High Severity)" },
      { color: "#ea580c", label: "Alert (Moderate Severity)" },
      { color: "#f59e0b", label: "Watch (Light / Marginal)" },
      { color: "rgba(16, 185, 129, 0.4)", label: "Below Warning Threshold (Normal)" }
    ];
  } else if (layer === "imd") {
    title = `IMD Retrospective Observation (${varUnit})`;
    items = varPal;
  } else if (layer === "confidence") {
    title = "EMPIRICAL CONFIDENCE REGIMES";
    items = PALETTES.confidence.map((c) => ({ color: c.color, label: c.label }));
  } else if (layer === "disagreement") {
    title = `MODEL DISAGREEMENT D = |GFS − ECMWF| (${varUnit})`;
    items = PALETTES.disagreement;
  }

  let html = `<div class="legend-title">${title}</div><div class="legend-items">`;
  items.forEach((item) => {
    html += `
      <div class="legend-row">
        <span class="legend-swatch" style="background: ${item.color};"></span>
        <span>${item.label}</span>
      </div>
    `;
  });
  html += `</div>`;
  container.innerHTML = html;
}

/* ========================================================
   CELL INSPECTION & PROGRESSIVE DISCLOSURE
   ======================================================== */
function inspectCell(pt) {
  state.selectedPoint = pt;

  // Auto-pause timeline playback during cell inspection
  if (state.isPlaying) {
    togglePlay();
  }

  // Draw Reticle in 3D Viewer if active
  if (state.threeViewer) {
    state.threeViewer.highlightCell(pt);
  }

  // Draw Reticle / Highlight Box on Map
  if (state.selectedCellHighlight) {
    state.map.removeLayer(state.selectedCellHighlight);
  }

  const half = 0.125;
  const b = [
    [pt.lat - half, pt.lon - half],
    [pt.lat + half, pt.lon + half]
  ];

  state.selectedCellHighlight = L.rectangle(b, {
    color: "#38bdf8",
    weight: 2.5,
    fillColor: "#0284c7",
    fillOpacity: 0.25,
    interactive: false,
    zIndex: 600,
  }).addTo(state.map);

  // Switch panels
  document.getElementById("panel-domain-summary").classList.add("hidden");
  const inspPanel = document.getElementById("panel-cell-inspector");
  inspPanel.classList.remove("hidden");

  // Populate Location & Context
  const stateName = pt.subregion === "Telangana" ? "Telangana" : "Andhra Pradesh";
  document.getElementById("inspect-subregion").textContent = `${pt.subregion.toUpperCase()} • ${stateName.toUpperCase()}`;
  document.getElementById("inspect-coords").textContent = `${pt.lat.toFixed(2)}°N · ${pt.lon.toFixed(2)}°E`;

  if (state.operationalMode === "live") {
    const initDate = state.currentGridData ? new Date(state.currentGridData.initialization_time_utc) : new Date();
    const validDate = state.currentGridData ? new Date(state.currentGridData.valid_time_utc) : new Date();
    const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
    const initFmt = `${String(initDate.getUTCDate()).padStart(2, "0")} ${months[initDate.getUTCMonth()]} ${initDate.getUTCFullYear()} 00 UTC`;
    const validFmt = `${String(validDate.getUTCDate()).padStart(2, "0")} ${months[validDate.getUTCMonth()]} ${validDate.getUTCFullYear()} 00 UTC`;
    document.getElementById("inspect-dates").textContent = `Initialization: ${initFmt} → Valid: ${validFmt} (+24h Lead)`;
  } else {
    document.getElementById("inspect-dates").textContent = `Forecast: ${state.currentDate} (00 UTC Cycle, +24h Lead)`;
  }

  // Dynamic Variable Kicker & Unit
  const varUnit = pt.unit || (state.activeVariable === "temperature" ? "°C" : state.activeVariable === "wind" ? "km/h" : "mm");
  const kickerElText = state.activeVariable === "temperature"
    ? "24-HOUR DYNAMICALLY BLENDED 2M TEMPERATURE"
    : state.activeVariable === "wind"
    ? "24-HOUR DYNAMICALLY BLENDED 10M WIND SPEED"
    : "24-HOUR DYNAMICALLY BLENDED PRECIPITATION";
  const varKickerEl = document.getElementById("inspect-var-kicker");
  if (varKickerEl) varKickerEl.textContent = kickerElText;
  const varUnitEl = document.getElementById("inspect-var-unit");
  if (varUnitEl) varUnitEl.textContent = varUnit;

  // Forecast Hero Reading
  const valHero = pt.blend_val !== undefined ? pt.blend_val : pt.fused_mm;
  const inspectFusedVal = document.getElementById("inspect-fused-val");
  if (inspectFusedVal) inspectFusedVal.textContent = Number(valHero).toFixed(2);
  const inspectBlendTag = document.getElementById("inspect-blend-tag");
  if (inspectBlendTag) {
    inspectBlendTag.textContent = state.operationalMode === "live" ? "50/50 Operational Reference" : "Context-Aware Model Weights";
  }

  // Learned Blending Weights & Dominant Model
  const wGfs = pt.w_gfs !== undefined ? pt.w_gfs : 0.50;
  const wEc = pt.w_ecmwf !== undefined ? pt.w_ecmwf : 0.50;

  const inspectWeightGfs = document.getElementById("inspect-weight-gfs");
  if (inspectWeightGfs) inspectWeightGfs.textContent = wGfs.toFixed(2);
  const inspectWeightEc = document.getElementById("inspect-weight-ec");
  if (inspectWeightEc) inspectWeightEc.textContent = wEc.toFixed(2);
  const inspectWbarGfs = document.getElementById("inspect-wbar-gfs");
  if (inspectWbarGfs) inspectWbarGfs.style.width = `${Math.round(wGfs * 100)}%`;
  const inspectWbarEc = document.getElementById("inspect-wbar-ec");
  if (inspectWbarEc) inspectWbarEc.style.width = `${Math.round(wEc * 100)}%`;
  const inspectWeightDominant = document.getElementById("inspect-weight-dominant");
  if (inspectWeightDominant) {
    inspectWeightDominant.textContent = state.operationalMode === "live" ? "Consensus (Balanced)" : (pt.dominant_model || (wGfs > 0.55 ? "NOAA GFS Dominant" : wEc > 0.55 ? "ECMWF IFS Dominant" : "Consensus (Balanced)"));
  }

  const pillWeights = document.getElementById("inspect-weights-pill");
  if (pillWeights) pillWeights.textContent = `w_GFS: ${wGfs.toFixed(2)} • w_EC: ${wEc.toFixed(2)}`;

  // Context Attribution (Why Did Weights Change?)
  const attr = pt.attribution || {};
  const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  setEl("inspect-attr-base", (attr.base_regional_weight !== undefined ? attr.base_regional_weight : 0.50).toFixed(2));
  setEl("inspect-attr-lead", (attr.lead_time_adjustment !== undefined ? attr.lead_time_adjustment : 0.00).toFixed(2));
  setEl("inspect-attr-skill", (attr.historical_skill_delta !== undefined ? attr.historical_skill_delta : 0.00).toFixed(4));
  setEl("inspect-attr-regime", (attr.weather_regime_delta !== undefined ? attr.weather_regime_delta : 0.00).toFixed(2));
  setEl("inspect-attr-entropy", (pt.weight_entropy !== undefined ? pt.weight_entropy : 0.693).toFixed(3));
  setEl("inspect-attr-ai", (pt.delta_w_ai !== undefined ? pt.delta_w_ai : Math.abs(wGfs - 0.5)).toFixed(3));

  // Deterministic Extreme Weather Guidance Card
  const extCard = document.getElementById("inspect-extreme-card");
  const extBadge = document.getElementById("inspect-extreme-badge");
  const extLevel = document.getElementById("inspect-extreme-level");
  const extAgreement = document.getElementById("inspect-extreme-agreement");
  const extProtocol = document.getElementById("inspect-extreme-protocol");

  if (pt.extreme_guidance) {
    const eg = pt.extreme_guidance;
    if (extLevel) extLevel.textContent = eg.warning_level || "Normal";
    if (extAgreement) extAgreement.textContent = eg.model_agreement || "BELOW_WARNING_THRESHOLD";
    if (extProtocol) extProtocol.textContent = eg.protocol || "IMD Pune / New Delhi Standard";
    if (extBadge) {
      if (eg.is_exceeded) {
        extBadge.textContent = "WARNING EXCEEDED";
        extBadge.style.background = "rgba(220, 38, 38, 0.25)";
        extBadge.style.color = "#f87171";
        if (extCard) extCard.style.borderLeftColor = "#ef4444";
      } else {
        extBadge.textContent = "NO WARNING";
        extBadge.style.background = "rgba(34, 197, 94, 0.2)";
        extBadge.style.color = "#4ade80";
        if (extCard) extCard.style.borderLeftColor = "#10b981";
      }
    }
  }

  // Confidence Banner & Categorization (Sections 7, 8, 9)
  const banner = document.getElementById("inspect-conf-banner");
  const titleEl = document.getElementById("inspect-conf-title");
  const subtextEl = document.getElementById("inspect-conf-subtext");
  
  let regimeRange = "D < 0.11";
  let histMae = "2.02";
  let whyExplanation = "";

  const disVal = pt.disagreement !== undefined ? pt.disagreement : pt.disagreement_mm;
  const gfsVal = pt.gfs_val !== undefined ? pt.gfs_val : pt.gfs_mm;
  const ecVal = pt.ecmwf_val !== undefined ? pt.ecmwf_val : pt.ecmwf_mm;

  if (pt.confidence_class === "High Confidence") {
    if (banner) banner.className = "confidence-status-banner conf-banner-high";
    if (titleEl) titleEl.textContent = "HIGH CONFIDENCE";
    if (subtextEl) subtextEl.textContent = "Confidence is based on historical model disagreement and observed forecast error.";
    regimeRange = "D < 0.11";
    histMae = `2.02 ${varUnit}`;
    whyExplanation = `GFS (${gfsVal.toFixed(2)} ${varUnit}) and ECMWF (${ecVal.toFixed(2)} ${varUnit}) are in close consensus for this cell (${disVal.toFixed(2)} ${varUnit} disagreement). Historical evaluation found that smaller model disagreement was associated with smaller forecast error magnitude.`;
  } else if (pt.confidence_class === "Moderate Confidence") {
    if (banner) banner.className = "confidence-status-banner conf-banner-mod";
    if (titleEl) titleEl.textContent = "MODERATE CONFIDENCE";
    if (subtextEl) subtextEl.textContent = "Confidence is based on historical model disagreement and observed forecast error.";
    regimeRange = "0.11 ≤ D < 2.06";
    histMae = `3.75 ${varUnit}`;
    whyExplanation = `GFS (${gfsVal.toFixed(2)} ${varUnit}) and ECMWF (${ecVal.toFixed(2)} ${varUnit}) exhibit moderate difference for this cell (${disVal.toFixed(2)} ${varUnit} disagreement). Historical evaluation found that moderate model disagreement was associated with intermediate forecast error magnitude.`;
  } else {
    if (banner) banner.className = "confidence-status-banner conf-banner-low";
    if (titleEl) titleEl.textContent = "LOW CONFIDENCE";
    if (subtextEl) subtextEl.textContent = "Confidence is based on historical model disagreement and observed forecast error.";
    regimeRange = "D ≥ 2.06";
    histMae = `9.46 ${varUnit}`;
    whyExplanation = `GFS (${gfsVal.toFixed(2)} ${varUnit}) and ECMWF (${ecVal.toFixed(2)} ${varUnit}) differ substantially for this cell (${disVal.toFixed(2)} ${varUnit} disagreement). Historical evaluation found that larger model disagreement was associated with larger forecast error magnitude.`;
  }

  // Why This Confidence? Plain-Language Explanation (Section 8)
  const whyBody = document.getElementById("inspect-why-body");
  if (whyBody) whyBody.textContent = whyExplanation;

  // Clean Inspector Confidence Pill & MAE
  const inspectConfPill = document.getElementById("inspect-conf-pill");
  const inspectConfText = document.getElementById("inspect-conf-text");
  const inspectConfMae = document.getElementById("inspect-conf-mae");
  if (inspectConfText) inspectConfText.textContent = pt.confidence_class ? pt.confidence_class.replace(" Confidence", "") : "Moderate";
  if (inspectConfPill) {
    const cClass = pt.confidence_class === "High Confidence" ? "high" : pt.confidence_class === "Low Confidence" ? "low" : "mod";
    inspectConfPill.className = `conf-badge-pill ${cClass}`;
  }
  if (inspectConfMae) {
    inspectConfMae.textContent = pt.confidence_class === "High Confidence" ? `Hist. MAE: 2.02 ${varUnit}` : pt.confidence_class === "Low Confidence" ? `Hist. MAE: 9.46 ${varUnit}` : `Hist. MAE: 3.75 ${varUnit}`;
  }
  const inspectDisUnit = document.getElementById("inspect-dis-unit");
  if (inspectDisUnit) inspectDisUnit.textContent = varUnit;

  // Historical Evidence Grid (Section 9)
  const evD = document.getElementById("inspect-evidence-d");
  if (evD) evD.textContent = `${disVal.toFixed(2)} ${varUnit}`;
  const evRegime = document.getElementById("inspect-evidence-regime");
  if (evRegime) evRegime.textContent = regimeRange;
  const evMae = document.getElementById("inspect-evidence-mae");
  if (evMae) evMae.textContent = histMae;

  // Visual Model Comparison Bars (Section 11)
  const maxModelVal = Math.max(gfsVal, ecVal, valHero, 0.1);
  const barGfs = document.getElementById("inspect-vbar-gfs");
  const barEcmwf = document.getElementById("inspect-vbar-ecmwf");
  const barFused = document.getElementById("inspect-vbar-fused");
  if (barGfs) barGfs.style.width = `${Math.max(4, Math.min(100, (gfsVal / maxModelVal) * 100))}%`;
  if (barEcmwf) barEcmwf.style.width = `${Math.max(4, Math.min(100, (ecVal / maxModelVal) * 100))}%`;
  if (barFused) barFused.style.width = `${Math.max(4, Math.min(100, (valHero / maxModelVal) * 100))}%`;

  const vvalGfs = document.getElementById("inspect-gfs-val");
  if (vvalGfs) vvalGfs.textContent = `${gfsVal.toFixed(2)} ${varUnit}`;
  const vvalEcmwf = document.getElementById("inspect-ecmwf-val");
  if (vvalEcmwf) vvalEcmwf.textContent = `${ecVal.toFixed(2)} ${varUnit}`;
  const vvalFused = document.getElementById("inspect-compare-fused");
  if (vvalFused) vvalFused.textContent = `${Number(valHero).toFixed(2)} ${varUnit}`;

  const diffTag = document.getElementById("bar-diff-tag");
  if (diffTag) diffTag.textContent = `Spread D: ${disVal.toFixed(2)} ${varUnit}`;

  // Discrete Model Readings Grid
  const cardGfs = document.getElementById("card-gfs-val");
  if (cardGfs) cardGfs.textContent = `${gfsVal.toFixed(2)} ${varUnit}`;
  const cardEcmwf = document.getElementById("card-ecmwf-val");
  if (cardEcmwf) cardEcmwf.textContent = `${ecVal.toFixed(2)} ${varUnit}`;
  const cardFused = document.getElementById("card-fused-val");
  if (cardFused) cardFused.textContent = `${Number(valHero).toFixed(2)} ${varUnit}`;
  const cardDis = document.getElementById("card-dis-val");
  if (cardDis) cardDis.textContent = `${disVal.toFixed(2)} ${varUnit}`;

  // Retrospective IMD Verification Audit / Live Pending Notice
  const pendingBox = document.getElementById("inspect-live-pending-box");
  const retroGrid = document.getElementById("inspect-retro-stats-grid");
  const statusBadge = document.getElementById("inspect-verif-status-badge");
  const verifNote = document.getElementById("inspect-verif-note");
  const kickerEl = document.getElementById("inspect-verif-kicker");
  const headlineEl = document.getElementById("inspect-verif-headline");
  const pillEl = document.getElementById("inspect-verif-pill");

  if (state.operationalMode === "live") {
    // STRICT LIVE MODE RULE: Do NOT display a fake observation.
    if (kickerEl) kickerEl.textContent = "CURRENT NWP FORECAST";
    if (headlineEl) headlineEl.textContent = "IMD Retrospective Verification";
    if (pillEl) pillEl.textContent = "Live Run (Observations Pending)";
    if (pendingBox) {
      pendingBox.classList.remove("hidden");
      const validTextEl = document.getElementById("inspect-live-valid-text");
      if (validTextEl && state.currentGridData) {
        const validDate = new Date(state.currentGridData.valid_time_utc);
        const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        validTextEl.textContent = `${String(validDate.getUTCDate()).padStart(2, "0")} ${months[validDate.getUTCMonth()]} ${validDate.getUTCFullYear()} 00 UTC`;
      }
    }
    if (retroGrid) retroGrid.style.display = "none";
    if (statusBadge) statusBadge.style.display = "none";
    if (verifNote) verifNote.style.display = "none";
  } else {
    // RETROSPECTIVE 2024 MODE: Full observation comparison
    if (kickerEl) kickerEl.textContent = "HISTORICAL OBSERVATION";
    if (headlineEl) headlineEl.textContent = "IMD Retrospective Verification";
    if (pillEl) pillEl.textContent = "Strictly Causal (T-1)";
    if (pendingBox) pendingBox.classList.add("hidden");
    if (retroGrid) retroGrid.style.display = "grid";
    if (statusBadge) statusBadge.style.display = "flex";
    if (verifNote) verifNote.style.display = "block";

    if (pt.imd_mm !== null && pt.imd_mm !== undefined) {
      document.getElementById("inspect-imd-val").textContent = `${pt.imd_mm.toFixed(2)} mm`;
      const fusedValElem = document.getElementById("inspect-fused-compare-val");
      if (fusedValElem) fusedValElem.textContent = `${pt.fused_mm.toFixed(2)} mm`;

      const err = pt.fused_error_mm;
      document.getElementById("inspect-imd-err").textContent = `${err >= 0 ? "+" : ""}${err.toFixed(2)} mm`;

      statusBadge.className = "audit-verification-status";
      const statusText = document.getElementById("inspect-verif-status-text");
      if (err >= 0) {
        statusBadge.classList.add("status-over");
        if (statusText) statusText.textContent = `OVER-FORECAST (+${err.toFixed(2)} mm)`;
      } else {
        statusBadge.classList.add("status-under");
        if (statusText) statusText.textContent = `UNDER-FORECAST (${err.toFixed(2)} mm)`;
      }
    } else {
      document.getElementById("inspect-imd-val").textContent = "Pending Observation";
      const fusedValElem = document.getElementById("inspect-fused-compare-val");
      if (fusedValElem) fusedValElem.textContent = `${pt.fused_mm.toFixed(2)} mm`;
      document.getElementById("inspect-imd-err").textContent = "--";
      statusBadge.className = "audit-verification-status status-pending";
      const statusText = document.getElementById("inspect-verif-status-text");
      if (statusText) statusText.textContent = "Causal T-1 Ingestion Pending";
    }
  }

  // Technical Metadata
  document.getElementById("tech-cell-coords").textContent = `${pt.lat.toFixed(2)}°N, ${pt.lon.toFixed(2)}°E`;
  document.getElementById("tech-subregion").textContent = pt.subregion;
  document.getElementById("tech-dis-raw").textContent = `${pt.disagreement_mm.toFixed(2)} mm`;
  document.getElementById("tech-dis-norm").textContent = pt.disagreement_norm ? pt.disagreement_norm.toFixed(3) : "--";
  document.getElementById("tech-threshold-rule").textContent = pt.confidence_class === "High Confidence"
    ? "D < 0.11 mm -> High Confidence"
    : pt.confidence_class === "Moderate Confidence"
    ? "0.11 <= D < 2.06 mm -> Moderate"
    : "D >= 2.06 mm -> Low Confidence";
  document.getElementById("tech-regime").textContent = pt.predicted_regime || "Moderate";
}

function clearSelection() {
  state.selectedPoint = null;
  if (state.selectedCellHighlight) {
    state.map.removeLayer(state.selectedCellHighlight);
    state.selectedCellHighlight = null;
  }
  if (state.threeViewer) {
    state.threeViewer.clearHighlight();
  }
  document.getElementById("panel-cell-inspector").classList.add("hidden");
  document.getElementById("panel-domain-summary").classList.remove("hidden");
}

/* ========================================================
   QUICK DEMONSTRATION SHORTCUTS
   ======================================================== */
function inspectHighestDisagreementCell() {
  if (!state.currentGridData || !state.currentGridData.points) return;
  const sorted = [...state.currentGridData.points].sort((a, b) => b.disagreement_mm - a.disagreement_mm);
  if (sorted.length > 0) {
    const highestD = sorted[0];
    state.map.flyTo([highestD.lat, highestD.lon], 9, { duration: 0.8 });
    setTimeout(() => inspectCell(highestD), 850);
  }
}

function inspectPeakRainfallCell() {
  if (!state.currentGridData || !state.currentGridData.points) return;
  const sorted = [...state.currentGridData.points].sort((a, b) => b.fused_mm - a.fused_mm);
  if (sorted.length > 0) {
    const peak = sorted[0];
    state.map.flyTo([peak.lat, peak.lon], 9, { duration: 0.8 });
    setTimeout(() => inspectCell(peak), 850);
  }
}

/* ========================================================
   TIMELINE CONTROLS & PLAYBACK
   ======================================================== */
function stepDay(delta) {
  const currentIdx = state.allDates.findIndex((d) => d.date === state.currentDate);
  if (currentIdx === -1) return;
  const nextIdx = currentIdx + delta;
  if (nextIdx >= 0 && nextIdx < state.allDates.length) {
    state.currentDate = state.allDates[nextIdx].date;
    document.getElementById("date-picker").value = state.currentDate;
    updateDateDisplay();
    loadForecastForDate(state.currentDate);
  }
}

function togglePlay() {
  state.isPlaying = !state.isPlaying;
  const playIcon = document.getElementById("play-icon");
  const playText = document.getElementById("play-text");

  if (state.isPlaying) {
    playIcon.textContent = "⏸";
    playText.textContent = "Pause";
    state.playTimer = setInterval(() => {
      const currentIdx = state.allDates.findIndex((d) => d.date === state.currentDate);
      if (currentIdx === -1 || currentIdx >= state.allDates.length - 1) {
        // Loop back to start
        state.currentDate = state.allDates[0].date;
      } else {
        state.currentDate = state.allDates[currentIdx + 1].date;
      }
      document.getElementById("date-picker").value = state.currentDate;
      updateDateDisplay();
      loadForecastForDate(state.currentDate);
    }, 700);
  } else {
    playIcon.textContent = "▶";
    playText.textContent = "Play";
    if (state.playTimer) {
      clearInterval(state.playTimer);
      state.playTimer = null;
    }
  }
}

/* ========================================================
   VERIFICATION DATA TABLE POPULATION
   ======================================================== */
async function loadVerificationData() {
  try {
    const resSummary = await fetch("/api/verification/summary");
    if (resSummary.ok) {
      const json = await resSummary.json();
      if (json.status === "SUCCESS" && json.metrics) {
        populateSummaryTable(json.metrics);
      }
    }
  } catch (e) {
    console.warn("Summary table API unavailable:", e);
  }

  try {
    const resBins = await fetch("/api/verification/bins");
    if (resBins.ok) {
      const json = await resBins.json();
      if (json.status === "SUCCESS" && json.bins) {
        populateBinsTable(json.bins);
      }
    }
  } catch (e) {
    console.warn("Bins table API unavailable:", e);
  }

  try {
    const resAudit = await fetch("/api/v2/verification/audit");
    if (resAudit.ok) {
      const json = await resAudit.json();
      if (json.status === "SUCCESS" && json.audit) {
        console.log("Acceptance Gate Audit loaded:", json.audit.acceptance_status);
      }
    }
  } catch (e) {
    console.warn("Audit API unavailable:", e);
  }
}

function populateSummaryTable(rows) {
  const tbody = document.getElementById("tbody-period-metrics");
  if (!tbody) return;
  tbody.innerHTML = "";
  rows.forEach((r) => {
    const tr = document.createElement("tr");
    const period = r["Period"] || r.period || "--";
    const model = r["Model"] || r.model || "--";
    const n = Number(r["N"] || r.samples || 0).toLocaleString();
    const mae = Number(r["MAE (mm)"] || r.mae || 0).toFixed(3);
    const rmse = Number(r["RMSE (mm)"] || r.rmse || 0).toFixed(3);
    const bias = Number(r["Mean Bias (mm)"] || r.bias || 0).toFixed(3);
    const heavyMae = Number(r["Heavy-Rain MAE (mm)"] || r.heavy_mae || 0).toFixed(3);
    const p99 = Number(r["99th Pct Error (mm)"] || r.p99 || 0).toFixed(2);

    tr.innerHTML = `
      <td><strong>${period}</strong></td>
      <td>${model}</td>
      <td>${n}</td>
      <td><strong>${mae}</strong></td>
      <td>${rmse}</td>
      <td>${bias}</td>
      <td>${heavyMae}</td>
      <td>${p99}</td>
    `;
    tbody.appendChild(tr);
  });
}

function populateBinsTable(rows) {
  const tbody = document.getElementById("tbody-bin-metrics");
  if (!tbody) return;
  tbody.innerHTML = "";
  rows.forEach((r) => {
    const tr = document.createElement("tr");
    const period = r["Period"] ? `[${r["Period"]}] ` : "";
    const binName = `${period}${r["Disagreement Bin"] || r.bin || "--"} Disagreement`;
    const threshold = r["threshold"] || (r["Disagreement Bin"] === "Low" ? "D < 0.11 mm" : r["Disagreement Bin"] === "Medium" ? "0.11 <= D < 2.06 mm" : "D >= 2.06 mm");
    const n = Number(r["N"] || r.samples || 0).toLocaleString();
    const meanD = Number(r["Mean D (mm)"] || r.mean_d || 0).toFixed(2);
    const gfsMae = Number(r["GFS MAE (mm)"] || r.gfs_mae || 0).toFixed(2);
    const ecmwfMae = Number(r["ECMWF MAE (mm)"] || r.ecmwf_mae || 0).toFixed(2);
    const fusedMae = Number(r["50/50 MAE (mm)"] || r.fused_mae || 0).toFixed(2);
    const fusedRmse = Number(r["50/50 RMSE (mm)"] || r.fused_rmse || 0).toFixed(2);

    tr.innerHTML = `
      <td><strong>${binName}</strong></td>
      <td>${threshold}</td>
      <td>${n}</td>
      <td>${meanD} mm</td>
      <td>${gfsMae} mm</td>
      <td>${ecmwfMae} mm</td>
      <td><strong>${fusedMae} mm</strong></td>
      <td>${fusedRmse} mm</td>
    `;
    tbody.appendChild(tr);
  });
}

/* ========================================================
   JUDGE GUIDED TECHNICAL TOUR MODAL
   ======================================================== */
const DEMO_STEPS = [
  {
    step: 1,
    title: "1. Operational Problem & Domain Overview",
    desc: "Welcome to SIH26081. We solve the critical challenge of high-impact monsoon rainfall forecasting by fusing independent NWP models (NOAA GFS & ECMWF IFS) and providing explainable confidence based on physical model disagreement.",
    preview: "Domain: Andhra Pradesh & Telangana • 791 Terrestrial 0.25° Cells • June–August 2024 (92 Continuous Monsoon Days)."
  },
  {
    step: 2,
    title: "2. Dual-NWP Independent Ingestion",
    desc: "We ingest 00 UTC cycles from NOAA GFS (APCP surface) and ECMWF IFS (tp surface) at 0.25° spatial resolution with zero interpolation or data fabrication.",
    preview: "Orthogonal errors between dynamical cores allow a joint ensemble to cancel individual regional biases."
  },
  {
    step: 3,
    title: "3. Validated 50/50 Equal-Weight Centroid",
    desc: "Across the June–August evaluation period, the tested adaptive fusion did not demonstrate a robust MAE advantage over the 50/50 ensemble; therefore, equal-weight fusion was retained as the operational strategy.",
    preview: "Static equal weighting minimizes error variance without overfitting synoptic transitions."
  },
  {
    step: 4,
    title: "4. Calibrated Model Disagreement Engine",
    desc: "Disagreement D = |GFS - ECMWF| serves strictly as an empirical confidence indicator (Spearman ρ = 0.584 with error). Low disagreement (D < 0.11 mm) guarantees historical MAE of 2.02 mm, whereas high divergence (D ≥ 2.06 mm) corresponds to historical MAE of 9.46 mm.",
    preview: "Rule: Disagreement is never used to dynamically reweight forecasts; it is used transparently to communicate forecast uncertainty."
  },
  {
    step: 5,
    title: "5. Retrospective IMD Verification Audit",
    desc: "Forecasts are evaluated against IMD retrospective 0.25° gridded daily observations under strictly causal T-1 latency. Over 72,772 paired samples are verified out-of-sample.",
    preview: "Accounting for the 87.5% temporal overlap with IMD's 08:30 IST accumulation window."
  },
  {
    step: 6,
    title: "6. 3D Analytical Precipitation & Spread Workstation",
    desc: "Seamlessly toggle between the operational 2D map and the 3D analytical visualization. In 3D RAIN mode, vertical height communicates forecast rainfall (P_fused) over the native 0.25° grid. In 3D DISAGREEMENT mode, vertical height visualizes model divergence |GFS - ECMWF|, immediately exposing low-confidence regimes.",
    preview: "Vertical height represents forecast magnitude, not geographic elevation. Click any 3D cell to trigger the full Cell Inspector with dual-model spread and IMD retrospective verification."
  },
  {
    step: 7,
    title: "7. Interactive Decision Support Workstation",
    desc: "Operators and disaster management authorities can inspect any cell in AP and Telangana to review model consensus, explainable confidence reasons, and historical verification audits.",
    preview: "Use the Quick Demonstration shortcuts or click any point on the rainfall field to explore!"
  }
];

function startDemoTour() {
  state.demoStep = 1;
  updateDemoModal();
  document.getElementById("demo-overlay").classList.remove("hidden");
}

function closeDemoTour() {
  document.getElementById("demo-overlay").classList.add("hidden");
}

function stepDemo(delta) {
  state.demoStep += delta;
  if (state.demoStep < 1) state.demoStep = 1;
  if (state.demoStep > DEMO_STEPS.length) state.demoStep = DEMO_STEPS.length;
  updateDemoModal();
}

function updateDemoModal() {
  const current = DEMO_STEPS[state.demoStep - 1];
  document.getElementById("demo-step-title").textContent = current.title;
  document.getElementById("demo-step-desc").textContent = current.desc;
  document.getElementById("demo-step-preview").innerHTML = `<strong>Demonstration Context:</strong> ${current.preview}`;
  document.getElementById("demo-progress-text").textContent = `Step ${state.demoStep} of ${DEMO_STEPS.length}`;

  document.getElementById("btn-demo-prev").disabled = state.demoStep === 1;
  const nextBtn = document.getElementById("btn-demo-next");
  if (state.demoStep === DEMO_STEPS.length) {
    nextBtn.textContent = "Finish Tour ✓";
    nextBtn.onclick = closeDemoTour;
  } else {
    nextBtn.textContent = "Next Step ▶";
    nextBtn.onclick = () => stepDemo(1);
  }

  // Update dots
  document.querySelectorAll(".step-dot").forEach((dot) => {
    const s = parseInt(dot.dataset.step, 10);
    dot.classList.toggle("active", s === state.demoStep);
  });
}

/* ========================================================
   MODAL ERROR DIALOG
   ======================================================== */
function showErrorModal(title, message, details) {
  document.getElementById("error-modal-title").textContent = title;
  document.getElementById("error-modal-msg").textContent = message;
  document.getElementById("error-modal-details").textContent = details;
  document.getElementById("error-modal").classList.remove("hidden");
}

function hideErrorModal() {
  document.getElementById("error-modal").classList.add("hidden");
}
