"""
Debris-Scan AI — Mission Orchestrator

Runs the 8-stage pipeline in strict sequence for a given mission.
Each stage's completion emits a WebSocket event; the frontend advances
ONLY in response to those events — never on its own timer.

Architecture: Dependency Injection
  - scan_adapter, detection_adapter: simulated sensor inputs (mock)
  - vision_provider: real AI model (YOLOVisionProvider or OfflineVisionProvider)
  - The orchestrator receives these through its constructor, never instantiates them directly.
"""
import asyncio
import traceback
from datetime import datetime, timezone
from typing import Callable, Awaitable

from models import (
    Mission, StageEvent, StageEnum, StatusEnum, STAGE_ORDER,
    FusionResult, RouteResult,
)
from adapters import MockScanAdapter, MockDetectionAdapter
from model_providers import create_vision_provider, OfflineVisionProvider
from stages import (
    stage_scan, stage_reconstruct, stage_detect,
    stage_fuse, stage_revisit, stage_hazard,
    stage_route, stage_report,
)


# Type alias for the event broadcast callback
EventCallback = Callable[[StageEvent], Awaitable[None]]


class MissionOrchestrator:
    """
    Runs the full 8-stage SAR pipeline for a mission.

    Adapters and model providers are injected at construction time.
    This means the orchestrator never contains any hardcoded adapter logic.

    Usage:
        vision = create_vision_provider()
        scan_adapter = MockScanAdapter(num_frames=60, fps=5.0)
        detect_adapter = MockDetectionAdapter(...)
        orchestrator = MissionOrchestrator(
            scan_adapter=scan_adapter,
            detection_adapter=detect_adapter,
            vision_provider=vision,
        )
        mission = orchestrator.create_mission(site_name="...")
        await orchestrator.run_mission(mission.id, broadcast_fn)
    """

    def __init__(self, scan_adapter=None, detection_adapter=None, vision_provider=None):
        self.missions: dict[str, Mission] = {}
        self.mission_data: dict[str, dict] = {}
        self._locks: dict[str, asyncio.Lock] = {}

        # ── Injected adapters (simulated hardware inputs) ──
        self.scan_adapter = scan_adapter or MockScanAdapter(num_frames=60, fps=5.0)
        self.detection_adapter = detection_adapter or MockDetectionAdapter(
            num_thermal_frames=30, radar_duration_s=30.0)

        # ── Injected model provider (real AI) ──
        # If none provided, use offline fallback — never silently fake
        self.vision_provider = vision_provider or OfflineVisionProvider(
            reason="No vision provider configured"
        )

    def create_mission(self, site_name: str,
                       boundary_coords: list[list[float]] | None = None) -> Mission:
        """Create a new mission and register it."""
        mission = Mission(
            site_name=site_name,
            boundary_coords=boundary_coords or [
                [28.6139, 77.2090], [28.6145, 77.2090],
                [28.6145, 77.2096], [28.6139, 77.2096],
            ],
            adapter_mode="mock",
        )

        for stage in STAGE_ORDER:
            mission.stage_statuses[stage.value] = StatusEnum.PENDING.value

        self.missions[mission.id] = mission
        self.mission_data[mission.id] = {"site_name": site_name}
        self._locks[mission.id] = asyncio.Lock()

        return mission

    def get_mission(self, mission_id: str) -> Mission | None:
        return self.missions.get(mission_id)

    def get_mission_snapshot(self, mission_id: str) -> dict | None:
        """Get a full state snapshot for browser reconnection."""
        mission = self.missions.get(mission_id)
        if not mission:
            return None

        data = self.mission_data.get(mission_id, {})

        snapshot = mission.model_dump(mode="json")

        artifacts = {}
        if "reconstruct" in data:
            artifacts["reconstruct"] = {
                "total_points": data["reconstruct"].get("total_points", 0),
                "point_cloud_b64": data["reconstruct"].get("point_cloud_b64"),
                "color_b64": data["reconstruct"].get("color_b64"),
                "bounds": data["reconstruct"].get("bounds"),
                "method": data["reconstruct"].get("method"),
            }
        if "fuse" in data:
            fuse = data["fuse"]
            artifacts["fuse"] = {
                "total_candidates": fuse.get("total_candidates", 0),
                "fusion_results": [
                    r.model_dump(mode="json") if hasattr(r, "model_dump") else r
                    for r in fuse.get("fusion_results", [])
                ],
            }
        if "revisit" in data:
            rev = data["revisit"]
            artifacts["revisit"] = {
                "confirmed_count": rev.get("confirmed_count", 0),
                "confirmed": [
                    r.model_dump(mode="json") if hasattr(r, "model_dump") else r
                    for r in rev.get("confirmed", [])
                ],
            }
        if "hazard" in data:
            haz = data["hazard"]
            artifacts["hazard"] = {
                "hazard_grid_b64": haz.get("hazard_grid_b64"),
                "grid_size": haz.get("grid_size"),
                "summary": haz.get("summary"),
            }
        if "route" in data:
            rt = data["route"]
            artifacts["route"] = {
                "total_routes": rt.get("total_routes", 0),
                "entry_point": rt.get("entry_point"),
                "routes": [
                    r.model_dump(mode="json") if hasattr(r, "model_dump") else r
                    for r in rt.get("routes", [])
                ],
            }
        if "report" in data:
            artifacts["report"] = data["report"].get("report")
        if "scan" in data:
            scan = data["scan"]
            artifacts["scan"] = {
                "frames_captured": scan.get("frames_captured", 0),
                "inference_frames": scan.get("inference_frames", 0),
                "total_detections": scan.get("total_detections", 0),
                "avg_inference_ms": scan.get("avg_inference_ms", 0),
                "model_name": scan.get("model_name", "—"),
                "model_device": scan.get("model_device", "—"),
                "model_status": scan.get("model_status", "—"),
                "video_fps": scan.get("video_fps", 0),
                "video_width": scan.get("video_width", 0),
                "video_height": scan.get("video_height", 0),
                # Include all RGB detections for reconnection overlay
                "rgb_detections": scan.get("rgb_detections", []),
            }

        snapshot["artifacts"] = artifacts
        return snapshot

    async def run_mission(self, mission_id: str, broadcast: EventCallback) -> None:
        """Run all 8 stages in sequence, broadcasting events via WebSocket."""
        mission = self.missions.get(mission_id)
        if not mission:
            raise ValueError(f"Mission {mission_id} not found")

        async with self._locks[mission_id]:
            mission.started_at = datetime.now(timezone.utc)
            data = self.mission_data[mission_id]

            stage_fns = [
                (StageEnum.SCAN,        self._run_scan),
                (StageEnum.RECONSTRUCT, self._run_reconstruct),
                (StageEnum.DETECT,      self._run_detect),
                (StageEnum.FUSE,        self._run_fuse),
                (StageEnum.REVISIT,     self._run_revisit),
                (StageEnum.HAZARD,      self._run_hazard),
                (StageEnum.ROUTE,       self._run_route),
                (StageEnum.REPORT,      self._run_report),
            ]

            for stage_enum, stage_fn in stage_fns:
                try:
                    mission.current_stage = stage_enum
                    mission.stage_statuses[stage_enum.value] = StatusEnum.STARTED.value
                    await broadcast(StageEvent(
                        mission_id=mission_id,
                        stage=stage_enum,
                        status=StatusEnum.STARTED,
                    ))

                    async def progress_cb(progress: float, payload: dict,
                                          _stage=stage_enum):
                        await broadcast(StageEvent(
                            mission_id=mission_id,
                            stage=_stage,
                            status=StatusEnum.PROGRESS,
                            progress=round(progress, 3),
                            payload=payload,
                        ))

                    result = await stage_fn(mission_id, data, progress_cb)
                    data[stage_enum.value] = result

                    complete_payload = self._serialize_stage_result(stage_enum, result)

                    mission.stage_statuses[stage_enum.value] = StatusEnum.COMPLETE.value
                    await broadcast(StageEvent(
                        mission_id=mission_id,
                        stage=stage_enum,
                        status=StatusEnum.COMPLETE,
                        progress=1.0,
                        payload=complete_payload,
                    ))

                except Exception as e:
                    mission.stage_statuses[stage_enum.value] = StatusEnum.FAILED.value
                    await broadcast(StageEvent(
                        mission_id=mission_id,
                        stage=stage_enum,
                        status=StatusEnum.FAILED,
                        payload={
                            "error": str(e),
                            "traceback": traceback.format_exc(),
                        },
                    ))
                    return

            mission.completed_at = datetime.now(timezone.utc)

    # ── Stage runners (pass injected dependencies down) ─────────────

    async def _run_scan(self, mission_id, data, progress_cb):
        return await stage_scan(
            mission_id,
            self.scan_adapter,
            progress_cb,
            vision_provider=self.vision_provider,   # inject real model
        )

    async def _run_reconstruct(self, mission_id, data, progress_cb):
        return await stage_reconstruct(mission_id, data.get("scan", {}), progress_cb)

    async def _run_detect(self, mission_id, data, progress_cb):
        return await stage_detect(mission_id, self.detection_adapter, progress_cb)

    async def _run_fuse(self, mission_id, data, progress_cb):
        return await stage_fuse(
            mission_id,
            data.get("detect", {}),
            data.get("reconstruct", {}),
            progress_cb,
        )

    async def _run_revisit(self, mission_id, data, progress_cb):
        return await stage_revisit(mission_id, data.get("fuse", {}), progress_cb)

    async def _run_hazard(self, mission_id, data, progress_cb):
        return await stage_hazard(
            mission_id,
            data.get("reconstruct", {}),
            data.get("fuse", {}),
            progress_cb,
        )

    async def _run_route(self, mission_id, data, progress_cb):
        return await stage_route(
            mission_id,
            data.get("hazard", {}),
            data.get("revisit", {}),
            progress_cb,
        )

    async def _run_report(self, mission_id, data, progress_cb):
        return await stage_report(mission_id, data, progress_cb)

    # ── Serialization helpers ────────────────────────────────────────

    def _serialize_stage_result(self, stage: StageEnum, result: dict) -> dict:
        """Convert stage result to JSON-serializable payload for WebSocket."""
        if stage == StageEnum.SCAN:
            return {
                "frames_captured": result.get("frames_captured", 0),
                "inference_frames": result.get("inference_frames", 0),
                "total_detections": result.get("total_detections", 0),
                "avg_inference_ms": result.get("avg_inference_ms", 0),
                "model_name": result.get("model_name", "—"),
                "model_device": result.get("model_device", "—"),
                "model_status": result.get("model_status", "—"),
                "video_fps": result.get("video_fps", 0),
                "video_width": result.get("video_width", 0),
                "video_height": result.get("video_height", 0),
                "total_points": result.get("total_points", 0),
                "lidar_batches": result.get("lidar_batches", 0),
                # Send all detections in the complete event for canvas replay
                "rgb_detections": result.get("rgb_detections", []),
            }

        elif stage == StageEnum.RECONSTRUCT:
            return {
                "total_points": result.get("total_points", 0),
                "point_cloud_b64": result.get("point_cloud_b64"),
                "color_b64": result.get("color_b64"),
                "bounds": result.get("bounds"),
                "method": result.get("method"),
            }

        elif stage == StageEnum.DETECT:
            thermal = result.get("thermal_detections", [])
            radar = result.get("radar_detections", [])
            return {
                "thermal_candidates": len(thermal),
                "radar_candidates": len(radar),
                "thermal_detections": [
                    d.model_dump(mode="json") if hasattr(d, "model_dump") else d
                    for d in thermal
                ],
                "radar_detections": [
                    d.model_dump(mode="json") if hasattr(d, "model_dump") else d
                    for d in radar
                ],
            }

        elif stage == StageEnum.FUSE:
            results = result.get("fusion_results", [])
            return {
                "total_candidates": len(results),
                "fusion_results": [
                    r.model_dump(mode="json") if hasattr(r, "model_dump") else r
                    for r in results
                ],
            }

        elif stage == StageEnum.REVISIT:
            confirmed = result.get("confirmed", [])
            return {
                "confirmed_count": result.get("confirmed_count", 0),
                "rejected_count": result.get("rejected_count", 0),
                "confirmed": [
                    r.model_dump(mode="json") if hasattr(r, "model_dump") else r
                    for r in confirmed
                ],
            }

        elif stage == StageEnum.HAZARD:
            return {
                "hazard_grid_b64": result.get("hazard_grid_b64"),
                "grid_size": result.get("grid_size"),
                "summary": result.get("summary"),
            }

        elif stage == StageEnum.ROUTE:
            routes = result.get("routes", [])
            return {
                "total_routes": len(routes),
                "entry_point": result.get("entry_point"),
                "routes": [
                    r.model_dump(mode="json") if hasattr(r, "model_dump") else r
                    for r in routes
                ],
            }

        elif stage == StageEnum.REPORT:
            return result.get("report", {})

        return {}
