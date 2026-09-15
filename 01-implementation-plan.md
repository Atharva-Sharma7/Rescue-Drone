# Debris-Scan AI — Implementation Plan
### Turning the current frontend into a real, defensible startup-grade product

---

## 0. The honest starting point

You don't have a real drone, real LiDAR, real UWB radar, or real thermal hardware yet. That's not a blocker — almost every hardware startup builds the software and the "story" before the hardware fleet exists. The trap to avoid is building a frontend that *pretends* to be live when it's actually a slideshow. The fix is architectural, not cosmetic:

> **Build one real pipeline with a swappable data source.** The same orchestrator, the same UI, the same state machine runs whether the sensor data comes from a `MockAdapter` (recorded footage + synthetic radar/thermal signals) or a `LiveAdapter` (real drone telemetry later). Nothing about the frontend changes when you plug in real hardware.

This is exactly the pattern real drone-software teams use — a recent write-up on building a React ground-control station describes building the entire dashboard "in mock mode, with no drone... involved," then pointing the *same components* at a real telemetry stack later. That's the credible way to demo something that isn't fully hardware-ready yet, and it's what investors/technical reviewers actually expect to see when they ask "is this real?"

That one decision drives everything below.

---

## 1. System architecture — the 8-stage pipeline

Your description maps cleanly onto a pipeline. Each stage is a discrete backend job that emits a "stage complete" event; the frontend never advances on its own timer — it advances because the backend told it to. That's what gives you genuine "coordination between steps."

| # | Stage | Input | Output | Real technique |
|---|-------|-------|--------|-----------------|
| 0 | Mission Init | Site boundary / GPS box | Mission ID, flight plan | Simple form + geofence |
| 1 | Aerial Scan | RGB video + LiDAR/point-cloud stream | Raw frames + point cloud | Sensor capture (recorded or live) |
| 2 | 3D Reconstruction | RGB frames (+ LiDAR if present) | Textured 3D mesh / point cloud of the debris | Multi-view stereo reconstruction (DUSt3R/MASt3R) or monocular depth (Depth Anything V2) fused with LiDAR points |
| 3 | Wide Sweep Detection | Thermal frames + UWB radar returns | Candidate hotspots (thermal) + candidate radar returns (breathing/motion signatures) | Thermal object detector + UWB clutter-removal signal processing |
| 4 | Multi-modal Fusion | All Stage 3 candidates + 3D map | Confidence-scored points overlaid on the 3D model | Weighted multi-sensor scoring (see §4) |
| 5 | Precision Revisit | Confidence points sorted high→low | Close-range imagery/radar per point | Drone descends to each point (simulated as a second data capture per point) |
| 6 | Hazard / Difficulty Mapping | 3D mesh + revisit data | Cost-weighted terrain grid (unstable rubble, voids, fire risk zones) | Structural heuristics over point-cloud slope/density |
| 7 | Route Planning | Hazard grid + confirmed points | Safest + fastest path per point, for ground rescue teams | A* / RRT* over a 3D voxel grid |
| 8 | Mission Report | All of the above | Exportable rescue brief (PDF/JSON) | Aggregation |

Stages 1–2 give you the "3D graphic of the debris." Stages 3–5 give you "detect mobile phones/survivors, then go down to confident points." Stages 6–7 give you "map difficulties, generate safest/fastest route." This is a faithful, buildable translation of your spec.

---

## 2. Orchestration — how steps actually coordinate

This is the part most "basic frontends" get wrong: they fake sequencing with `setTimeout`. Do it properly instead:

- **Backend**: a small FastAPI (or Node/Express) **Mission Orchestrator** service. `POST /missions/{id}/start` kicks off Stage 1; each stage, on completion, pushes a `stage_update` event over a WebSocket and triggers the next stage.
- **Frontend**: one WebSocket connection per mission. A `useMissionStore` (Zustand) holds `{ currentStage, stageStatus, artifacts }`. UI components subscribe to store slices — they never own timing logic themselves.
- **Adapters**: every stage's "do the work" function is behind an interface, e.g. `ScanAdapter.getFrames(missionId)`. `MockScanAdapter` streams pre-recorded footage at real-time pace; a future `LiveScanAdapter` would pull from an actual drone. The orchestrator doesn't know or care which one is plugged in.

This gives you real, verifiable "step-by-step execution when initiated" — because it's genuinely event-driven, not animated.

