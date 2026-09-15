"""
Debris-Scan AI — 8-Stage Pipeline Implementations

Each stage is an async function that:
  1. Receives outputs from the previous stage + active adapters
  2. Does its work (real or mock depending on the adapter)
  3. Returns artifacts to be stored and sent to the frontend
  4. Progress is reported via a callback

Stage 1: Aerial Scan — real YOLO inference on recorded aerial video
Stage 2: 3D Reconstruction — depth estimation → point cloud (mock pass 1, Depth Anything V2 pass 2)
Stage 3: Wide Sweep Detection — thermal hotspot detection + UWB signal processing
Stage 4: Multi-modal Fusion — weighted confidence scoring
Stage 5: Precision Revisit — close-range data per candidate (highest confidence first)
Stage 6: Hazard Mapping — classify terrain difficulty from point cloud
Stage 7: Route Planning — A* pathfinding over hazard grid
Stage 8: Mission Report — aggregate everything into exportable summary
"""
import numpy as np
import asyncio
import base64
import time
import pathlib
import logging
from datetime import datetime, timezone

from adapters import Frame, RadarSample
from models import Detection, FusionResult, RouteResult, Waypoint, MissionReport
from fusion import MultiModalFusion
from pathfinder import AStarPathfinder, generate_hazard_grid

logger = logging.getLogger("debris-scan.stages")

# ── Video source path (relative to backend/ directory) ─────────────
# The video is served from frontend/public/assets/ (browser URL: /assets/aerial-survey.mp4)
# The backend reads it directly from disk using a relative path from this file.
_BACKEND_DIR = pathlib.Path(__file__).parent
_VIDEO_PATH = _BACKEND_DIR / ".." / "frontend" / "public" / "assets" / "aerial-survey.mp4"

# Configurable inference rate (run YOLO every N video frames)
INFERENCE_EVERY_N_FRAMES = 5


# ── Stage 1: Aerial Scan ────────────────────────────────────────────

