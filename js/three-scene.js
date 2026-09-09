/**
 * AeroScan True-Color Photogrammetry & LiDAR 3D Disaster Zone
 * Complete 3D Terrain in Color (Drone 4K Camera + LiDAR Fusion)
 * Detailed 3D Human Bodies Trapped in Rubble
 */

class DisasterScene3D {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;
    this.drone = null;
    this.droneCameraView = false;
    this.lidarPointCloud = null;
    this.lidarSweepLine = null;

    this.hazardMeshes = [];
    this.victimMarkers = [];
    this.humanSurvivors = [];
    this.buildingMeshes = [];
    this.groundTeamMarker = null;

    // Simultaneous 3-Route Meshes
    this.safestRouteMesh = null;
    this.moderateRouteMesh = null;
    this.hardRouteMesh = null;

    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.rotors = [];
    this.clock = new THREE.Clock();
    this.selectedVictimId = "VIC-01";
    this.onVictimSelectCallback = null;

    this.init();
  }

  // Generate rich true-color aerial photogrammetry textures
  generateColorAerialTextures() {
    // 1. Full-Color Aerial Orthomosaic (Asphalt, Concrete Rubble, Earth, Grass Borders)
    const aerialCanvas = document.createElement("canvas");
    aerialCanvas.width = 1024;
    aerialCanvas.height = 1024;
    const ctx = aerialCanvas.getContext("2d");

    // Base earth/ground (warm grayish-tan soil)
    ctx.fillStyle = "#8a7e72";
    ctx.fillRect(0, 0, 1024, 1024);

    // Patchy vegetation on perimeter
    ctx.fillStyle = "#4a6741";
    for (let i = 0; i < 60; i++) {
      const x = (Math.random() < 0.5 ? Math.random() * 250 : 774 + Math.random() * 250);
      const y = Math.random() * 1024;
      ctx.beginPath();
      ctx.arc(x, y, 40 + Math.random() * 80, 0, Math.PI * 2);
      ctx.fill();
    }

    // Asphalt Main Road with yellow lane lines
    ctx.fillStyle = "#333842";
    ctx.fillRect(160, 0, 160, 1024);
    ctx.strokeStyle = "#facc15";
    ctx.lineWidth = 6;
    ctx.setLineDash([24, 24]);
    ctx.beginPath();
    ctx.moveTo(240, 0); ctx.lineTo(240, 1024);
    ctx.stroke();
    ctx.setLineDash([]);

    // Earthquake fault rupture fissure (dark chasm)
    ctx.strokeStyle = "#1e1b18";
    ctx.lineWidth = 14;
    ctx.beginPath();
    ctx.moveTo(200, 1024);
    ctx.bezierCurveTo(450, 700, 520, 400, 800, 0);
    ctx.stroke();

    // Crushed Concrete Rubble Zone (blended greys, dust, and gravel)
    for (let i = 0; i < 180; i++) {
      const cx = 550 + (Math.random() - 0.5) * 450;
      const cy = 500 + (Math.random() - 0.5) * 450;
      const r = 20 + Math.random() * 60;
      const shade = Math.floor(130 + Math.random() * 70);
      ctx.fillStyle = `rgb(${shade}, ${shade - 5}, ${shade - 10})`;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Texture grain and scattered debris stones
    for (let i = 0; i < 40000; i++) {
      const s = Math.floor(80 + Math.random() * 120);
      ctx.fillStyle = `rgba(${s}, ${s}, ${s}, 0.35)`;
      ctx.fillRect(Math.random() * 1024, Math.random() * 1024, 2, 2);
    }

    this.aerialTexture = new THREE.CanvasTexture(aerialCanvas);
    this.aerialTexture.wrapS = THREE.RepeatWrapping;
    this.aerialTexture.wrapT = THREE.RepeatWrapping;

    // 2. Concrete Building Wall Texture (Stucco, cracks & weathered paint)
    const bWallCanvas = document.createElement("canvas");
    bWallCanvas.width = 512;
    bWallCanvas.height = 512;
    const wctx = bWallCanvas.getContext("2d");
    wctx.fillStyle = "#c2c7ce";
    wctx.fillRect(0, 0, 512, 512);

    // Weathered blue commercial building paint band
    wctx.fillStyle = "#3b82f6";
    wctx.fillRect(0, 80, 512, 60);

    // Broken window openings
    wctx.fillStyle = "#0f172a";
    for (let x = 30; x < 480; x += 90) {
      wctx.fillRect(x, 180, 55, 75);
      wctx.fillRect(x, 320, 55, 75);
    }

    // Fracture cracks
    wctx.strokeStyle = "#1e293b";
    wctx.lineWidth = 3;
    wctx.beginPath();
    wctx.moveTo(120, 0); wctx.lineTo(220, 200); wctx.lineTo(190, 360); wctx.lineTo(320, 512);
    wctx.stroke();

    this.buildingWallTexture = new THREE.CanvasTexture(bWallCanvas);

    // 3. Red Brick Masonry Texture
    const brickCanvas = document.createElement("canvas");
    brickCanvas.width = 256;
    brickCanvas.height = 256;
    const bkctx = brickCanvas.getContext("2d");
    bkctx.fillStyle = "#b91c1c";
    bkctx.fillRect(0, 0, 256, 256);
    bkctx.strokeStyle = "#e2e8f0";
    bkctx.lineWidth = 2.5;
    for (let y = 0; y < 256; y += 32) {
      bkctx.beginPath();
      bkctx.moveTo(0, y); bkctx.lineTo(256, y);
      bkctx.stroke();
      const offset = (y % 64 === 0) ? 0 : 32;
      for (let x = offset; x < 256; x += 64) {
        bkctx.beginPath();
        bkctx.moveTo(x, y); bkctx.lineTo(x, y + 32);
        bkctx.stroke();
      }
    }
    this.brickTexture = new THREE.CanvasTexture(brickCanvas);
    this.brickTexture.wrapS = THREE.RepeatWrapping;
    this.brickTexture.wrapT = THREE.RepeatWrapping;
    this.brickTexture.repeat.set(2, 2);
  }

  init() {
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;

    this.generateColorAerialTextures();

    // Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xbdd0e2); // Realistic daylight atmospheric sky
    this.scene.fog = new THREE.FogExp2(0xbdd0e2, 0.005);

    // Camera
    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.5, 1000);
    this.camera.position.set(-58, 42, 64);

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.container.appendChild(this.renderer.domElement);

    // OrbitControls
    this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    this.controls.maxPolarAngle = Math.PI / 2 - 0.02;
    this.controls.minDistance = 3;
    this.controls.maxDistance = 250;
    this.controls.target.set(0, 0, 0);

    // Setup Components
    this.setupRealisticLighting();
    this.createFullColorDisasterTerrain();
    this.createRealisticCollapsedComplex();
    this.createColorRubbleFields();
    this.createCrushedVehicleAndDebris();
    this.createRealisticTrappedHumanBodies();
    this.createHazardOverlays();
    this.createQuadcopterDrone();
    this.createGroundRescueTeam();
    this.createAllThreeRoutes();

    // Window Resize & Mouse Raycaster
    window.addEventListener("resize", () => this.onWindowResize());
    this.renderer.domElement.addEventListener("pointerdown", (e) => this.onPointerDown(e));

    this.animate();
  }

  setupRealisticLighting() {
    // Ambient light - bright, daylight overcast fill
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.3);
    this.scene.add(ambientLight);

    // Strong direct sunlight casting realistic shadows
    const sunLight = new THREE.DirectionalLight(0xfffbeb, 1.8);
    sunLight.position.set(55, 90, 45);
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
    sunLight.shadow.bias = -0.0003;
    this.scene.add(sunLight);

    // Sky dome fill light
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x85929e, 0.75);
    this.scene.add(hemiLight);
  }

  // 1. COMPLETE 3D TERRAIN IN FULL COLOR (Orthomosaic Photogrammetry Mesh)
  createFullColorDisasterTerrain() {
    const size = 160;
    const segments = 120;
    const geometry = new THREE.PlaneGeometry(size, size, segments, segments);
    geometry.rotateX(-Math.PI / 2);

    const pos = geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);

      // Realistic topographical elevation
      let y = (Math.sin(x * 0.04) * Math.cos(z * 0.04) * 2.8) +
              (Math.sin(x * 0.09) * 0.9) +
              (Math.cos(z * 0.11) * 0.7);

      // Deep fault chasm rupture
      const trenchDist = Math.abs(x * 0.6 + z * 0.8);
      if (trenchDist < 14) {
        y -= (14 - trenchDist) * 0.28;
      }

      // Rubble mound around commercial building collapse
      const distCollapse = Math.hypot(x - 26, z - (-15));
      if (distCollapse < 24) {
        y += (24 - distCollapse) * 0.28;
      }

      // Flat road corridor (Zone Gamma)
      if (x > -45 && x < -25) {
        y = y * 0.12;
      }

      pos.setY(i, y);
    }
    geometry.computeVertexNormals();

    // Photogrammetry textured material in vibrant color
    const terrainMaterial = new THREE.MeshStandardMaterial({
      map: this.aerialTexture,
      roughness: 0.85,
      metalness: 0.1,
      flatShading: false
    });

    const terrainMesh = new THREE.Mesh(geometry, terrainMaterial);
    terrainMesh.receiveShadow = true;
    this.scene.add(terrainMesh);
  }

  // 2. Realistic Multi-Story Collapsed Commercial Building
  createRealisticCollapsedComplex() {
    const group = new THREE.Group();

    const wallMat = new THREE.MeshStandardMaterial({ map: this.buildingWallTexture, roughness: 0.8 });
    const slabMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.85, flatShading: true });
    const brickMat = new THREE.MeshStandardMaterial({ map: this.brickTexture, roughness: 0.9 });
    const rebarMat = new THREE.MeshStandardMaterial({ color: 0xb91c1c, metalness: 0.8, roughness: 0.3 });

    // Ground Floor Foundation (Basement Cavity Roof)
    const f1 = new THREE.Mesh(new THREE.BoxGeometry(26, 0.9, 20), slabMat);
    f1.position.set(26, 0.45, -15);
    f1.castShadow = true; f1.receiveShadow = true;
    group.add(f1);

    // Tilted Second Floor Slab (Triangle of Life void beneath it)
    const f2 = new THREE.Mesh(new THREE.BoxGeometry(24, 0.7, 18), slabMat);
    f2.position.set(28, 4.4, -14);
    f2.rotation.z = -0.34;
    f2.rotation.y = 0.12;
    f2.castShadow = true; f2.receiveShadow = true;
    group.add(f2);
    this.buildingMeshes.push(f2);

    // Pancake Third Floor Slab
    const f3 = new THREE.Mesh(new THREE.BoxGeometry(22, 0.7, 16), slabMat);
    f3.position.set(30, 7.5, -13);
    f3.rotation.z = -0.52;
    f3.rotation.x = 0.22;
    f3.castShadow = true;
    group.add(f3);
    this.buildingMeshes.push(f3);

    // Surviving Standing Exterior Walls with Windows
    const standingWall = new THREE.Mesh(new THREE.BoxGeometry(1.2, 9.0, 18), wallMat);
    standingWall.position.set(13, 4.5, -15);
    standingWall.castShadow = true;
    group.add(standingWall);

    // Collapsed Brick Infill Walls
    const brokenBrick = new THREE.Mesh(new THREE.BoxGeometry(12, 3.5, 1.4), brickMat);
    brokenBrick.position.set(24, 1.75, -5);
    brokenBrick.rotation.z = 0.32;
    group.add(brokenBrick);

    // Buckled Support Pillars
    for (let i = 0; i < 7; i++) {
      const h = 2.8 + Math.random() * 3.5;
      const pillar = new THREE.Mesh(new THREE.BoxGeometry(1.2, h, 1.2), slabMat);
      pillar.position.set(17 + (i % 3) * 9, h / 2, -22 + Math.floor(i / 3) * 9);
      if (i === 1 || i === 4) pillar.rotation.z = 0.38;
      pillar.castShadow = true;
      group.add(pillar);
    }

    // Exposed Twisted Steel Rebar protruding from fractured slabs
    for (let r = 0; r < 20; r++) {
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 4.5, 6), rebarMat);
      rod.position.set(18 + Math.random() * 20, 3.2 + Math.random() * 4.5, -22 + Math.random() * 18);
      rod.rotation.set(Math.random() * 1.4, Math.random() * 1.4, Math.random() * 1.4);
      group.add(rod);
    }

    // Secondary Collapsed Storefront Structure (Survivor 2)
    const storefrontSlab = new THREE.Mesh(new THREE.BoxGeometry(16, 0.8, 9), slabMat);
    storefrontSlab.position.set(22, 1.4, 18);
    storefrontSlab.rotation.z = 0.28;
    group.add(storefrontSlab);

    this.scene.add(group);
  }

  // 3. Full-Color Rubble Boulders & Concrete Blocks
  createColorRubbleFields() {
    const rubbleGroup = new THREE.Group();

    const concreteMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.9, flatShading: true });
    const brickChunkMat = new THREE.MeshStandardMaterial({ map: this.brickTexture, roughness: 0.85 });

    const rubbleGeos = [
      new THREE.DodecahedronGeometry(1.4, 0),
      new THREE.BoxGeometry(1.8, 0.9, 1.3),
      new THREE.TetrahedronGeometry(1.6, 0)
    ];

    const clusters = [
      { cx: 28, cz: -14, count: 75, spread: 18 },
      { cx: 22, cz: 18, count: 35, spread: 11 },
      { cx: -14, cz: -10, count: 30, spread: 9 },
      { cx: 38, cz: -28, count: 42, spread: 13 },
      { cx: -32, cz: 24, count: 24, spread: 8 }
    ];

    clusters.forEach(c => {
      for (let i = 0; i < c.count; i++) {
        const geo = rubbleGeos[i % rubbleGeos.length];
        const mat = (i % 3 === 0) ? brickChunkMat : concreteMat;
        const mesh = new THREE.Mesh(geo, mat);
        const angle = Math.random() * Math.PI * 2;
        const rad = Math.pow(Math.random(), 0.6) * c.spread;
        const x = c.cx + Math.cos(angle) * rad;
        const z = c.cz + Math.sin(angle) * rad;
        const scale = 0.5 + Math.random() * 1.5;

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

  // Crushed vehicle in parking ramp (Survivor 5)
  createCrushedVehicleAndDebris() {
    const group = new THREE.Group();

    // Red car body crushed under a fallen beam
    const carMat = new THREE.MeshStandardMaterial({ color: 0xef4444, metalness: 0.7, roughness: 0.3 });
    const carBody = new THREE.Mesh(new THREE.BoxGeometry(4.2, 1.1, 2.0), carMat);
    carBody.position.set(12, 0.6, -35);
    carBody.rotation.z = 0.15;
    carBody.castShadow = true;
    group.add(carBody);

    // Concrete slab crushing the roof
    const slabCrush = new THREE.Mesh(
      new THREE.BoxGeometry(6.0, 0.7, 3.5),
      new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.9 })
    );
    slabCrush.position.set(12.5, 1.5, -35);
    slabCrush.rotation.z = -0.18;
    slabCrush.castShadow = true;
    group.add(slabCrush);

    this.scene.add(group);
  }

  // 4. REALISTIC HUMAN BODIES STUCK IN THE RUBBLE (Visible from Camera & Void Inspect)
  createRealisticTrappedHumanBodies() {
    const victims = window.RESCUE_CONFIG.victims;

    victims.forEach((v) => {
      const humanGroup = new THREE.Group();

      // Realistic skin & clothing materials
      const skinMat = new THREE.MeshStandardMaterial({ color: 0xe0a96d, roughness: 0.5 });
      const hairMat = new THREE.MeshStandardMaterial({ color: 0x27272a, roughness: 0.8 });
      const shirtMat = new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.7 }); // Blue emergency shirt
      const pantsMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.8 }); // Dark jeans

      // 1. Head with Hair
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 16, 16), skinMat);
      head.position.set(0, 0.45, 0.35);
      humanGroup.add(head);

      const hair = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 16), hairMat);
      hair.position.set(0, 0.52, 0.32);
      hair.scale.set(0.95, 0.7, 0.95);
      humanGroup.add(hair);

      // 2. Torso (trapped at an angle between rubble)
      const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.24, 0.75, 12), shirtMat);
      torso.position.set(0, 0, 0);
      torso.rotation.x = Math.PI / 3;
      humanGroup.add(torso);

      // 3. Right Arm (REACHING OUTWARD from beneath the slab toward the light!)
      const armReaching = new THREE.Group();
      const upperArm = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.07, 0.45, 8), shirtMat);
      upperArm.position.y = 0.22;
      armReaching.add(upperArm);

      const forearm = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.06, 0.45, 8), skinMat);
      forearm.position.set(0, 0.55, 0.15);
      forearm.rotation.x = Math.PI / 4;
      armReaching.add(forearm);

      // Hand reaching upward
      const hand = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.14, 0.05), skinMat);
      hand.position.set(0, 0.8, 0.35);
      armReaching.add(hand);

      armReaching.position.set(0.32, 0.15, 0.1);
      armReaching.rotation.z = -Math.PI / 3;
      humanGroup.add(armReaching);

      // 4. Left Arm (protecting head/curled)
      const armCurled = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.07, 0.5, 8), shirtMat);
      armCurled.position.set(-0.3, 0.2, 0.25);
      armCurled.rotation.z = Math.PI / 3;
      armCurled.rotation.x = Math.PI / 4;
      humanGroup.add(armCurled);

      // 5. Legs (pinned under concrete block)
      const leg1 = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.09, 0.75, 8), pantsMat);
      leg1.position.set(-0.2, -0.38, -0.2);
      leg1.rotation.x = -Math.PI / 4;
      humanGroup.add(leg1);

      const leg2 = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.09, 0.75, 8), pantsMat);
      leg2.position.set(0.2, -0.38, -0.2);
      leg2.rotation.x = -Math.PI / 4;
      humanGroup.add(leg2);

      // Heavy Concrete Slab visibly pinning their lower legs!
      const pinningSlab = new THREE.Mesh(
        new THREE.BoxGeometry(2.4, 0.45, 1.8),
        new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.9 })
      );
      pinningSlab.position.set(0, -0.15, -0.4);
      pinningSlab.rotation.z = 0.22;
      pinningSlab.castShadow = true;
      humanGroup.add(pinningSlab);

      // Vital Aura Halo around the trapped human
      const vitalRingGeo = new THREE.RingGeometry(0.75, 0.95, 24);
      vitalRingGeo.rotateX(-Math.PI / 2);
      const vitalRingMat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(v.badgeColor),
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.85
      });
      const vitalRing = new THREE.Mesh(vitalRingGeo, vitalRingMat);
      vitalRing.position.y = 0.05;
      humanGroup.add(vitalRing);

      // Place the 3D human body at their exact trapped coordinates
      humanGroup.position.set(v.coords.x, v.surfaceCoords.y - 0.2, v.coords.z);
      this.scene.add(humanGroup);
      this.humanSurvivors.push({ model: humanGroup, torso: torso, armReaching: armReaching, victim: v });

      // Surface Target Marker (Beacon & Pulse Ring on the rubble surface above them)
      const markerGroup = new THREE.Group();
      const col = new THREE.Color(v.badgeColor);

      // Vertical penetration indicator rod
      const rodGeo = new THREE.CylinderGeometry(0.06, 0.06, v.depthMeters + 2.5, 8);
      const rod = new THREE.Mesh(rodGeo, new THREE.MeshBasicMaterial({ color: col }));
      rod.position.y = (v.depthMeters + 2.5) / 2;
      markerGroup.add(rod);

      // Surface radar pulse rings
      const pulseRingGeo = new THREE.RingGeometry(1.3, 1.8, 32).rotateX(-Math.PI / 2);
      const pulseRingMat = new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.8, side: THREE.DoubleSide });
      const pulseRing = new THREE.Mesh(pulseRingGeo, pulseRingMat);
      pulseRing.position.y = 0.2;
      markerGroup.add(pulseRing);

      // Tactical Diamond Beacon
      const diamond = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.85, 0),
        new THREE.MeshStandardMaterial({ color: col, roughness: 0.2, metalness: 0.8 })
      );
      diamond.position.y = v.depthMeters + 2.5 + 0.8;
      markerGroup.add(diamond);

      markerGroup.position.set(v.surfaceCoords.x, v.surfaceCoords.y, v.surfaceCoords.z);
      markerGroup.userData = { victim: v, diamond: diamond, pulseRing: pulseRing };
      this.scene.add(markerGroup);
      this.victimMarkers.push(markerGroup);
    });
  }

  // 5. Procedural 3D Hazard Cost Zones
  createHazardOverlays() {
    const hazardData = window.RESCUE_CONFIG.hazardZones;
    hazardData.forEach(haz => {
      const ringGeo = new THREE.RingGeometry(haz.radius * 0.85, haz.radius, 48).rotateX(-Math.PI / 2);
      const ringMat = new THREE.MeshBasicMaterial({ color: haz.color, side: THREE.DoubleSide, transparent: true, opacity: 0.6 });
      const ringMesh = new THREE.Mesh(ringGeo, ringMat);
      ringMesh.position.set(haz.coords.x, 0.16, haz.coords.z);
      this.scene.add(ringMesh);

      const cylGeo = new THREE.CylinderGeometry(haz.radius, haz.radius, 3.5, 32, 1, true);
      const cylMat = new THREE.MeshBasicMaterial({ color: haz.color, side: THREE.DoubleSide, transparent: true, opacity: 0.08 });
      const cylMesh = new THREE.Mesh(cylGeo, cylMat);
      cylMesh.position.set(haz.coords.x, 1.75, haz.coords.z);
      this.scene.add(cylMesh);
      this.hazardMeshes.push({ ring: ringMesh, cylinder: cylMesh, data: haz });
    });
  }

  // 6. Realistic Quadcopter Drone Model with 4K Gimbal Camera & Spotlight
  createQuadcopterDrone() {
    this.drone = new THREE.Group();
    const carbonMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.3 });
    const accentMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.3 });

    // Fuselage Body
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.42, 1.6), carbonMat);
    this.drone.add(body);

    const hood = new THREE.Mesh(new THREE.ConeGeometry(0.7, 0.5, 4), accentMat);
    hood.rotateY(Math.PI / 4);
    hood.position.y = 0.35;
    this.drone.add(hood);

    // Carbon Fiber Arms
    const armGeo = new THREE.CylinderGeometry(0.08, 0.08, 2.4, 8).rotateZ(Math.PI / 2);
    const arm1 = new THREE.Mesh(armGeo, carbonMat);
    arm1.rotation.y = Math.PI / 4;
    this.drone.add(arm1);

    const arm2 = new THREE.Mesh(armGeo, carbonMat);
    arm2.rotation.y = -Math.PI / 4;
    this.drone.add(arm2);

    // 4 Rotors with Spinning Blurred Blades
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

    // 4K Optical Camera Gimbal + Downward LiDAR Sensor Turret
    const gimbal = new THREE.Mesh(
      new THREE.SphereGeometry(0.35, 16, 12),
      new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.2, metalness: 0.8 })
    );
    gimbal.position.y = -0.3;
    this.drone.add(gimbal);

    // Dynamic Searchlight illuminating the rubble
    const spot = new THREE.SpotLight(0xffffff, 4.0, 45, Math.PI / 5, 0.4, 1.2);
    spot.position.set(0, -0.3, 0);
    spot.target.position.set(0, -15, 0);
    this.drone.add(spot);
    this.drone.add(spot.target);

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

  // 7. SIMULTANEOUS 3-ROUTE SYSTEM (Safest Green, Moderate Orange, Hard Red)
  createAllThreeRoutes(targetVictimId = "VIC-01") {
    if (this.safestRouteMesh) this.scene.remove(this.safestRouteMesh);
    if (this.moderateRouteMesh) this.scene.remove(this.moderateRouteMesh);
    if (this.hardRouteMesh) this.scene.remove(this.hardRouteMesh);

    const targetVictim = window.RESCUE_CONFIG.victims.find(v => v.id === targetVictimId) || window.RESCUE_CONFIG.victims[0];
    const start = window.RESCUE_CONFIG.groundTeam.currentLocation;
    const end = targetVictim.surfaceCoords;

    // 1. SAFEST ROUTE (Green)
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

    // 2. MODERATE ROUTE (Orange)
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

    // 3. HARD / HAZARDOUS ROUTE (Red)
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

  // Camera views with Close-Up Trapped Survivor focus!
  setCameraView(viewMode) {
    if (viewMode === "drone_pov") {
      const dp = this.drone.position;
      this.camera.position.set(dp.x, dp.y + 1.8, dp.z + 3.5);
      this.controls.target.set(dp.x, 0, dp.z - 10);
    } else if (viewMode === "void_inspect") {
      // Zoom right in front of the trapped 3D human body (Survivor 1)
      const targetSurvivor = this.humanSurvivors[0];
      if (targetSurvivor) {
        const hp = targetSurvivor.model.position;
        this.camera.position.set(hp.x - 3.5, hp.y + 2.4, hp.z + 3.8);
        this.controls.target.set(hp.x, hp.y + 0.3, hp.z);
      }
    } else if (viewMode === "top_down") {
      this.camera.position.set(0, 115, 0);
      this.controls.target.set(0, 0, 0);
    } else {
      // Default isometric overview showing full colored terrain
      this.camera.position.set(-58, 42, 64);
      this.controls.target.set(0, 0, 0);
    }
  }

  focusVictim(victimId) {
    this.selectedVictimId = victimId;
    const survivor = this.humanSurvivors.find(s => s.victim.id === victimId);

    if (survivor) {
      const hp = survivor.model.position;
      // Animate camera directly to the trapped human!
      this.controls.target.set(hp.x, hp.y + 0.3, hp.z);
      this.camera.position.set(hp.x - 4.2, hp.y + 2.8, hp.z + 4.5);

      // Drone flies directly overhead to position sensors
      this.drone.position.set(hp.x, 13.5, hp.z);
      this.createAllThreeRoutes(victimId);
    }
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

    // Drone flight & gentle organic hover
    if (this.drone) {
      this.drone.position.y = 13.5 + Math.sin(elapsed * 2.2) * 0.25;
      this.drone.rotation.z = Math.sin(elapsed * 1.4) * 0.02;
    }

    // Trapped humans: physical chest-wall breathing movement & arm motion
    this.humanSurvivors.forEach((item) => {
      const bpm = item.victim.vitals.respirationDetected ? item.victim.vitals.breathsPerMin : 12;
      const respFreq = (bpm / 60) * 2 * Math.PI;

      // Realistic chest expansion
      const chestExpansion = 1.0 + Math.sin(elapsed * respFreq) * 0.09;
      if (item.torso) item.torso.scale.set(1.0, chestExpansion, 1.0);

      // Reaching arm slight movement trying to signal
      if (item.armReaching) {
        item.armReaching.rotation.z = -Math.PI / 3 + Math.sin(elapsed * 1.5) * 0.08;
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
