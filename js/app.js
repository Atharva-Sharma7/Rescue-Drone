/**
 * AeroScan SAR-3D - Master Controller
 * Sequential Mission Pipeline & High-Realism 3D Reconstruction
 */

document.addEventListener("DOMContentLoaded", () => {
  if (window.lucide) lucide.createIcons();

  // 1. Initialize 3D Disaster Scene
  const scene3D = new DisasterScene3D("three-viewport");

  // 2. Initialize Path Planner
  const router = new RescuePathPlanner(
    window.RESCUE_CONFIG.hazardZones,
    window.RESCUE_CONFIG.groundTeam.currentLocation
  );

  let currentVictimId = window.RESCUE_CONFIG.victims[0].id;
  let currentRouteMode = "safest"; // "safest", "quickest", "hard"
  let currentFilter = "all";
  let activeStep = 1;

  // 3. Populate Victims in Dropdown & Bottom Triage Tray
  const dropdown = document.getElementById("victim-select-dropdown");
  const trayContainer = document.getElementById("victim-cards-container");

  function renderVictimCards() {
    dropdown.innerHTML = "";
    trayContainer.innerHTML = "";

    const evaluatedList = window.victimEngine.rankVictims(window.RESCUE_CONFIG.victims);

    evaluatedList.forEach((item, index) => {
      const v = item.raw;

      // Filter check
      if (currentFilter === "phone_breathing" && !v.detectionType.includes("BREATHING")) return;
      if (currentFilter === "phone_only" && v.detectionType !== "PHONE_ONLY") return;
      if (currentFilter === "radar_only" && v.detectionType !== "RADAR_BREATHING_ONLY") return;

      // Dropdown option
      const opt = document.createElement("option");
      opt.value = v.id;
      opt.textContent = `${v.tag} • ${v.detectionBadge} [Depth: ${v.depthMeters}m]`;
      if (v.id === currentVictimId) opt.selected = true;
      dropdown.appendChild(opt);

      // Bottom Survivor Card
      const card = document.createElement("div");
      card.className = `victim-card ${v.id === currentVictimId ? "selected" : ""}`;
      card.id = `v-card-${v.id}`;

      card.innerHTML = `
        <div class="v-card-top">
          <span class="v-id">#${index + 1} ${v.id}</span>
          <span class="v-detection-pill" style="background: ${v.badgeColor}15; color: ${v.badgeColor}; border: 1px solid ${v.badgeColor}40;">
            ${v.vitals.respirationDetected ? (v.vitals.cardiacMotionDetected ? 'Phone+ECG+Resp' : 'Phone+Resp') : (v.detectionType === 'PHONE_ONLY' ? 'Phone RF' : 'Radar Only')}
          </span>
        </div>
        <div style="font-size: 11px; font-weight: 700; color: var(--text-main); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
          ${v.tag}
        </div>
        <div class="v-card-stats">
          <div>Depth: <span class="highlight">${v.depthMeters}m</span> &bull; ${v.accessibility.extractionDifficulty}</div>
          <div>Vitals: <span class="highlight">${v.vitals.respirationDetected ? v.vitals.breathsPerMin + ' bpm' : 'None (RF Active)'}</span></div>
        </div>
        <div style="margin-top: 4px; display: flex; gap: 4px;">
          <button class="btn-tactical" style="padding: 3px 6px; font-size: 10px; flex: 1; justify-content: center;" onclick="openSensorModal('${v.id}')">
            <i data-lucide="activity" style="width:11px; height:11px;"></i> SENSORS
          </button>
        </div>
      `;

      card.addEventListener("click", (e) => {
        if (!e.target.closest("button")) {
          selectVictim(v.id);
        }
      });

      trayContainer.appendChild(card);
    });

    if (window.lucide) lucide.createIcons();
  }

  renderVictimCards();

  // Filter Buttons
  document.querySelectorAll(".filter-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".filter-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      currentFilter = btn.dataset.filter;
      renderVictimCards();
    });
  });

  // 4. Handle Victim Selection
  function selectVictim(victimId) {
    currentVictimId = victimId;
    dropdown.value = victimId;

    document.querySelectorAll(".victim-card").forEach(c => c.classList.remove("selected"));
    const activeCard = document.getElementById(`v-card-${victimId}`);
    if (activeCard) activeCard.classList.add("selected");

    scene3D.focusVictim(victimId);
    updateRouteCalculations();
  }

  scene3D.onVictimSelectCallback = (victim) => {
    selectVictim(victim.id);
  };

  dropdown.addEventListener("change", (e) => {
    selectVictim(e.target.value);
  });

  // 5. Simultaneous 3-Route Side-by-Side Calculation & Highlight
  function updateRouteCalculations() {
    const targetVictim = window.RESCUE_CONFIG.victims.find(v => v.id === currentVictimId);
    if (!targetVictim) return;

    const safestRes = router.planRouteToVictim(targetVictim, "safest");
    const modRes = router.planRouteToVictim(targetVictim, "quickest");
    const hardRes = router.planRouteToVictim(targetVictim, "shortest");

    document.getElementById("dist-safest").textContent = `${safestRes.metrics.distanceMeters} m`;
    document.getElementById("time-safest").textContent = `${safestRes.metrics.estimatedTimeMinutes} min`;

    document.getElementById("dist-moderate").textContent = `${modRes.metrics.distanceMeters} m`;
    document.getElementById("time-moderate").textContent = `${modRes.metrics.estimatedTimeMinutes} min`;

    document.getElementById("dist-hard").textContent = `${hardRes.metrics.distanceMeters} m`;
    document.getElementById("time-hard").textContent = `${hardRes.metrics.estimatedTimeMinutes} min`;

    highlightRouteRow(currentRouteMode);
  }

  function highlightRouteRow(mode) {
    document.querySelectorAll(".route-row").forEach(r => {
      r.classList.remove("selected-safest", "selected-moderate", "selected-hard");
    });

    const targetVictim = window.RESCUE_CONFIG.victims.find(v => v.id === currentVictimId);
    if (!targetVictim) return;

    let activeRes;
    const modeTag = document.getElementById("route-active-mode-tag");

    if (mode === "safest") {
      document.getElementById("row-route-safest").classList.add("selected-safest");
      activeRes = router.planRouteToVictim(targetVictim, "safest");
      modeTag.textContent = "SAFEST CORRIDOR";
      modeTag.style.color = "var(--route-safest)";
    } else if (mode === "quickest") {
      document.getElementById("row-route-moderate").classList.add("selected-moderate");
      activeRes = router.planRouteToVictim(targetVictim, "quickest");
      modeTag.textContent = "MODERATE RESPONSE";
      modeTag.style.color = "var(--route-moderate)";
    } else {
      document.getElementById("row-route-hard").classList.add("selected-hard");
      activeRes = router.planRouteToVictim(targetVictim, "shortest");
      modeTag.textContent = "HARD / PERILOUS";
      modeTag.style.color = "var(--route-hard)";
    }

    scene3D.setRouteHighlight(mode);

    const dirContainer = document.getElementById("route-directions-content");
    dirContainer.innerHTML = `<ol style="margin-left: 16px;">${activeRes.tacticalDirections.map(s => `<li>${s}</li>`).join("")}</ol>`;
  }

  document.getElementById("row-route-safest").addEventListener("click", () => {
    currentRouteMode = "safest";
    highlightRouteRow("safest");
  });
  document.getElementById("row-route-moderate").addEventListener("click", () => {
    currentRouteMode = "quickest";
    highlightRouteRow("quickest");
  });
  document.getElementById("row-route-hard").addEventListener("click", () => {
    currentRouteMode = "hard";
    highlightRouteRow("hard");
  });

  // 6. Multi-Victim Sequence Planning
  const btnMultiVictim = document.getElementById("btn-multi-victim-opt");
  btnMultiVictim.addEventListener("click", () => {
    const tour = router.computeMultiVictimSequence(window.RESCUE_CONFIG.victims);
    scene3D.displayMultiVictimTour(tour);

    const modeTag = document.getElementById("route-active-mode-tag");
    modeTag.textContent = "MULTI-SURVIVOR SEQUENCE";
    modeTag.style.color = "var(--accent-purple)";

    const dirContainer = document.getElementById("route-directions-content");
    let html = `<div style="font-weight:700; color:var(--accent-purple); margin-bottom:6px;">Priority Sequence (All 5 Survivors):</div><ol style="margin-left: 16px;">`;
    tour.sequence.forEach(step => {
      html += `<li><strong>Stop ${step.stepNumber}: ${step.victim.tag}</strong> &bull; Leg: ${step.legDistanceMeters}m (${step.legTimeMinutes}m extraction). Cumulative: ${step.cumulativeMinutes} mins.</li>`;
    });
    html += `</ol><div style="font-size:10.5px; color:var(--text-muted); margin-top:6px; font-style:italic;">${tour.rationale}</div>`;
    dirContainer.innerHTML = html;
  });

  // 7. 4-Step Mission Pipeline (In Sequence)
  const stepButtons = document.querySelectorAll(".workflow-step");
  function setWorkflowStep(stepNum) {
    activeStep = stepNum;
    stepButtons.forEach(b => b.classList.remove("active"));
    const activeBtn = document.getElementById(`step-btn-${stepNum}`);
    if (activeBtn) activeBtn.classList.add("active");

    if (stepNum === 1) {
      // Step 1: Aerial 3D LiDAR Survey
      scene3D.setCameraView("iso");
      if (scene3D.lidarPointCloud) scene3D.lidarPointCloud.visible = true;
      if (scene3D.xrayMode) scene3D.toggleXrayMode();
    } else if (stepNum === 2) {
      // Step 2: Sub-Surface Victim Localization & Cutaway
      scene3D.setCameraView("void_inspect");
    } else if (stepNum === 3) {
      // Step 3: Explainable Triage Analysis
      openSensorModal(currentVictimId);
    } else if (stepNum === 4) {
      // Step 4: 3D Route Planning (Safest / Moderate / Hard)
      scene3D.setCameraView("iso");
      updateRouteCalculations();
    }
  }

  stepButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      setWorkflowStep(parseInt(btn.dataset.step, 10));
    });
  });

  // 8. Camera Controls & Void X-Ray
  document.getElementById("btn-cam-iso").addEventListener("click", (e) => {
    setActiveCamBtn(e.currentTarget);
    scene3D.setCameraView("iso");
  });
  document.getElementById("btn-cam-drone").addEventListener("click", (e) => {
    setActiveCamBtn(e.currentTarget);
    scene3D.setCameraView("drone_pov");
  });
  document.getElementById("btn-cam-void").addEventListener("click", (e) => {
    setActiveCamBtn(e.currentTarget);
    scene3D.setCameraView("void_inspect");
  });
  document.getElementById("btn-cam-top").addEventListener("click", (e) => {
    setActiveCamBtn(e.currentTarget);
    scene3D.setCameraView("top_down");
  });

  function setActiveCamBtn(activeBtn) {
    document.querySelectorAll(".view-btn").forEach(b => b.classList.remove("active"));
    activeBtn.classList.add("active");
  }

  const btnToggleXray = document.getElementById("btn-toggle-xray");
  btnToggleXray.addEventListener("click", () => {
    const isXray = scene3D.toggleXrayMode();
    btnToggleXray.classList.toggle("active", isXray);
  });

  // 9. Sensor Inspection Modal
  const modal = document.getElementById("sensor-modal");
  const modalCloseBtn = document.getElementById("modal-close-btn");
  let activeModalVictim = null;

  window.openSensorModal = function(victimId) {
    const victim = window.RESCUE_CONFIG.victims.find(v => v.id === victimId);
    if (!victim) return;
    activeModalVictim = victim;

    document.getElementById("modal-victim-title").textContent = `${victim.tag} &mdash; ${victim.detectionBadge}`;
    document.getElementById("modal-depth-badge").textContent = `DEPTH: ${victim.depthMeters}m [${victim.accessibility.rubbleType}]`;

    const evalData = window.victimEngine.evaluateVictim(victim);
    const listElem = document.getElementById("modal-explainable-list");
    listElem.innerHTML = evalData.explainabilityReasons.map(r => `<li>${r}</li>`).join("");

    modal.classList.add("open");

    window.sensorVisualizer.initRadarOscilloscope("canvas-radar", victim);
    window.sensorVisualizer.initThermalVisualizer("canvas-thermal", victim);
    window.sensorVisualizer.initSdrVisualizer("canvas-sdr", victim);
    window.sensorVisualizer.drawLidarCrossSection("canvas-lidar", victim);

    if (window.lucide) lucide.createIcons();
  };

  modalCloseBtn.addEventListener("click", () => {
    modal.classList.remove("open");
    window.sensorVisualizer.stopAll();
  });

  document.getElementById("modal-btn-plan-route").addEventListener("click", () => {
    modal.classList.remove("open");
    window.sensorVisualizer.stopAll();
    if (activeModalVictim) selectVictim(activeModalVictim.id);
  });

  document.getElementById("modal-btn-dispatch").addEventListener("click", () => {
    alert(`[DISPATCH ORDER CONFIRMED]\n\nRescue Alpha Team (Capt. R. Sharma, NDRF) en-route to ${activeModalVictim ? activeModalVictim.tag : "target"}.\n\nDetection Status: ${activeModalVictim ? activeModalVictim.detectionBadge : "Confirmed"}\nRoute: ${currentRouteMode.toUpperCase()}`);
  });

  // Initial Calculation
  updateRouteCalculations();
});