async def stage_scan(
    mission_id: str,
    scan_adapter,
    progress_cb=None,
    vision_provider=None,   # VisionModelProvider — injected by orchestrator
) -> dict:
    """
    Stage 1: Aerial Scan with REAL RGB model inference.

    Data flow:
    - Reads recorded aerial video frame-by-frame via OpenCV (simulated RGB sensor)
    - Runs real YOLO inference every INFERENCE_EVERY_N_FRAMES frames
    - Emits rgb_detection events per detected object via progress_cb
    - Also collects simulated LiDAR from the mock scan adapter
    - Returns frame count, detection list, and point cloud

    If model is offline: emits RGB MODEL OFFLINE, continues without detections.
    If video is unavailable: falls back to adapter synthetic frames, no detections.
    """
    rgb_detections_all: list[dict] = []
    frames_captured = 0
    inference_frames = 0
    total_inference_ms = 0.0
    sample_frames = []

    # ── Determine model status ──
    model_available = vision_provider is not None and vision_provider.is_available()
    model_status_str = "REAL INFERENCE" if model_available else "RGB MODEL OFFLINE"
    model_name = vision_provider.status().name if vision_provider else "offline"
    model_device = vision_provider.status().device if vision_provider else "offline"

    if progress_cb:
        await progress_cb(0.01, {
            "status": "AERIAL SCAN STARTED",
            "model_status": model_status_str,
            "model_name": model_name,
            "model_device": model_device,
        })

    # ── Try to open video with OpenCV ──
    video_path = str(_VIDEO_PATH.resolve())
    cap = None
    video_ok = False
    video_fps = 0.0
    video_total_frames = 0
    video_width = 640
    video_height = 480

    try:
        import cv2
        cap = cv2.VideoCapture(video_path)
        if cap.isOpened():
            video_ok = True
            video_fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
            video_total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
            video_width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
            video_height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
            logger.info(
                f"Video opened: {video_path} "
                f"({video_width}x{video_height} @ {video_fps:.1f}fps, "
                f"{video_total_frames} frames)"
            )
        else:
            logger.warning(f"OpenCV could not open: {video_path}")
    except ImportError:
        logger.warning("OpenCV not installed — using synthetic frame data from adapter")

    if progress_cb:
        await progress_cb(0.03, {
            "status": "RGB MODEL LOADED" if model_available else "RGB MODEL OFFLINE",
            "model_name": model_name,
            "model_device": model_device,
            "video_source": "aerial-survey.mp4",
            "video_ok": video_ok,
            "video_fps": round(video_fps, 1),
            "video_total_frames": video_total_frames,
        })

    # ── Process video frames ──
    if video_ok and cap is not None:
        import cv2

        frame_idx = 0
        loop = asyncio.get_event_loop()

        while True:
            ret, bgr_frame = cap.read()
            if not ret:
                break

            frame_idx += 1
            frames_captured += 1
            timestamp_s = frame_idx / video_fps

            # Run YOLO every N frames
            if frame_idx % INFERENCE_EVERY_N_FRAMES == 0 and model_available:
                inference_frames += 1

                # Run in executor to avoid blocking the event loop
                def _run_inference(frame=bgr_frame, fid=frame_idx, ts=timestamp_s):
                    return vision_provider.detect(
                        frame, frame_id=fid, timestamp_s=ts, conf_threshold=0.25
                    )

                dets = await loop.run_in_executor(None, _run_inference)

                for det in dets:
                    d = det.to_dict()
                    rgb_detections_all.append(d)
                    total_inference_ms += det.inference_time_ms

                    # Emit individual detection event so frontend can overlay in real time
                    if progress_cb:
                        await progress_cb(
                            frame_idx / max(video_total_frames, 1),
                            {
                                "event_type": "rgb_detection",
                                "frame_id": frame_idx,
                                "timestamp_s": round(timestamp_s, 3),
                                "detection": d,
                                "frames_captured": frames_captured,
                                "inference_frames": inference_frames,
                                "total_detections": len(rgb_detections_all),
                                "model_name": model_name,
                                "model_status": "REAL INFERENCE",
                            },
                        )

            # Emit coarser progress every 10 frames
            if frame_idx % 10 == 0 and progress_cb:
                avg_ms = total_inference_ms / max(inference_frames, 1)
                await progress_cb(
                    frame_idx / max(video_total_frames, 1),
                    {
                        "status": "FRAME PROCESSING",
                        "frames_captured": frames_captured,
                        "inference_frames": inference_frames,
                        "total_detections": len(rgb_detections_all),
                        "avg_inference_ms": round(avg_ms, 1),
                        "model_name": model_name,
                        "model_status": model_status_str,
                        "video_fps": round(video_fps, 1),
                    },
                )

            # Yield to event loop periodically
            if frame_idx % 30 == 0:
                await asyncio.sleep(0)

        cap.release()
        logger.info(
            f"Scan complete: {frames_captured} frames, "
            f"{inference_frames} inferred, "
            f"{len(rgb_detections_all)} detections"
        )

    else:
        # No OpenCV or video file not found
        # Fall back to adapter synthetic frames but emit NO fabricated detections
        logger.info("Falling back to adapter synthetic frames (no real video inference)")
        total_frames = scan_adapter.get_total_frames()
        async for frame in scan_adapter.get_rgb_frames(mission_id):
            frames_captured += 1
            if frame.index % 10 == 0:
                sample_frames.append(frame)
            if progress_cb:
                await progress_cb(frames_captured / total_frames, {
                    "status": "FRAME PROCESSING (synthetic)",
                    "frames_captured": frames_captured,
                    "total_frames": total_frames,
                    "model_status": "RGB MODEL OFFLINE — no video source",
                })

    # ── LiDAR collection ──
    avg_inference = total_inference_ms / max(inference_frames, 1)

    if progress_cb:
        await progress_cb(0.85, {
            "status": "AERIAL SCAN PROGRESS — collecting LiDAR",
            "frames_captured": frames_captured,
            "inference_frames": inference_frames,
            "total_detections": len(rgb_detections_all),
            "avg_inference_ms": round(avg_inference, 1),
            "model_name": model_name,
            "model_status": model_status_str,
        })

    all_points = []
    all_colors = []
    batch_count = 0

    async for batch in scan_adapter.get_lidar_points(mission_id):
        all_points.append(batch.points)
        if batch.colors is not None:
            all_colors.append(batch.colors)
        batch_count += 1

    point_cloud = np.concatenate(all_points, axis=0) if all_points else np.zeros((0, 3))
    colors = np.concatenate(all_colors, axis=0) if all_colors else None

    if progress_cb:
        await progress_cb(1.0, {
            "status": "AERIAL SCAN COMPLETE",
            "frames_captured": frames_captured,
            "inference_frames": inference_frames,
            "total_detections": len(rgb_detections_all),
            "avg_inference_ms": round(avg_inference, 1),
            "model_name": model_name,
            "model_device": model_device,
            "model_status": model_status_str,
            "video_fps": round(video_fps, 1),
            "video_width": video_width,
            "video_height": video_height,
        })

    return {
        "frames_captured": frames_captured,
        "inference_frames": inference_frames,
        "rgb_detections": rgb_detections_all,
        "total_detections": len(rgb_detections_all),
        "avg_inference_ms": round(avg_inference, 1),
        "model_name": model_name,
        "model_device": model_device,
        "model_status": model_status_str,
        "video_fps": round(video_fps, 1),
        "video_width": video_width,
        "video_height": video_height,
        "keyframes": sample_frames,
        "point_cloud": point_cloud,
        "point_cloud_colors": colors,
        "lidar_batches": batch_count,
        "total_points": len(point_cloud),
    }


