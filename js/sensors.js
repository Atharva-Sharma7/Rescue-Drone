/**
 * Multi-Sensor Signal Simulators & Oscilloscopes
 * mmWave/UWB Radar, Crack-Focused Thermal, SDR RF Sniffer, LiDAR Cross-Section
 * Smart India Hackathon (SIH) Specification
 */

class SensorVisualizer {
  constructor() {
    this.animationFrames = {};
    this.phase = 0;
  }

  // 1. UWB / mmWave Radar Micro-Doppler Respiration Waveform
  initRadarOscilloscope(canvasId, victim) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    const bpm = (victim && victim.vitals.respirationDetected) ? victim.vitals.breathsPerMin : 12;
    const isCardiac = victim && victim.vitals.cardiacMotionDetected;
    const hrBpm = isCardiac ? victim.vitals.heartRateBpm : 0;
    const snr = victim ? victim.vitals.radarSNR : "+14.0 dB";

    let t = 0;
    const render = () => {
      t += 0.04;
      const w = canvas.width;
      const h = canvas.height;

      // Dark tactical grid background
      ctx.fillStyle = "#0a0f18";
      ctx.fillRect(0, 0, w, h);

      // Radar grid lines
      ctx.strokeStyle = "rgba(0, 240, 255, 0.08)";
      ctx.lineWidth = 1;
      for (let x = 0; x < w; x += 30) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let y = 0; y < h; y += 20) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      // Center baseline
      ctx.strokeStyle = "rgba(0, 240, 255, 0.25)";
      ctx.beginPath();
      ctx.moveTo(0, h / 2);
      ctx.lineTo(w, h / 2);
      ctx.stroke();

      // Live Respiration Waveform (Thoracic micro-motion ~0.2Hz to 0.4Hz)
      ctx.strokeStyle = "#00f0ff";
      ctx.lineWidth = 2.5;
      ctx.shadowBlur = 10;
      ctx.shadowColor = "#00f0ff";
      ctx.beginPath();

      const freq = (bpm / 60) * 2 * Math.PI;
      const cardFreq = isCardiac ? (hrBpm / 60) * 2 * Math.PI : 0;

      for (let x = 0; x < w; x++) {
        const timeVal = t + (x / 70);
        // Primary respiration sine
        let yVal = Math.sin(timeVal * freq) * (h * 0.32);
        // Add cardiac pulsation harmonic (if detected)
        if (isCardiac) {
          yVal += Math.sin(timeVal * cardFreq) * (h * 0.08);
        }
        // Micro-noise & rubble multi-path jitter
        yVal += (Math.sin(timeVal * 18) * 2.5) + ((Math.random() - 0.5) * 2);

        const yPos = (h / 2) + yVal;
        if (x === 0) ctx.moveTo(x, yPos);
        else ctx.lineTo(x, yPos);
      }
      ctx.stroke();
      ctx.shadowBlur = 0; // Reset

      // Overlay text stats
      ctx.fillStyle = "#a0aec0";
      ctx.font = "10px monospace";
      ctx.fillText(`RADAR FREQ: 3.8 GHz UWB | SNR: ${snr}`, 10, 15);
      ctx.fillStyle = "#00f0ff";
      ctx.fillText(`RESPIRATION: ${bpm} BPM`, 10, h - 8);
      if (isCardiac) {
        ctx.fillStyle = "#ff3366";
        ctx.fillText(`CARDIAC MOTION: ${hrBpm} BPM`, 180, h - 8);
      }