---

## 3. Real pretrained models you can actually wire in today

All free, all on Hugging Face or GitHub, verified as currently available:

**3D reconstruction / depth**
- **Depth Anything V2** (`depth-anything/Depth-Anything-V2-*` on Hugging Face) — monocular depth from a single RGB frame, works via the `transformers` pipeline in ~5 lines of Python, has a hosted demo Space you can test before integrating.
- **DUSt3R / MASt3R** (`naver/DUSt3R_ViTLarge_BaseDecoder_512_dpt`, `naver/MASt3R_ViTLarge_BaseDecoder_512_catmlpdpt_metric`) — takes a handful of overlapping RGB images with **no camera calibration needed** and regresses a dense 3D point cloud directly. This is the closest free equivalent to "RGB + LiDAR → 3D graphic." There's a live Hugging Face Space (`naver/MASt3R`) you can literally drag debris photos into today to see it work.

**Thermal / person detection**
- `foduucom/thermal-image-object-detection` — general-purpose YOLOv8 thermal object detector, ready to use.
- `ubr-physical-ai/rescue-target-yolo26n` — worth calling out specifically: a YOLO detector trained *for search-and-rescue*, detecting "person lying down wearing a hi-vis vest" in thermal/low-light scenes, trained on synthetic NVIDIA Isaac Sim renders. Its own model card is refreshingly honest that it's research-grade, not safety-certified, and must not be the sole basis for a life-critical decision — **copy that exact honesty into your own product's UI** (a small "assistive tool, not a safety system" disclaimer). It's good engineering and it's good trust-building.
- Published research (Alsalman et al., "Human Detection in Thermal Images Using YOLOv8 for Search and Rescue Missions") trained on 17,148 thermal images with ~91,000 human annotations — cite this as your methodological precedent if you ever present to a technical audience.

**Path planning**
- No pretrained model needed — this is classical robotics. A* and RRT* over a 3D occupancy grid are the standard, well-understood approach used in real UAV path-planning research (e.g., "MPN-RRT*" and similar 2025 papers combine RRT* with obstacle grids for exactly this). `martin0004/drone_path_planning` on GitHub is a clean, small reference implementation of A* + RRT you can adapt directly.

**UWB radar / phone detection — the one honest caveat**
There is no plug-and-play pretrained model for "detect a phone or a heartbeat through rubble" — this is real, fielded technology, but it's signal processing (variance-threshold clutter removal on radar range bins to isolate a breathing signature), not a downloadable neural net. It's genuinely used in the field: Camero's Xaver UWB radar line was credited with helping locate survivors after the February 2023 Turkey earthquake. Two honest options:
1. **Simulate it properly**: generate synthetic radar range-bin data with an injected periodic breathing signature + noise, and run the same variance-threshold algorithm a real system would use. This is real signal processing on synthetic input — not fake, just not yet connected to real antennas.
2. **Phone/RF presence**, specifically, is usually done via WiFi/Bluetooth/cellular ping triangulation rather than UWB — worth being precise about this distinction in your pitch so a technical reviewer doesn't catch you conflating the two.

---

## 4. The fusion "AI model" — build the honest version

Don't claim a single opaque model magically fuses five sensors — that's the line that gets startups picked apart in diligence. Build (and present) a transparent multi-modal confidence score instead:

```
confidence(cell) = w_thermal · thermal_score(cell)
                  + w_radar   · radar_score(cell)
                  + w_geom    · structural_plausibility(cell)   # e.g. void/cavity likelihood from the 3D mesh
                  - w_hazard  · instability_penalty(cell)
```

Normalize each term 0–1, tune weights, render the result as a heatmap over the 3D reconstruction. This is genuinely how multi-sensor SAR fusion is approached in practice, it's fully explainable (a real requirement for anything safety-adjacent), and later — once you have real labeled data — you can swap the weighted sum for a trained classifier without touching the rest of the pipeline.

---

## 5. Demo data strategy — don't use ripped YouTube footage in a real product

You said "use any YouTube video" — for a hackathon slide that's fine, but you told me this is a real product you intend to keep building on, so it's worth flagging now rather than after you've built a brand around it: re-uploading someone else's copyrighted footage as your own product demo is a real legal and trust liability once you're pitching or shipping something real.

