/**
 * SIH26081 — 3D Meteorological Precipitation & Model Disagreement Engine
 * WebGL / Three.js Workstation-Grade Analytical Surface Visualization
 * Zero ML, 100% Real Data, Native 0.25° Grid Preserved.
 * 
 * Height represents forecast rainfall (or model disagreement), not terrain elevation.
 */

class Meteorological3DViewer {
  constructor() {
    this.container = null;
    this.canvasWrap = null;
    this.tooltip = null;
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;
    this.animId = null;
    this.isRunning = false;

    // Callbacks
    this.onCellClick = null;
    this.onCellHover = null;

    // State
    this.gridData = null;
    this.mode = "rain"; // "rain" | "disagreement"
    this.showLowConf = false;
    this.activeRegion = "All";
    this.selectedPoint = null;
    this.hoveredPoint = null;

    // Three.js Objects
    this.surfaceMesh = null;
    this.gridLinesMesh = null;
    this.skirtMesh = null;
    this.lowConfGroup = null;
    this.hoverReticle = null;
    this.selectReticle = null;
    this.groundGroup = null;
    this.boundaryLinesGroup = null;

    // Coordinate Mapping (Center of AP + Telangana Domain)
    this.centerLat = 16.0;
    this.centerLon = 80.5;
    this.scale = 4.0;
    this.cosLat = Math.cos((16.0 * Math.PI) / 180); // Preserves true geographic aspect ratio (~0.961)

    // Raycasting
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.isDragging = false;
    this.mouseDownPos = { x: 0, y: 0 };

    // Default Camera Configuration (Slightly elevated oblique workstation view)
    this.defaultCamPos = new THREE.Vector3(0, 32, 38);
    this.defaultTarget = new THREE.Vector3(0, 2.5, 0);

    // Bound Event Handlers
    this._onMouseMove = this._onMouseMove.bind(this);
    this._onMouseDown = this._onMouseDown.bind(this);
    this._onMouseUp = this._onMouseUp.bind(this);
    this._onMouseLeave = this._onMouseLeave.bind(this);
    this._onResize = this._onResize.bind(this);
    this._animate = this._animate.bind(this);
  }

  static isWebGLAvailable() {
    try {
      const canvas = document.createElement("canvas");
      return !!(
        window.WebGLRenderingContext &&
        (canvas.getContext("webgl") || canvas.getContext("experimental-webgl"))
      );
    } catch (e) {
      return false;
    }
  }

  init(containerElem, onCellClick, onCellHover) {
    this.container = containerElem;
    this.onCellClick = onCellClick;
    this.onCellHover = onCellHover;

    if (!Meteorological3DViewer.isWebGLAvailable()) {
      console.warn("WebGL not available in this environment.");
      const fallback = document.getElementById("webgl-fallback");
      if (fallback) fallback.classList.remove("hidden");
      return false;
    }

    const width = this.container.clientWidth || 800;
    const height = this.container.clientHeight || 600;

    // 1. Scene Setup
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0b1120); // Dark Slate Meteorological Theme
    this.scene.fog = new THREE.FogExp2(0x0b1120, 0.007);

    // 2. Camera Setup (Oblique Workstation View)
    this.camera = new THREE.PerspectiveCamera(42, width / height, 0.5, 500);
    this.camera.position.copy(this.defaultCamPos);

    // 3. Renderer Setup
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;

    // Append Canvas to Container
    this.container.appendChild(this.renderer.domElement);

    // 4. OrbitControls
    if (typeof THREE.OrbitControls !== "undefined") {
      this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
      this.controls.enableDamping = true;
      this.controls.dampingFactor = 0.08;
      this.controls.maxPolarAngle = Math.PI / 2 - 0.08; // Prevent going beneath ground plane
      this.controls.minDistance = 8;
      this.controls.maxDistance = 110;
      this.controls.target.copy(this.defaultTarget);
      this.controls.update();
    }