# ── Stage 2: 3D Reconstruction ──────────────────────────────────────

async def stage_reconstruct(mission_id: str, scan_data: dict,
                            progress_cb=None, use_real_model=False) -> dict:
    """Build a 3D point cloud from scan data.

    Pass 1 (mock): Uses the LiDAR point cloud directly with synthetic depth
    Pass 2 (real): Would run Depth Anything V2 on keyframes to augment the cloud
    """
    point_cloud = scan_data["point_cloud"]
    colors = scan_data.get("point_cloud_colors")

    if progress_cb:
        await progress_cb(0.1, {"status": "Processing LiDAR point cloud"})

    if not use_real_model:
        await asyncio.sleep(0.5)

        rng = np.random.RandomState(2026)
        n_extra = 10000
        ex = rng.uniform(0, 100, n_extra).astype(np.float32)
        ey = rng.uniform(0, 100, n_extra).astype(np.float32)

        ez = (2.0 * np.sin(ex * 0.08) * np.cos(ey * 0.06)).astype(np.float32)
        d1 = np.sqrt((ex - 48)**2 + (ey - 52)**2)
        ez += (9.0 * np.exp(-d1**2 / 350)).astype(np.float32)
        d2 = np.sqrt((ex - 22)**2 + (ey - 68)**2)
        ez += (6.0 * np.exp(-d2**2 / 180)).astype(np.float32)
        d3 = np.sqrt((ex - 70)**2 + (ey - 30)**2)
        ez += (4.0 * np.exp(-d3**2 / 120)).astype(np.float32)
        ez += rng.uniform(-0.8, 0.8, n_extra).astype(np.float32)

        extra_points = np.stack([ex, ey, ez], axis=1)
        point_cloud = np.concatenate([point_cloud, extra_points], axis=0)

        if colors is not None:
            z_norm = np.clip((ez - ez.min()) / (ez.max() - ez.min() + 1e-6), 0, 1)
            extra_colors = np.zeros((n_extra, 3), dtype=np.uint8)
            extra_colors[:, 0] = (90 + 120 * z_norm).astype(np.uint8)
            extra_colors[:, 1] = (75 + 95 * z_norm).astype(np.uint8)
            extra_colors[:, 2] = (50 + 80 * z_norm).astype(np.uint8)
            colors = np.concatenate([colors, extra_colors], axis=0)

        if progress_cb:
            await progress_cb(0.6, {
                "status": "Fusing LiDAR + depth-estimated points",
                "total_points": len(point_cloud),
            })

    await asyncio.sleep(0.3)

    pc_bytes = point_cloud.astype(np.float32).tobytes()
    pc_b64 = base64.b64encode(pc_bytes).decode("ascii")

    color_b64 = None
    if colors is not None:
        color_b64 = base64.b64encode(colors.astype(np.uint8).tobytes()).decode("ascii")

    if progress_cb:
        await progress_cb(1.0, {"status": "Reconstruction complete"})

    return {
        "point_cloud": point_cloud,
        "point_cloud_colors": colors,
        "point_cloud_b64": pc_b64,
        "color_b64": color_b64,
        "total_points": len(point_cloud),
        "bounds": {
            "min": point_cloud.min(axis=0).tolist(),
            "max": point_cloud.max(axis=0).tolist(),
        },
        "method": "mock_lidar_depth_fusion" if not use_real_model else "depth_anything_v2",
    }


