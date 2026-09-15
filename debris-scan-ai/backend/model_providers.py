"""
Debris-Scan AI — Model Providers
Protocol + concrete implementations for real AI inference.

Design rule: every provider MUST report is_available() truthfully.
If a model cannot load, it returns available=False and an empty detection list.
The backend NEVER silently presents heuristic output as model output.
"""
import time
import logging
import os
import pathlib
from typing import Protocol, runtime_checkable, Any
from dataclasses import dataclass, field

import numpy as np

logger = logging.getLogger("debris-scan.models")


# ── Detection schema ────────────────────────────────────────────────

@dataclass
class RgbDetection:
    """One bounding-box detection from the RGB vision model."""
    frame_id: int
    timestamp_s: float          # seconds into video
    class_name: str
    bbox_x1: float              # pixel coords in source-frame space
    bbox_y1: float
    bbox_x2: float
    bbox_y2: float
    confidence: float           # 0.0–1.0
    track_id: str | None        # only set when a real tracker is active
    model_name: str
    inference_time_ms: float

    def to_dict(self) -> dict:
        return {
            "frame_id": self.frame_id,
            "timestamp_s": self.timestamp_s,
            "class_name": self.class_name,
            "bbox": {
                "x1": self.bbox_x1,
                "y1": self.bbox_y1,
                "x2": self.bbox_x2,
                "y2": self.bbox_y2,
            },
            "confidence": self.confidence,
            "track_id": self.track_id,
            "model_name": self.model_name,
            "inference_time_ms": self.inference_time_ms,
        }


@dataclass
class ModelStatus:
    available: bool
    name: str
    version: str
    device: str          # "cpu" | "cuda" | "mps" | "offline"
    error: str | None = None


# ── Provider protocol ───────────────────────────────────────────────

@runtime_checkable
class VisionModelProvider(Protocol):
    """Interface for RGB detection models."""

    def load(self) -> bool: ...
    def is_available(self) -> bool: ...
    def status(self) -> ModelStatus: ...

    def detect(
        self,
        frame: np.ndarray,   # H×W×3 uint8 BGR
        frame_id: int,
        timestamp_s: float,
        conf_threshold: float = 0.25,
    ) -> list[RgbDetection]: ...


# ── YOLO implementation ─────────────────────────────────────────────

class YOLOVisionProvider:
    """
    Real YOLOv8n/YOLO11n inference via ultralytics.

    Loads the model once at startup. Inference runs synchronously
    (called inside asyncio via run_in_executor on the calling side).
    """

    MODEL_PREFERENCE = [
        "yolo11n.pt",   # YOLO11 nano — fastest, ~2.6M params
        "yolov8n.pt",   # YOLOv8 nano — fallback
    ]

    def __init__(self, model_name: str | None = None):
        self._model = None
        self._model_name = model_name  # override if specified
        self._loaded_name = "not_loaded"
        self._device = "cpu"
        self._version = "unknown"
        self._error: str | None = None

    def load(self) -> bool:
        """Attempt to import ultralytics and load the model. Returns True on success."""
        try:
            from ultralytics import YOLO
            import torch

            # Pick model
            names_to_try = (
                [self._model_name] if self._model_name else self.MODEL_PREFERENCE
            )

            model = None
            chosen = None
            for name in names_to_try:
                try:
                    logger.info(f"Attempting to load {name}...")
                    model = YOLO(name)
                    chosen = name
                    break
                except Exception as e:
                    logger.warning(f"Could not load {name}: {e}")

            if model is None:
                self._error = "No YOLO model could be loaded"
                logger.error(self._error)
                return False

            # Determine device
            self._device = "cuda" if torch.cuda.is_available() else "cpu"
            logger.info(f"YOLO model loaded: {chosen} on {self._device}")

            # Warm up with a dummy frame
            dummy = np.zeros((480, 640, 3), dtype=np.uint8)
            model.predict(dummy, verbose=False, device=self._device)
            logger.info("YOLO warm-up complete")

            self._model = model
            self._loaded_name = chosen
            self._version = getattr(model, "__version__", "unknown")
            self._error = None
            return True

        except ImportError as e:
            self._error = f"ultralytics not installed: {e}"
            logger.error(self._error)
            return False
        except Exception as e:
            self._error = str(e)
            logger.error(f"Model load failed: {e}")
            return False

    def is_available(self) -> bool:
        return self._model is not None

    def status(self) -> ModelStatus:
        return ModelStatus(
            available=self.is_available(),
            name=self._loaded_name,
            version=self._version,
            device=self._device,
            error=self._error,
        )

    def detect(
        self,
        frame: np.ndarray,
        frame_id: int,
        timestamp_s: float,
        conf_threshold: float = 0.25,
    ) -> list[RgbDetection]:
        """Run real YOLO inference. Returns empty list if model offline."""
        if not self.is_available():
            return []

        t0 = time.perf_counter()
        results = self._model.predict(
            frame,
            conf=conf_threshold,
            verbose=False,
            device=self._device,
        )
        elapsed_ms = (time.perf_counter() - t0) * 1000

        detections: list[RgbDetection] = []
        for r in results:
            boxes = r.boxes
            if boxes is None:
                continue
            names = r.names  # {int: str}
            for box in boxes:
                cls_id = int(box.cls[0])
                conf = float(box.conf[0])
                x1, y1, x2, y2 = box.xyxy[0].tolist()
                detections.append(
                    RgbDetection(
                        frame_id=frame_id,
                        timestamp_s=round(timestamp_s, 3),
                        class_name=names.get(cls_id, str(cls_id)),
                        bbox_x1=round(x1, 1),
                        bbox_y1=round(y1, 1),
                        bbox_x2=round(x2, 1),
                        bbox_y2=round(y2, 1),
                        confidence=round(conf, 4),
                        track_id=None,   # no tracker active in Phase 4
                        model_name=self._loaded_name,
                        inference_time_ms=round(elapsed_ms, 1),
                    )
                )
        return detections


# ── Offline fallback (never pretends to be real) ────────────────────

class OfflineVisionProvider:
    """
    Used when the real model cannot load.
    Always returns empty detections and status.available=False.
    The frontend will show: RGB MODEL OFFLINE
    """

    def __init__(self, reason: str = "Model not loaded"):
        self._reason = reason

    def load(self) -> bool:
        return False

    def is_available(self) -> bool:
        return False

    def status(self) -> ModelStatus:
        return ModelStatus(
            available=False,
            name="offline",
            version="—",
            device="offline",
            error=self._reason,
        )

    def detect(self, frame, frame_id, timestamp_s, conf_threshold=0.25):
        return []


# ── Factory ─────────────────────────────────────────────────────────

def create_vision_provider(model_name: str | None = None) -> YOLOVisionProvider | OfflineVisionProvider:
    """
    Attempt to load a real YOLO provider.
    Falls back to OfflineVisionProvider on any error (never silently fake).
    """
    provider = YOLOVisionProvider(model_name=model_name)
    success = provider.load()
    if success:
        return provider
    return OfflineVisionProvider(reason=provider._error or "Load failed")