The fix costs nothing and looks *more* professional, not less:
- **Pixabay** and the **Creative Commons section of Videezy** have genuinely free-for-commercial-use drone, debris, and thermal-imaging footage — confirmed available today.
- Clearly label demo runs in the UI as **"Simulated Mission — Recorded Flight Data"** (small badge, not hidden). This is exactly the mock-mode pattern real drone-software teams ship with, and it reads as *more* credible to a technical audience than an unlabeled clip, because it shows you understand the difference between demo and deployment.
- **Optional stretch, later**: if you want an actually-flying simulated drone (not just canned footage) generating live synthetic camera/LiDAR feeds, use **Gazebo** (ROS 2-native, actively maintained) or **NVIDIA Isaac Sim** (best sensor fidelity, steeper setup). Skip **AirSim** — Microsoft shut it down in 2022, and its community successor **Colosseum** was itself archived in July 2026, so neither is a safe foundation to build on right now.

---

## 6. Frontend — what "startup grade" actually means here

Not "add gradients." Specifically:

- **Real-time truth in the UI.** Every number, every stage transition, every point on the map traces back to a WebSocket event from the orchestrator — never a hardcoded animation. This is the single biggest tell between "startup demo" and "student project."
- **A visual language that matches the domain.** Mission-control aesthetic: dark canvas, the 3D/map viewport as the hero element, monospace telemetry readouts, status chips per pipeline stage, restrained accent color reserved for confidence/alert states. Not generic SaaS-dashboard styling.
- **Explainability baked in, not bolted on.** Clicking a confidence point shows *why* it scored high (thermal contribution, radar contribution, structural contribution) — this single feature does more for credibility than anything else in this plan.
- **Explicit simulated/live state.** A persistent badge showing which adapter is active. When you eventually get real hardware, this becomes the moment your product visibly "goes live" — a strong demo moment in its own right.

Recommended stack (all free/open-source): **Next.js + TypeScript**, **Tailwind + shadcn/ui**, **Zustand** for state, **Framer Motion** for stage-transition animation, **React Three Fiber + drei** for the 3D point-cloud/mesh viewer, **MapLibre GL** (or `react-three-map` to combine the two) for the georeferenced route map, native **WebSocket** for the event stream. Full detail is in the build prompt (file 2).

---

## 7. Suggested build order (2+ week runway, no hard deadline)

1. **Week 1 — Skeleton & mock pipeline.** Orchestrator + adapter interfaces + WebSocket events + full frontend UI running entirely on `MockAdapter`s with recorded footage and synthetic sensor data. This alone is a complete, honest, demo-able product.
2. **Week 2 — Swap in real models one stage at a time.** Start with Stage 2 (MASt3R/Depth Anything V2 — visually the most impressive), then Stage 3 (thermal YOLO model), then Stage 7 (A* route planning — this one is fully real, no simulation needed at all).
3. **Week 3+ — Fusion tuning, hazard mapping, mission report export, and (optional) a Gazebo/Isaac Sim simulated flight for a genuinely live-flying demo.**

---

## 8. Sources referenced

- Depth Anything V2 — https://huggingface.co/depth-anything/Depth-Anything-V2-Small-hf
- DUSt3R — https://github.com/naver/dust3r · MASt3R Space — https://huggingface.co/spaces/naver/MASt3R
- Thermal SAR YOLO model — https://huggingface.co/ubr-physical-ai/rescue-target-yolo26n
- General thermal YOLOv8 — https://huggingface.co/foduucom/thermal-image-object-detection
- A*/RRT* reference implementation — https://github.com/martin0004/drone_path_planning
- UWB radar SAR precedent (Camero Xaver, 2023 Turkey earthquake) — https://camero-tech.com/enhancing-search-and-rescue-operations-with-ultra-wideband-radar/
- UWB victim-detection dataset (robot-mounted radar) — PMC article, https://pmc.ncbi.nlm.nih.gov/articles/PMC13342609/
- Mock-mode-first drone dashboard pattern — https://dev.to/jaya_chapparam/building-a-real-time-drone-ground-control-station-in-react-3nbm
- Free commercial-use footage — https://pixabay.com/videos/search/drone/
- Robot simulator landscape (2026) — https://www.blackcoffeerobotics.com/blog/which-robot-simulation-software-to-use
- AirSim shutdown / Colosseum archived — https://github.com/CodexLabsLLC/Colosseum