# ── Stage 3: Wide Sweep Detection ───────────────────────────────────

async def stage_detect(mission_id: str, detection_adapter,
                       progress_cb=None) -> dict:
    """Run thermal detection and UWB radar vital-sign processing.

    Thermal: hotspot detection on simulated thermal frames
    UWB Radar: REAL signal processing — clutter removal + FFT breathing detection
    """
    thermal_detections = []
    radar_detections = []

    if progress_cb:
        await progress_cb(0.05, {"status": "Running thermal sweep"})

    frame_count = 0

    async for frame in detection_adapter.get_thermal_frames(mission_id):
        frame_count += 1

        thermal_map = frame.data[:, :, 0].astype(float) / 255.0
        h, w = thermal_map.shape

        try:
            from scipy.ndimage import maximum_filter, label
            local_max = maximum_filter(thermal_map, size=40)
            peaks = (thermal_map == local_max) & (thermal_map > 0.55)
            labeled, num_features = label(peaks)
        except ImportError:
            peaks = thermal_map > 0.60
            labeled = peaks.astype(int)
            num_features = int(np.sum(peaks))

        for feat_id in range(1, min(num_features + 1, 6)):
            ys, xs = np.where(labeled == feat_id)
            if len(xs) == 0:
                continue
            cx, cy = float(np.mean(xs) / w * 100), float(np.mean(ys) / h * 100)
            peak_val = float(thermal_map[ys, xs].max())

            det = Detection(
                id=f"TH-{frame.index:02d}-{feat_id}",
                source="thermal",
                x=round(cx, 2),
                y=round(cy, 2),
                z=0.0,
                confidence=round(peak_val, 3),
                label="thermal_hotspot",
                metadata={"frame": frame.index, "peak_temp_norm": round(peak_val, 3)},
            )
            thermal_detections.append(det)

        if progress_cb:
            await progress_cb(0.05 + 0.4 * frame_count / 30, {
                "status": f"Thermal frame {frame_count}/30",
                "thermal_candidates": len(thermal_detections),
            })

    # ── UWB Radar vital-sign detection — REAL signal processing ──
    if progress_cb:
        await progress_cb(0.5, {"status": "Processing UWB radar returns"})

    radar_detections = await _process_radar_vitals(mission_id, detection_adapter,
                                                    progress_cb)

    thermal_deduped = _deduplicate_detections(thermal_detections, radius=6.0)

    if progress_cb:
        await progress_cb(1.0, {
            "status": "Detection sweep complete",
            "thermal_candidates": len(thermal_deduped),
            "radar_candidates": len(radar_detections),
        })

    return {
        "thermal_detections": thermal_deduped,
        "radar_detections": radar_detections,
        "thermal_frames_processed": frame_count,
        "radar_samples_processed": int(detection_adapter.radar_duration_s *
                                       detection_adapter.radar_sample_rate),
    }


