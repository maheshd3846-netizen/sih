/**
  AETHERA — Adaptive Multi-Model Weather Intelligence Workstation (SIH26081)
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
  labelsTileLayer: null,
  stationLayerGroup: null,
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

// Basemap Tiles (Esri World Gray Base + Reference — High-legibility, Zero-watermark GIS Cartography)
const TILES = {
  light: {
    base: "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}",
    labels: "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}",
    attribution: "Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ",
    subdomains: ["a", "b", "c"]
  },
  dark: {
    base: "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}",
    labels: "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}",
    attribution: "Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ",
    subdomains: ["a", "b", "c"]
  }
};

// Meteorological Reference Stations & Regional Urban Centres (AP & Telangana)
const METEOROLOGICAL_STATIONS = [
  { name: "Hyderabad", lat: 17.3850, lon: 78.4867, role: "IMD Meteorological Centre (MC)", subregion: "Telangana" },
  { name: "Visakhapatnam", lat: 17.6868, lon: 83.2185, role: "Cyclone Warning Centre (CWC)", subregion: "Coastal Andhra Pradesh" },
  { name: "Vijayawada", lat: 16.5062, lon: 80.6480, role: "Radar & Meteorological Station", subregion: "Coastal Andhra Pradesh" },
  { name: "Amaravati", lat: 16.5131, lon: 80.5165, role: "State Capital Agro-Met Observatory", subregion: "Coastal Andhra Pradesh" },
  { name: "Tirupati", lat: 13.6288, lon: 79.4192, role: "IMD Synoptic Observatory", subregion: "Rayalaseema" },
  { name: "Kurnool", lat: 15.8281, lon: 78.0373, role: "Rayalaseema Meteorological Station", subregion: "Rayalaseema" },
  { name: "Warangal", lat: 17.9689, lon: 79.5941, role: "North Telangana Agro-Met Station", subregion: "Telangana" },
  { name: "Rajahmundry", lat: 17.0005, lon: 81.8040, role: "Godavari Basin Hydromet Station", subregion: "Coastal Andhra Pradesh" },
  { name: "Nellore", lat: 14.4426, lon: 79.9865, role: "Coastal Cyclone Station", subregion: "Coastal Andhra Pradesh" },
  { name: "Nizamabad", lat: 18.6725, lon: 78.0941, role: "North Telangana Observatory", subregion: "Telangana" },
  { name: "Kadapa", lat: 14.4673, lon: 78.8241, role: "Central Rayalaseema Station", subregion: "Rayalaseema" },
  { name: "Anantapur", lat: 14.6819, lon: 77.6006, role: "Semi-Arid Zone Met Station", subregion: "Rayalaseema" },
  { name: "Kakinada", lat: 16.9891, lon: 82.2475, role: "Deep-Water Port Weather Radar", subregion: "Coastal Andhra Pradesh" },
  { name: "Khammam", lat: 17.2473, lon: 80.1514, role: "Telangana Valley Met Station", subregion: "Telangana" },
];

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

  const popoverWrapper = document.querySelector(".layers-popover-wrapper");
  const miniGroup = document.querySelector(".map-util-mini-group");
  const contextBadge = document.getElementById("map-context-badge");
  if (popoverWrapper) popoverWrapper.classList.toggle("hidden", dim === "3d");
  if (miniGroup) miniGroup.classList.toggle("hidden", dim === "3d");
  if (contextBadge) contextBadge.classList.toggle("hidden", dim === "3d");

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
  } else if (state.threeMode === "temperature" || state.activeVariable === "temperature") {
    noteElem.innerHTML = "<strong>3D TEMPERATURE:</strong> Height = forecast temperature magnitude &bull; Color = temperature (Z-axis is a visualization coordinate only).";
  } else if (state.threeMode === "wind" || state.activeVariable === "wind") {
    noteElem.innerHTML = "<strong>3D WIND:</strong> Height = wind-speed magnitude &bull; Color = wind speed (Z-axis is a visualization coordinate only).";
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
      helperEl.innerHTML = `Height = forecast rainfall magnitude &bull; Color = intensity. Click any column to inspect.`;
    } else if (state.threeMode === "disagreement") {
      titleEl.textContent = `3D MODEL DISAGREEMENT (${leadTag})`;
      unitEl.textContent = `|GFS − ECMWF| (${varUnit})`;
      helperEl.innerHTML = "Height = inter-model disagreement &bull; Color = disagreement intensity. Higher disagreement indicates a lower empirical-confidence regime.";
    } else if (state.threeMode === "temperature") {
      titleEl.textContent = `3D ${varName} (${leadTag})`;
      unitEl.textContent = varUnit;
      helperEl.innerHTML = `Height = forecast temperature magnitude &bull; Color = temperature. Click any column to inspect.`;
    } else if (state.threeMode === "wind") {
      titleEl.textContent = `3D ${varName} (${leadTag})`;
      unitEl.textContent = varUnit;
      helperEl.innerHTML = `Height = wind-speed magnitude &bull; Color = wind speed. Click any column to inspect.`;
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
   MAP INITIALIZATION & CARTOGRAPHIC GIS ENVIRONMENT
   ======================================================== */
