/**
 * 3D Disaster Zone WebGL Simulation - Light Tactical SAR Theme
 * Continuous LiDAR Prototype + Simultaneous 3-Route Rendering (Safest, Moderate, Hard)
 * Smart India Hackathon (SIH) Mission Control
 */

class DisasterScene3D {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;
    this.drone = null;
    this.lidarSweepPlane = null;
    this.lidarPointCloud = null;
    this.lidarBeam = null;
    this.hazardMeshes = [];
    this.victimMarkers = [];
    this.unconfirmedMarkers = [];
    this.groundTeamMarker = null;

    // Simultaneous 3-Route Tubes
    this.safestRouteMesh = null;
    this.moderateRouteMesh = null;
    this.hardRouteMesh = null;
    this.multiRouteLines = [];

    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.rotors = [];
    this.clock = new THREE.Clock();
    this.selectedVictimId = null;
    this.onVictimSelectCallback = null;

    this.init();
  }

  init() {
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;

    // 1. Scene with Crisp Light Daytime Tactical SAR Palette
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xecf0f5); // Clean light daylight atmosphere
    this.scene.fog = new THREE.FogExp2(0xecf0f5, 0.0055);

    // 2. Camera
    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.5, 1000);
    this.camera.position.set(-60, 48, 70);

    // 3. Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.container.appendChild(this.renderer.domElement);

    // 4. OrbitControls
    this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    this.controls.maxPolarAngle = Math.PI / 2 - 0.02;
    this.controls.minDistance = 12;
    this.controls.maxDistance = 260;
    this.controls.target.set(0, 0, 0);

    // 5. Lighting for Light Theme
    this.setupLighting();

    // 6. Terrain & Collapsed Structures
    this.createTerrain();
    this.createCollapsedStructures();
    this.createRubbleFields();
    this.createHazardOverlays();

    // 7. CONTINUOUS LiDAR Point Cloud Prototype (Always visible & actively scanning)
    this.createContinuousLiDARPrototype();

    // 8. Quadcopter Drone with Scanning Laser Frustum
    this.createQuadcopter();

    // 9. Ground Rescue Team
    this.createGroundRescueTeam();

    // 10. Survivor & Missing Person Markers
    this.createVictimMarkers();
    this.createUnconfirmedBeacons();

    // 11. Simultaneous 3-Route System (Green Safest, Orange Moderate, Red Hard)
    this.createAllThreeRoutes();

    // 12. Listeners
    window.addEventListener("resize", () => this.onWindowResize());
    this.renderer.domElement.addEventListener("pointerdown", (e) => this.onPointerDown(e));

    // Animation Loop
    this.animate();
  }

  setupLighting() {
    // Ambient light - bright, daylight overcast fill
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.45);
    this.scene.add(ambientLight);

    // Primary sunlight directional light
    const dirLight = new THREE.DirectionalLight(0xfff7ed, 1.7);
    dirLight.position.set(55, 90, 45);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 10;
    dirLight.shadow.camera.far = 240;
    const d = 80;
    dirLight.shadow.camera.left = -d;
    dirLight.shadow.camera.right = d;
    dirLight.shadow.camera.top = d;
    dirLight.shadow.camera.bottom = -d;
    dirLight.shadow.bias = -0.0003;
    this.scene.add(dirLight);

    // Sky dome light for natural outdoor GI
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0xcfd8dc, 0.8);
    this.scene.add(hemiLight);
  }

  createTerrain() {
    const size = 160;
    const segments = 120;
    const geometry = new THREE.PlaneGeometry(size, size, segments, segments);
    geometry.rotateX(-Math.PI / 2);

    const pos = geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);

      let y = (Math.sin(x * 0.04) * Math.cos(z * 0.04) * 2.4) +
              (Math.sin(x * 0.1) * 0.9) +
              (Math.cos(z * 0.12) * 0.7);

      // Fault rupture trench through center
      const trenchDist = Math.abs(x * 0.6 + z * 0.8);
      if (trenchDist < 12) {
        y -= (12 - trenchDist) * 0.22;
      }

      // Debris elevation around building collapse
      const distCollapse = Math.hypot(x - 26, z - (-15));
      if (distCollapse < 22) {
        y += (22 - distCollapse) * 0.28;
      }

      // Cleared concrete service road
      if (x > -45 && x < -25) {
        y = y * 0.2;
      }

      pos.setY(i, y);
    }
    geometry.computeVertexNormals();

    // Natural light concrete & asphalt material
    const material = new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      roughness: 0.85,
      metalness: 0.05,
      flatShading: true
    });

    const terrainMesh = new THREE.Mesh(geometry, material);
    terrainMesh.receiveShadow = true;
    this.scene.add(terrainMesh);

    // Light theme tactical grid
    const grid = new THREE.GridHelper(160, 32, 0x0284c7, 0xcfd8dc);
    grid.position.y = 0.04;
    this.scene.add(grid);
  }

  createCollapsedStructures() {
    const group = new THREE.Group();
    const slabMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.85 });
    const beamMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.75 });
    const rebarMat = new THREE.MeshStandardMaterial({ color: 0xb91c1c, metalness: 0.7, roughness: 0.4 });

    // Ground floor slab (cracked)
    const slab1 = new THREE.Mesh(new THREE.BoxGeometry(24, 0.8, 18), slabMat);
    slab1.position.set(26, 0.4, -15);
    slab1.castShadow = true;
    slab1.receiveShadow = true;
    group.add(slab1);

    // Tilted second floor slab
    const slab2 = new THREE.Mesh(new THREE.BoxGeometry(22, 0.6, 16), slabMat);
    slab2.position.set(28, 4.2, -14);
    slab2.rotation.z = -0.32;
    slab2.rotation.y = 0.15;
    slab2.castShadow = true;
    group.add(slab2);

    // Collapsed top roof slab pancake
    const slab3 = new THREE.Mesh(new THREE.BoxGeometry(20, 0.6, 15), slabMat);
    slab3.position.set(30, 7.0, -13);
    slab3.rotation.z = -0.48;
    slab3.rotation.x = 0.22;
    slab3.castShadow = true;
    group.add(slab3);

    // Broken support pillars
    for (let i = 0; i < 6; i++) {
      const pillarHeight = 2.5 + Math.random() * 4;
      const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.9, pillarHeight, 0.9), beamMat);
      pillar.position.set(16 + (i % 3) * 10, pillarHeight / 2, -22 + Math.floor(i / 3) * 12);
      if (i === 1 || i === 4) pillar.rotation.z = 0.4;
      pillar.castShadow = true;
      group.add(pillar);
    }

    // Exposed rebar rods
    for (let r = 0; r < 14; r++) {
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 3.5, 6), rebarMat);
      rod.position.set(20 + Math.random() * 16, 3.5 + Math.random() * 3, -20 + Math.random() * 12);
      rod.rotation.set(Math.random() * 0.8, Math.random() * 0.8, Math.random() * 0.8);
      group.add(rod);
    }

    // Collapsed storefront masonry
    const wallCollapsed = new THREE.Mesh(new THREE.BoxGeometry(14, 0.8, 5), slabMat);
    wallCollapsed.position.set(21, 0.8, 17);
    wallCollapsed.rotation.z = 0.25;
    group.add(wallCollapsed);

    this.scene.add(group);
  }

  createRubbleFields() {
    const rubbleGroup = new THREE.Group();
    const stoneMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.9, flatShading: true });

    const rubbleGeos = [
      new THREE.DodecahedronGeometry(1.2, 0),
      new THREE.BoxGeometry(1.6, 0.8, 1.2),
      new THREE.TetrahedronGeometry(1.5, 0)
    ];

    const clusters = [
      { cx: 28, cz: -14, count: 65, spread: 18 },
      { cx: 22, cz: 18, count: 30, spread: 10 },
      { cx: -14, cz: -10, count: 25, spread: 9 },
      { cx: -22, cz: 8, count: 35, spread: 12 }
    ];

    clusters.forEach(c => {
      for (let i = 0; i < c.count; i++) {
        const geo = rubbleGeos[i % rubbleGeos.length];
        const mesh = new THREE.Mesh(geo, stoneMat);
        const angle = Math.random() * Math.PI * 2;
        const rad = Math.pow(Math.random(), 0.6) * c.spread;
        const x = c.cx + Math.cos(angle) * rad;
        const z = c.cz + Math.sin(angle) * rad;
        const scale = 0.5 + Math.random() * 1.5;

        mesh.position.set(x, scale * 0.4, z);
        mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
        mesh.scale.set(scale, scale, scale);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        rubbleGroup.add(mesh);
      }
    });

    this.scene.add(rubbleGroup);
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
        opacity: 0.65
      });
      const ringMesh = new THREE.Mesh(ringGeo, ringMat);
      ringMesh.position.set(haz.coords.x, 0.16, haz.coords.z);
      this.scene.add(ringMesh);

      const cylGeo = new THREE.CylinderGeometry(haz.radius, haz.radius, 4, 32, 1, true);
      const cylMat = new THREE.MeshBasicMaterial({
        color: haz.color,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.10
      });
      const cylMesh = new THREE.Mesh(cylGeo, cylMat);
      cylMesh.position.set(haz.coords.x, 2, haz.coords.z);
      this.scene.add(cylMesh);
      this.hazardMeshes.push({ ring: ringMesh, cylinder: cylMesh, data: haz });
    });
  }

  // CONTINUOUS LiDAR Mapped Terrain Prototype
  createContinuousLiDARPrototype() {
    const particleCount = 48000;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);

    // Realistic elevation ramp: Deep Blue/Turquoise -> Bright Green -> Amber -> Crimson
    const colorTop = new THREE.Color(0xdc2626);    // Crimson peak
    const colorHigh = new THREE.Color(0xf59e0b);   // Amber
    const colorMid = new THREE.Color(0x10b981);    // Emerald green
    const colorLow = new THREE.Color(0x0284c7);    // Deep Cyan/Blue

    for (let i = 0; i < particleCount; i++) {
      const x = (Math.random() - 0.5) * 144;
      const z = (Math.random() - 0.5) * 144;
      let y = 0.25 + (Math.sin(x * 0.05) * Math.cos(z * 0.05) * 2.2);

      if (Math.hypot(x - 26, z - (-15)) < 22) {
        y += Math.random() * 8.5;
      } else {
        y += Math.random() * 1.6;
      }

      positions[i * 3] = x;
      positions[i * 3 + 1] = y + 0.12; // Just above the mesh
      positions[i * 3 + 2] = z;

      let c;
      if (y > 5.0) c = colorTop;
      else if (y > 2.2) c = colorHigh;
      else if (y > 0.8) c = colorMid;
      else c = colorLow;

      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }

    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: 0.55,
      vertexColors: true,
      transparent: true,
      opacity: 0.88
    });

    this.lidarPointCloud = new THREE.Points(geometry, material);
    this.lidarPointCloud.visible = true; // CONTINUOUSLY VISIBLE AS PROTOTYPE
    this.scene.add(this.lidarPointCloud);

    // Active Sweeping Laser Beam Line
    const sweepGeo = new THREE.PlaneGeometry(140, 2);
    sweepGeo.rotateX(-Math.PI / 2);
    const sweepMat = new THREE.MeshBasicMaterial({
      color: 0x0284c7,
      transparent: true,
      opacity: 0.45,
      side: THREE.DoubleSide
    });
    this.lidarSweepPlane = new THREE.Mesh(sweepGeo, sweepMat);
    this.lidarSweepPlane.position.y = 0.35;
    this.scene.add(this.lidarSweepPlane);
  }

  createQuadcopter() {
    this.drone = new THREE.Group();
    const carbonMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.3 });
    const brightOrange = new THREE.MeshStandardMaterial({ color: 0xe11d48, roughness: 0.3 });

    const body = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.45, 1.6), carbonMat);
    this.drone.add(body);

    const hood = new THREE.Mesh(new THREE.ConeGeometry(0.7, 0.5, 4), brightOrange);
    hood.rotateY(Math.PI / 4);
    hood.position.y = 0.35;
    this.drone.add(hood);

    const armGeo = new THREE.CylinderGeometry(0.08, 0.08, 2.4, 8);
    armGeo.rotateZ(Math.PI / 2);

    const arm1 = new THREE.Mesh(armGeo, carbonMat);
    arm1.rotation.y = Math.PI / 4;
    this.drone.add(arm1);

    const arm2 = new THREE.Mesh(armGeo, carbonMat);
    arm2.rotation.y = -Math.PI / 4;
    this.drone.add(arm2);

    const propMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, transparent: true, opacity: 0.75 });
    const motorPositions = [
      { x: 1.2 * Math.cos(Math.PI / 4), z: 1.2 * Math.sin(Math.PI / 4) },
      { x: -1.2 * Math.cos(Math.PI / 4), z: 1.2 * Math.sin(Math.PI / 4) },
      { x: 1.2 * Math.cos(Math.PI / 4), z: -1.2 * Math.sin(Math.PI / 4) },
      { x: -1.2 * Math.cos(Math.PI / 4), z: -1.2 * Math.sin(Math.PI / 4) }
    ];

    motorPositions.forEach((pos) => {
      const propGroup = new THREE.Group();
      const blade1 = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.02, 0.16), propMat);
      propGroup.add(blade1);
      propGroup.position.set(pos.x, 0.32, pos.z);
      this.drone.add(propGroup);
      this.rotors.push(propGroup);
    });

    // Dynamic LiDAR Scanning Laser Frustum (Pulsing Cone to ground)
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

  // Survivor Markers with distinctive badges for:
  // - Phone + Breathing + Heartbeat
  // - Phone Only
  // - Radar Breathing Only
  createVictimMarkers() {
    const victims = window.RESCUE_CONFIG.victims;

    victims.forEach(v => {
      const group = new THREE.Group();
      const col = new THREE.Color(v.badgeColor);

      // Depth rod
      const rodHeight = Math.max(1.0, v.depthMeters + 2.6);
      const rod = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.08, rodHeight, 8),
        new THREE.MeshBasicMaterial({ color: col })
      );
      rod.position.y = (rodHeight / 2) - v.depthMeters;
      group.add(rod);

      // Sub-surface body sphere in cavity
      const sphere = new THREE.Mesh(
        new THREE.SphereGeometry(0.65, 16, 16),
        new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.4 })
      );
      sphere.position.y = -v.depthMeters;
      group.add(sphere);

      // Surface radar pulse rings
      const pulseRing = new THREE.Mesh(
        new THREE.RingGeometry(1.3, 1.8, 32).rotateX(-Math.PI / 2),
        new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.85, side: THREE.DoubleSide })
      );
      pulseRing.position.y = 0.25;
      group.add(pulseRing);

      // Top rotating octahedron beacon
      const diamond = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.9, 0),
        new THREE.MeshStandardMaterial({ color: col, roughness: 0.2, metalness: 0.7 })
      );
      diamond.position.y = rodHeight - v.depthMeters + 0.9;
      group.add(diamond);

      group.position.set(v.surfaceCoords.x, v.surfaceCoords.y, v.surfaceCoords.z);
      group.userData = { victim: v, diamond: diamond, pulseRing: pulseRing };
      this.scene.add(group);
      this.victimMarkers.push(group);
    });
  }

  // Unconfirmed / Scanning Beacons representing remaining missing individuals
  createUnconfirmedBeacons() {
    const coords = [
      { x: -28, z: -35, name: "Missing #6 (Pending Scan)" },
      { x: 34, z: 32, name: "Missing #7 (Acoustic Anomaly)" },
      { x: -5, z: 40, name: "Missing #8 (Weak RF Echo)" },
      { x: 44, z: -8, name: "Missing #9 (Rubble Pile South)" },
      { x: -40, z: -15, name: "Missing #10 (Collapsed Wall)" }
    ];

    coords.forEach(pt => {
      const group = new THREE.Group();
      const dot = new THREE.Mesh(
        new THREE.SphereGeometry(0.35, 12, 12),
        new THREE.MeshBasicMaterial({ color: 0x94a3b8, transparent: true, opacity: 0.7 })
      );
      dot.position.y = 0.8;
      group.add(dot);

      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.9, 1.2, 24).rotateX(-Math.PI / 2),
        new THREE.MeshBasicMaterial({ color: 0x94a3b8, transparent: true, opacity: 0.4, side: THREE.DoubleSide })
      );
      ring.position.y = 0.2;
      group.add(ring);

      group.position.set(pt.x, 0.4, pt.z);
      group.userData = { isUnconfirmed: true, name: pt.name, ring: ring };
      this.scene.add(group);
      this.unconfirmedMarkers.push(group);
    });
  }

  // SIMULTANEOUS 3-ROUTE SYSTEM: Render Safest (Green), Moderate (Orange), and Hard (Red) Together!
  createAllThreeRoutes(targetVictimId = "VIC-01") {
    // Remove existing route meshes
    if (this.safestRouteMesh) this.scene.remove(this.safestRouteMesh);
    if (this.moderateRouteMesh) this.scene.remove(this.moderateRouteMesh);
    if (this.hardRouteMesh) this.scene.remove(this.hardRouteMesh);

    const targetVictim = window.RESCUE_CONFIG.victims.find(v => v.id === targetVictimId) || window.RESCUE_CONFIG.victims[0];
    const start = window.RESCUE_CONFIG.groundTeam.currentLocation;
    const end = targetVictim.surfaceCoords;

    // 1. SAFEST ROUTE (Green: Navigates cleared corridor, hugs low-risk perimeter)
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
      color: 0x16a34a, // Bold Emergency Green
      emissive: 0x15803d,
      emissiveIntensity: 0.7,
      roughness: 0.3
    });
    this.safestRouteMesh = new THREE.Mesh(safestGeo, safestMat);
    this.scene.add(this.safestRouteMesh);

    // 2. MODERATE ROUTE (Orange: Balances transit speed with minor rubble climb)
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
      color: 0xf59e0b, // Bold Warning Orange
      emissive: 0xd97706,
      emissiveIntensity: 0.7,
      roughness: 0.3
    });
    this.moderateRouteMesh = new THREE.Mesh(modGeo, modMat);
    this.scene.add(this.moderateRouteMesh);

    // 3. HARD / HAZARDOUS ROUTE (Red: Direct Euclidean cut through dangerous tilt-slab collapse)
    const hardPoints = [
      new THREE.Vector3(start.x, 0.6, start.z),
      new THREE.Vector3(start.x * 0.65 + end.x * 0.35, 2.2, start.z * 0.65 + end.z * 0.35),
      new THREE.Vector3(start.x * 0.35 + end.x * 0.65, 2.5, start.z * 0.35 + end.z * 0.65),
      new THREE.Vector3(end.x, 0.6, end.z)
    ];
    const hardCurve = new THREE.CatmullRomCurve3(hardPoints);
    const hardGeo = new THREE.TubeGeometry(hardCurve, 60, 0.38, 8, false);
    const hardMat = new THREE.MeshStandardMaterial({
      color: 0xdc2626, // Crimson Alert Red
      emissive: 0xb91c1c,
      emissiveIntensity: 0.8,
      roughness: 0.3
    });
    this.hardRouteMesh = new THREE.Mesh(hardGeo, hardMat);
    this.scene.add(this.hardRouteMesh);
  }

  // Focus single route mode or keep all 3 visible
  setRouteHighlight(mode) {
    if (!this.safestRouteMesh || !this.moderateRouteMesh || !this.hardRouteMesh) return;
    if (mode === "safest") {
      this.safestRouteMesh.scale.set(1.2, 1.2, 1.2);
      this.moderateRouteMesh.scale.set(0.8, 0.8, 0.8);
      this.hardRouteMesh.scale.set(0.8, 0.8, 0.8);
      this.safestRouteMesh.material.opacity = 1.0;
      this.moderateRouteMesh.material.opacity = 0.5;
      this.hardRouteMesh.material.opacity = 0.5;
    } else if (mode === "quickest") {
      this.safestRouteMesh.scale.set(0.8, 0.8, 0.8);
      this.moderateRouteMesh.scale.set(1.2, 1.2, 1.2);
      this.hardRouteMesh.scale.set(0.8, 0.8, 0.8);
      this.safestRouteMesh.material.opacity = 0.5;
      this.moderateRouteMesh.material.opacity = 1.0;
      this.hardRouteMesh.material.opacity = 0.5;
    } else {
      this.safestRouteMesh.scale.set(0.8, 0.8, 0.8);
      this.moderateRouteMesh.scale.set(0.8, 0.8, 0.8);
      this.hardRouteMesh.scale.set(1.2, 1.2, 1.2);
      this.safestRouteMesh.material.opacity = 0.5;
      this.moderateRouteMesh.material.opacity = 0.5;
      this.hardRouteMesh.material.opacity = 1.0;
    }
  }

  setCameraView(viewMode) {
    if (viewMode === "drone_pov") {
      const dp = this.drone.position;
      this.camera.position.set(dp.x, dp.y + 2, dp.z + 4);
      this.controls.target.set(dp.x, 0, dp.z - 8);
    } else if (viewMode === "team_pov") {
      const tp = window.RESCUE_CONFIG.groundTeam.currentLocation;
      this.camera.position.set(tp.x + 6, tp.y + 5, tp.z + 6);
      this.controls.target.set(0, 2, 0);
    } else if (viewMode === "top_down") {
      this.camera.position.set(0, 120, 0);
      this.controls.target.set(0, 0, 0);
    } else {
      this.camera.position.set(-60, 48, 70);
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

    // Spin propellers
    this.rotors.forEach((rotor, idx) => {
      const dir = idx % 2 === 0 ? 1 : -1;
      rotor.rotation.y += dir * 0.45;
    });

    // Drone flight & hover motion
    if (this.drone) {
      this.drone.position.y = 13.5 + Math.sin(elapsed * 2.2) * 0.25;
      this.drone.rotation.z = Math.sin(elapsed * 1.4) * 0.02;
    }

    // Pulse LiDAR beam
    if (this.lidarBeam) {
      this.lidarBeam.material.opacity = 0.16 + Math.sin(elapsed * 5) * 0.07;
    }

    // Sweeping laser line across disaster terrain (CONTINUOUS PROTOTYPE SCAN)
    if (this.lidarSweepPlane) {
      this.lidarSweepPlane.position.z = Math.sin(elapsed * 0.8) * 62;
    }

    // Survivor pulse rings & rotating beacons
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

    // Ground team beacon pulse
    if (this.groundTeamPulse) {
      const gScale = 1.0 + ((elapsed * 1.2) % 1.0) * 2.2;
      this.groundTeamPulse.scale.set(gScale, gScale, 1);
      this.groundTeamPulse.material.opacity = Math.max(0, 0.8 - ((gScale - 1.0) / 2.2));
    }

    // Unconfirmed beacons gentle blink
    this.unconfirmedMarkers.forEach(group => {
      const ring = group.userData.ring;
      if (ring) {
        ring.material.opacity = 0.25 + Math.sin(elapsed * 3 + group.position.x) * 0.2;
      }
    });

    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }
}

window.DisasterScene3D = DisasterScene3D;