async def _process_radar_vitals(mission_id: str, adapter,
                                progress_cb=None) -> list[Detection]:
    """Real UWB vital-sign detection via clutter removal + FFT.

    Algorithm:
    1. Collect all radar samples into a time×range_bins matrix
    2. Subtract mean (static clutter removal)
    3. Compute variance per range bin over time
    4. For high-variance bins, FFT to check if dominant frequency
       is in the human breathing band (0.15–0.50 Hz)
    5. Emit detection at each breathing-band bin

    This is genuine signal processing — the same algorithm runs
    whether the input is synthetic or from a real Novelda X4 radar.
    """
    samples = []
    async for sample in adapter.get_radar_returns(mission_id):
        samples.append(sample.range_bins)

    if not samples:
        return []

    radar_matrix = np.array(samples)
    num_samples, num_bins = radar_matrix.shape
    sample_rate = adapter.radar_sample_rate

    clutter_profile = np.mean(radar_matrix, axis=0)
    residual = radar_matrix - clutter_profile

    bin_variance = np.var(residual, axis=0)
    var_threshold = np.percentile(bin_variance, 85)
    candidate_bins = np.where(bin_variance > var_threshold)[0]

    detections = []
    det_count = 0

    for bin_idx in candidate_bins:
        signal = residual[:, bin_idx]

        fft_vals = np.abs(np.fft.rfft(signal))
        freqs = np.fft.rfftfreq(num_samples, d=1.0 / sample_rate)

        breath_mask = (freqs >= 0.15) & (freqs <= 0.50)
        if not np.any(breath_mask):
            continue

        breath_fft = fft_vals[breath_mask]
        breath_freqs = freqs[breath_mask]

        if len(breath_fft) == 0:
            continue

        peak_idx = np.argmax(breath_fft)
        peak_power = breath_fft[peak_idx]
        peak_freq = breath_freqs[peak_idx]

        noise_floor = np.median(fft_vals[1:])
        snr = peak_power / (noise_floor + 1e-8)

        if snr > 3.0:
            det_count += 1
            depth = bin_idx / num_bins * 10.0
            confidence = float(np.clip(snr / 15.0, 0.3, 0.95))

            det = Detection(
                id=f"UWB-{det_count:02d}",
                source="radar",
                x=round(bin_idx / num_bins * 100, 2),
                y=round(50 + (bin_idx % 7 - 3) * 8, 2),
                z=round(depth, 2),
                confidence=round(confidence, 3),
                label="breathing_signature",
                metadata={
                    "breathing_freq_hz": round(float(peak_freq), 3),
                    "breathing_bpm": round(float(peak_freq * 60), 1),
                    "snr_db": round(float(10 * np.log10(snr)), 1),
                    "range_bin": int(bin_idx),
                    "depth_m": round(depth, 2),
                    "method": "variance_threshold_fft",
                },
            )
            detections.append(det)

    return detections


def _deduplicate_detections(detections: list[Detection],
                            radius: float = 6.0) -> list[Detection]:
    """Keep only the highest-confidence detection within each spatial cluster."""
    if not detections:
        return []

    sorted_dets = sorted(detections, key=lambda d: d.confidence, reverse=True)
    kept = []
    used = set()

    for det in sorted_dets:
        if det.id in used:
            continue

        for other in sorted_dets:
            if other.id in used or other.id == det.id:
                continue
            dist = np.sqrt((det.x - other.x)**2 + (det.y - other.y)**2)
            if dist < radius:
                used.add(other.id)

        kept.append(det)
        used.add(det.id)

    return kept


