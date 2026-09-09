/**
 * High-Realism 3D Disaster Zone Simulation - AeroScan SAR
 * Procedural PBR Textures, Collapsed Multi-Story Buildings, Internal Voids & Trapped Survivors
 */

class DisasterScene3D {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;
    this.drone = null;
    this.droneSpotlight = null;
    this.lidarBeam = null;
    this.lidarPointCloud = null;
    this.lidarSweepLine = null;
    this.dustParticles = null;

    this.hazardMeshes = [];
    this.victimMarkers = [];
    this.survivorModels = [];
    this.buildingSlabs = [];
    this.groundTeamMarker = null;

    // Simultaneous 3-Route Meshes
    this.safestRouteMesh = null;
    this.moderateRouteMesh = null;
    this.hardRouteMesh = null;

    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.rotors = [];
    this.clock = new THREE.Clock();
    this.xrayMode = false;
    this.selectedVictimId = null;
    this.onVictimSelectCallback = null;

    this.init();
  }

  // Generate realistic procedural textures via HTML5 Canvas
  generateTextures() {
    // 1. Concrete Debris Texture (with cracks, dirt, and stone aggregate)
    const concreteCanvas = document.createElement("canvas");
    concreteCanvas.width = 512;
    concreteCanvas.height = 512;
    const cctx = concreteCanvas.getContext("2d");
    cctx.fillStyle = "#8a94a0";
    cctx.fillRect(0, 0, 512, 512);

    // Add aggregate noise
    for (let i = 0; i < 30000; i++) {
      const shade = Math.floor(100 + Math.random() * 80);
      cctx.fillStyle = `rgba(${shade}, ${shade}, ${shade}, 0.25)`;
      cctx.fillRect(Math.random() * 512, Math.random() * 512, 2, 2);
    }

    // Add structural fracture cracks
    cctx.strokeStyle = "rgba(40, 45, 55, 0.75)";
    cctx.lineWidth = 2.5;
    for (let c = 0; c < 12; c++) {
      let x = Math.random() * 512;
      let y = Math.random() * 512;
      cctx.beginPath();
      cctx.moveTo(x, y);
      for (let s = 0; s < 7; s++) {
        x += (Math.random() - 0.5) * 70;
        y += (Math.random() - 0.5) * 70;
        cctx.lineTo(x, y);
      }
      cctx.stroke();
    }
    this.concreteTexture = new THREE.CanvasTexture(concreteCanvas);
    this.concreteTexture.wrapS = THREE.RepeatWrapping;
    this.concreteTexture.wrapT = THREE.RepeatWrapping;

    // 2. Cracked Asphalt Road Texture
    const roadCanvas = document.createElement("canvas");
    roadCanvas.width = 512;
    roadCanvas.height = 512;
    const rctx = roadCanvas.getContext("2d");
    rctx.fillStyle = "#2d3748";
    rctx.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 20000; i++) {
      const g = Math.floor(30 + Math.random() * 50);
      rctx.fillStyle = `rgba(${g}, ${g}, ${g}, 0.3)`;
      rctx.fillRect(Math.random() * 512, Math.random() * 512, 3, 3);
    }
    // Yellow hazard road stripe
    rctx.fillStyle = "#eab308";
    rctx.fillRect(240, 0, 32, 512);
    this.roadTexture = new THREE.CanvasTexture(roadCanvas);
    this.roadTexture.wrapS = THREE.RepeatWrapping;
    this.roadTexture.wrapT = THREE.RepeatWrapping;
    this.roadTexture.repeat.set(4, 4);

    // 3. Shattered Brick Masonry Texture
    const brickCanvas = document.createElement("canvas");
    brickCanvas.width = 256;
    brickCanvas.height = 256;
    const bctx = brickCanvas.getContext("2d");
    bctx.fillStyle = "#8a3d31";
    bctx.fillRect(0, 0, 256, 256);
    bctx.strokeStyle = "#cbd5e1";
    bctx.lineWidth = 3;
    for (let y = 0; y < 256; y += 32) {
      bctx.beginPath();
      bctx.moveTo(0, y);
      bctx.lineTo(256, y);
      bctx.stroke();
      const offset = (y % 64 === 0) ? 0 : 32;
      for (let x = offset; x < 256; x += 64) {
        bctx.beginPath();
        bctx.moveTo(x, y);
        bctx.lineTo(x, y + 32);
        bctx.stroke();
      }
    }
    this.brickTexture = new THREE.CanvasTexture(brickCanvas);
    this.brickTexture.wrapS = THREE.RepeatWrapping;
    this.brickTexture.wrapT = THREE.RepeatWrapping;
  }

  init() {
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;

    // Generate procedural PBR textures
    this.generateTextures();

    // Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xdce4ec); // Natural overcast daylight
    this.scene.fog = new THREE.FogExp2(0xdce4ec, 0.006);

    // Camera
    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.5, 1000);
    this.camera.position.set(-62, 44, 68);

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.container.appendChild(this.renderer.domElement);

    // Controls
    this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.maxPolarAngle = Math.PI / 2 - 0.02;
    this.controls.minDistance = 10;
    this.controls.maxDistance = 250;
    this.controls.target.set(0, 0, 0);

    // Setup Components
    this.setupLighting();
    this.createAtmosphericDust();
    this.createRealisticTerrain();
    this.createCollapsedMultiStoryComplex();
    this.createRubbleDebrisFields();
    this.createTrappedSurvivorsInsideVoids();
    this.createHazardOverlays();
    this.createContinuousLiDARPrototype();
    this.createQuadcopter();
    this.createGroundRescueTeam();
    this.createAllThreeRoutes();

    // Event Listeners
    window.addEventListener("resize", () => this.onWindowResize());
    this.renderer.domElement.addEventListener("pointerdown", (e) => this.onPointerDown(e));

    this.animate();
  }

  setupLighting() {
    // Ambient light - realistic outdoor diffuse
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
    this.scene.add(ambientLight);

    // Sun directional light casting real soft shadows
    const sunLight = new THREE.DirectionalLight(0xfffbeb, 1.6);
    sunLight.position.set(60, 95, 45);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 10;
    sunLight.shadow.camera.far = 240;
    const d = 80;
    sunLight.shadow.camera.left = -d;
    sunLight.shadow.camera.right = d;
    sunLight.shadow.camera.top = d;
    sunLight.shadow.camera.bottom = -d;
    sunLight.shadow.bias = -0.0004;
    this.scene.add(sunLight);

    // Hemisphere sky bounce
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x94a3b8, 0.7);
    this.scene.add(hemiLight);
  }

  // Floating atmospheric dust & disaster particulate
  createAtmosphericDust() {
    const count = 1800;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 140;
      pos[i * 3 + 1] = 1.0 + Math.random() * 25;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 140;
    }
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));

    const mat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.35,
      transparent: true,
      opacity: 0.4
    });

    this.dustParticles = new THREE.Points(geo, mat);
    this.scene.add(this.dustParticles);
  }

  createRealisticTerrain() {
    const size = 160;
    const segments = 120;
    const geometry = new THREE.PlaneGeometry(size, size, segments, segments);
    geometry.rotateX(-Math.PI / 2);

    const pos = geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);

      let y = (Math.sin(x * 0.04) * Math.cos(z * 0.04) * 2.5) +
              (Math.sin(x * 0.1) * 0.8) +
              (Math.cos(z * 0.12) * 0.6);

      // Fault rupture trench
      const trenchDist = Math.abs(x * 0.6 + z * 0.8);
      if (trenchDist < 12) {
        y -= (12 - trenchDist) * 0.22;
      }

      // Rubble mound beneath collapsed building
      const distCollapse = Math.hypot(x - 26, z - (-15));
      if (distCollapse < 22) {
        y += (22 - distCollapse) * 0.25;
      }

      // Flat service access road (Zone Gamma)
      if (x > -45 && x < -25) {
        y = y * 0.15;
      }

      pos.setY(i, y);
    }
    geometry.computeVertexNormals();

    const terrainMat = new THREE.MeshStandardMaterial({
      map: this.concreteTexture,
      roughness: 0.9,
      metalness: 0.05,
      flatShading: true
    });

    const terrainMesh = new THREE.Mesh(geometry, terrainMat);
    terrainMesh.receiveShadow = true;
    this.scene.add(terrainMesh);

    // Cleared road strip
    const roadGeo = new THREE.PlaneGeometry(20, 150);
    roadGeo.rotateX(-Math.PI / 2);
    const roadMat = new THREE.MeshStandardMaterial({ map: this.roadTexture, roughness: 0.85 });
    const roadMesh = new THREE.Mesh(roadGeo, roadMat);
    roadMesh.position.set(-35, 0.08, 0);
    roadMesh.receiveShadow = true;
    this.scene.add(roadMesh);
  }

  // Collapsed Multi-Story Building with Exposed Hollow Voids
  createCollapsedMultiStoryComplex() {
    const group = new THREE.Group();

    const concreteMat = new THREE.MeshStandardMaterial({
      map: this.concreteTexture,
      roughness: 0.85
    });
    const brickMat = new THREE.MeshStandardMaterial({
      map: this.brickTexture,
      roughness: 0.9
    });
    const steelMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      roughness: 0.4,
      metalness: 0.8
    });
    const rebarMat = new THREE.MeshStandardMaterial({
      color: 0x991b1b,
      metalness: 0.7,
      roughness: 0.3
    });

    // 1. Bottom Foundation Floor (Hollow Basement Cavity - Victim 1 Location)
    const baseFloor = new THREE.Mesh(new THREE.BoxGeometry(26, 0.9, 20), concreteMat);
    baseFloor.position.set(26, 0.45, -15);
    baseFloor.castShadow = true;
    baseFloor.receiveShadow = true;
    group.add(baseFloor);
    this.buildingSlabs.push(baseFloor);

    // 2. Buckled Intermediate Slab (Creates Surviving Triangle Void)
    const slab2 = new THREE.Mesh(new THREE.BoxGeometry(24, 0.7, 18), concreteMat);
    slab2.position.set(28, 4.4, -14);
    slab2.rotation.z = -0.34; // 19.5 degree slope
    slab2.rotation.y = 0.12;
    slab2.castShadow = true;
    slab2.receiveShadow = true;
    group.add(slab2);
    this.buildingSlabs.push(slab2);

    // 3. Top Pancake Slab (Severely tilted)
    const slab3 = new THREE.Mesh(new THREE.BoxGeometry(22, 0.7, 16), concreteMat);
    slab3.position.set(30, 7.5, -13);
    slab3.rotation.z = -0.52; // 30 degree tilt
    slab3.rotation.x = 0.22;
    slab3.castShadow = true;
    group.add(slab3);
    this.buildingSlabs.push(slab3);

    // 4. Shattered Brick Infill Walls
    const wall1 = new THREE.Mesh(new THREE.BoxGeometry(1.2, 5.0, 14), brickMat);
    wall1.position.set(16, 2.5, -16);
    wall1.rotation.y = 0.15;
    wall1.castShadow = true;
    group.add(wall1);

    const wallBroken = new THREE.Mesh(new THREE.BoxGeometry(10, 3.2, 1.2), brickMat);
    wallBroken.position.set(24, 1.6, -6);
    wallBroken.rotation.z = 0.28;
    group.add(wallBroken);

    // 5. Sheared Concrete Support Pillars & Exposed Steel Rebar
    for (let i = 0; i < 7; i++) {
      const h = 2.8 + Math.random() * 3.5;
      const pillar = new THREE.Mesh(new THREE.BoxGeometry(1.1, h, 1.1), concreteMat);
      pillar.position.set(17 + (i % 3) * 9, h / 2, -22 + Math.floor(i / 3) * 9);
      if (i === 1 || i === 4) {
        pillar.rotation.z = 0.38; // Buckled structural pillar
      }
      pillar.castShadow = true;
      group.add(pillar);
    }

    // Protruding twisted steel rebars
    for (let r = 0; r < 18; r++) {
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 4.2, 6), rebarMat);
      rod.position.set(19 + Math.random() * 18, 3.2 + Math.random() * 4, -22 + Math.random() * 16);
      rod.rotation.set(Math.random() * 1.2, Math.random() * 1.2, Math.random() * 1.2);
      group.add(rod);
    }

    // 6. Secondary Collapsed Commercial Structure (Victim 2 storefront)
    const storefront = new THREE.Mesh(new THREE.BoxGeometry(16, 0.8, 8), concreteMat);
    storefront.position.set(22, 1.2, 18);
    storefront.rotation.z = 0.24;
    group.add(storefront);
    this.buildingSlabs.push(storefront);

    this.scene.add(group);
  }

  createRubbleDebrisFields() {
    const rubbleGroup = new THREE.Group();
    const rubbleMat = new THREE.MeshStandardMaterial({
      map: this.concreteTexture,
      roughness: 0.95,
      flatShading: true
    });

    const rubbleGeos = [
      new THREE.DodecahedronGeometry(1.4, 0),
      new THREE.BoxGeometry(1.8, 0.9, 1.3),
      new THREE.TetrahedronGeometry(1.6, 0)
    ];

    const clusters = [
      { cx: 28, cz: -14, count: 70, spread: 18 },
      { cx: 22, cz: 18, count: 32, spread: 11 },
      { cx: -14, cz: -10, count: 28, spread: 9 },
      { cx: 38, cz: -28, count: 40, spread: 13 },
      { cx: 12, cz: -35, count: 25, spread: 8 }
    ];

    clusters.forEach(c => {
      for (let i = 0; i < c.count; i++) {
        const geo = rubbleGeos[i % rubbleGeos.length];
        const mesh = new THREE.Mesh(geo, rubbleMat);
        const angle = Math.random() * Math.PI * 2;
        const rad = Math.pow(Math.random(), 0.6) * c.spread;
        const x = c.cx + Math.cos(angle) * rad;
        const z = c.cz + Math.sin(angle) * rad;
        const scale = 0.5 + Math.random() * 1.4;

        mesh.position.set(x, scale * 0.45, z);
        mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
        mesh.scale.set(scale, scale, scale);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        rubbleGroup.add(mesh);
      }
    });

    this.scene.add(rubbleGroup);
  }

  // REALISTIC 3D HUMAN MODELS TRAPPED INSIDE THE VOIDS
  createTrappedSurvivorsInsideVoids() {
    const victims = window.RESCUE_CONFIG.victims;

    victims.forEach((v) => {
      const group = new THREE.Group();

      // Create Detailed 3D Human Figure in Survivor Posture (Curled / Resting in cavity)
      const humanGroup = new THREE.Group();

      const skinMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.6 });
      const clothesMat = new THREE.MeshStandardMaterial({ color: 0x1e3a8a, roughness: 0.7 });

      // Head
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 16), skinMat);
      head.position.set(0, 0.4, 0.4);
      humanGroup.add(head);

      // Torso (slanted in survival fetal posture)
      const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.25, 0.8, 12), clothesMat);
      torso.position.set(0, 0, 0);
      torso.rotation.x = Math.PI / 3;
      humanGroup.add(torso);

      // Limbs
      const arm1 = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.6, 8), clothesMat);
      arm1.position.set(-0.35, 0.1, 0.2);
      arm1.rotation.z = Math.PI / 4;
      humanGroup.add(arm1);

      const arm2 = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.6, 8), clothesMat);
      arm2.position.set(0.35, 0.1, 0.2);
      arm2.rotation.z = -Math.PI / 4;
      humanGroup.add(arm2);

      const leg1 = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.09, 0.8, 8), clothesMat);
      leg1.position.set(-0.25, -0.4, -0.2);
      leg1.rotation.x = -Math.PI / 4;
      humanGroup.add(leg1);

      const leg2 = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.09, 0.8, 8), clothesMat);
      leg2.position.set(0.25, -0.4, -0.2);
      leg2.rotation.x = -Math.PI / 4;
      humanGroup.add(leg2);

      // Glowing Vital Signs / UWB Respiration Halo around the person
      const vitalRingGeo = new THREE.RingGeometry(0.7, 0.9, 24);
      vitalRingGeo.rotateX(-Math.PI / 2);
      const vitalRingMat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(v.badgeColor),
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.85
      });
      const vitalRing = new THREE.Mesh(vitalRingGeo, vitalRingMat);
      vitalRing.position.y = -0.1;
      humanGroup.add(vitalRing);

      // Position human inside cavity at exact underground depth
      humanGroup.position.set(v.coords.x, v.coords.y, v.coords.z);
      this.scene.add(humanGroup);
      this.survivorModels.push({ model: humanGroup, victim: v, vitalRing: vitalRing });

      // Surface Target Marker (Poles and beacons rising from void up to surface)
      const rodHeight = Math.max(1.0, v.depthMeters + 2.8);
      const rod = new THREE.Mesh(
        new THREE.CylinderGeometry(0.06, 0.06, rodHeight, 8),
        new THREE.MeshBasicMaterial({ color: new THREE.Color(v.badgeColor) })
      );
      rod.position.y = (rodHeight / 2) - v.depthMeters;
      group.add(rod);

      // Expanding Radar Pulse Rings on surface rubble
      const surfaceRingGeo = new THREE.RingGeometry(1.4, 1.9, 32);
      surfaceRingGeo.rotateX(-Math.PI / 2);
      const surfaceRingMat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(v.badgeColor),
        transparent: true,
        opacity: 0.8,
        side: THREE.DoubleSide
      });
      const surfaceRing = new THREE.Mesh(surfaceRingGeo, surfaceRingMat);
      surfaceRing.position.y = 0.25;
      group.add(surfaceRing);

      // Tactical Floating Diamond Beacon
      const diamond = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.85, 0),
        new THREE.MeshStandardMaterial({
          color: new THREE.Color(v.badgeColor),
          roughness: 0.2,
          metalness: 0.8
        })
      );
      diamond.position.y = rodHeight - v.depthMeters + 0.8;
      group.add(diamond);

      group.position.set(v.surfaceCoords.x, v.surfaceCoords.y, v.surfaceCoords.z);
      group.userData = { victim: v, diamond: diamond, pulseRing: surfaceRing };
      this.scene.add(group);
      this.victimMarkers.push(group);
    });
  }

  createHazardOverlays() {
    const hazardData = window.RESCUE_CONFIG.hazardZones;
    hazardData.forEach(haz => {
      const ringGeo = new THREE.RingGeometry(haz.radius * 0.85, haz.radius, 48);
      ringGeo.rotateX(-Math.PI / 2);
      const ringMat = new THREE.MeshBasicMaterial({
        color: haz.color,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.6
      });
      const ringMesh = new THREE.Mesh(ringGeo, ringMat);
      ringMesh.position.set(haz.coords.x, 0.16, haz.coords.z);
      this.scene.add(ringMesh);

      const cylGeo = new THREE.CylinderGeometry(haz.radius, haz.radius, 3.5, 32, 1, true);
      const cylMat = new THREE.MeshBasicMaterial({
        color: haz.color,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.08
      });
      const cylMesh = new THREE.Mesh(cylGeo, cylMat);
      cylMesh.position.set(haz.coords.x, 1.75, haz.coords.z);
      this.scene.add(cylMesh);
      this.hazardMeshes.push({ ring: ringMesh, cylinder: cylMesh, data: haz });
    });
  }

  // CONTINUOUS REAL-TIME LiDAR MAPPED TERRAIN PROTOTYPE
  createContinuousLiDARPrototype() {
    const count = 48000;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);

    const cTop = new THREE.Color(0xdc2626);   // Red
    const cMid = new THREE.Color(0xf59e0b);   // Amber
    const cLow = new THREE.Color(0x10b981);   // Green
    const cBase = new THREE.Color(0x0284c7);  // Cyan

    for (let i = 0; i < count; i++) {
      const x = (Math.random() - 0.5) * 144;
      const z = (Math.random() - 0.5) * 144;
      let y = 0.3 + (Math.sin(x * 0.05) * Math.cos(z * 0.05) * 2.2);

      if (Math.hypot(x - 26, z - (-15)) < 22) {
        y += Math.random() * 8.5;
      } else {
        y += Math.random() * 1.6;
      }

      positions[i * 3] = x;
      positions[i * 3 + 1] = y + 0.14;
      positions[i * 3 + 2] = z;

      let c;
      if (y > 5.0) c = cTop;
      else if (y > 2.2) c = cMid;
      else if (y > 0.8) c = cLow;
      else c = cBase;

      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }

    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: 0.52,
      vertexColors: true,
      transparent: true,
      opacity: 0.85
    });

    this.lidarPointCloud = new THREE.Points(geometry, material);
    this.scene.add(this.lidarPointCloud);

    // Active Sweeping Laser Beam Line
    const sweepGeo = new THREE.PlaneGeometry(140, 2);
    sweepGeo.rotateX(-Math.PI / 2);
    const sweepMat = new THREE.MeshBasicMaterial({
      color: 0x0284c7,
      transparent: true,
      opacity: 0.4,
      side: THREE.DoubleSide
    });
    this.lidarSweepLine = new THREE.Mesh(sweepGeo, sweepMat);
    this.lidarSweepLine.position.y = 0.35;
    this.scene.add(this.lidarSweepLine);
  }

  // Realistic Quadcopter with Searchlight & Laser Scanning Frustum
  createQuadcopter() {
    this.drone = new THREE.Group();
    const carbonMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.3 });
    const safetyMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.3 });

    // Fuselage
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.42, 1.6), carbonMat);
    this.drone.add(body);

    const hood = new THREE.Mesh(new THREE.ConeGeometry(0.7, 0.5, 4), safetyMat);
    hood.rotateY(Math.PI / 4);
    hood.position.y = 0.35;
    this.drone.add(hood);

    // Carbon arms
    const armGeo = new THREE.CylinderGeometry(0.08, 0.08, 2.4, 8);
    armGeo.rotateZ(Math.PI / 2);

    const arm1 = new THREE.Mesh(armGeo, carbonMat);
    arm1.rotation.y = Math.PI / 4;
    this.drone.add(arm1);

    const arm2 = new THREE.Mesh(armGeo, carbonMat);
    arm2.rotation.y = -Math.PI / 4;
    this.drone.add(arm2);

    // Motors and spinning rotors
    const propMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, transparent: true, opacity: 0.75 });
    const motorPositions = [
      { x: 1.2 * Math.cos(Math.PI / 4), z: 1.2 * Math.sin(Math.PI / 4) },
      { x: -1.2 * Math.cos(Math.PI / 4), z: 1.2 * Math.sin(Math.PI / 4) },
      { x: 1.2 * Math.cos(Math.PI / 4), z: -1.2 * Math.sin(Math.PI / 4) },
      { x: -1.2 * Math.cos(Math.PI / 4), z: -1.2 * Math.sin(Math.PI / 4) }
    ];

    motorPositions.forEach((pos) => {
      const propGroup = new THREE.Group();
      const blade = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.02, 0.16), propMat);
      propGroup.add(blade);
      propGroup.position.set(pos.x, 0.32, pos.z);
      this.drone.add(propGroup);
      this.rotors.push(propGroup);
    });

    // High-Intensity Downward Searchlight
    this.droneSpotlight = new THREE.SpotLight(0xffffff, 4.0, 45, Math.PI / 6, 0.4, 1.2);
    this.droneSpotlight.position.set(0, -0.3, 0);
    this.droneSpotlight.target.position.set(0, -15, 0);
    this.drone.add(this.droneSpotlight);
    this.drone.add(this.droneSpotlight.target);

    // Pulsing Laser Scanning Cone
    const coneGeo = new THREE.ConeGeometry(8.5, 14, 24, 1, true);
    coneGeo.rotateX(Math.PI);
    const coneMat = new THREE.MeshBasicMaterial({
      color: 0x0284c7,
      transparent: true,
      opacity: 0.18,
      side: THREE.DoubleSide
    });
    this.lidarBeam = new THREE.Mesh(coneGeo, coneMat);
    this.lidarBeam.position.y = -7;
    this.drone.add(this.lidarBeam);

    this.drone.position.set(-14, 13.5, -10);
    this.scene.add(this.drone);
  }

  createGroundRescueTeam() {
    const teamData = window.RESCUE_CONFIG.groundTeam;
    this.groundTeamMarker = new THREE.Group();

    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(1.4, 1.4, 0.4, 24),
      new THREE.MeshStandardMaterial({ color: 0x16a34a })
    );
    this.groundTeamMarker.add(base);

    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.06, 3.2, 8),
      new THREE.MeshStandardMaterial({ color: 0x475569 })
    );
    pole.position.y = 1.6;
    this.groundTeamMarker.add(pole);

    const beacon = new THREE.Mesh(
      new THREE.SphereGeometry(0.45, 16, 16),
      new THREE.MeshBasicMaterial({ color: 0x22c55e })
    );
    beacon.position.y = 3.2;
    this.groundTeamMarker.add(beacon);

    const pulseRing = new THREE.Mesh(
      new THREE.RingGeometry(2.0, 2.5, 32).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0x16a34a, transparent: true, opacity: 0.8, side: THREE.DoubleSide })
    );
    pulseRing.position.y = 0.2;
    this.groundTeamMarker.add(pulseRing);
    this.groundTeamPulse = pulseRing;

    this.groundTeamMarker.position.set(teamData.currentLocation.x, teamData.currentLocation.y, teamData.currentLocation.z);
    this.scene.add(this.groundTeamMarker);
  }

  // SIMULTANEOUS 3-ROUTE SYSTEM: Render Safest (Green), Moderate (Orange), Hard (Red) Together
  createAllThreeRoutes(targetVictimId = "VIC-01") {
    if (this.safestRouteMesh) this.scene.remove(this.safestRouteMesh);
    if (this.moderateRouteMesh) this.scene.remove(this.moderateRouteMesh);
    if (this.hardRouteMesh) this.scene.remove(this.hardRouteMesh);

    const targetVictim = window.RESCUE_CONFIG.victims.find(v => v.id === targetVictimId) || window.RESCUE_CONFIG.victims[0];
    const start = window.RESCUE_CONFIG.groundTeam.currentLocation;
    const end = targetVictim.surfaceCoords;

    // 1. SAFEST ROUTE (Green: Navigates cleared corridor, minimal hazard exposure)
    const safestPoints = [
      new THREE.Vector3(start.x, 0.6, start.z),
      new THREE.Vector3(-38, 0.6, 22),
      new THREE.Vector3(-32, 0.6, 0),
      new THREE.Vector3(-24, 0.7, -8),
      new THREE.Vector3(end.x, 0.6, end.z)
    ];
    const safestCurve = new THREE.CatmullRomCurve3(safestPoints);
    const safestGeo = new THREE.TubeGeometry(safestCurve, 60, 0.45, 8, false);
    const safestMat = new THREE.MeshStandardMaterial({
      color: 0x16a34a,
      emissive: 0x15803d,
      emissiveIntensity: 0.7,
      roughness: 0.3
    });
    this.safestRouteMesh = new THREE.Mesh(safestGeo, safestMat);
    this.scene.add(this.safestRouteMesh);

    // 2. MODERATE ROUTE (Orange: Balances travel time with moderate slope climb)
    const modPoints = [
      new THREE.Vector3(start.x, 0.6, start.z),
      new THREE.Vector3(-25, 0.9, 28),
      new THREE.Vector3(-15, 1.2, 10),
      new THREE.Vector3(-10, 1.0, 0),
      new THREE.Vector3(end.x, 0.6, end.z)
    ];
    const modCurve = new THREE.CatmullRomCurve3(modPoints);
    const modGeo = new THREE.TubeGeometry(modCurve, 60, 0.38, 8, false);
    const modMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      emissive: 0xd97706,
      emissiveIntensity: 0.7,
      roughness: 0.3
    });
    this.moderateRouteMesh = new THREE.Mesh(modGeo, modMat);
    this.scene.add(this.moderateRouteMesh);

    // 3. HARD / HAZARDOUS ROUTE (Red: Cuts straight through unstable pancake collapse)
    const hardPoints = [
      new THREE.Vector3(start.x, 0.6, start.z),
      new THREE.Vector3(start.x * 0.65 + end.x * 0.35, 2.2, start.z * 0.65 + end.z * 0.35),
      new THREE.Vector3(start.x * 0.35 + end.x * 0.65, 2.5, start.z * 0.35 + end.z * 0.65),
      new THREE.Vector3(end.x, 0.6, end.z)
    ];
    const hardCurve = new THREE.CatmullRomCurve3(hardPoints);
    const hardGeo = new THREE.TubeGeometry(hardCurve, 60, 0.38, 8, false);
    const hardMat = new THREE.MeshStandardMaterial({
      color: 0xdc2626,
      emissive: 0xb91c1c,
      emissiveIntensity: 0.8,
      roughness: 0.3
    });
    this.hardRouteMesh = new THREE.Mesh(hardGeo, hardMat);
    this.scene.add(this.hardRouteMesh);
  }

  setRouteHighlight(mode) {
    if (!this.safestRouteMesh || !this.moderateRouteMesh || !this.hardRouteMesh) return;
    if (mode === "safest") {
      this.safestRouteMesh.scale.set(1.2, 1.2, 1.2);
      this.moderateRouteMesh.scale.set(0.8, 0.8, 0.8);
      this.hardRouteMesh.scale.set(0.8, 0.8, 0.8);
      this.safestRouteMesh.material.opacity = 1.0;
      this.moderateRouteMesh.material.opacity = 0.45;
      this.hardRouteMesh.material.opacity = 0.45;
    } else if (mode === "quickest") {
      this.safestRouteMesh.scale.set(0.8, 0.8, 0.8);
      this.moderateRouteMesh.scale.set(1.2, 1.2, 1.2);
      this.hardRouteMesh.scale.set(0.8, 0.8, 0.8);
      this.safestRouteMesh.material.opacity = 0.45;
      this.moderateRouteMesh.material.opacity = 1.0;
      this.hardRouteMesh.material.opacity = 0.45;
    } else {
      this.safestRouteMesh.scale.set(0.8, 0.8, 0.8);
      this.moderateRouteMesh.scale.set(0.8, 0.8, 0.8);
      this.hardRouteMesh.scale.set(1.2, 1.2, 1.2);
      this.safestRouteMesh.material.opacity = 0.45;
      this.moderateRouteMesh.material.opacity = 0.45;
      this.hardRouteMesh.material.opacity = 1.0;
    }
  }

  // Cutaway / X-Ray Toggle to reveal inside collapsed buildings
  toggleXrayMode() {
    this.xrayMode = !this.xrayMode;
    this.buildingSlabs.forEach(slab => {
      slab.material.transparent = this.xrayMode;
      slab.material.opacity = this.xrayMode ? 0.28 : 1.0;
    });
    return this.xrayMode;
  }

  setCameraView(viewMode) {
    if (viewMode === "drone_pov") {
      const dp = this.drone.position;
      this.camera.position.set(dp.x, dp.y + 2, dp.z + 4);
      this.controls.target.set(dp.x, 0, dp.z - 8);
    } else if (viewMode === "void_inspect") {
      // Zoom right into the underground void where Survivor 1 is trapped!
      const v = window.RESCUE_CONFIG.victims[0];
      this.camera.position.set(v.coords.x - 4, v.coords.y + 3, v.coords.z + 5);
      this.controls.target.set(v.coords.x, v.coords.y, v.coords.z);
      if (!this.xrayMode) this.toggleXrayMode();
    } else if (viewMode === "top_down") {
      this.camera.position.set(0, 120, 0);
      this.controls.target.set(0, 0, 0);
    } else {
      this.camera.position.set(-62, 44, 68);
      this.controls.target.set(0, 0, 0);
    }
  }

  focusVictim(victimId) {
    const marker = this.victimMarkers.find(m => m.userData.victim.id === victimId);
    if (!marker) return;
    this.selectedVictimId = victimId;

    const vp = marker.position;
    this.controls.target.set(vp.x, vp.y, vp.z);
    this.camera.position.set(vp.x - 16, vp.y + 13, vp.z + 18);

    this.drone.position.set(vp.x, 13.5, vp.z);
    this.createAllThreeRoutes(victimId);
  }

  onPointerDown(event) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObjects(this.victimMarkers, true);

    if (intersects.length > 0) {
      let root = intersects[0].object;
      while (root.parent && !root.userData.victim) {
        root = root.parent;
      }
      if (root && root.userData.victim) {
        const victim = root.userData.victim;
        this.focusVictim(victim.id);
        if (this.onVictimSelectCallback) {
          this.onVictimSelectCallback(victim);
        }
      }
    }
  }

  onWindowResize() {
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  animate() {
    requestAnimationFrame(() => this.animate());
    const elapsed = this.clock.getElapsedTime();

    // Rotors spin
    this.rotors.forEach((rotor, idx) => {
      const dir = idx % 2 === 0 ? 1 : -1;
      rotor.rotation.y += dir * 0.45;
    });

    // Drone gentle hovering motion
    if (this.drone) {
      this.drone.position.y = 13.5 + Math.sin(elapsed * 2.2) * 0.25;
      this.drone.rotation.z = Math.sin(elapsed * 1.4) * 0.02;
    }

    // Laser scanning sweep plane
    if (this.lidarSweepLine) {
      this.lidarSweepLine.position.z = Math.sin(elapsed * 0.8) * 62;
    }

    // Gentle swirling atmospheric dust
    if (this.dustParticles) {
      this.dustParticles.rotation.y = elapsed * 0.02;
    }

    // Survivors chest breathing movement and vital sign pulse
    this.survivorModels.forEach(item => {
      const bpm = item.victim.vitals.respirationDetected ? item.victim.vitals.breathsPerMin : 12;
      const respFreq = (bpm / 60) * 2 * Math.PI;
      // Chest breathing expansion
      const scaleY = 1.0 + Math.sin(elapsed * respFreq) * 0.08;
      item.model.scale.set(1.0, scaleY, 1.0);

      // Vital halo pulsation
      if (item.vitalRing) {
        const vScale = 1.0 + ((elapsed * (bpm / 30)) % 1.0) * 0.6;
        item.vitalRing.scale.set(vScale, vScale, 1);
        item.vitalRing.material.opacity = Math.max(0.2, 0.9 - ((vScale - 1.0) / 0.6));
      }
    });

    // Surface pulse rings & rotating diamond beacons
    this.victimMarkers.forEach(group => {
      const pulseRing = group.userData.pulseRing;
      const diamond = group.userData.diamond;

      if (pulseRing) {
        const scale = 1.0 + ((elapsed * 1.6) % 1.0) * 1.8;
        pulseRing.scale.set(scale, scale, 1);
        pulseRing.material.opacity = Math.max(0, 0.9 - ((scale - 1.0) / 1.8));
      }
      if (diamond) diamond.rotation.y = elapsed * 1.2;
    });

    if (this.groundTeamPulse) {
      const gScale = 1.0 + ((elapsed * 1.2) % 1.0) * 2.2;
      this.groundTeamPulse.scale.set(gScale, gScale, 1);
      this.groundTeamPulse.material.opacity = Math.max(0, 0.8 - ((gScale - 1.0) / 2.2));
    }

    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }
}

window.DisasterScene3D = DisasterScene3D;
