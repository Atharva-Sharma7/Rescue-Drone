"""
Debris-Scan AI — Pydantic Data Models
All schemas shared between orchestrator, stages, and the WebSocket API.
"""
from pydantic import BaseModel, Field
from enum import Enum
from datetime import datetime, timezone
from typing import Optional, Any
import uuid


# ── Pipeline Enums ──────────────────────────────────────────────────

class StageEnum(str, Enum):
    INIT        = "init"
    SCAN        = "scan"
    RECONSTRUCT = "reconstruct"
    DETECT      = "detect"
    FUSE        = "fuse"
    REVISIT     = "revisit"
    HAZARD      = "hazard"
    ROUTE       = "route"
    REPORT      = "report"

STAGE_ORDER = [
    StageEnum.SCAN,
    StageEnum.RECONSTRUCT,
    StageEnum.DETECT,
    StageEnum.FUSE,
    StageEnum.REVISIT,
    StageEnum.HAZARD,
    StageEnum.ROUTE,
    StageEnum.REPORT,
]

class StatusEnum(str, Enum):
    PENDING  = "pending"
    STARTED  = "started"
    PROGRESS = "progress"
    COMPLETE = "complete"
    FAILED   = "failed"


# ── WebSocket Event ─────────────────────────────────────────────────

class StageEvent(BaseModel):
    mission_id: str
    stage: StageEnum
    status: StatusEnum
    progress: Optional[float] = None          # 0.0 – 1.0
    payload: Optional[dict[str, Any]] = None  # stage-specific data
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# ── Mission ─────────────────────────────────────────────────────────

class MissionCreate(BaseModel):
    site_name: str = "Sector Alpha — Collapsed Commercial Complex"
    boundary_coords: list[list[float]] = Field(
        default=[[28.6139, 77.2090], [28.6145, 77.2090],
                 [28.6145, 77.2096], [28.6139, 77.2096]],
        description="GPS polygon defining the search area"
    )

class Mission(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4())[:8])
    site_name: str
    boundary_coords: list[list[float]]
    current_stage: StageEnum = StageEnum.INIT
    stage_statuses: dict[str, str] = Field(default_factory=dict)
    artifacts: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    adapter_mode: str = "mock"   # "mock" or "live"


# ── Sensor Data Containers ──────────────────────────────────────────

class Detection(BaseModel):
    """A single candidate detection from one sensor modality."""
    id: str
    source: str                 # "thermal" | "radar" | "visual"
    x: float                    # grid coordinate (0–100)
    y: float
    z: float = 0.0              # depth below surface (meters)
    confidence: float           # 0.0 – 1.0
    label: str = "person"
    metadata: dict[str, Any] = Field(default_factory=dict)


class FusionResult(BaseModel):
    """A fused multi-sensor candidate with explainable per-sensor breakdown."""
    id: str
    x: float
    y: float
    z: float
    total_score: float          # weighted sum, 0.0 – 1.0
    thermal_contribution: float # individual term BEFORE weighting
    radar_contribution: float
    structural_contribution: float
    hazard_penalty: float
    label: str = "survivor_candidate"
    confirmed: bool = False     # set True after Stage 5 revisit


class HazardCell(BaseModel):
    x: int
    y: int
    cost: float                 # 0.0 (safe) – 1.0 (impassable)
    classification: str = "stable"  # "stable" | "loose_rubble" | "steep" | "void" | "fire_risk"


class Waypoint(BaseModel):
    x: float
    y: float
    z: float = 0.0
    hazard_cost: float = 0.0


class RouteResult(BaseModel):
    target_id: str
    mode: str                   # "safest" | "fastest"
    waypoints: list[Waypoint]
    total_distance_m: float
    estimated_time_min: float
    max_hazard_encountered: float
    hazard_zone_crossings: int


class MissionReport(BaseModel):
    mission_id: str
    site_name: str
    adapter_mode: str
    total_area_scanned_m2: float
    scan_duration_s: float
    total_points_captured: int
    candidates_detected: int
    confirmed_survivors: int
    fusion_results: list[FusionResult]
    routes: list[RouteResult]
    hazard_summary: dict[str, int] = Field(default_factory=dict)
    generated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