function initMap() {
  state.map = L.map("map", {
    center: [16.2, 80.2],
    zoom: 7,
    minZoom: 6,
    maxZoom: 12,
    zoomControl: false, // Custom position
  });

  // Zoom control bottom-right
  L.control.zoom({ position: "bottomright" }).addTo(state.map);

  // Dedicated Leaflet pane for geographic labels above the weather overlay
  state.map.createPane("labelsPane");
  state.map.getPane("labelsPane").style.zIndex = 450;
  state.map.getPane("labelsPane").style.pointerEvents = "none";

  // Base tile layer (underneath weather overlay)
  const baseOpts = { attribution: TILES.light.attribution, maxZoom: 16 };
  if (TILES.light.subdomains) baseOpts.subdomains = TILES.light.subdomains;
  state.baseTileLayer = L.tileLayer(TILES.light.base, baseOpts).addTo(state.map);

  // Labels & boundaries tile layer (on top of weather overlay)
  const labelOpts = { pane: "labelsPane", maxZoom: 16 };
  if (TILES.light.subdomains) labelOpts.subdomains = TILES.light.subdomains;
  state.labelsTileLayer = L.tileLayer(TILES.light.labels, labelOpts).addTo(state.map);

  // Layer groups for boundaries, station markers, gridlines, interactive hits
  state.boundaryLayerGroup = L.layerGroup().addTo(state.map);
  state.stationLayerGroup = L.layerGroup().addTo(state.map);
  state.gridLinesLayerGroup = L.layerGroup().addTo(state.map);
  state.interactiveLayerGroup = L.layerGroup().addTo(state.map);

  renderStationMarkers();

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

function renderStationMarkers() {
  if (!state.stationLayerGroup) return;
  state.stationLayerGroup.clearLayers();

  METEOROLOGICAL_STATIONS.forEach((st) => {
    const isDark = state.isDarkMode;
    const ringColor = isDark ? "#38bdf8" : "#0284c7";
    const fillColor = isDark ? "rgba(56, 189, 248, 0.28)" : "rgba(2, 132, 199, 0.22)";

    const iconHtml = `
      <div class="gis-station-marker" style="width: 14px; height: 14px; display: flex; align-items: center; justify-content: center; cursor: pointer; pointer-events: auto;">
        <div style="width: 10px; height: 10px; border-radius: 50%; background: ${fillColor}; border: 1.5px solid ${ringColor}; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 4px rgba(0,0,0,0.35);">
          <div style="width: 3px; height: 3px; border-radius: 50%; background: #ffffff;"></div>
        </div>
      </div>
    `;

    const customIcon = L.divIcon({
      html: iconHtml,
      className: "met-station-icon-wrapper",
      iconSize: [14, 14],
      iconAnchor: [7, 7],
    });

    const marker = L.marker([st.lat, st.lon], {
      icon: customIcon,
      pane: "labelsPane",
      interactive: true,
    });

    marker.bindTooltip(`
      <div style="font-family: var(--font-sans); font-size: 11px; padding: 3px 5px; line-height: 1.4;">
        <div style="font-weight: 700; color: #0284c7; font-size: 11.5px;">${st.name}</div>
        <div style="font-size: 10px; color: #475569; font-weight: 600;">${st.subregion}</div>
        <div style="font-size: 9.5px; color: #64748b; margin-top: 1px;">${st.role}</div>
        <div style="margin-top: 4px; padding-top: 3px; border-top: 1px solid #e2e8f0; font-size: 9.5px; color: #0284c7; font-weight: 600;">Click to inspect 0.25° forecast cell</div>
      </div>
    `, { sticky: true, opacity: 0.95 });

    marker.on("click", (e) => {
      L.DomEvent.stopPropagation(e);
      if (state.currentGridData && state.currentGridData.points) {
        const snappedLat = Math.round(st.lat * 4) / 4;
        const snappedLon = Math.round(st.lon * 4) / 4;
        const matched = state.currentGridData.points.find(
          (p) => Math.abs(p.lat - snappedLat) < 0.13 && Math.abs(p.lon - snappedLon) < 0.13
        );
        if (matched) inspectCell(matched);
      }
    });

    state.stationLayerGroup.addLayer(marker);
  });
}

function toggleBasemap() {
  state.isDarkMode = !state.isDarkMode;
  const btn = document.getElementById("btn-basemap-toggle");
  if (btn) btn.classList.toggle("active", state.isDarkMode);
  const config = state.isDarkMode ? TILES.dark : TILES.light;

  if (state.baseTileLayer) state.map.removeLayer(state.baseTileLayer);
  if (state.labelsTileLayer) state.map.removeLayer(state.labelsTileLayer);

  const baseOpts = { attribution: config.attribution, maxZoom: 16 };
  if (config.subdomains) baseOpts.subdomains = config.subdomains;
  state.baseTileLayer = L.tileLayer(config.base, baseOpts).addTo(state.map);

  const labelOpts = { pane: "labelsPane", maxZoom: 16 };
  if (config.subdomains) labelOpts.subdomains = config.subdomains;
  state.labelsTileLayer = L.tileLayer(config.labels, labelOpts).addTo(state.map);

  renderStationMarkers();
  renderGridLines();
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
      pane: "labelsPane",
      filter: (f) => f.properties && f.properties.name !== "All Domain",
      style: {
        color: state.isDarkMode ? "rgba(148, 163, 184, 0.45)" : "rgba(71, 85, 105, 0.4)",
        weight: 1.0,
        opacity: 0.55,
        fill: false,
        dashArray: "3, 4",
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
  const btnInspectD = document.getElementById("btn-inspect-highest-d");
  if (btnInspectD) btnInspectD.addEventListener("click", inspectHighestDisagreementCell);
  const btnInspectRain = document.getElementById("btn-inspect-peak-rain");
  if (btnInspectRain) btnInspectRain.addEventListener("click", inspectPeakRainfallCell);

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

    const footerPill = document.getElementById("footer-mode-pill");
    const footerK = document.getElementById("footer-mode-k");
    const footerV = document.getElementById("footer-mode-v");
    if (footerPill) {
      footerPill.className = "status-pill status-pill-live";
      footerPill.title = "Current live operational NWP run";
    }
    if (footerK) footerK.textContent = "Mode:";
    if (footerV) footerV.textContent = "Live Operational NWP Feed (Current 00Z NOAA GFS + ECMWF IFS)";

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

    const footerPill = document.getElementById("footer-mode-pill");
    const footerK = document.getElementById("footer-mode-k");
    const footerV = document.getElementById("footer-mode-v");
    if (footerPill) {
      footerPill.className = "status-pill status-pill-retro";
      footerPill.title = "Retrospective 2024 monsoon historical verification mode";
    }
    if (footerK) footerK.textContent = "Notice:";
    if (footerV) footerV.textContent = "Retrospective Demonstration (Jun–Aug 2024) • Verified Historical Analysis";

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
  let dateFormatted = "";
  const rawDateStr = data.forecast_date || data.valid_time_utc || data.initialization_time_utc || state.currentDate;
  if (rawDateStr) {
    const d = new Date(rawDateStr.includes("T") ? rawDateStr : rawDateStr + "T00:00:00Z");
    if (!isNaN(d.getTime())) {
      const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
      dateFormatted = `${String(d.getUTCDate()).padStart(2, "0")} ${months[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
    }
  }

  const dateBadge = document.getElementById("summary-date-badge");
  if (dateBadge && dateFormatted) dateBadge.textContent = dateFormatted;
  const regionLabel = document.getElementById("summary-region-label");
  if (regionLabel) {
    if (state.operationalMode === "live") {
      regionLabel.textContent = "Current 24-Hour NWP Forecast";
    } else {
      regionLabel.textContent = state.activeRegion === "All" ? "AP & Telangana Domain" : state.activeRegion;
    }
  }
  const summaryKicker = document.querySelector("#panel-domain-summary .panel-kicker");
  if (summaryKicker) {
    summaryKicker.textContent = `OPERATIONAL OVERVIEW • ${total} CELLS`;
  }

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
   METEOROLOGICAL COLOR CALIBRATION & SCALAR EXTRACTION
   ======================================================== */
function getScalarValue(pt, layer, variable) {
  if (layer === "disagreement") {
    return pt.disagreement !== undefined ? pt.disagreement : pt.disagreement_mm;
  }
  if (layer === "w_gfs") {
    return pt.w_gfs !== undefined ? pt.w_gfs : 0.50;
  }
  if (layer === "w_ecmwf") {
    return pt.w_ecmwf !== undefined ? pt.w_ecmwf : 0.50;
  }
  if (layer === "dominant_model") {
    const dom = pt.dominant_model || "Consensus";
    if (dom.includes("GFS")) return -1.0;
    if (dom.includes("ECMWF")) return 1.0;
    return 0.0;
  }
  if (layer === "weight_entropy") {
    return pt.weight_entropy !== undefined ? pt.weight_entropy : 0.693;
  }
  if (layer === "extreme_guidance") {
    if (pt.extreme_guidance && pt.extreme_guidance.is_exceeded) {
      return pt.extreme_guidance.severity_score || 1;
    }
    return 0;
  }
  if (layer === "confidence") {
    const dVal = pt.disagreement !== undefined ? pt.disagreement : pt.disagreement_mm;
    return dVal;
  }

  // Continuous forecast layers
  let val = pt.blend_val !== undefined ? pt.blend_val : pt.fused_mm;
  if (layer === "fused") val = pt.baseline_val !== undefined ? pt.baseline_val : pt.fused_mm;
  else if (layer === "gfs") val = pt.gfs_val !== undefined ? pt.gfs_val : pt.gfs_mm;
  else if (layer === "ecmwf") val = pt.ecmwf_val !== undefined ? pt.ecmwf_val : pt.ecmwf_mm;
  else if (layer === "imd") {
    val = pt.obs_val !== undefined ? pt.obs_val : (pt.imd_mm !== null ? pt.imd_mm : 0.0);
  }
  return val;
}

// Continuous Color Ramp Interpolation with Controlled Opacity
function getContinuousColor(val, layer, variable) {
  if (val === undefined || isNaN(val)) return [0, 0, 0, 0];

  // 1. Inter-Model Disagreement
  if (layer === "disagreement") {
    const stops = [
      { val: 0.0,  r: 165, g: 180, b: 252, a: 0.18 },
      { val: 0.11, r: 59,  g: 130, b: 246, a: 0.55 },
      { val: 2.06, r: 245, g: 158, b: 11,  a: 0.75 },
      { val: 5.0,  r: 234, g: 88,  b: 12,  a: 0.82 },
      { val: 10.0, r: 220, g: 38,  b: 38,  a: 0.88 },
      { val: 25.0, r: 126, g: 34,  b: 206, a: 0.92 },
    ];
    return interpolatePiecewise(val, stops);
  }

  // 2. Simplex Model Weights
  if (layer === "w_gfs" || layer === "w_ecmwf") {
    const stops = [
      { val: 0.00, r: 12,  g: 74,  b: 110, a: 0.85 },
      { val: 0.42, r: 2,   g: 132, b: 199, a: 0.75 },
      { val: 0.50, r: 100, g: 116, b: 139, a: 0.65 },
      { val: 0.58, r: 245, g: 158, b: 11,  a: 0.75 },
      { val: 0.70, r: 234, g: 88,  b: 12,  a: 0.82 },
      { val: 1.00, r: 194, g: 65,  b: 12,  a: 0.88 },
    ];
    return interpolatePiecewise(val, stops);
  }

  // 3. Dominant Model
  if (layer === "dominant_model") {
    if (val < -0.2) return [2, 132, 199, 0.82]; // GFS blue
    if (val > 0.2) return [217, 119, 6, 0.82];  // ECMWF amber
    return [13, 148, 136, 0.78];                // Balanced teal
  }

  // 4. Weight Entropy
  if (layer === "weight_entropy") {
    const stops = [
      { val: 0.60, r: 14,  g: 165, b: 233, a: 0.80 },
      { val: 0.67, r: 245, g: 158, b: 11,  a: 0.80 },
      { val: 0.693, r: 126, g: 34,  b: 206, a: 0.85 },
    ];
    return interpolatePiecewise(val, stops);
  }

  // 5. Extreme Guidance
  if (layer === "extreme_guidance") {
    if (val >= 3) return [126, 34, 206, 0.92];
    if (val >= 2) return [220, 38, 38, 0.86];
    if (val >= 1) return [234, 88, 12, 0.80];
    return [16, 185, 129, 0.20];
  }

  // 6. Empirical Confidence
  if (layer === "confidence") {
    const stops = [
      { val: 0.0,  r: 16,  g: 185, b: 129, a: 0.72 },
      { val: 0.10, r: 16,  g: 185, b: 129, a: 0.72 },
      { val: 0.12, r: 245, g: 158, b: 11,  a: 0.74 },
      { val: 2.05, r: 245, g: 158, b: 11,  a: 0.74 },
      { val: 2.07, r: 220, g: 38,  b: 38,  a: 0.82 },
      { val: 10.0, r: 220, g: 38,  b: 38,  a: 0.82 },
    ];
    return interpolatePiecewise(val, stops);
  }

  // 7. Temperature Variable
  if (variable === "temperature") {
    const stops = [
      { val: 10.0, r: 59,  g: 130, b: 246, a: 0.65 },
      { val: 16.0, r: 59,  g: 130, b: 246, a: 0.68 },
      { val: 24.0, r: 6,   g: 182, b: 212, a: 0.72 },
      { val: 32.0, r: 16,  g: 185, b: 129, a: 0.75 },
      { val: 38.0, r: 245, g: 158, b: 11,  a: 0.80 },
      { val: 42.0, r: 234, g: 88,  b: 12,  a: 0.84 },
      { val: 45.0, r: 220, g: 38,  b: 38,  a: 0.88 },
      { val: 50.0, r: 126, g: 34,  b: 206, a: 0.92 },
    ];
    return interpolatePiecewise(val, stops);
  }

  // 8. Wind Variable
  if (variable === "wind") {
    const stops = [
      { val: 0.0,  r: 56,  g: 189, b: 248, a: 0.15 },
      { val: 15.0, r: 16,  g: 185, b: 129, a: 0.60 },
      { val: 30.0, r: 245, g: 158, b: 11,  a: 0.72 },
      { val: 45.0, r: 234, g: 88,  b: 12,  a: 0.80 },
      { val: 62.0, r: 220, g: 38,  b: 38,  a: 0.86 },
      { val: 88.0, r: 126, g: 34,  b: 206, a: 0.92 },
    ];
    return interpolatePiecewise(val, stops);
  }

  // 9. Standard Precipitation Field (Smooth continuous meteorological field)
  // Preserves exact scientifically defined thresholds
  const rainStops = [
    { val: 0.0,  r: 241, g: 245, b: 249, a: 0.00 }, // Dry: transparent
    { val: 0.1,  r: 125, g: 211, b: 252, a: 0.42 }, // Trace (< 2.5 mm)
    { val: 2.5,  r: 37,  g: 99,  b: 235, a: 0.64 }, // Light (2.5 - 7.5 mm)
    { val: 7.5,  r: 22,  g: 163, b: 74,  a: 0.74 }, // Moderate (7.5 - 15 mm)
    { val: 15.0, r: 234, g: 88,  b: 12,  a: 0.82 }, // Heavy (15 - 35 mm)
    { val: 35.0, r: 220, g: 38,  b: 38,  a: 0.88 }, // Very Heavy (35 - 65 mm)
    { val: 65.0, r: 126, g: 34,  b: 206, a: 0.92 }, // Extreme (>= 65 mm)
  ];
  return interpolatePiecewise(val, rainStops);
}

function interpolatePiecewise(val, stops) {
  if (val <= stops[0].val) {
    const s = stops[0];
    return [s.r, s.g, s.b, s.a];
  }
  const last = stops[stops.length - 1];
  if (val >= last.val) {
    return [last.r, last.g, last.b, last.a];
  }

  for (let i = 0; i < stops.length - 1; i++) {
    const s0 = stops[i];
    const s1 = stops[i + 1];
    if (val >= s0.val && val <= s1.val) {
      const t = (val - s0.val) / (s1.val - s0.val);
      const r = Math.round(s0.r + t * (s1.r - s0.r));
      const g = Math.round(s0.g + t * (s1.g - s0.g));
      const b = Math.round(s0.b + t * (s1.b - s0.b));
      const a = s0.a + t * (s1.a - s0.a);
      return [r, g, b, a];
    }
  }
  return [last.r, last.g, last.b, last.a];
}

// Retained for 3D Viewer & backward compatibility
function getPointColorAndOpacity(point) {
  const layer = state.activeLayer;
  if (layer === "confidence") {
    const confItem = PALETTES.confidence.find((c) => c.key === point.confidence_class);
    return { color: confItem ? confItem.color : "#94a3b8", opacity: 0.85 };
  }
  const val = getScalarValue(point, layer, state.activeVariable);
  const rgba = getContinuousColor(val, layer, state.activeVariable);
  return {
    color: `rgb(${rgba[0]}, ${rgba[1]}, ${rgba[2]})`,
    opacity: rgba[3],
    val: val
  };
}

/* ========================================================
   MAP PRESENTATION RENDERING (Continuous Interpolated Field & Interactive Hits)
   ======================================================== */
function renderGrid() {
  if (!state.currentGridData || !state.currentGridData.points) return;

  const minLat = DOMAIN_BOUNDS.latMin;
  const maxLat = DOMAIN_BOUNDS.latMax;
  const minLon = DOMAIN_BOUNDS.lonMin;
  const maxLon = DOMAIN_BOUNDS.lonMax;

  const latSpan = maxLat - minLat;
  const lonSpan = maxLon - minLon;

  // Build 33x37 regular grid matrix for O(1) continuous spatial sampling
  const gridRows = 33;
  const gridCols = 37;
  const scalarGrid = new Array(gridRows);
  for (let r = 0; r < gridRows; r++) {
    scalarGrid[r] = new Float32Array(gridCols).fill(NaN);
  }

  const layer = state.activeLayer;
  const variable = state.activeVariable;

  state.currentGridData.points.forEach((pt) => {
    if (state.activeRegion !== "All" && pt.subregion !== state.activeRegion) {
      return;
    }
    const r = Math.round((pt.lat - 12.0) * 4);
    const c = Math.round((pt.lon - 76.0) * 4);
    if (r >= 0 && r < gridRows && c >= 0 && c < gridCols) {
      scalarGrid[r][c] = getScalarValue(pt, layer, variable);
    }
  });

  // Offscreen canvas for continuous raster interpolation
  const canvas = document.createElement("canvas");
  const cWidth = 740;
  const cHeight = 660;
  canvas.width = cWidth;
  canvas.height = cHeight;
  const ctx = canvas.getContext("2d");

  const imgData = ctx.createImageData(cWidth, cHeight);
  const buf32 = new Uint32Array(imgData.data.buffer);

  for (let py = 0; py < cHeight; py++) {
    const lat = maxLat - (py / cHeight) * latSpan;
    const rowF = (lat - 12.0) * 4;
    const r0 = Math.floor(rowF);
    const r1 = r0 + 1;
    const dr = rowF - r0;

    for (let px = 0; px < cWidth; px++) {
      const lon = minLon + (px / cWidth) * lonSpan;
      const colF = (lon - 76.0) * 4;
      const c0 = Math.floor(colF);
      const c1 = c0 + 1;
      const dc = colF - c0;

      // Check 4 neighbor nodes
      const v00 = (r0 >= 0 && r0 < gridRows && c0 >= 0 && c0 < gridCols) ? scalarGrid[r0][c0] : NaN;
      const v01 = (r0 >= 0 && r0 < gridRows && c1 >= 0 && c1 < gridCols) ? scalarGrid[r0][c1] : NaN;
      const v10 = (r1 >= 0 && r1 < gridRows && c0 >= 0 && c0 < gridCols) ? scalarGrid[r1][c0] : NaN;
      const v11 = (r1 >= 0 && r1 < gridRows && c1 >= 0 && c1 < gridCols) ? scalarGrid[r1][c1] : NaN;

      const n00Valid = !isNaN(v00);
      const n01Valid = !isNaN(v01);
      const n10Valid = !isNaN(v10);
      const n11Valid = !isNaN(v11);

      const validCount = (n00Valid ? 1 : 0) + (n01Valid ? 1 : 0) + (n10Valid ? 1 : 0) + (n11Valid ? 1 : 0);
      if (validCount === 0) continue;

      let minDist = 999;
      if (n00Valid) minDist = Math.min(minDist, Math.hypot(dr, dc));
      if (n01Valid) minDist = Math.min(minDist, Math.hypot(dr, dc - 1));
      if (n10Valid) minDist = Math.min(minDist, Math.hypot(dr - 1, dc));
      if (n11Valid) minDist = Math.min(minDist, Math.hypot(dr - 1, dc - 1));

      // Domain mask: Outside the valid domain, do not show forecast colors
      if (minDist > 0.88) continue;

      let feather = 1.0;
      if (minDist > 0.45) {
        feather = 0.5 * (1.0 + Math.cos(Math.PI * (minDist - 0.45) / (0.88 - 0.45)));
      }

      let interpolatedVal = 0;
      if (validCount === 4) {
        // C1 continuous bicubic / smoothstep hermite interpolation
        const u = dr * dr * (3 - 2 * dr);
        const v = dc * dc * (3 - 2 * dc);
        interpolatedVal = (1 - u) * (1 - v) * v00 +
                          (1 - u) * v * v01 +
                          u * (1 - v) * v10 +
                          u * v * v11;
      } else {
        // Boundary weighted interpolation
        let wSum = 0;
        let vSum = 0;
        if (n00Valid) {
          const w = Math.max(0, 1 - Math.hypot(dr, dc) / 1.414);
          const wSq = w * w;
          wSum += wSq; vSum += v00 * wSq;
        }
        if (n01Valid) {
          const w = Math.max(0, 1 - Math.hypot(dr, dc - 1) / 1.414);
          const wSq = w * w;
          wSum += wSq; vSum += v01 * wSq;
        }
        if (n10Valid) {
          const w = Math.max(0, 1 - Math.hypot(dr - 1, dc) / 1.414);
          const wSq = w * w;
          wSum += wSq; vSum += v10 * wSq;
        }
        if (n11Valid) {
          const w = Math.max(0, 1 - Math.hypot(dr - 1, dc - 1) / 1.414);
          const wSq = w * w;
          wSum += wSq; vSum += v11 * wSq;
        }
        interpolatedVal = wSum > 0 ? (vSum / wSum) : 0;
      }

      const rgba = getContinuousColor(interpolatedVal, layer, variable);
      const alpha = Math.round(rgba[3] * feather * 255);
      if (alpha > 0) {
        const idx = py * cWidth + px;
        buf32[idx] = (alpha << 24) | (rgba[2] << 16) | (rgba[1] << 8) | rgba[0];
      }
    }
  }

  ctx.putImageData(imgData, 0, 0);

  // Update or add Leaflet ImageOverlay at zIndex: 350
  const imgDataUrl = canvas.toDataURL();
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
    zIndex: 350,
  }).addTo(state.map);

  // 2. Clear & rebuild invisible interactive grid hits for cell inspection & hover tooltips
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

    const hitRect = L.rectangle(cellBounds, {
      stroke: false,
      fillColor: "#000000",
      fillOpacity: 0.0,
      interactive: true,
    });

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

  // Render high zoom graticule if active
  renderGridLines();
}

function renderGridLines() {
  state.gridLinesLayerGroup.clearLayers();
  if (!state.showGridLines || !state.currentGridData || !state.currentGridData.points) return;

  const graticuleStyle = {
    color: state.isDarkMode ? "rgba(148, 163, 184, 0.28)" : "rgba(71, 85, 105, 0.25)",
    weight: 0.5,
    dashArray: "2, 4",
    interactive: false,
    pane: "labelsPane"
  };

  // Parallels (every 0.25°)
  for (let lat = 12.0; lat <= 20.01; lat += 0.25) {
    const isMajor = Math.abs(lat - Math.round(lat)) < 0.01;
    const line = L.polyline([
      [lat, 76.0],
      [lat, 85.0]
    ], {
      ...graticuleStyle,
      weight: isMajor ? 0.75 : 0.45,
      color: isMajor 
        ? (state.isDarkMode ? "rgba(148, 163, 184, 0.38)" : "rgba(71, 85, 105, 0.35)") 
        : graticuleStyle.color
    });
    state.gridLinesLayerGroup.addLayer(line);
  }

  // Meridians (every 0.25°)
  for (let lon = 76.0; lon <= 85.01; lon += 0.25) {
    const isMajor = Math.abs(lon - Math.round(lon)) < 0.01;
    const line = L.polyline([
      [12.0, lon],
      [20.0, lon]
    ], {
      ...graticuleStyle,
      weight: isMajor ? 0.75 : 0.45,
      color: isMajor 
        ? (state.isDarkMode ? "rgba(148, 163, 184, 0.38)" : "rgba(71, 85, 105, 0.35)") 
        : graticuleStyle.color
    });
    state.gridLinesLayerGroup.addLayer(line);
  }
}

/* ========================================================
   FLOATING METEOROLOGICAL COLOR BAR LEGEND
   ======================================================== */
function updateLegend() {
  const container = document.getElementById("map-legend");
  if (!container) return;

  const varUnit = state.activeVariable === "temperature" ? "°C" : state.activeVariable === "wind" ? "km/h" : "mm / 24h";

  // 3D Specific Analytical Legend
  if (state.viewDimension === "3d") {
    if (state.threeMode !== "disagreement") {
      let html = `
        <div class="legend-title">3D ${state.activeVariable.toUpperCase()}</div>
        <div class="legend-3d-dims">
          <div class="dim-row"><span class="dim-k">HEIGHT:</span><span class="dim-v">${state.activeVariable === "temperature" ? "Forecast temperature magnitude (°C)" : state.activeVariable === "wind" ? "Wind-speed magnitude (km/h)" : `Forecast rainfall magnitude (${varUnit})`}</span></div>
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
      const legend3dNote = state.activeVariable === "temperature" ? "Height = forecast temperature magnitude." : state.activeVariable === "wind" ? "Height = wind-speed magnitude." : "Height = forecast rainfall magnitude.";
      html += `<div class="legend-3d-note">${legend3dNote}</div>`;
      container.innerHTML = html;
      return;
    } else {
      let html = `
        <div class="legend-title">3D MODEL DISAGREEMENT</div>
        <div class="legend-3d-dims">
          <div class="dim-row"><span class="dim-k">HEIGHT:</span><span class="dim-v">Inter-model disagreement |GFS − ECMWF| (${varUnit})</span></div>
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
      html += `<div class="legend-3d-note">Height = inter-model disagreement.</div>`;
      container.innerHTML = html;
      return;
    }
  }

  // 2D Map Continuous Color Bar Legend
  const layer = state.activeLayer;

  // 1. Rainfall Field Color Bar
  if (state.activeVariable === "precipitation" && ["blended", "fused", "gfs", "ecmwf", "imd"].includes(layer)) {
    let layerLabel = "Rainfall Intensity";
    if (layer === "blended") layerLabel = "Context-Aware Blend";
    else if (layer === "fused") layerLabel = "50/50 Baseline";
    else if (layer === "gfs") layerLabel = "NOAA GFS Forecast";
    else if (layer === "ecmwf") layerLabel = "ECMWF IFS Forecast";
    else if (layer === "imd") layerLabel = "IMD Retrospective Obs";

    container.innerHTML = `
      <div class="met-colorbar-card">
        <div class="colorbar-head">
          <div class="colorbar-title-row">
            <span class="colorbar-dot"></span>
            <span class="colorbar-title">Rainfall Intensity</span>
          </div>
          <span class="colorbar-unit">mm / 24h</span>
        </div>
        <div class="colorbar-ramp-container">
          <div class="colorbar-ramp-gradient" style="background: linear-gradient(to right, #7dd3fc 0%, #7dd3fc 14%, #2563eb 32%, #16a34a 50%, #ea580c 68%, #dc2626 84%, #7e22ce 100%);"></div>
          <div class="colorbar-tick-marks">
            <span class="c-tick" style="left: 0%;"></span>
            <span class="c-tick" style="left: 14%;"></span>
            <span class="c-tick" style="left: 32%;"></span>
            <span class="c-tick" style="left: 50%;"></span>
            <span class="c-tick" style="left: 68%;"></span>
            <span class="c-tick" style="left: 84%;"></span>
            <span class="c-tick" style="left: 100%;"></span>
          </div>
        </div>
        <div class="colorbar-tick-labels">
          <span style="left: 0%;">0</span>
          <span style="left: 14%;">0.1</span>
          <span style="left: 32%;">2.5</span>
          <span style="left: 50%;">7.5</span>
          <span style="left: 68%;">15</span>
          <span style="left: 84%;">35</span>
          <span style="left: 100%;">65+</span>
        </div>
        <div class="colorbar-cat-labels">
          <span style="left: 7%;">Trace</span>
          <span style="left: 23%;">Light</span>
          <span style="left: 41%;">Mod</span>
          <span style="left: 59%;">Heavy</span>
          <span style="left: 76%;">V.Heavy</span>
          <span style="left: 92%;">Extreme</span>
        </div>
      </div>
    `;
    return;
  }

  // 2. Temperature Color Bar
  if (state.activeVariable === "temperature" && ["blended", "fused", "gfs", "ecmwf", "imd"].includes(layer)) {
    container.innerHTML = `
      <div class="met-colorbar-card">
        <div class="colorbar-head">
          <div class="colorbar-title-row">
            <span class="colorbar-dot" style="background: #ea580c; box-shadow: 0 0 6px #ea580c;"></span>
            <span class="colorbar-title">Temperature Field</span>
          </div>
          <span class="colorbar-unit">°C</span>
        </div>
        <div class="colorbar-ramp-container">
          <div class="colorbar-ramp-gradient" style="background: linear-gradient(to right, #3b82f6 0%, #06b6d4 25%, #10b981 45%, #f59e0b 65%, #ea580c 80%, #dc2626 92%, #7e22ce 100%);"></div>
          <div class="colorbar-tick-marks">
            <span class="c-tick" style="left: 0%;"></span>
            <span class="c-tick" style="left: 25%;"></span>
            <span class="c-tick" style="left: 45%;"></span>
            <span class="c-tick" style="left: 65%;"></span>
            <span class="c-tick" style="left: 80%;"></span>
            <span class="c-tick" style="left: 92%;"></span>
            <span class="c-tick" style="left: 100%;"></span>
          </div>
        </div>
        <div class="colorbar-tick-labels">
          <span style="left: 0%;">&lt;16</span>
          <span style="left: 25%;">24</span>
          <span style="left: 45%;">32</span>
          <span style="left: 65%;">38</span>
          <span style="left: 80%;">42</span>
          <span style="left: 92%;">45</span>
          <span style="left: 100%;">48+</span>
        </div>
        <div class="colorbar-cat-labels">
          <span style="left: 12%;">Cool</span>
          <span style="left: 35%;">Mild</span>
          <span style="left: 55%;">Warm</span>
          <span style="left: 72%;">Hot</span>
          <span style="left: 86%;">Heatwave</span>
          <span style="left: 96%;">Severe</span>
        </div>
      </div>
    `;
    return;
  }

  // 3. Wind Speed Color Bar
  if (state.activeVariable === "wind" && ["blended", "fused", "gfs", "ecmwf", "imd"].includes(layer)) {
    container.innerHTML = `
      <div class="met-colorbar-card">
        <div class="colorbar-head">
          <div class="colorbar-title-row">
            <span class="colorbar-dot" style="background: #10b981; box-shadow: 0 0 6px #10b981;"></span>
            <span class="colorbar-title">Wind Speed Field</span>
          </div>
          <span class="colorbar-unit">km/h</span>
        </div>
        <div class="colorbar-ramp-container">
          <div class="colorbar-ramp-gradient" style="background: linear-gradient(to right, #38bdf8 0%, #10b981 30%, #f59e0b 55%, #ea580c 75%, #dc2626 90%, #7e22ce 100%);"></div>
          <div class="colorbar-tick-marks">
            <span class="c-tick" style="left: 0%;"></span>
            <span class="c-tick" style="left: 30%;"></span>
            <span class="c-tick" style="left: 55%;"></span>
            <span class="c-tick" style="left: 75%;"></span>
            <span class="c-tick" style="left: 90%;"></span>
            <span class="c-tick" style="left: 100%;"></span>
          </div>
        </div>
        <div class="colorbar-tick-labels">
          <span style="left: 0%;">&lt;15</span>
          <span style="left: 30%;">30</span>
          <span style="left: 55%;">45</span>
          <span style="left: 75%;">62</span>
          <span style="left: 90%;">88</span>
          <span style="left: 100%;">100+</span>
        </div>
        <div class="colorbar-cat-labels">
          <span style="left: 15%;">Light</span>
          <span style="left: 42%;">Breeze</span>
          <span style="left: 65%;">Moderate</span>
          <span style="left: 82%;">Strong</span>
          <span style="left: 95%;">Storm</span>
        </div>
      </div>
    `;
    return;
  }

  // 4. Inter-Model Disagreement Color Bar
  if (layer === "disagreement") {
    container.innerHTML = `
      <div class="met-colorbar-card">
        <div class="colorbar-head">
          <div class="colorbar-title-row">
            <span class="colorbar-dot" style="background: #f59e0b; box-shadow: 0 0 6px #f59e0b;"></span>
            <span class="colorbar-title">Model Disagreement D</span>
          </div>
          <span class="colorbar-unit">${varUnit}</span>
        </div>
        <div class="colorbar-ramp-container">
          <div class="colorbar-ramp-gradient" style="background: linear-gradient(to right, #a5b4fc 0%, #3b82f6 20%, #f59e0b 45%, #ea580c 70%, #dc2626 100%);"></div>
          <div class="colorbar-tick-marks">
            <span class="c-tick" style="left: 0%;"></span>
            <span class="c-tick" style="left: 20%;"></span>
            <span class="c-tick" style="left: 45%;"></span>
            <span class="c-tick" style="left: 70%;"></span>
            <span class="c-tick" style="left: 100%;"></span>
          </div>
        </div>
        <div class="colorbar-tick-labels">
          <span style="left: 0%;">0</span>
          <span style="left: 20%;">0.11</span>
          <span style="left: 45%;">2.06</span>
          <span style="left: 70%;">5.0</span>
          <span style="left: 100%;">10+</span>
        </div>
        <div class="colorbar-cat-labels">
          <span style="left: 10%;">High Conf</span>
          <span style="left: 32%;">Moderate</span>
          <span style="left: 58%;">Low Confidence</span>
          <span style="left: 85%;">Severe Spread</span>
        </div>
      </div>
    `;
    return;
  }

  // 5. Simplex Weights Color Bar
  if (layer === "w_gfs" || layer === "w_ecmwf") {
    const isGfs = layer === "w_gfs";
    container.innerHTML = `
      <div class="met-colorbar-card">
        <div class="colorbar-head">
          <div class="colorbar-title-row">
            <span class="colorbar-dot" style="background: #0284c7; box-shadow: 0 0 6px #0284c7;"></span>
            <span class="colorbar-title">${isGfs ? 'GFS Simplex Weight (w_GFS)' : 'ECMWF Simplex Weight (w_EC)'}</span>
          </div>
          <span class="colorbar-unit">Weight [0, 1]</span>
        </div>
        <div class="colorbar-ramp-container">
          <div class="colorbar-ramp-gradient" style="background: linear-gradient(to right, #0c4a6e 0%, #0284c7 35%, #64748b 50%, #f59e0b 65%, #ea580c 80%, #c2410c 100%);"></div>
          <div class="colorbar-tick-marks">
            <span class="c-tick" style="left: 0%;"></span>
            <span class="c-tick" style="left: 35%;"></span>
            <span class="c-tick" style="left: 50%;"></span>
            <span class="c-tick" style="left: 65%;"></span>
            <span class="c-tick" style="left: 100%;"></span>
          </div>
        </div>
        <div class="colorbar-tick-labels">
          <span style="left: 0%;">0.0</span>
          <span style="left: 35%;">0.45</span>
          <span style="left: 50%;">0.50</span>
          <span style="left: 65%;">0.55</span>
          <span style="left: 100%;">1.0</span>
        </div>
        <div class="colorbar-cat-labels">
          <span style="left: 17%;">Subordinate</span>
          <span style="left: 50%;">Consensus</span>
          <span style="left: 82%;">Dominant</span>
        </div>
      </div>
    `;
    return;
  }

  // 6. Empirical Confidence Categories
  if (layer === "confidence") {
    container.innerHTML = `
      <div class="met-colorbar-card">
        <div class="colorbar-head">
          <div class="colorbar-title-row">
            <span class="colorbar-dot" style="background: #10b981; box-shadow: 0 0 6px #10b981;"></span>
            <span class="colorbar-title">Confidence Regimes</span>
          </div>
          <span class="colorbar-unit">Spread Calibration</span>
        </div>
        <div class="colorbar-ramp-container" style="display: flex; gap: 2px; height: 10px;">
          <div style="flex: 1; background: #10b981; border-radius: 2px;"></div>
          <div style="flex: 1; background: #f59e0b; border-radius: 2px;"></div>
          <div style="flex: 1; background: #dc2626; border-radius: 2px;"></div>
        </div>
        <div class="colorbar-cat-labels" style="display: flex; justify-content: space-between; margin-top: 3px;">
          <span style="position: static; transform: none; color: #34d399;">High (D &lt; 0.11)</span>
          <span style="position: static; transform: none; color: #fbbf24;">Moderate (0.11–2.06)</span>
          <span style="position: static; transform: none; color: #f87171;">Low (D &ge; 2.06)</span>
        </div>
      </div>
    `;
    return;
  }

  // Fallback for categorical / other layers
  let title = "METEOROLOGICAL ANALYSIS";
  let items = [];
  if (layer === "dominant_model") {
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
    title = "EXTREME WEATHER GUIDANCE";
    items = [
      { color: "#7e22ce", label: "Extreme Warning (Severe Exceedance)" },
      { color: "#dc2626", label: "Warning (High Severity)" },
      { color: "#ea580c", label: "Alert (Moderate Severity)" },
      { color: "#f59e0b", label: "Watch (Light / Marginal)" },
      { color: "rgba(16, 185, 129, 0.4)", label: "Below Warning Threshold (Normal)" }
    ];
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
   CELL INSPECTION & GEOGRAPHIC LOCATION SELECTION
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

  // Clear prior selection layer
  if (state.selectedCellHighlight) {
    state.map.removeLayer(state.selectedCellHighlight);
  }

  // Precision Meteorological Station Reticle (Geographic point on weather map)
  const highlightGroup = L.layerGroup();

  // 1. Subtle 0.25° representative cell footprint (hairline dashed bracket, no heavy fill)
  const half = 0.125;
  const b = [
    [pt.lat - half, pt.lon - half],
    [pt.lat + half, pt.lon + half]
  ];
  const cellFootprint = L.rectangle(b, {
    color: "#0284c7",
    weight: 1.0,
    dashArray: "3, 3",
    fillColor: "#38bdf8",
    fillOpacity: 0.08,
    interactive: false,
    zIndex: 590,
  });
  highlightGroup.addLayer(cellFootprint);

  // 2. Precision Station Reticle Ring
  const targetRing = L.circleMarker([pt.lat, pt.lon], {
    radius: 8,
    weight: 2,
    color: "#0284c7",
    fillColor: "#38bdf8",
    fillOpacity: 0.25,
    interactive: false,
    zIndex: 600,
  });
  highlightGroup.addLayer(targetRing);

  // 3. Central Pinpoint Station Core
  const pinpointCore = L.circleMarker([pt.lat, pt.lon], {
    radius: 2.5,
    weight: 1.5,
    color: "#0369a1",
    fillColor: "#ffffff",
    fillOpacity: 1.0,
    interactive: false,
    zIndex: 601,
  });
  highlightGroup.addLayer(pinpointCore);

  // 4. Subtle Crosshair Ticks (N, S, E, W)
  const chDelta = 0.035;
  const chNS = L.polyline([
    [pt.lat - chDelta, pt.lon],
    [pt.lat + chDelta, pt.lon]
  ], { color: "#0284c7", weight: 1.2, interactive: false, zIndex: 600 });
  const chEW = L.polyline([
    [pt.lat, pt.lon - chDelta],
    [pt.lat, pt.lon + chDelta]
  ], { color: "#0284c7", weight: 1.2, interactive: false, zIndex: 600 });
  highlightGroup.addLayer(chNS);
  highlightGroup.addLayer(chEW);

  highlightGroup.addTo(state.map);
  state.selectedCellHighlight = highlightGroup;

  // Switch panels
  document.getElementById("panel-domain-summary").classList.add("hidden");
  const inspPanel = document.getElementById("panel-cell-inspector");
  inspPanel.classList.remove("hidden");

  // Populate Location & Context
  const stateName = pt.subregion === "Telangana" ? "Telangana" : "Andhra Pradesh";
  document.getElementById("inspect-subregion").textContent = `${pt.subregion.toUpperCase()} • ${stateName.toUpperCase()}`;
  document.getElementById("inspect-coords").textContent = `${pt.lat.toFixed(2)}°N · ${pt.lon.toFixed(2)}°E`;

  const leadTag = `+${state.activeLead || 24}h Lead`;
  if (state.operationalMode === "live") {
    const initDate = state.currentGridData ? new Date(state.currentGridData.initialization_time_utc) : new Date();
    const validDate = state.currentGridData ? new Date(state.currentGridData.valid_time_utc) : new Date();
    const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
    const initFmt = `${String(initDate.getUTCDate()).padStart(2, "0")} ${months[initDate.getUTCMonth()]} ${initDate.getUTCFullYear()} 00 UTC`;
    const validFmt = `${String(validDate.getUTCDate()).padStart(2, "0")} ${months[validDate.getUTCMonth()]} ${validDate.getUTCFullYear()} 00 UTC`;
    document.getElementById("inspect-dates").textContent = `Initialization: ${initFmt} → Valid: ${validFmt} (${leadTag})`;
  } else {
    document.getElementById("inspect-dates").textContent = `Forecast: ${state.currentDate} (00 UTC Cycle, ${leadTag})`;
  }

  // Dynamic Variable Kicker & Unit
  const varUnit = pt.unit || (state.activeVariable === "temperature" ? "°C" : state.activeVariable === "wind" ? "km/h" : "mm");
  const leadStr = `+${state.activeLead || 24}H`;
  const kickerElText = state.activeVariable === "temperature"
    ? `${leadStr} DYNAMICALLY BLENDED 2M TEMPERATURE`
    : state.activeVariable === "wind"
    ? `${leadStr} DYNAMICALLY BLENDED 10M WIND SPEED`
    : `${leadStr} DYNAMICALLY BLENDED PRECIPITATION`;
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
  if (cardDis) cardDis.textContent = disVal.toFixed(2);

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
      const imdValEl = document.getElementById("inspect-imd-val");
      if (imdValEl) imdValEl.textContent = `${pt.imd_mm.toFixed(2)} mm`;
      const fusedValElem = document.getElementById("inspect-fused-compare-val");
      if (fusedValElem) fusedValElem.textContent = `${(pt.blend_val !== undefined ? pt.blend_val : pt.fused_mm).toFixed(2)} mm`;

      const err = pt.fused_error_mm !== undefined ? pt.fused_error_mm : 0.0;
      const imdErrEl = document.getElementById("inspect-imd-err");
      if (imdErrEl) imdErrEl.textContent = `${err >= 0 ? "+" : ""}${err.toFixed(2)} mm`;

      if (statusBadge) {
        statusBadge.className = "audit-verification-status";
        const statusText = document.getElementById("inspect-verif-status-text");
        if (err >= 0) {
          statusBadge.classList.add("status-over");
          if (statusText) statusText.textContent = `OVER-FORECAST (+${err.toFixed(2)} mm)`;
        } else {
          statusBadge.classList.add("status-under");
          if (statusText) statusText.textContent = `UNDER-FORECAST (${err.toFixed(2)} mm)`;
        }
      }
    } else {
      const imdValEl = document.getElementById("inspect-imd-val");
      if (imdValEl) imdValEl.textContent = state.operationalMode === "live" ? "Pending Observation" : "No Observation";
      const fusedValElem = document.getElementById("inspect-fused-compare-val");
      if (fusedValElem) fusedValElem.textContent = `${(pt.blend_val !== undefined ? pt.blend_val : pt.fused_mm).toFixed(2)} mm`;
      const imdErrEl = document.getElementById("inspect-imd-err");
      if (imdErrEl) imdErrEl.textContent = "--";
      if (statusBadge) {
        statusBadge.className = "audit-verification-status status-pending";
        const statusText = document.getElementById("inspect-verif-status-text");
        if (statusText) statusText.textContent = "Causal T-1 Ingestion Pending";
      }
    }
  }

  // Technical Metadata (safe setters)
  const setElText = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  };
  setElText("tech-cell-coords", `${pt.lat.toFixed(2)}°N, ${pt.lon.toFixed(2)}°E`);
  setElText("tech-subregion", pt.subregion);
  setElText("tech-dis-raw", `${(pt.disagreement_mm !== undefined ? pt.disagreement_mm : (pt.disagreement || 0)).toFixed(2)} ${varUnit}`);
  setElText("tech-dis-norm", pt.disagreement_norm ? pt.disagreement_norm.toFixed(3) : "--");
  setElText("tech-threshold-rule", pt.confidence_class === "High Confidence"
    ? `D < 0.11 ${varUnit} -> High Confidence`
    : pt.confidence_class === "Moderate Confidence"
    ? `0.11 <= D < 2.06 ${varUnit} -> Moderate`
    : `D >= 2.06 ${varUnit} -> Low Confidence`);
  setElText("tech-regime", pt.predicted_regime || "Moderate");
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
    desc: "Welcome to AETHERA. We solve the critical challenge of high-impact monsoon rainfall forecasting by fusing independent NWP models (NOAA GFS & ECMWF IFS) and providing explainable confidence based on physical model disagreement.",
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
