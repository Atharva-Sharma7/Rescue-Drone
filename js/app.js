/**
 * AI-Powered Drone Search & Rescue System - Master Controller
 * Professional Light Theme & Multi-Route Analysis
 * Smart India Hackathon (SIH) Mission Control
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

  // 3. Populate Victims in Dropdown & Bottom Triage Tray
  const dropdown = document.getElementById("victim-select-dropdown");
  const trayContainer = document.getElementById("victim-cards-container");

  function renderVictimCards() {
    dropdown.innerHTML = "";
    trayContainer.innerHTML = "";

    const evaluatedList = window.victimEngine.rankVictims(window.RESCUE_CONFIG.victims);

    evaluatedList.forEach((item, index) => {
      const v = item.raw;
      const evalData = item.evaluation;

      // Filter check
      if (currentFilter === "phone_breathing" && !v.detectionType.includes("BREATHING")) return;
      if (currentFilter === "phone_only" && v.detectionType !== "PHONE_ONLY") return;
      if (currentFilter === "radar_only" && v.detectionType !== "RADAR_BREATHING_ONLY") return;

      // Dropdown option
      const opt = document.createElement("option");
      opt.value = v.id;
      opt.textContent = `${v.tag} &bull; ${v.detectionBadge} [Depth: ${v.depthMeters}m]`;
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
            ${v.vitals.respirationDetected ? (v.vitals.cardiacMotionDetected ? 'Phone+ECG+Resp' : 'Phone+Resp') : (v.detectionType === 'PHONE_ONLY' ? 'Phone Only' : 'Radar Only')}
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

    // Calculate all 3 route options
    const safestRes = router.planRouteToVictim(targetVictim, "safest");
    const modRes = router.planRouteToVictim(targetVictim, "quickest");
    const hardRes = router.planRouteToVictim(targetVictim, "shortest");

    // Populate comparison table
    document.getElementById("dist-safest").textContent = `${safestRes.metrics.distanceMeters} m`;
    document.getElementById("time-safest").textContent = `${safestRes.metrics.estimatedTimeMinutes} min`;

    document.getElementById("dist-moderate").textContent = `${modRes.metrics.distanceMeters} m`;
    document.getElementById("time-moderate").textContent = `${modRes.metrics.estimatedTimeMinutes} min`;

    document.getElementById("dist-hard").textContent = `${hardRes.metrics.distanceMeters} m`;
    document.getElementById("time-hard").textContent = `${hardRes.metrics.estimatedTimeMinutes} min`;

    // Highlight selected route in 3D and in table
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

    // Populate directions
    const dirContainer = document.getElementById("route-directions-content");
    dirContainer.innerHTML = `<ol style="margin-left: 16px;">${activeRes.tacticalDirections.map(s => `<li>${s}</li>`).join("")}</ol>`;
  }

  // Row click listeners
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
    let html = `<div style="font-weight:700; color:var(--accent-purple); margin-bottom:6px;">Priority-Aware Sequence (All 5 Survivors):</div><ol style="margin-left: 16px;">`;
    tour.sequence.forEach(step => {
      html += `<li><strong>Stop ${step.stepNumber}: ${step.victim.tag}</strong> &mdash; ${step.victim.detectionBadge}. Leg: ${step.legDistanceMeters}m (${step.legTimeMinutes}m extraction). Cumulative: ${step.cumulativeMinutes} mins.</li>`;
    });
    html += `</ol><div style="font-size:10.5px; color:var(--text-muted); margin-top:6px; font-style:italic;">${tour.rationale}</div>`;
    dirContainer.innerHTML = html;
  });

  // 7. Camera Controls
  document.getElementById("btn-cam-iso").addEventListener("click", (e) => {
    setActiveCamBtn(e.currentTarget);
    scene3D.setCameraView("iso");
  });
  document.getElementById("btn-cam-drone").addEventListener("click", (e) => {
    setActiveCamBtn(e.currentTarget);
    scene3D.setCameraView("drone_pov");
  });
  document.getElementById("btn-cam-team").addEventListener("click", (e) => {
    setActiveCamBtn(e.currentTarget);
    scene3D.setCameraView("team_pov");
  });
  document.getElementById("btn-cam-top").addEventListener("click", (e) => {
    setActiveCamBtn(e.currentTarget);
    scene3D.setCameraView("top_down");
  });

  function setActiveCamBtn(activeBtn) {
    document.querySelectorAll(".view-btn").forEach(b => b.classList.remove("active"));
    activeBtn.classList.add("active");
  }

  // 8. Sensor Inspection Modal
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

  // 9. Groq AI Real-Time Extraction Plan
  const btnAiExtraction = document.getElementById("modal-btn-ai-extraction");
  btnAiExtraction.addEventListener("click", async () => {
    if (!activeModalVictim) return;
    const origHtml = btnAiExtraction.innerHTML;
    btnAiExtraction.innerHTML = `<i data-lucide="loader" style="width:14px; height:14px; animation:spin 1s linear infinite;"></i> GENERATING AI PROTOCOL...`;
    btnAiExtraction.disabled = true;

    const plan = await window.groqCommander.generateExtractionPlan(activeModalVictim);

    const listElem = document.getElementById("modal-explainable-list");
    const aiLi = document.createElement("li");
    aiLi.style.borderTop = "1px solid #ddd6fe";
    aiLi.style.paddingTop = "8px";
    aiLi.style.marginTop = "6px";
    aiLi.innerHTML = `
      <strong style="color:var(--accent-purple);">[Groq AI SAR Protocol &bull; ${plan.source}]:</strong><br>
      <div style="font-family:var(--font-mono); font-size:11.5px; color:var(--text-main); margin-top:4px; white-space:pre-wrap; background:#ffffff; border:1px solid #ddd6fe; padding:8px; border-radius:6px;">${plan.text}</div>
    `;
    listElem.appendChild(aiLi);

    btnAiExtraction.innerHTML = `<i data-lucide="check" style="width:14px; height:14px;"></i> PROTOCOL READY`;
    setTimeout(() => {
      btnAiExtraction.innerHTML = origHtml;
      btnAiExtraction.disabled = false;
      if (window.lucide) lucide.createIcons();
    }, 4000);
  });

  // 10. Hugging Face Models Hub Modal
  const hfModal = document.getElementById("hf-modal");
  const btnOpenHf = document.getElementById("btn-open-hf-hub");
  const hfCloseBtn = document.getElementById("hf-modal-close-btn");
  const hfCloseFooter = document.getElementById("hf-modal-close-footer");
  const hfContainer = document.getElementById("hf-models-container");

  function renderHfModels() {
    hfContainer.innerHTML = "";
    const models = window.hfHub.getModels();
    models.forEach(m => {
      const card = document.createElement("div");
      card.className = "hf-model-card";
      card.innerHTML = `
        <div class="hf-card-top">
          <div class="hf-model-name">
            <span style="font-size: 16px;">🤗</span>
            <span>${m.name}</span>
          </div>
          <span class="hf-badge">${m.status}</span>
        </div>
        <div class="hf-card-body">${m.description}</div>
        <div class="hf-card-meta">
          <span>Hub ID: <strong style="color:var(--text-main);">${m.hubId}</strong></span>
          <span>Task: <strong>${m.task}</strong></span>
          <span>Framework: <strong>${m.framework}</strong></span>
          <span>Parameters: <strong>${m.params}</strong></span>
        </div>
        <div class="hf-card-footer">
          <span style="color: var(--route-safest); font-size: 11px; font-weight:700;">Precision: ${m.accuracy}</span>
          <button class="hf-test-btn" onclick="testHfModel('${m.id}', this)">
            <i data-lucide="play" style="width:12px; height:12px;"></i> RUN BENCHMARK
          </button>
        </div>
        <div id="hf-result-${m.id}" style="display:none; margin-top:6px; padding:8px; background:#f8fafc; border:1px solid var(--border-main); border-radius:6px; font-family:var(--font-mono); font-size:11px;"></div>
      `;
      hfContainer.appendChild(card);
    });
    if (window.lucide) lucide.createIcons();
  }

  window.testHfModel = async function(modelId, btn) {
    btn.innerHTML = `<i data-lucide="loader" style="width:12px; height:12px; animation:spin 1s linear infinite;"></i> BENCHMARKING...`;
    btn.disabled = true;

    const resBox = document.getElementById(`hf-result-${modelId}`);
    const res = await window.hfHub.runInference(modelId, { deltaT: "+2.4°C", bpm: 14, snr: "+19.2 dB" });

    resBox.style.display = "block";
    resBox.innerHTML = `
      <div style="color:var(--route-safest); font-weight:700;">✓ Edge Inference Completed (${res.model})</div>
      <pre style="margin-top:4px; color:var(--text-secondary); white-space:pre-wrap;">${JSON.stringify(res.result, null, 2)}</pre>
    `;

    btn.innerHTML = `<i data-lucide="check" style="width:12px; height:12px;"></i> PASSED`;
    btn.disabled = false;
    if (window.lucide) lucide.createIcons();
  };

  btnOpenHf.addEventListener("click", () => {
    renderHfModels();
    hfModal.classList.add("open");
  });
  hfCloseBtn.addEventListener("click", () => hfModal.classList.remove("open"));
  hfCloseFooter.addEventListener("click", () => hfModal.classList.remove("open"));

  // 11. AI Tactical Copilot Floating Drawer
  const chatDrawer = document.getElementById("ai-chat-drawer");
  const btnOpenChat = document.getElementById("btn-open-ai-chat");
  const btnFloatingChat = document.getElementById("floating-ai-trigger");
  const chatCloseBtn = document.getElementById("ai-chat-close-btn");
  const chatInput = document.getElementById("chat-input-field");
  const chatSendBtn = document.getElementById("chat-send-btn");
  const chatMessages = document.getElementById("chat-messages-container");

  function toggleChat() {
    chatDrawer.classList.toggle("open");
    if (chatDrawer.classList.contains("open")) chatInput.focus();
  }

  btnOpenChat.addEventListener("click", toggleChat);
  btnFloatingChat.addEventListener("click", toggleChat);
  chatCloseBtn.addEventListener("click", () => chatDrawer.classList.remove("open"));

  async function handleSendQuery(query) {
    if (!query || !query.trim()) return;
    const text = query.trim();

    const uBubble = document.createElement("div");
    uBubble.className = "chat-bubble user";
    uBubble.textContent = text;
    chatMessages.appendChild(uBubble);
    chatInput.value = "";
    chatMessages.scrollTop = chatMessages.scrollHeight;

    const aiBubble = document.createElement("div");
    aiBubble.className = "chat-bubble ai";
    aiBubble.innerHTML = `<i data-lucide="loader" style="width:13px; height:13px; display:inline; animation:spin 1s linear infinite;"></i> Consulting Groq LPU SAR Model...`;
    chatMessages.appendChild(aiBubble);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    if (window.lucide) lucide.createIcons();

    const targetVictim = window.RESCUE_CONFIG.victims.find(v => v.id === currentVictimId);
    const response = await window.groqCommander.askCommander(text, targetVictim);

    aiBubble.innerHTML = `
      <div style="font-size:10.5px; color:var(--accent-purple); font-weight:700; margin-bottom:4px;">
        ${response.source}
      </div>
      <div style="white-space:pre-wrap;">${response.text}</div>
    `;
    chatMessages.scrollTop = chatMessages.scrollHeight;
    if (window.lucide) lucide.createIcons();
  }

  chatSendBtn.addEventListener("click", () => handleSendQuery(chatInput.value));
  chatInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") handleSendQuery(chatInput.value);
  });

  document.querySelectorAll(".suggestion-chip").forEach(chip => {
    chip.addEventListener("click", () => {
      handleSendQuery(chip.dataset.query);
    });
  });

  // 12. Mission Briefing Export Modal
  const exportModal = document.getElementById("export-modal");
  const exportCloseBtn = document.getElementById("export-modal-close-btn");
  const exportBtn = document.getElementById("btn-export-mission");
  const jsonPreview = document.getElementById("export-json-preview");

  exportBtn.addEventListener("click", () => {
    const briefingData = {
      mission: window.RESCUE_CONFIG.mission,
      casualtyStatus: window.RESCUE_CONFIG.statsOverview,
      groundRescueTeam: window.RESCUE_CONFIG.groundTeam,
      rankedSurvivors: window.victimEngine.rankVictims(window.RESCUE_CONFIG.victims).map(item => ({
        victimId: item.raw.id,
        tag: item.raw.tag,
        detectionBadge: item.raw.detectionBadge,
        depthMeters: item.raw.depthMeters,
        respirationBpm: item.raw.vitals.breathsPerMin,
        sdrDevice: item.raw.digitalRescue.deviceName,
        extractionEquipment: item.raw.accessibility.requiredEquipment,
        safetyNotice: item.raw.environmentalHazard
      })),
      simultaneousRoutes: {
        safestRouteDistance: document.getElementById("dist-safest").textContent,
        moderateRouteDistance: document.getElementById("dist-moderate").textContent,
        hardRouteDistance: document.getElementById("dist-hard").textContent
      },
      systemTimestamp: new Date().toISOString()
    };

    jsonPreview.textContent = JSON.stringify(briefingData, null, 2);
    exportModal.classList.add("open");
  });

  exportCloseBtn.addEventListener("click", () => exportModal.classList.remove("open"));

  document.getElementById("btn-copy-briefing").addEventListener("click", () => {
    navigator.clipboard.writeText(jsonPreview.textContent).then(() => {
      alert("Mission Briefing copied to clipboard!");
    });
  });

  document.getElementById("btn-download-briefing").addEventListener("click", () => {
    const blob = new Blob([jsonPreview.textContent], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `SAR_MISSION_BRIEFING_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });

  // Initial Calculation
  updateRouteCalculations();
});