# ── Stage 4: Multi-modal Fusion ──────────────────────────────────────

async def stage_fuse(mission_id: str, detect_data: dict,
                     reconstruct_data: dict,
                     progress_cb=None) -> dict:
    """Fuse thermal + radar detections into confidence-scored candidates."""
    if progress_cb:
        await progress_cb(0.1, {"status": "Computing multi-modal fusion scores"})

    fusion = MultiModalFusion()

    point_cloud = reconstruct_data.get("point_cloud")

    from pathfinder import generate_hazard_grid
    hazard_grid = generate_hazard_grid(point_cloud)

    results = fusion.fuse(
        thermal_detections=detect_data["thermal_detections"],
        radar_detections=detect_data["radar_detections"],
        point_cloud=point_cloud,
        hazard_grid=hazard_grid,
    )

    if progress_cb:
        await progress_cb(1.0, {
            "status": "Fusion complete",
            "candidates": len(results),
            "top_score": results[0].total_score if results else 0,
        })

    return {
        "fusion_results": results,
        "hazard_grid": hazard_grid,
        "total_candidates": len(results),
    }


# ── Stage 5: Precision Revisit ───────────────────────────────────────

async def stage_revisit(mission_id: str, fuse_data: dict,
                        progress_cb=None) -> dict:
    """Simulate precision revisit: drone descends to each candidate point.

    In a real system, this would capture close-range imagery and radar data.
    For mock, we confirm candidates above a confidence threshold.
    """
    results: list[FusionResult] = fuse_data["fusion_results"]
    confirmed = []
    rejected = []

    for i, candidate in enumerate(results):
        if progress_cb:
            await progress_cb((i + 1) / len(results), {
                "status": f"Revisiting candidate {candidate.id}",
                "position": {"x": candidate.x, "y": candidate.y},
            })

        await asyncio.sleep(0.4)

        if candidate.total_score > 0.35:
            candidate.confirmed = True
            confirmed.append(candidate)
        else:
            rejected.append(candidate)

    return {
        "confirmed": confirmed,
        "rejected": rejected,
        "confirmed_count": len(confirmed),
        "rejected_count": len(rejected),
    }


# ── Stage 6: Hazard Mapping ─────────────────────────────────────────

async def stage_hazard(mission_id: str, reconstruct_data: dict,
                       fuse_data: dict, progress_cb=None) -> dict:
    """Classify terrain into hazard zones from point cloud analysis."""
    if progress_cb:
        await progress_cb(0.1, {"status": "Voxelizing point cloud for hazard analysis"})

    hazard_grid = fuse_data.get("hazard_grid")
    point_cloud = reconstruct_data.get("point_cloud")

    if hazard_grid is None:
        hazard_grid = generate_hazard_grid(point_cloud)

    await asyncio.sleep(0.5)

    grid_size = hazard_grid.shape[0]
    classifications = {}
    summary = {"stable": 0, "loose_rubble": 0, "steep": 0, "void": 0, "impassable": 0}

    for gy in range(grid_size):
        for gx in range(grid_size):
            cost = float(hazard_grid[gy, gx])
            if cost > 0.9:
                classifications[f"{gx},{gy}"] = "impassable"
                summary["impassable"] += 1
            elif cost > 0.6:
                classifications[f"{gx},{gy}"] = "steep"
                summary["steep"] += 1
            elif cost > 0.35:
                classifications[f"{gx},{gy}"] = "loose_rubble"
                summary["loose_rubble"] += 1
            else:
                classifications[f"{gx},{gy}"] = "stable"
                summary["stable"] += 1

    hg_b64 = base64.b64encode(
        hazard_grid.astype(np.float32).tobytes()).decode("ascii")

    if progress_cb:
        await progress_cb(1.0, {
            "status": "Hazard mapping complete",
            "summary": summary,
        })

    return {
        "hazard_grid": hazard_grid,
        "hazard_grid_b64": hg_b64,
        "grid_size": grid_size,
        "classifications": classifications,
        "summary": summary,
    }


