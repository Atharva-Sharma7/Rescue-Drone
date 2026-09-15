# Build Prompt — Debris-Scan AI Mission Control
Copy everything below into Claude Code (or another AI coding agent) as your starting instruction. It's self-contained.

---

```
You are building "Debris-Scan AI" — a search-and-rescue mission control web app for a
drone-based debris-scanning system. Build a real, working product, not a mockup: every
number and state transition in the UI must be driven by real backend events, never by
hardcoded timers. Since no physical drone exists yet, the system must run end-to-end on
simulated/mock data through a swappable adapter interface, so real hardware can be
plugged in later without touching the frontend or orchestrator.

=====================================================================
1. PRODUCT OVERVIEW
=====================================================================
A drone scans a debris field in 8 coordinated stages:
  0. Mission Init      — operator defines a site boundary, starts the mission
  1. Aerial Scan        — RGB video + LiDAR/point-cloud capture over the site
  2. 3D Reconstruction   — build a 3D mesh/point cloud of the debris from stage 1 data
  3. Wide Sweep Detection — thermal camera + UWB radar sweep the reconstructed area
                            for candidate signs of life (heat signatures, radar
                            breathing/motion returns)
  4. Multi-modal Fusion  — combine stage 3 candidates into confidence-scored points
                            plotted on the 3D model
  5. Precision Revisit    — drone "descends" to each confidence point (highest first)
                            and captures close-range data to confirm/refine it
  6. Hazard Mapping       — classify terrain difficulty/instability across the mesh
  7. Route Planning       — compute the safest + fastest path from a ground-entry
                            point to each confirmed point, for a human rescue team
  8. Mission Report       — exportable summary (JSON + PDF) of all confirmed points,
                            confidence, routes, and hazards

Each stage is a discrete backend job. On completion it emits a WebSocket event; the
frontend advances ONLY in response to that event. This is the most important
architectural requirement in this whole prompt — do not fake sequencing with
setTimeout or client-side animation timers standing in for real progress.

=====================================================================
2. TECH STACK
=====================================================================
Frontend:
  - Next.js 14+ (App Router), TypeScript
  - Tailwind CSS + shadcn/ui for base components
  - Zustand for mission/pipeline state
  - Framer Motion for stage-transition animation (triggered by store state changes,
    never by its own independent timers)
  - React Three Fiber + @react-three/drei for the 3D point-cloud/mesh viewer
  - MapLibre GL (or `react-three-map` if you want the 3D view embedded in a
    georeferenced map) for the route-planning map
  - Recharts (or visx) for telemetry/confidence charts
  - Native browser WebSocket client

Backend:
  - Python, FastAPI
  - WebSocket endpoint per mission for stage events
  - Background task runner (FastAPI BackgroundTasks or a simple asyncio task queue
    is fine at this scale — no need for Celery/Redis yet)
  - Model layer: thin wrapper functions per model, see section 5

Keep the repo as a monorepo: `/frontend` (Next.js) and `/backend` (FastAPI), with a
root `docker-compose.yml` that runs both plus any needed services.

=====================================================================
3. THE ADAPTER PATTERN (build this first, before anything else)
=====================================================================
Define these interfaces in the backend BEFORE writing any pipeline logic:

  class ScanAdapter(Protocol):
      async def get_rgb_frames(self, mission_id: str) -> AsyncIterator[Frame]: ...
      async def get_lidar_points(self, mission_id: str) -> AsyncIterator[PointBatch]: ...

  class DetectionAdapter(Protocol):
      async def get_thermal_frames(self, mission_id: str) -> AsyncIterator[Frame]: ...
      async def get_radar_returns(self, mission_id: str) -> AsyncIterator[RadarSample]: ...

Implement `MockScanAdapter` / `MockDetectionAdapter` now:
  - `MockScanAdapter` streams frames extracted from a pre-downloaded, properly
    licensed royalty-free video file (see section 6) at real-time pace (use ffmpeg
    to pre-extract frames at ~5fps into a folder per demo scenario, then stream them
    with a small delay to simulate real-time capture).
  - `MockDetectionAdapter` streams frames from a royalty-free thermal-style video AND
    generates synthetic UWB radar range-bin data: a background noise floor plus an
    injected periodic waveform (~0.2–0.3 Hz, mimicking breathing) at 1-3 configurable
    "hidden" locations per demo scenario, so the later signal-processing stage has
    something real to detect rather than being pre-scripted.

Leave clearly marked TODO stubs for `LiveScanAdapter` / `LiveDetectionAdapter` that
would pull from real hardware later — do not implement them now, just define the
interface contract so swapping in real drone data later is a one-line change in the
orchestrator's dependency injection, nothing else.

=====================================================================
4. ORCHESTRATOR
=====================================================================
  POST /missions                 -> create mission, returns mission_id
  POST /missions/{id}/start      -> begins Stage 1, returns 202
  GET  /missions/{id}            -> current state snapshot (for reconnect/refresh)
  WS   /missions/{id}/events     -> stream of StageEvent

  StageEvent schema (JSON):
  {
    "mission_id": "string",
    "stage": "scan | reconstruct | detect | fuse | revisit | hazard | route | report",
    "status": "started | progress | complete | failed",
    "progress": 0.0-1.0,            // optional, for long-running stages
    "payload": { ... stage-specific data, e.g. point cloud URL, candidate list ... },
    "timestamp": "ISO8601"
  }

  The orchestrator runs stages strictly in order for a given mission. Each stage
  function receives the outputs of the previous stage and the active adapters, does
  its work, persists artifacts (point clouds, detection lists, route geometry) to
  disk/S3-compatible storage, and emits `complete` before the next stage starts.
  On any exception, emit `failed` with an error message — the frontend must show
  this state, not hang silently.

=====================================================================
5. MODEL / ALGORITHM LAYER (real pretrained models — install as needed)
=====================================================================
Stage 2 — 3D Reconstruction:
  - Primary: MASt3R or DUSt3R (github.com/naver/dust3r) — takes a handful of
    overlapping RGB frames from stage 1, outputs a dense 3D point cloud with no
    camera-calibration step required. Wrap it as
    `reconstruct(frames: list[Frame]) -> PointCloud`.
  - Lightweight fallback / speed option: Depth Anything V2 via the `transformers`
    pipeline (`depth-anything/Depth-Anything-V2-Small-hf`) for a fast per-frame
    depth map you can back-project into a rough point cloud if MASt3R is too slow
    for a given demo machine.

Stage 3 — Thermal detection:
  - `foduucom/thermal-image-object-detection` (YOLOv8, load via `ultralytics`) or
    `ubr-physical-ai/rescue-target-yolo26n` (SAR-specific "person lying + hi-vis
    vest" detector, note in its model card it's research-grade — surface that same
    caveat in the product UI as a small disclaimer, don't hide it).
  - Wrap as `detect_thermal(frame: Frame) -> list[Detection]`.

Stage 3 — UWB "vital sign" detection (signal processing, not a pretrained model):
  - Implement variance-threshold clutter removal on the synthetic radar range-bin
    stream from `MockDetectionAdapter`: subtract a running-average static-clutter
    profile, then flag range bins whose residual variance exceeds a threshold and
    whose dominant frequency falls in the human breathing band (~0.2-0.5 Hz) as
    candidate returns. Wrap as `detect_radar(samples: list[RadarSample]) ->
    list[Detection]`. This is real signal processing running on synthetic input —
    document it as such in code comments and in the UI copy.

Stage 4 — Fusion (explainable, not a black box):
  Score each spatial cell of the reconstructed mesh:
    confidence = w_thermal * thermal_score
               + w_radar   * radar_score
               + w_geom    * structural_plausibility   (void/cavity likelihood
                                                          from local point density)
               - w_hazard  * instability_penalty
  Normalize each term to [0,1]. Store the per-term breakdown alongside the total
  score — the frontend needs this for the "why did this point score high" UI.

Stage 6 — Hazard mapping:
  Voxelize the mesh; flag cells with high local point-density variance (loose
  rubble) or steep local slope (unstable footing) as high-cost.

Stage 7 — Route planning:
  A* (or RRT* for smoother paths) over the voxel grid from stage 6, with edge cost
  = distance * (1 + hazard_penalty). Reference implementation to adapt:
  github.com/martin0004/drone_path_planning. Wrap as
  `plan_route(start, goal, hazard_grid) -> list[Waypoint]`.

=====================================================================
6. DEMO DATA (do this before touching adapters)
=====================================================================
Do NOT scrape/re-host YouTube videos in the shipped product. Download a small set of
royalty-free, commercial-use-cleared clips instead (Pixabay, Videezy's Creative
Commons section, or Pexels) covering: aerial debris/collapsed-structure footage,
drone flyover footage, and thermal-style imagery. Store them in
`/backend/demo-assets/{scenario_name}/` with a `manifest.json` describing which file
maps to which adapter stream. Extract frames with ffmpeg at capture time, not at
build time, so the "live-feeling" streaming behavior is real code, not a video tag.

Every screen that renders mock-sourced data must show a small, persistent
"Simulated Mission — Recorded Flight Data" badge. This is a requirement, not a nice-
to-have — it's what makes the demo credible instead of deceptive.

=====================================================================
7. FRONTEND SCREENS
=====================================================================
1. **Mission Control** (default/home view)
   - Left: vertical stage stepper (8 stages from section 1), each showing
     pending/active/complete/failed, driven entirely by the WebSocket store.
   - Center: live feed panel — shows the current stage's relevant visual (raw
     video during Scan, point cloud building during Reconstruct, thermal overlay
     during Detect, etc.)
   - Right: telemetry readout panel (monospace: frame count, points captured,
     candidates found, current confidence range) updating from real event payloads.
   - "Simulated Mission" badge, mission ID, elapsed time, Start/Reset controls.

2. **3D Reconstruction Viewer**
   - React Three Fiber canvas rendering the point cloud/mesh artifact from Stage 2.
   - Orbit controls, point-size/density toggle, and (once Stage 4 completes) an
     overlay toggle that colors the cloud by fusion confidence.

3. **Detection & Fusion View**
   - The 3D view with confidence points rendered as markers, sized/colored by
     score. Clicking a point opens a side panel breaking down thermal / radar /
     structural contribution to that point's score (this is the explainability
     feature from the plan — build it, don't skip it).

4. **Route Planner**
   - Map (MapLibre) or top-down projection of the hazard grid, with the planned
     route(s) drawn from Stage 7, waypoint list, and estimated time/distance per
     route.

5. **Mission Report**
   - Summary table of all confirmed points (location, confidence, breakdown),
     routes, and a "Download Report" button producing the Stage 8 JSON/PDF.

Visual language: dark background, the 3D/map viewport as the dominant hero element
on every screen, monospace for all numeric telemetry, a single restrained accent
color reserved for confidence/alert states (e.g. amber → red as confidence rises),
status chips rather than plain text for pipeline stage state. Avoid generic light-
theme SaaS-dashboard styling — this should read as mission-control software.

=====================================================================
8. BUILD ORDER
=====================================================================
1. Backend skeleton: FastAPI app, mission model, WebSocket endpoint, StageEvent
   schema, MockScanAdapter/MockDetectionAdapter with real demo footage streaming.
2. Orchestrator wired to stages 1 and 8 only (scan -> straight to report) just to
   prove the event pipeline end-to-end works and the frontend reacts correctly.
3. Frontend Mission Control screen consuming the WebSocket, stepper + live feed +
   telemetry panel working against the skeleton above.
4. Fill in Stage 2 (MASt3R/Depth Anything V2) and the 3D Reconstruction Viewer.
5. Fill in Stage 3 (thermal YOLO + synthetic UWB signal processing) and the
   Detection & Fusion view, including the score-breakdown panel.
6. Fill in Stages 5-6-7 (revisit loop, hazard grid, A* route planning) and the
   Route Planner screen.
7. Mission Report screen + export.
8. Polish pass: animations tied to real state transitions, empty/loading/error
   states for every screen, the "Simulated Mission" badge everywhere it's needed.

=====================================================================
9. ACCEPTANCE CRITERIA
=====================================================================
- Starting a mission with zero manual intervention runs all 8 stages to completion
  using only mock adapters, purely driven by backend events.
- Refreshing the browser mid-mission and reconnecting shows the correct current
  stage (via GET /missions/{id}), not a reset state.
- Every visual element that depends on stage data is empty/loading until its
  stage's `complete` event arrives — nothing is pre-rendered with fake numbers.
- Clicking any confidence point shows its real per-sensor score breakdown.
- The route planner's output path visibly avoids the high-hazard cells in the
  hazard grid, not a straight line.
- No YouTube-sourced or otherwise unlicensed video files anywhere in the repo or
  demo-assets folder.
```