    // 5. Professional Workstation Lighting (No dramatic shadows, pure data clarity)
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.70);
    this.scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xffffff, 0.75);
    sunLight.position.set(25, 45, 25);
    this.scene.add(sunLight);

    const fillLight = new THREE.DirectionalLight(0x94a3b8, 0.35);
    fillLight.position.set(-25, 30, -25);
    this.scene.add(fillLight);

    // 6. Geographic Ground Plane & Coordinate Reference System
    this._buildGeographicBase();

    // 7. Reticles (Hover & Selection)
    this._buildReticles();

    // 8. Event Listeners
    const dom = this.renderer.domElement;
    dom.addEventListener("mousemove", this._onMouseMove);
    dom.addEventListener("mousedown", this._onMouseDown);
    dom.addEventListener("mouseup", this._onMouseUp);
    dom.addEventListener("mouseleave", this._onMouseLeave);
    window.addEventListener("resize", this._onResize);

    this.tooltip = document.getElementById("three-hover-tooltip");

    return true;
  }

  /* ========================================================
     GEOGRAPHIC BASE & AUTHORITATIVE REFERENCE PLANE (Y = 0)
     ======================================================== */
  _buildGeographicBase() {
    this.groundGroup = new THREE.Group();
    this.scene.add(this.groundGroup);

    // Dark GIS Ground Plane
    const groundGeo = new THREE.PlaneGeometry(55, 50);
    const groundMat = new THREE.MeshBasicMaterial({
      color: 0x0f172a,
      depthWrite: true,
      side: THREE.DoubleSide,
    });
    const groundMesh = new THREE.Mesh(groundGeo, groundMat);
    groundMesh.rotation.x = -Math.PI / 2;
    groundMesh.position.y = -0.05;
    this.groundGroup.add(groundMesh);

    // Subtle 2-degree Geographic Reference Grid Lines
    const gridMat = new THREE.LineBasicMaterial({
      color: 0x1e293b,
      transparent: true,
      opacity: 0.8,
    });

    const latLines = [12.0, 14.0, 16.0, 18.0, 20.0];
    const lonLines = [76.0, 78.0, 80.0, 82.0, 84.0, 85.0];

    const gridPoints = [];

    // Latitude lines (East-West)
    latLines.forEach((lat) => {
      const z = -(lat - this.centerLat) * this.scale;
      const xStart = (75.5 - this.centerLon) * this.scale * this.cosLat;
      const xEnd = (85.5 - this.centerLon) * this.scale * this.cosLat;
      gridPoints.push(new THREE.Vector3(xStart, 0.01, z));
      gridPoints.push(new THREE.Vector3(xEnd, 0.01, z));
    });

    // Longitude lines (North-South)
    lonLines.forEach((lon) => {
      const x = (lon - this.centerLon) * this.scale * this.cosLat;
      const zStart = -(11.5 - this.centerLat) * this.scale;
      const zEnd = -(20.5 - this.centerLat) * this.scale;
      gridPoints.push(new THREE.Vector3(x, 0.01, zStart));
      gridPoints.push(new THREE.Vector3(x, 0.01, zEnd));
    });

    const gridGeo = new THREE.BufferGeometry().setFromPoints(gridPoints);
    const gridLines = new THREE.LineSegments(gridGeo, gridMat);
    this.groundGroup.add(gridLines);

    // Domain Bounding Perimeter Frame (12°–20°N, 76°–85°E)
    const domainBorderPts = [
      this._geoToWorld(12.0, 76.0, 0.02),
      this._geoToWorld(20.0, 76.0, 0.02),
      this._geoToWorld(20.0, 85.0, 0.02),
      this._geoToWorld(12.0, 85.0, 0.02),
      this._geoToWorld(12.0, 76.0, 0.02),
    ];
    const borderGeo = new THREE.BufferGeometry().setFromPoints(domainBorderPts);
    const borderMat = new THREE.LineBasicMaterial({
      color: 0x334155,
      linewidth: 1.5,
      transparent: true,
      opacity: 0.9,
    });
    const domainBorder = new THREE.Line(borderGeo, borderMat);
    this.groundGroup.add(domainBorder);

    // Geographic Cardinal & Regional Text Labels
    this._addTextLabel("20°N", this._geoToWorld(20.0, 75.6, 0.1), "#64748b", 11);
    this._addTextLabel("18°N", this._geoToWorld(18.0, 75.6, 0.1), "#64748b", 11);
    this._addTextLabel("16°N", this._geoToWorld(16.0, 75.6, 0.1), "#64748b", 11);
    this._addTextLabel("14°N", this._geoToWorld(14.0, 75.6, 0.1), "#64748b", 11);
    this._addTextLabel("12°N", this._geoToWorld(12.0, 75.6, 0.1), "#64748b", 11);

    this._addTextLabel("76°E", this._geoToWorld(11.6, 76.0, 0.1), "#64748b", 11);
    this._addTextLabel("78°E", this._geoToWorld(11.6, 78.0, 0.1), "#64748b", 11);
    this._addTextLabel("80°E", this._geoToWorld(11.6, 80.0, 0.1), "#64748b", 11);
    this._addTextLabel("82°E", this._geoToWorld(11.6, 82.0, 0.1), "#64748b", 11);
    this._addTextLabel("84°E", this._geoToWorld(11.6, 84.0, 0.1), "#64748b", 11);

    // Geographic Orientation Labels
    this._addTextLabel("TELANGANA", this._geoToWorld(17.8, 79.0, 0.1), "#94a3b8", 14, true);
    this._addTextLabel("ANDHRA PRADESH", this._geoToWorld(15.2, 79.2, 0.1), "#94a3b8", 14, true);
    this._addTextLabel("BAY OF BENGAL", this._geoToWorld(15.5, 83.4, 0.1), "#38bdf8", 13, true);

    // Load Authoritative State Boundaries from GeoJSON
    this._loadBoundaries();
  }

  async _loadBoundaries() {
    try {
      const res = await fetch("domain_boundaries.geojson");
      if (!res.ok) return;
      const data = await res.json();

      this.boundaryLinesGroup = new THREE.Group();
      this.groundGroup.add(this.boundaryLinesGroup);

      const boundaryMat = new THREE.LineBasicMaterial({
        color: 0x475569,
        linewidth: 1.2,
        transparent: true,
        opacity: 0.75,
      });

      data.features.forEach((feature) => {
        if (!feature.geometry) return;
        const coords = feature.geometry.coordinates;

        const processPolygon = (poly) => {
          poly.forEach((ring) => {
            const pts = [];
            ring.forEach(([lon, lat]) => {
              pts.push(this._geoToWorld(lat, lon, 0.05));
            });
            if (pts.length > 1) {
              const geo = new THREE.BufferGeometry().setFromPoints(pts);
              const line = new THREE.Line(geo, boundaryMat);
              this.boundaryLinesGroup.add(line);
            }
          });
        };

        if (feature.geometry.type === "Polygon") {
          processPolygon(coords);
        } else if (feature.geometry.type === "MultiPolygon") {
          coords.forEach((poly) => processPolygon(poly));
        }
      });
    } catch (e) {
      console.warn("Could not load 3D boundaries:", e);
    }
  }

  _addTextLabel(text, worldPos, color = "#94a3b8", fontSize = 12, bold = false) {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext("2d");

    ctx.font = `${bold ? "bold " : ""}${fontSize * 2}px Inter, sans-serif`;
    ctx.fillStyle = color;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, 128, 32);

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    const spriteMat = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      opacity: 0.85,
    });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.position.copy(worldPos);
    sprite.scale.set(6, 1.5, 1);
    this.groundGroup.add(sprite);
  }

  /* ========================================================
     SELECTION & HOVER RETICLES
     ======================================================== */
  _buildReticles() {
    // Hover Reticle (0.25° x 0.25° Cell Frame)
    const hoverGeo = new THREE.BufferGeometry();
    const hoverMat = new THREE.LineBasicMaterial({
      color: 0x38bdf8,
      linewidth: 1.5,
      transparent: true,
      opacity: 0.9,
    });
    this.hoverReticle = new THREE.LineSegments(hoverGeo, hoverMat);
    this.hoverReticle.visible = false;
    this.scene.add(this.hoverReticle);

    // Selected Cell Reticle (Pillar & Beacon Halo)
    this.selectReticle = new THREE.Group();
    this.selectReticle.visible = false;

    // Glowing column box
    const selBoxGeo = new THREE.BufferGeometry();
    const selBoxMat = new THREE.LineBasicMaterial({
      color: 0x00f0ff,
      linewidth: 2.5,
      transparent: true,
      opacity: 1.0,
    });
    this.selectReticleBox = new THREE.LineSegments(selBoxGeo, selBoxMat);
    this.selectReticle.add(this.selectReticleBox);

    // Base target ring
    const ringGeo = new THREE.RingGeometry(0.5, 0.7, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85,
    });
    this.selectReticleRing = new THREE.Mesh(ringGeo, ringMat);
    this.selectReticleRing.rotation.x = -Math.PI / 2;
    this.selectReticleRing.position.y = 0.08;
    this.selectReticle.add(this.selectReticleRing);

    this.scene.add(this.selectReticle);
  }

  /* ========================================================
     COORDINATE TRANSFORMS & DISPLAY HEIGHT
     ======================================================== */
  _geoToWorld(lat, lon, y = 0) {
    const x = (lon - this.centerLon) * this.scale * this.cosLat;
    const z = -(lat - this.centerLat) * this.scale;
    return new THREE.Vector3(x, y, z);
  }

  _worldToGeo(x, z) {
    const lon = this.centerLon + x / (this.scale * this.cosLat);
    const lat = this.centerLat - z / this.scale;
    return { lat, lon };
  }

  /**
   * Nonlinear Visual Height Scaling
   * Monotonic square-root transform: displayHeight = 1.25 * sqrt(value)
   * Prevents 100mm extreme monsoon spikes from needle-distorting the scene
   * while making 1-5mm light rain distinctly topographical.
   * Numerical forecast values remain completely untouched.
   */
  getDisplayHeight(val) {
    if (val <= 0.05) return 0.08; // Slight base relief so zero-rain cells are visible on ground
    return Math.min(18.0, Math.sqrt(val) * 1.30);
  }

  getColorForValue(val) {
    if (this.mode === "rain") {
      // PALETTES.rain
      if (val >= 65.0) return new THREE.Color(0x7e22ce);
      if (val >= 35.0) return new THREE.Color(0xdc2626);
      if (val >= 15.0) return new THREE.Color(0xea580c);
      if (val >= 7.5)  return new THREE.Color(0x16a34a);
      if (val >= 2.5)  return new THREE.Color(0x2563eb);
      if (val >= 0.1)  return new THREE.Color(0x7dd3fc);
      return new THREE.Color(0x334155); // Dry / trace base
    } else {
      // PALETTES.disagreement (Sequential Monochromatic Model Disagreement Scale)
      if (val >= 10.0) return new THREE.Color(0x312e81);
      if (val >= 5.0)  return new THREE.Color(0x4338ca);
      if (val >= 2.06) return new THREE.Color(0x6366f1);
      if (val >= 0.5)  return new THREE.Color(0x818cf8);
      if (val >= 0.11) return new THREE.Color(0xa5b4fc);
      return new THREE.Color(0xe0e7ff);
    }
  }

  /* ========================================================
     DATA RENDERING — 3D METEOROLOGICAL SURFACE MESH
     ======================================================== */
  renderData(gridData, mode = "rain", showLowConfidence = false, activeRegion = "All") {
    if (!gridData || !gridData.points) return;

    this.gridData = gridData;
    this.mode = mode;
    this.showLowConf = showLowConfidence;
    this.activeRegion = activeRegion;

    // Clean up existing surface objects
    this._disposeSurface();

    const points = this.activeRegion === "All"
      ? gridData.points
      : gridData.points.filter((p) => p.subregion === this.activeRegion);

    if (!points.length) return;

    // Build 2D lookup grid for 0.25° cells
    // Lat: 12.0 to 20.0 (33 slots), Lon: 76.0 to 85.0 (37 slots)
    const gridMap = new Map();
    points.forEach((pt) => {
      const key = `${pt.lat.toFixed(2)},${pt.lon.toFixed(2)}`;
      gridMap.set(key, pt);
    });

    const lats = [];
    for (let lat = 12.0; lat <= 20.01; lat += 0.25) lats.push(parseFloat(lat.toFixed(2)));
    const lons = [];
    for (let lon = 76.0; lon <= 85.01; lon += 0.25) lons.push(parseFloat(lon.toFixed(2)));

    // 1. Build Continuous Faceted Surface Geometry
    const positions = [];
    const colors = [];
    const indices = [];
    let vertIdx = 0;

    // Grid of vertices at each 0.25° point
    // To ensure exact cell representation with clean slopes, each cell has a 0.25° x 0.25° top tile
    const half = 0.120; // 0.12° extent (leaving tiny 0.005° crisp meteorological seam)

    // Group for low-confidence analytical overlays
    this.lowConfGroup = new THREE.Group();
    this.scene.add(this.lowConfGroup);

    const wireframeLines = [];

    points.forEach((pt) => {
      const val = this.mode === "rain" ? pt.fused_mm : pt.disagreement_mm;
      const h = this.getDisplayHeight(val);
      const col = this.getColorForValue(val);

      // Low-confidence analytical dampening or highlighting
      const isLowConf = pt.disagreement_mm >= 2.06;
      let renderCol = col.clone();

      if (this.showLowConf) {
        if (!isLowConf) {
          // Dim non-low-confidence cells to spotlight low-confidence zones
          renderCol.multiplyScalar(0.35);
        }
      }

      // Corners of 0.25° cell tile
      const latMin = pt.lat - half;
      const latMax = pt.lat + half;
      const lonMin = pt.lon - half;
      const lonMax = pt.lon + half;

      // 4 top vertices
      const pTL = this._geoToWorld(latMax, lonMin, h);
      const pTR = this._geoToWorld(latMax, lonMax, h);
      const pBR = this._geoToWorld(latMin, lonMax, h);
      const pBL = this._geoToWorld(latMin, lonMin, h);

      // 4 base vertices (drop to Y = 0)
      const bTL = this._geoToWorld(latMax, lonMin, 0);
      const bTR = this._geoToWorld(latMax, lonMax, 0);
      const bBR = this._geoToWorld(latMin, lonMax, 0);
      const bBL = this._geoToWorld(latMin, lonMin, 0);

      // TOP FACE (2 Triangles)
      const topStart = vertIdx;
      [pTL, pTR, pBR, pBL].forEach((p) => {
        positions.push(p.x, p.y, p.z);
        colors.push(renderCol.r, renderCol.g, renderCol.b);
      });
      vertIdx += 4;
      indices.push(topStart, topStart + 1, topStart + 2);
      indices.push(topStart, topStart + 2, topStart + 3);

      // Top perimeter wireframe line
      wireframeLines.push(pTL, pTR, pTR, pBR, pBR, pBL, pBL, pTL);

      // SIDE WALLS / SKIRTS (Darkened tone for geological cross-section clarity)
      const skirtCol = renderCol.clone().multiplyScalar(0.65);

      // Check if neighboring cells exist; if boundary or height diff, add subtle wall
      const addQuad = (v1, v2, v3, v4) => {
        const s = vertIdx;
        [v1, v2, v3, v4].forEach((v) => {
          positions.push(v.x, v.y, v.z);
          colors.push(skirtCol.r, skirtCol.g, skirtCol.b);
        });
        vertIdx += 4;
        indices.push(s, s + 1, s + 2);
        indices.push(s, s + 2, s + 3);
      };

      // North wall (latMax)
      const hasNorth = gridMap.has(`${(pt.lat + 0.25).toFixed(2)},${pt.lon.toFixed(2)}`);
      if (!hasNorth) addQuad(pTL, bTL, bTR, pTR);

      // South wall (latMin)
      const hasSouth = gridMap.has(`${(pt.lat - 0.25).toFixed(2)},${pt.lon.toFixed(2)}`);
      if (!hasSouth) addQuad(pBR, bBR, bBL, pBL);

      // West wall (lonMin)
      const hasWest = gridMap.has(`${pt.lat.toFixed(2)},${(pt.lon - 0.25).toFixed(2)}`);
      if (!hasWest) addQuad(pBL, bBL, bTL, pTL);

      // East wall (lonMax)
      const hasEast = gridMap.has(`${pt.lat.toFixed(2)},${(pt.lon + 0.25).toFixed(2)}`);
      if (!hasEast) addQuad(pTR, bTR, bBR, pBR);

      // 2. Analytical Low-Confidence Overlay Feature
      if (this.showLowConf && isLowConf) {
        // Highlighting halo ring around low-confidence cell top
        const capGeo = new THREE.BufferGeometry();
        const capPts = [pTL, pTR, pTR, pBR, pBR, pBL, pBL, pTL];
        capGeo.setFromPoints(capPts);
        const capMat = new THREE.LineBasicMaterial({
          color: 0xf59e0b, // Amber Warning Beacon
          linewidth: 2.0,
        });
        const capLine = new THREE.LineSegments(capGeo, capMat);
        this.lowConfGroup.add(capLine);
      }
    });

    // Create Optimized BufferGeometry Surface Mesh
    const surfaceGeo = new THREE.BufferGeometry();
    surfaceGeo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    surfaceGeo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    surfaceGeo.setIndex(indices);
    surfaceGeo.computeVertexNormals();

    const surfaceMat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.35,
      metalness: 0.15,
      side: THREE.DoubleSide,
    });

    this.surfaceMesh = new THREE.Mesh(surfaceGeo, surfaceMat);
    this.scene.add(this.surfaceMesh);

    // Subtle 0.25° Grid Lines on Surface
    const wireGeo = new THREE.BufferGeometry().setFromPoints(wireframeLines);
    const wireMat = new THREE.LineBasicMaterial({
      color: 0x0f172a,
      linewidth: 0.8,
      transparent: true,
      opacity: 0.35,
    });
    this.gridLinesMesh = new THREE.LineSegments(wireGeo, wireMat);
    this.scene.add(this.gridLinesMesh);

    // Update selection reticle if a point is already selected
    if (this.selectedPoint) {
      const match = points.find(
        (p) => Math.abs(p.lat - this.selectedPoint.lat) < 0.05 && Math.abs(p.lon - this.selectedPoint.lon) < 0.05
      );
      if (match) {
        this.highlightCell(match);
      } else {
        this.clearHighlight();
      }
    }
  }

  _disposeSurface() {
    if (this.surfaceMesh) {
      this.scene.remove(this.surfaceMesh);
      if (this.surfaceMesh.geometry) this.surfaceMesh.geometry.dispose();
      if (this.surfaceMesh.material) this.surfaceMesh.material.dispose();
      this.surfaceMesh = null;
    }
    if (this.gridLinesMesh) {
      this.scene.remove(this.gridLinesMesh);
      if (this.gridLinesMesh.geometry) this.gridLinesMesh.geometry.dispose();
      if (this.gridLinesMesh.material) this.gridLinesMesh.material.dispose();
      this.gridLinesMesh = null;
    }
    if (this.lowConfGroup) {
      this.scene.remove(this.lowConfGroup);
      this.lowConfGroup.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) obj.material.dispose();
      });
      this.lowConfGroup = null;
    }
  }

  /* ========================================================
     INTERACTION: RAYCASTING, HOVER & SELECTION
     ======================================================== */
  _onMouseDown(e) {
    this.isDragging = false;
    this.mouseDownPos = { x: e.clientX, y: e.clientY };
  }

  _onMouseUp(e) {
    const dist = Math.hypot(e.clientX - this.mouseDownPos.x, e.clientY - this.mouseDownPos.y);
    if (dist < 5) {
      // It's a clean click, not a drag orbit/pan
      this._handleClick(e);
    }
  }

  _onMouseMove(e) {
    if (!this.container || !this.gridData || !this.gridData.points) return;

    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    // Raycast against ground plane or surface
    this.raycaster.setFromCamera(this.mouse, this.camera);
    
    // Intersect plane at Y = 0 to get geographic coordinate
    const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const hitPoint = new THREE.Vector3();
    const hit = this.raycaster.ray.intersectPlane(groundPlane, hitPoint);

    if (hit) {
      const geo = this._worldToGeo(hitPoint.x, hitPoint.z);
      const snappedLat = Math.round(geo.lat * 4) / 4;
      const snappedLon = Math.round(geo.lon * 4) / 4;

      const pt = this.gridData.points.find(
        (p) => Math.abs(p.lat - snappedLat) < 0.05 && Math.abs(p.lon - snappedLon) < 0.05
      );

      if (pt && (this.activeRegion === "All" || pt.subregion === this.activeRegion)) {
        this.hoveredPoint = pt;
        this._updateHoverReticle(pt);
        this._showTooltip(pt, e.clientX, e.clientY);
        if (this.onCellHover) this.onCellHover(pt);
        return;
      }
    }

    // Outside grid domain
    this.hoveredPoint = null;
    this.hoverReticle.visible = false;
    this._hideTooltip();
    if (this.onCellHover) this.onCellHover(null);
  }

  _handleClick(e) {
    if (this.hoveredPoint) {
      this.highlightCell(this.hoveredPoint);
      if (this.onCellClick) {
        this.onCellClick(this.hoveredPoint);
      }
    }
  }

  _onMouseLeave() {
    this.hoveredPoint = null;
    if (this.hoverReticle) this.hoverReticle.visible = false;
    this._hideTooltip();
  }

  _updateHoverReticle(pt) {
    const half = 0.125;
    const val = this.mode === "rain" ? pt.fused_mm : pt.disagreement_mm;
    const h = this.getDisplayHeight(val);

    const latMin = pt.lat - half;
    const latMax = pt.lat + half;
    const lonMin = pt.lon - half;
    const lonMax = pt.lon + half;

    const pTL = this._geoToWorld(latMax, lonMin, h + 0.05);
    const pTR = this._geoToWorld(latMax, lonMax, h + 0.05);
    const pBR = this._geoToWorld(latMin, lonMax, h + 0.05);
    const pBL = this._geoToWorld(latMin, lonMin, h + 0.05);

    const bTL = this._geoToWorld(latMax, lonMin, 0);
    const bTR = this._geoToWorld(latMax, lonMax, 0);
    const bBR = this._geoToWorld(latMin, lonMax, 0);
    const bBL = this._geoToWorld(latMin, lonMin, 0);

    const pts = [
      pTL, pTR, pTR, pBR, pBR, pBL, pBL, pTL, // Top ring
      bTL, bTR, bTR, bBR, bBR, bBL, bBL, bTL, // Base ring
      pTL, bTL, pTR, bTR, pBR, bBR, pBL, bBL  // 4 vertical corner struts
    ];

    this.hoverReticle.geometry.dispose();
    this.hoverReticle.geometry = new THREE.BufferGeometry().setFromPoints(pts);
    this.hoverReticle.visible = true;
  }

  highlightCell(pt) {
    this.selectedPoint = pt;
    if (!this.selectReticle) return;

    const half = 0.125;
    const val = this.mode === "rain" ? pt.fused_mm : pt.disagreement_mm;
    const h = this.getDisplayHeight(val);

    const latMin = pt.lat - half;
    const latMax = pt.lat + half;
    const lonMin = pt.lon - half;
    const lonMax = pt.lon + half;

    const pTL = this._geoToWorld(latMax, lonMin, h + 0.1);
    const pTR = this._geoToWorld(latMax, lonMax, h + 0.1);
    const pBR = this._geoToWorld(latMin, lonMax, h + 0.1);
    const pBL = this._geoToWorld(latMin, lonMin, h + 0.1);

    const bTL = this._geoToWorld(latMax, lonMin, 0);
    const bTR = this._geoToWorld(latMax, lonMax, 0);
    const bBR = this._geoToWorld(latMin, lonMax, 0);
    const bBL = this._geoToWorld(latMin, lonMin, 0);

    const pts = [
      pTL, pTR, pTR, pBR, pBR, pBL, pBL, pTL,
      bTL, bTR, bTR, bBR, bBR, bBL, bBL, bTL,
      pTL, bTL, pTR, bTR, pBR, bBR, pBL, bBL
    ];

    this.selectReticleBox.geometry.dispose();
    this.selectReticleBox.geometry = new THREE.BufferGeometry().setFromPoints(pts);

    // Position center ring
    const centerWorld = this._geoToWorld(pt.lat, pt.lon, 0.05);
    this.selectReticleRing.position.set(centerWorld.x, 0.06, centerWorld.z);

    this.selectReticle.visible = true;
  }

  clearHighlight() {
    this.selectedPoint = null;
    if (this.selectReticle) {
      this.selectReticle.visible = false;
    }
  }

  /* ========================================================
     LIGHTWEIGHT 3D HOVER TOOLTIP (Section 13)
     ======================================================== */
  _showTooltip(pt, clientX, clientY) {
    if (!this.tooltip) return;

    const confClass = pt.confidence_class || "Confidence";
    const confColor = confClass === "High Confidence" ? "#0d9488" : confClass === "Moderate Confidence" ? "#d97706" : "#86198f";

    this.tooltip.innerHTML = `
      <div class="three-tip-header">
        <span class="tip-coord">LAT ${pt.lat.toFixed(2)}° N &bull; LON ${pt.lon.toFixed(2)}° E</span>
        <span class="tip-region">${pt.subregion}</span>
      </div>
      <div class="three-tip-grid">
        <div class="tip-item">
          <span class="tip-k">EQUAL-WEIGHT FUSION</span>
          <span class="tip-v text-accent">${pt.fused_mm.toFixed(2)} mm</span>
        </div>
        <div class="tip-item">
          <span class="tip-k">GFS</span>
          <span class="tip-v">${pt.gfs_mm.toFixed(2)} mm</span>
        </div>
        <div class="tip-item">
          <span class="tip-k">ECMWF</span>
          <span class="tip-v">${pt.ecmwf_mm.toFixed(2)} mm</span>
        </div>
        <div class="tip-item">
          <span class="tip-k">DISAGREEMENT</span>
          <span class="tip-v text-warn">${pt.disagreement_mm.toFixed(2)} mm</span>
        </div>
      </div>
      <div class="three-tip-conf" style="border-left: 3px solid ${confColor};">
        <span>Empirical Confidence: <strong>${confClass}</strong> (Hist. MAE: ${pt.expected_mae_mm.toFixed(2)} mm)</span>
      </div>
      <div class="three-tip-action">Click to inspect cell &amp; view retrospective verification</div>
    `;

    const containerRect = this.container.getBoundingClientRect();
    const x = clientX - containerRect.left + 16;
    const y = clientY - containerRect.top + 16;

    this.tooltip.style.left = `${Math.min(x, containerRect.width - 240)}px`;
    this.tooltip.style.top = `${Math.min(y, containerRect.height - 180)}px`;
    this.tooltip.classList.remove("hidden");
  }

  _hideTooltip() {
    if (this.tooltip) {
      this.tooltip.classList.add("hidden");
    }
  }

  /* ========================================================
     CAMERA CONTROLS & RESIZE
     ======================================================== */
  resetCamera() {
    if (!this.camera || !this.controls) return;

    // Smooth reset
    const startPos = this.camera.position.clone();
    const startTarget = this.controls.target.clone();
    const duration = 600;
    const startTime = performance.now();

    const animateReset = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(1.0, elapsed / duration);
      // Ease out cubic
      const ease = 1 - Math.pow(1 - progress, 3);

      this.camera.position.lerpVectors(startPos, this.defaultCamPos, ease);
      this.controls.target.lerpVectors(startTarget, this.defaultTarget, ease);
      this.controls.update();

      if (progress < 1.0) {
        requestAnimationFrame(animateReset);
      }
    };

    requestAnimationFrame(animateReset);
  }

  _onResize() {
    if (!this.container || !this.renderer || !this.camera) return;
    const width = this.container.clientWidth || 800;
    const height = this.container.clientHeight || 600;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  /* ========================================================
     RENDER LOOP & LIFECYCLE
     ======================================================== */
  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this._onResize();
    this._animate();
  }

  stop() {
    this.isRunning = false;
    if (this.animId) {
      cancelAnimationFrame(this.animId);
      this.animId = null;
    }
  }

  _animate() {
    if (!this.isRunning) return;
    this.animId = requestAnimationFrame(this._animate);

    if (this.controls) {
      this.controls.update();
    }

    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
  }

  destroy() {
    this.stop();
    window.removeEventListener("resize", this._onResize);

    if (this.renderer && this.renderer.domElement) {
      const dom = this.renderer.domElement;
      dom.removeEventListener("mousemove", this._onMouseMove);
      dom.removeEventListener("mousedown", this._onMouseDown);
      dom.removeEventListener("mouseup", this._onMouseUp);
      dom.removeEventListener("mouseleave", this._onMouseLeave);
      if (dom.parentNode) dom.parentNode.removeChild(dom);
    }

    this._disposeSurface();

    if (this.renderer) {
      this.renderer.dispose();
      this.renderer = null;
    }
  }
}

// Attach globally
window.Meteorological3DViewer = Meteorological3DViewer;
