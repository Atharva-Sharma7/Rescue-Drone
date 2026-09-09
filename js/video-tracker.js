/**
 * AeroScan SAR-3D: Real-Time Disaster Video AI Detector & Tracker
 * Simulates YOLO11 + ByteTrack Inference on the Aerial/Disaster Video Feed
 */

class DisasterVideoTracker {
  constructor(videoElementId, canvasElementId, options = {}) {
    this.video = document.getElementById(videoElementId);
    this.canvas = document.getElementById(canvasElementId);
    this.ctx = this.canvas ? this.canvas.getContext("2d") : null;

    this.onDetectionCallback = options.onDetection || null;
    this.onMetricsCallback = options.onMetrics || null;

    // AI Configuration Toggles
    this.aiDetectionEnabled = true;
    this.trackingEnabled = true;
    this.thermalDemoEnabled = false;
    this.radarDemoEnabled = false;

    // Performance Metrics
    this.framesProcessed = 0;
    this.lastFrameTime = performance.now();
    this.fpsHistory = [];
    this.currentFps = 18.4;
    this.latencyMs = 32.1;
    this.isRunning = false;

    // Ground-Truth Tracklets based on the disaster video sequence
    this.tracklets = [
      {
        id: "VIC-01",
        label: "PERSON",
        role: "Survivor #1 (Pinned Cavity)",
        baseConf: 0.91,
        depth: 2.3,
        priority: "CRITICAL",
        respiration: "Detected (14 bpm)",
        keyframes: [
          { time: 0.0, x: 0.28, y: 0.35, w: 0.11, h: 0.22, conf: 0.88 },
          { time: 3.5, x: 0.31, y: 0.38, w: 0.12, h: 0.23, conf: 0.93 },
          { time: 7.0, x: 0.34, y: 0.42, w: 0.13, h: 0.24, conf: 0.95 },
          { time: 10.5, x: 0.36, y: 0.44, w: 0.13, h: 0.24, conf: 0.92 },
          { time: 13.5, x: 0.38, y: 0.45, w: 0.14, h: 0.25, conf: 0.91 }
        ]
      },
      {
        id: "VIC-02",
        label: "PERSON",
        role: "Survivor #2 (Debris Edge)",
        baseConf: 0.84,
        depth: 1.1,
        priority: "HIGH",
        respiration: "Scanning",
        keyframes: [
          { time: 1.8, x: 0.62, y: 0.25, w: 0.09, h: 0.19, conf: 0.79 },
          { time: 5.2, x: 0.59, y: 0.29, w: 0.10, h: 0.20, conf: 0.86 },
          { time: 9.0, x: 0.55, y: 0.34, w: 0.11, h: 0.21, conf: 0.89 },
          { time: 13.5, x: 0.52, y: 0.37, w: 0.11, h: 0.21, conf: 0.84 }
        ]
      },
      {
        id: "VIC-03",
        label: "PERSON",
        role: "Survivor #3 (Partial Void)",
        baseConf: 0.88,
        depth: 3.1,
        priority: "HIGH",
        respiration: "Detected (22 bpm)",
        keyframes: [
          { time: 4.5, x: 0.18, y: 0.58, w: 0.10, h: 0.18, conf: 0.82 },
          { time: 8.0, x: 0.20, y: 0.55, w: 0.11, h: 0.19, conf: 0.89 },
          { time: 11.5, x: 0.22, y: 0.52, w: 0.11, h: 0.20, conf: 0.87 },
          { time: 13.5, x: 0.23, y: 0.50, w: 0.12, h: 0.20, conf: 0.88 }
        ]
      }
    ];

    this.activeDetections = [];
    this.init();
  }

  init() {
    if (!this.video || !this.canvas) return;

    const onReady = () => {
      this.syncCanvasDimensions();
      if (!this.video.paused) {
        this.isRunning = true;
        this.processLoop();
      }
    };

    this.video.addEventListener("loadedmetadata", onReady);
    this.video.addEventListener("canplay", onReady);
    this.syncCanvasDimensions();
    window.addEventListener("resize", () => this.syncCanvasDimensions());

    if (window.ResizeObserver) {
      const ro = new ResizeObserver(() => this.syncCanvasDimensions());
      ro.observe(this.video);
    }

    this.video.addEventListener("play", () => {
      this.isRunning = true;
      this.processLoop();
    });

    this.video.addEventListener("pause", () => {
      this.isRunning = false;
    });

    this.video.addEventListener("seeked", () => {
      this.processFrame();
    });

    if (!this.video.paused) {
      this.isRunning = true;
      this.processLoop();
    }
  }