      this.animationFrames[canvasId] = requestAnimationFrame(render);
    };

    if (this.animationFrames[canvasId]) cancelAnimationFrame(this.animationFrames[canvasId]);
    render();
  }

  // 2. Crack-Focused Thermal Detection Visualizer (False-Color Infrared)
  initThermalVisualizer(canvasId, victim) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    const hasPlume = victim && victim.thermal.fissurePlumeDetected;
    const deltaT = victim ? victim.thermal.temperatureDeltaC : "+2.1°C";
    let thermalTick = 0;

    const render = () => {
      thermalTick += 0.03;
      const w = canvas.width;
      const h = canvas.height;

      // Base rubble thermal background (Cold concrete: deep violet/indigo 18°C)
      const grad = ctx.createLinearGradient(0, 0, w, h);
      grad.addColorStop(0, "#0d0221");
      grad.addColorStop(0.5, "#150838");
      grad.addColorStop(1, "#0a031a");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      // Procedural Rubble Crack Lines (cold background fractures)
      ctx.strokeStyle = "rgba(70, 40, 110, 0.4)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(w * 0.1, h * 0.2);
      ctx.lineTo(w * 0.4, h * 0.45);
      ctx.lineTo(w * 0.7, h * 0.48);
      ctx.lineTo(w * 0.95, h * 0.85);
      ctx.stroke();

      if (hasPlume) {
        // Escaping Heat Plume through the fissure (Ironbow Palette: Purple -> Red -> Orange -> Yellow -> White)
        const centerX = w * 0.52 + Math.sin(thermalTick * 1.5) * 4;
        const centerY = h * 0.50 + Math.cos(thermalTick * 1.2) * 3;
        const radius = 38 + Math.sin(thermalTick * 2) * 5;

        const radial = ctx.createRadialGradient(centerX, centerY, 4, centerX, centerY, radius);
        radial.addColorStop(0, "rgba(255, 255, 240, 0.95)"); // Core vent heat
        radial.addColorStop(0.25, "rgba(255, 170, 0, 0.85)"); // Heat plume
        radial.addColorStop(0.55, "rgba(235, 45, 75, 0.6)");  // Convection diffusion
        radial.addColorStop(0.85, "rgba(110, 15, 130, 0.3)"); // Dissipation gradient
        radial.addColorStop(1, "rgba(15, 5, 35, 0)");

        ctx.fillStyle = radial;
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        ctx.fill();

        // Fissure Vent Border highlight
        ctx.strokeStyle = "rgba(255, 220, 100, 0.7)";
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Target reticle over crack
        ctx.strokeStyle = "#ff453a";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(centerX, centerY, 14, 0, Math.PI * 2);
        ctx.moveTo(centerX - 18, centerY); ctx.lineTo(centerX + 18, centerY);
        ctx.moveTo(centerX, centerY - 18); ctx.lineTo(centerX, centerY + 18);
        ctx.stroke();

        ctx.fillStyle = "#ff9500";
        ctx.font = "10px monospace";
        ctx.fillText(`PLUME HOTSPOT: ΔT ${deltaT}`, centerX + 20, centerY - 10);
      } else {
        // No plume detected
        ctx.fillStyle = "#a0aec0";
        ctx.font = "11px monospace";
        ctx.fillText("NO CONVECTIVE PLUME VENTING DETECTED", w * 0.15, h * 0.5);
      }

      // Sensor Status bar
      ctx.fillStyle = "#cbd5e0";
      ctx.font = "9px monospace";
      ctx.fillText("LWIR 8-14µm CRACK-THERMAL | 640x512 FLIR Boson Core", 8, 14);

      this.animationFrames[canvasId] = requestAnimationFrame(render);
    };

    if (this.animationFrames[canvasId]) cancelAnimationFrame(this.animationFrames[canvasId]);
    render();
  }

  // 3. Digital Rescue SDR RF Spectrum & Waterfall
  initSdrVisualizer(canvasId, victim) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    const sdrActive = victim && victim.digitalRescue.sdrDeviceDetected;
    const rssi = victim ? victim.digitalRescue.rssiDbm : -85;
    const mac = victim ? victim.digitalRescue.macPrefix : "Unknown";
    let sdrTick = 0;

    const render = () => {
      sdrTick += 0.05;
      const w = canvas.width;
      const h = canvas.height;

      // Dark background
      ctx.fillStyle = "#07111a";
      ctx.fillRect(0, 0, w, h);

      // Spectrum frequency bars (2.412 GHz to 2.484 GHz)
      const bars = 48;
      const barW = w / bars;

      for (let i = 0; i < bars; i++) {
        // Ambient RF noise floor (-95 to -105 dBm)
        let barHeight = (Math.sin(i * 0.4 + sdrTick) * 6) + (Math.random() * 8) + 12;

        // Active transmitter spike around channel 6 (2.437 GHz)
        if (sdrActive && i >= 20 && i <= 28) {
          const centerDist = Math.abs(i - 24);
          const spikeFactor = (1 - (centerDist / 5));
          if (spikeFactor > 0) {
            const signalStrengthScaled = (100 + rssi) * 1.8;
            barHeight += spikeFactor * Math.max(10, signalStrengthScaled);
          }
        }

        const barY = h - barHeight - 16;
        // Color gradient based on power
        if (barHeight > 45) ctx.fillStyle = "#30d158"; // Strong signal
        else if (barHeight > 25) ctx.fillStyle = "#00f0ff";
        else ctx.fillStyle = "#1e3a5f"; // Noise floor

        ctx.fillRect(i * barW, barY, barW - 1, barHeight);
      }

      // Metadata overlay
      ctx.fillStyle = "#a0aec0";
      ctx.font = "9px monospace";
      ctx.fillText(`SDR 2.4GHz ISM BAND | GAIN: +42dB | DIRECTIONAL AoA`, 8, 12);

      if (sdrActive) {
        ctx.fillStyle = "#30d158";
        ctx.fillText(`BEACON MATCH: ${mac} | RSSI: ${rssi} dBm`, 8, h - 4);
      } else {
        ctx.fillStyle = "#718096";
        ctx.fillText("RF NOISE FLOOR ONLY (NO PROBE FRAMES)", 8, h - 4);
      }

      this.animationFrames[canvasId] = requestAnimationFrame(render);
    };

    if (this.animationFrames[canvasId]) cancelAnimationFrame(this.animationFrames[canvasId]);
    render();
  }

  // 4. LiDAR Sub-Surface Void Cross-Section
  drawLidarCrossSection(canvasId, victim) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    const w = canvas.width;
    const h = canvas.height;
    const depth = victim ? victim.depthMeters : 1.5;

    ctx.fillStyle = "#080c14";
    ctx.fillRect(0, 0, w, h);

    // Ground surface profile (LiDAR point cloud scan line)
    ctx.strokeStyle = "#38ef7d";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 45);
    ctx.lineTo(w * 0.25, 42);
    ctx.lineTo(w * 0.45, 38);
    ctx.lineTo(w * 0.7, 46);
    ctx.lineTo(w, 44);
    ctx.stroke();

    // Rubble debris fill (textured cross-hatch)
    ctx.fillStyle = "rgba(45, 55, 72, 0.7)";
    ctx.fillRect(0, 45, w, h - 45);

    // Draw underground void cavity where victim is located
    const cavityY = 45 + (depth * 28);
    ctx.fillStyle = "rgba(10, 16, 26, 0.95)";
    ctx.beginPath();
    ctx.ellipse(w * 0.5, cavityY, 45, 18, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(0, 240, 255, 0.4)";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Victim marker inside void
    ctx.fillStyle = "#ff3b30";
    ctx.beginPath();
    ctx.arc(w * 0.5, cavityY, 5, 0, Math.PI * 2);
    ctx.fill();

    // Depth measurement ruler
    ctx.strokeStyle = "#ffd60a";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(w * 0.5, 42);
    ctx.lineTo(w * 0.5, cavityY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Text labels
    ctx.fillStyle = "#ffd60a";
    ctx.font = "10px monospace";
    ctx.fillText(`DEPTH: ${depth}m`, w * 0.53, (42 + cavityY) / 2);

    ctx.fillStyle = "#a0aec0";
    ctx.font = "9px monospace";
    ctx.fillText("RUBBLE OVERBURDEN", 10, 75);
    ctx.fillText("STRUCTURAL VOID", w * 0.55, cavityY + 14);

    // Quadcopter symbol above ground
    ctx.fillStyle = "#00f0ff";
    ctx.fillText("▲ DRONE (12.4m AGL)", w * 0.42, 18);
  }

  stopAll() {
    for (const key in this.animationFrames) {
      cancelAnimationFrame(this.animationFrames[key]);
    }
    this.animationFrames = {};
  }
}

window.sensorVisualizer = new SensorVisualizer();