# ── Stage 7: Route Planning ─────────────────────────────────────────

async def stage_route(mission_id: str, hazard_data: dict,
                      revisit_data: dict, progress_cb=None) -> dict:
    """Run A* pathfinding from ground entry point to each confirmed candidate.

    Two routes per candidate: safest (hazard-averse) and fastest (shorter but riskier).
    This is REAL pathfinding, not simulation.
    """
    hazard_grid = hazard_data["hazard_grid"]
    confirmed = revisit_data["confirmed"]
    grid_size = hazard_grid.shape[0]

    pathfinder = AStarPathfinder(grid_size=grid_size)

    entry_point = (5, 95)
    routes = []

    for i, candidate in enumerate(confirmed):
        if progress_cb:
            await progress_cb((i + 0.5) / max(len(confirmed), 1), {
                "status": f"Planning routes to {candidate.id}",
            })

        goal = (
            int(np.clip(candidate.x, 0, grid_size - 1)),
            int(np.clip(candidate.y, 0, grid_size - 1)),
        )

        safest = pathfinder.plan(entry_point, goal, hazard_grid, mode="safest")
        routes.append(RouteResult(
            target_id=candidate.id,
            mode="safest",
            waypoints=[Waypoint(**wp) for wp in safest["waypoints"]],
            total_distance_m=safest["total_distance_m"],
            estimated_time_min=safest["estimated_time_min"],
            max_hazard_encountered=safest["max_hazard_encountered"],
            hazard_zone_crossings=safest["hazard_zone_crossings"],
        ))

        fastest = pathfinder.plan(entry_point, goal, hazard_grid, mode="fastest")
        routes.append(RouteResult(
            target_id=candidate.id,
            mode="fastest",
            waypoints=[Waypoint(**wp) for wp in fastest["waypoints"]],
            total_distance_m=fastest["total_distance_m"],
            estimated_time_min=fastest["estimated_time_min"],
            max_hazard_encountered=fastest["max_hazard_encountered"],
            hazard_zone_crossings=fastest["hazard_zone_crossings"],
        ))

        await asyncio.sleep(0.2)

    if progress_cb:
        await progress_cb(1.0, {
            "status": "All routes computed",
            "total_routes": len(routes),
        })

    return {
        "routes": routes,
        "entry_point": list(entry_point),
        "total_routes": len(routes),
    }


# ── Stage 8: Mission Report ─────────────────────────────────────────

async def stage_report(mission_id: str, mission_data: dict,
                       progress_cb=None) -> dict:
    """Aggregate all pipeline outputs into a mission report."""
    if progress_cb:
        await progress_cb(0.5, {"status": "Generating mission report"})

    scan = mission_data.get("scan", {})
    reconstruct = mission_data.get("reconstruct", {})
    fuse = mission_data.get("fuse", {})
    revisit = mission_data.get("revisit", {})
    hazard = mission_data.get("hazard", {})
    route = mission_data.get("route", {})

    area = 100.0 * 100.0

    report = MissionReport(
        mission_id=mission_id,
        site_name=mission_data.get("site_name", "Unknown Site"),
        adapter_mode="mock",
        total_area_scanned_m2=area,
        scan_duration_s=scan.get("frames_captured", 60) * 0.2,
        total_points_captured=reconstruct.get("total_points", 0),
        candidates_detected=fuse.get("total_candidates", 0),
        confirmed_survivors=revisit.get("confirmed_count", 0),
        fusion_results=revisit.get("confirmed", []),
        routes=route.get("routes", []),
        hazard_summary=hazard.get("summary", {}),
    )

    report_json = report.model_dump(mode="json")

    if progress_cb:
        await progress_cb(1.0, {"status": "Report generated"})

    return {
        "report": report_json,
    }
