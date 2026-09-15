"""
Debris-Scan AI — FastAPI Server

REST + WebSocket API for the mission control frontend.

Endpoints:
  POST /missions              → create a new mission
  POST /missions/{id}/start   → begin the 8-stage pipeline (returns 202)
  GET  /missions/{id}         → current state snapshot (for reconnect/refresh)
  WS   /missions/{id}/events  → real-time stage event stream
  GET  /health                → service + model status

The server runs locally or on Colab with ngrok exposing a public URL.
The frontend connects to that URL for all communication.
"""
import asyncio
import json
import logging
from contextlib import asynccontextmanager
from datetime import datetime, timezone

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from models import MissionCreate, StageEvent
from adapters import MockScanAdapter, MockDetectionAdapter
from model_providers import create_vision_provider
from orchestrator import MissionOrchestrator

# ── Logging ──────────────────────────────────────────────────────────

logging.basicConfig(level=logging.INFO,
                    format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("debris-scan")


# ── WebSocket Connection Manager ─────────────────────────────────────

class ConnectionManager:
    """Manages WebSocket connections per mission."""

    def __init__(self):
        self.connections: dict[str, list[WebSocket]] = {}

    async def connect(self, mission_id: str, ws: WebSocket):
        await ws.accept()
        if mission_id not in self.connections:
            self.connections[mission_id] = []
        self.connections[mission_id].append(ws)
        logger.info(f"WS connected: mission={mission_id}, "
                     f"total={len(self.connections[mission_id])}")

    def disconnect(self, mission_id: str, ws: WebSocket):
        if mission_id in self.connections:
            self.connections[mission_id] = [
                c for c in self.connections[mission_id] if c != ws
            ]

    async def broadcast(self, mission_id: str, event: StageEvent):
        """Send a StageEvent to all WebSocket clients for this mission."""
        if mission_id not in self.connections:
            return

        msg = event.model_dump(mode="json")
        if isinstance(msg.get("timestamp"), datetime):
            msg["timestamp"] = msg["timestamp"].isoformat()
        elif msg.get("timestamp"):
            msg["timestamp"] = str(msg["timestamp"])

        dead = []
        for ws in self.connections[mission_id]:
            try:
                await ws.send_json(msg)
            except Exception:
                dead.append(ws)

        for ws in dead:
            self.connections[mission_id] = [
                c for c in self.connections[mission_id] if c != ws
            ]


# ── Application Setup ────────────────────────────────────────────────

ws_manager = ConnectionManager()

# Build injected dependencies at startup
_scan_adapter = MockScanAdapter(num_frames=60, fps=5.0)
_detect_adapter = MockDetectionAdapter(num_thermal_frames=30, radar_duration_s=30.0)

# Load the real vision model at startup — reports status in /health
logger.info("Loading vision model at startup...")
_vision_provider = create_vision_provider()
_vision_status = _vision_provider.status()
logger.info(
    f"Vision model: available={_vision_status.available} "
    f"name={_vision_status.name} device={_vision_status.device} "
    f"error={_vision_status.error}"
)

orchestrator = MissionOrchestrator(
    scan_adapter=_scan_adapter,
    detection_adapter=_detect_adapter,
    vision_provider=_vision_provider,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Debris-Scan AI backend starting")
    yield
    logger.info("Debris-Scan AI backend shutting down")


app = FastAPI(
    title="Debris-Scan AI",
    description="Search & Rescue Mission Control Backend",
    version="2.0.0",
    lifespan=lifespan,
)

# CORS: allow all origins (Colab + ngrok + localhost)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── REST Endpoints ───────────────────────────────────────────────────

@app.get("/")
async def root():
    return {
        "service": "Debris-Scan AI",
        "version": "2.0.0",
        "status": "operational",
        "adapter_mode": "mock",
        "vision_model": _vision_status.name,
        "vision_available": _vision_status.available,
        "missions_active": len(orchestrator.missions),
        "docs": "/docs",
    }


@app.get("/health")
async def health():
    """
    Full health report including model availability.

    Returns:
      status: "healthy"
      models.vision.available: true/false — never lies
      models.vision.name: actual model loaded
      models.vision.device: "cpu" | "cuda" | "offline"
      models.vision.error: error message if unavailable
    """
    vs = _vision_provider.status()
    return {
        "status": "healthy",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "adapter_mode": "mock",
        "gpu": False,   # will be True when CUDA available
        "models": {
            "vision": {
                "available": vs.available,
                "name": vs.name,
                "version": vs.version,
                "device": vs.device,
                "error": vs.error,
                "inference_rate": f"every {5} frames",
            }
        },
    }


@app.post("/missions", status_code=201)
async def create_mission(req: MissionCreate):
    """Create a new mission. Returns the mission object with its ID."""
    mission = orchestrator.create_mission(
        site_name=req.site_name,
        boundary_coords=req.boundary_coords,
    )
    logger.info(f"Mission created: {mission.id} — {mission.site_name}")
    return mission.model_dump(mode="json")


@app.post("/missions/{mission_id}/start", status_code=202)
async def start_mission(mission_id: str):
    """Begin the 8-stage pipeline. Returns 202 Accepted immediately.

    Progress is streamed via the WebSocket at /missions/{id}/events.
    """
    mission = orchestrator.get_mission(mission_id)
    if not mission:
        raise HTTPException(status_code=404, detail="Mission not found")

    if mission.started_at is not None and mission.completed_at is None:
        return {"mission_id": mission_id, "status": "pipeline_already_running"}

    if mission.completed_at is not None:
        from models import STAGE_ORDER, StatusEnum
        mission.started_at = None
        mission.completed_at = None
        for s in STAGE_ORDER:
            mission.stage_statuses[s.value] = StatusEnum.PENDING.value

    async def broadcast_fn(event: StageEvent):
        logger.info(f"[{event.stage.value}] {event.status.value}"
                     f" progress={event.progress}")
        await ws_manager.broadcast(mission_id, event)

    asyncio.create_task(orchestrator.run_mission(mission_id, broadcast_fn))

    return {"mission_id": mission_id, "status": "pipeline_started"}


@app.get("/missions/{mission_id}")
async def get_mission(mission_id: str):
    """Get current mission state snapshot. Used for reconnection after refresh."""
    snapshot = orchestrator.get_mission_snapshot(mission_id)
    if not snapshot:
        raise HTTPException(status_code=404, detail="Mission not found")
    return snapshot


@app.get("/missions")
async def list_missions():
    """List all missions."""
    return {
        "missions": [
            {
                "id": m.id,
                "site_name": m.site_name,
                "current_stage": m.current_stage.value,
                "adapter_mode": m.adapter_mode,
                "created_at": m.created_at.isoformat(),
                "started_at": m.started_at.isoformat() if m.started_at else None,
                "completed_at": m.completed_at.isoformat() if m.completed_at else None,
            }
            for m in orchestrator.missions.values()
        ]
    }


# ── WebSocket Endpoint ───────────────────────────────────────────────

@app.websocket("/missions/{mission_id}/events")
async def mission_events(websocket: WebSocket, mission_id: str):
    """WebSocket endpoint for real-time stage events.

    On connect, sends the current snapshot immediately (for browser refresh recovery).
    Keeps alive with 30s ping/pong cycle.
    """
    mission = orchestrator.get_mission(mission_id)
    if not mission:
        await websocket.close(code=4004, reason="Mission not found")
        return

    await ws_manager.connect(mission_id, websocket)

    try:
        # Send current state snapshot on connect
        snapshot = orchestrator.get_mission_snapshot(mission_id)
        if snapshot:
            await websocket.send_json({
                "type": "snapshot",
                "data": snapshot,
            })

        while True:
            try:
                data = await asyncio.wait_for(
                    websocket.receive_text(), timeout=30.0)
                msg = json.loads(data) if data else {}
                if msg.get("type") == "ping":
                    await websocket.send_json({"type": "pong"})
            except asyncio.TimeoutError:
                try:
                    await websocket.send_json({"type": "ping"})
                except Exception:
                    break

    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.error(f"WS error: {e}")
    finally:
        ws_manager.disconnect(mission_id, websocket)


# ── Entry point ───────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