  syncCanvasDimensions() {
    if (!this.video || !this.canvas) return;
    const rect = this.video.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      this.canvas.width = rect.width;
      this.canvas.height = rect.height;
      this.processFrame();
    }
  }

  interpolateKeyframe(tracklet, currentTime) {
    const kfs = tracklet.keyframes;
    if (currentTime < kfs[0].time || currentTime > kfs[kfs.length - 1].time) {
      return null;
    }

    for (let i = 0; i < kfs.length - 1; i++) {
      const k1 = kfs[i];
      const k2 = kfs[i + 1];
      if (currentTime >= k1.time && currentTime <= k2.time) {
        const span = k2.time - k1.time;
        const progress = span > 0 ? (currentTime - k1.time) / span : 0;
        const jitter = (Math.random() - 0.5) * 0.002;
        return {
          id: tracklet.id,
          label: tracklet.label,
          role: tracklet.role,
          depth: tracklet.depth,
          priority: tracklet.priority,
          respiration: tracklet.respiration,
          conf: Math.round((k1.conf + (k2.conf - k1.conf) * progress) * 100),
          x: k1.x + (k2.x - k1.x) * progress + jitter,
          y: k1.y + (k2.y - k1.y) * progress + jitter,
          w: k1.w + (k2.w - k1.w) * progress,
          h: k1.h + (k2.h - k1.h) * progress
        };
      }
    }
    return null;
  }

  processLoop() {
    if (!this.isRunning) return;
    this.processFrame();
    requestAnimationFrame(() => this.processLoop());
  }

  processFrame() {
    if (!this.ctx || !this.video) return;

    const now = performance.now();
    const delta = now - this.lastFrameTime;
    this.lastFrameTime = now;

    if (delta > 0) {
      const fps = 1000 / delta;
      this.fpsHistory.push(fps);
      if (this.fpsHistory.length > 20) this.fpsHistory.shift();
      const avgFps = this.fpsHistory.reduce((a, b) => a + b, 0) / this.fpsHistory.length;
      this.currentFps = Math.min(30, Math.round(avgFps * 10) / 10);
      this.latencyMs = Math.round((1000 / (avgFps || 24)) * 0.75 * 10) / 10;
    }

    this.framesProcessed++;

    const w = this.canvas.width;
    const h = this.canvas.height;
    this.ctx.clearRect(0, 0, w, h);

    if (!this.aiDetectionEnabled) return;

    const currentTime = this.video.currentTime || 0;
    const detections = [];

    this.tracklets.forEach(tracklet => {
      const det = this.interpolateKeyframe(tracklet, currentTime);
      if (det) detections.push(det);
    });

    this.activeDetections = detections;

    detections.forEach(det => {
      this.drawDetectionBox(det, w, h);
    });

    if (this.thermalDemoEnabled) {
      this.drawThermalOverlay(w, h, detections);
    }

    if (this.radarDemoEnabled) {
      this.drawRadarOverlay(w, h, detections, now);
    }

    if (this.onMetricsCallback) {
      this.onMetricsCallback({
        framesProcessed: this.framesProcessed,
        fps: this.currentFps,
        latencyMs: this.latencyMs,
        personsDetected: detections.length,
        activeTracks: detections.length,
        primaryVictim: detections[0] || null
      });
    }
  }

  drawDetectionBox(det, w, h) {
    const ctx = this.ctx;
    const bx = det.x * w;
    const by = det.y * h;
    const bw = det.w * w;
    const bh = det.h * h;

    const isCritical = det.priority === "CRITICAL";
    const boxColor = isCritical ? "#ef4444" : "#f59e0b";
    const accentColor = isCritical ? "rgba(239, 68, 68, 0.2)" : "rgba(245, 158, 11, 0.2)";

    ctx.fillStyle = accentColor;
    ctx.fillRect(bx, by, bw, bh);

    ctx.strokeStyle = boxColor;
    ctx.lineWidth = 2.5;
    const cornerLen = Math.min(16, bw * 0.25, bh * 0.25);

    ctx.beginPath();
    ctx.moveTo(bx, by + cornerLen);
    ctx.lineTo(bx, by);
    ctx.lineTo(bx + cornerLen, by);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(bx + bw - cornerLen, by);
    ctx.lineTo(bx + bw, by);
    ctx.lineTo(bx + bw, by + cornerLen);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(bx, by + bh - cornerLen);
    ctx.lineTo(bx, by + bh);
    ctx.lineTo(bx + cornerLen, by + bh);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(bx + bw - cornerLen, by + bh);
    ctx.lineTo(bx + bw, by + bh);
    ctx.lineTo(bx + bw, by + bh - cornerLen);
    ctx.stroke();

    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 1;
    ctx.strokeRect(bx, by, bw, bh);
    ctx.setLineDash([]);

    const tagText = `${det.id} • ${det.label} ${det.conf}%`;
    ctx.font = "bold 11px 'IBM Plex Mono', monospace";
    const textWidth = ctx.measureText(tagText).width;

    ctx.fillStyle = "rgba(7, 13, 24, 0.9)";
    ctx.fillRect(bx, by - 22, textWidth + 14, 20);
    ctx.strokeStyle = boxColor;
    ctx.lineWidth = 1;
    ctx.strokeRect(bx, by - 22, textWidth + 14, 20);

    ctx.fillStyle = boxColor;
    ctx.fillText(tagText, bx + 7, by - 8);

    const depthText = `EST. DEPTH: ${det.depth}m | RADAR: UWB SYNC`;
    ctx.font = "10px 'IBM Plex Mono', monospace";
    const dWidth = ctx.measureText(depthText).width;

    ctx.fillStyle = "rgba(11, 20, 36, 0.85)";
    ctx.fillRect(bx, by + bh + 4, dWidth + 12, 18);
    ctx.fillStyle = "#38bdf8";
    ctx.fillText(depthText, bx + 6, by + bh + 17);
  }

  drawThermalOverlay(w, h, detections) {
    const ctx = this.ctx;
    detections.forEach(det => {
      const cx = (det.x + det.w / 2) * w;
      const cy = (det.y + det.h / 2) * h;
      const radius = Math.max(det.w * w, det.h * h) * 0.9;

      const grad = ctx.createRadialGradient(cx, cy, 2, cx, cy, radius);
      grad.addColorStop(0, "rgba(255, 69, 0, 0.75)");
      grad.addColorStop(0.5, "rgba(255, 140, 0, 0.4)");
      grad.addColorStop(1, "rgba(255, 215, 0, 0)");

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  drawRadarOverlay(w, h, detections, now) {
    const ctx = this.ctx;
    detections.forEach((det, i) => {
      const cx = (det.x + det.w / 2) * w;
      const cy = (det.y + det.h / 2) * h;

      const phase = (now * 0.002 + i) % 1;
      const r1 = phase * 60;
      const r2 = ((phase + 0.5) % 1) * 60;

      ctx.strokeStyle = `rgba(6, 182, 212, ${0.8 - phase * 0.7})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(cx, cy, r1, 0, Math.PI * 2);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(cx, cy, r2, 0, Math.PI * 2);
      ctx.stroke();
    });
  }

  toggleAiDetection(enabled) {
    this.aiDetectionEnabled = enabled;
    this.processFrame();
  }

  toggleTracking(enabled) {
    this.trackingEnabled = enabled;
    this.processFrame();
  }

  toggleThermalDemo(enabled) {
    this.thermalDemoEnabled = enabled;
    this.processFrame();
  }

  toggleRadarDemo(enabled) {
    this.radarDemoEnabled = enabled;
    this.processFrame();
  }

  stepForward(frames = 1) {
    if (!this.video) return;
    this.video.pause();
    this.video.currentTime = Math.min(this.video.duration || 13, this.video.currentTime + (frames / 30));
  }
}

window.DisasterVideoTracker = DisasterVideoTracker;
