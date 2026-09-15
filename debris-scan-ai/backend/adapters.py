"""
Debris-Scan AI — Sensor Adapters
Protocol interfaces + Mock implementations for demo missions.

The adapter pattern is the architectural core: the orchestrator calls adapters
through the protocol interface. MockScanAdapter streams synthetic data now;
LiveScanAdapter will stream real drone telemetry later. One-line swap.
"""
import numpy as np
import asyncio
from typing import AsyncIterator, Protocol, runtime_checkable
from dataclasses import dataclass, field


# ── Raw Data Containers ─────────────────────────────────────────────

@dataclass
class Frame:
    """A single RGB or thermal image frame."""
    index: int
    data: np.ndarray          # H×W×3 uint8
    timestamp: float          # seconds since scan start
    width: int = 0
    height: int = 0

    def __post_init__(self):
        if self.data is not None:
            self.height, self.width = self.data.shape[:2]

@dataclass
class PointBatch:
    """A batch of 3D LiDAR-style points."""
    points: np.ndarray        # N×3 float32 (x, y, z)
    colors: np.ndarray = field(default=None)  # N×3 uint8 or None
    batch_index: int = 0

@dataclass
class RadarSample:
    """A single UWB radar frame: magnitude across range bins."""
    range_bins: np.ndarray    # 1D float32, length = num_range_bins
    timestamp: float          # seconds since scan start
    sample_index: int = 0


# ── Protocol Interfaces ─────────────────────────────────────────────

@runtime_checkable
class ScanAdapter(Protocol):
    """Interface for aerial RGB + LiDAR capture."""
    async def get_rgb_frames(self, mission_id: str) -> AsyncIterator[Frame]: ...
    async def get_lidar_points(self, mission_id: str) -> AsyncIterator[PointBatch]: ...
    def get_total_frames(self) -> int: ...

@runtime_checkable
class DetectionAdapter(Protocol):
    """Interface for thermal + UWB radar sensor streams."""
    async def get_thermal_frames(self, mission_id: str) -> AsyncIterator[Frame]: ...
    async def get_radar_returns(self, mission_id: str) -> AsyncIterator[RadarSample]: ...
    def get_survivor_ground_truth(self) -> list[dict]: ...


# ── Mock Scan Adapter ────────────────────────────────────────────────

class MockScanAdapter:
    """Streams synthetic RGB frames and LiDAR point cloud batches.

    Generates procedural aerial debris-field imagery and terrain geometry.
    Real-time pacing via asyncio.sleep simulates actual capture cadence.
    """

    def __init__(self, num_frames: int = 60, fps: float = 5.0,
                 num_lidar_batches: int = 20, points_per_batch: int = 5000):
        self.num_frames = num_frames
        self.fps = fps
        self.frame_delay = 1.0 / fps
        self.num_lidar_batches = num_lidar_batches
        self.points_per_batch = points_per_batch

    def get_total_frames(self) -> int:
        return self.num_frames

    async def get_rgb_frames(self, mission_id: str) -> AsyncIterator[Frame]:
        """Generate synthetic aerial-view debris field frames."""
        for i in range(self.num_frames):
            h, w = 480, 640
            frame_data = np.zeros((h, w, 3), dtype=np.uint8)

            # Seed per-frame for reproducibility
            rng = np.random.RandomState(i * 42 + 7)

            # Base rubble terrain texture (brown-gray)
            noise = rng.randint(55, 125, (h, w), dtype=np.uint8)
            frame_data[:, :, 0] = noise
            frame_data[:, :, 1] = (noise * 0.82).astype(np.uint8)
            frame_data[:, :, 2] = (noise * 0.65).astype(np.uint8)

            # Collapsed slab shadows (dark rectangles at angles)
            for _ in range(3):
                cx, cy = rng.randint(100, w - 100), rng.randint(100, h - 100)
                sw, sh = rng.randint(60, 200), rng.randint(30, 80)
                frame_data[max(0, cy-sh):cy+sh, max(0, cx-sw):cx+sw] = (
                    frame_data[max(0, cy-sh):cy+sh, max(0, cx-sw):cx+sw] * 0.4
                ).astype(np.uint8)

            # Rubble scatter (bright spots)
            n_scatter = 200
            sx = rng.randint(0, w, n_scatter)
            sy = rng.randint(0, h, n_scatter)
            for j in range(n_scatter):
                r = rng.randint(2, 6)
                cv = rng.randint(130, 200)
                y1, y2 = max(0, sy[j]-r), min(h, sy[j]+r)
                x1, x2 = max(0, sx[j]-r), min(w, sx[j]+r)
                frame_data[y1:y2, x1:x2, 0] = cv
                frame_data[y1:y2, x1:x2, 1] = int(cv * 0.9)
                frame_data[y1:y2, x1:x2, 2] = int(cv * 0.75)

            # Simulate drone movement: subtle shift each frame
            shift_x = int(2 * np.sin(i * 0.15))
            shift_y = int(1.5 * np.cos(i * 0.12))
            frame_data = np.roll(frame_data, shift_x, axis=1)
            frame_data = np.roll(frame_data, shift_y, axis=0)

            yield Frame(index=i, data=frame_data, timestamp=i * self.frame_delay)
            await asyncio.sleep(self.frame_delay * 0.15)  # 6× faster than real-time for demo

    async def get_lidar_points(self, mission_id: str) -> AsyncIterator[PointBatch]:
        """Generate synthetic LiDAR point cloud with terrain + collapsed structures."""
        for batch_idx in range(self.num_lidar_batches):
            rng = np.random.RandomState(batch_idx * 137 + 11)
            n = self.points_per_batch

            # Scatter points across 100×100m grid
            x = rng.uniform(0, 100, n).astype(np.float32)
            y = rng.uniform(0, 100, n).astype(np.float32)

            # Base terrain: gentle undulation
            z = (2.0 * np.sin(x * 0.08) * np.cos(y * 0.06)).astype(np.float32)

            # Collapsed building 1: rubble heap near center
            d1 = np.sqrt((x - 48)**2 + (y - 52)**2)
            z += (9.0 * np.exp(-d1**2 / 350)).astype(np.float32)

            # Collapsed building 2: smaller heap
            d2 = np.sqrt((x - 22)**2 + (y - 68)**2)
            z += (6.0 * np.exp(-d2**2 / 180)).astype(np.float32)

            # Debris scatter: isolated chunks
            d3 = np.sqrt((x - 70)**2 + (y - 30)**2)
            z += (4.0 * np.exp(-d3**2 / 120)).astype(np.float32)

            # Surface noise (rubble texture)
            z += rng.uniform(-0.4, 0.4, n).astype(np.float32)

            points = np.stack([x, y, z], axis=1)

            # Elevation-based coloring (gray-brown rubble)
            z_norm = np.clip((z - z.min()) / (z.max() - z.min() + 1e-6), 0, 1)
            colors = np.zeros((n, 3), dtype=np.uint8)
            colors[:, 0] = (95 + 110 * z_norm).astype(np.uint8)
            colors[:, 1] = (80 + 85 * z_norm).astype(np.uint8)
            colors[:, 2] = (55 + 70 * z_norm).astype(np.uint8)

            yield PointBatch(points=points, colors=colors, batch_index=batch_idx)
            await asyncio.sleep(0.3)


# ── Mock Detection Adapter ──────────────────────────────────────────

class MockDetectionAdapter:
    """Generates synthetic thermal frames and UWB radar range-bin data.

    IMPORTANT: The UWB radar data contains REAL injected breathing waveforms.
    The downstream stage must perform REAL signal processing (clutter removal +
    FFT) to detect them — this is genuine DSP on synthetic input, not pre-baked
    detections. Document as such in the UI.
    """

    # Ground-truth hidden survivors (the pipeline must DISCOVER these)
    SURVIVOR_PROFILES = [
        {"id": "SRV-01", "x": 45, "y": 50, "depth": 2.3,
         "breathing_freq": 0.23, "amplitude": 0.7, "label": "Pinned under slab cavity"},
        {"id": "SRV-02", "x": 24, "y": 65, "depth": 1.1,
         "breathing_freq": 0.28, "amplitude": 0.85, "label": "Debris edge, partially visible"},
        {"id": "SRV-03", "x": 72, "y": 32, "depth": 3.4,
         "breathing_freq": 0.19, "amplitude": 0.5, "label": "Deep void, weak signal"},
    ]

    def __init__(self, num_thermal_frames: int = 30, radar_duration_s: float = 30.0,
                 radar_sample_rate: float = 20.0, num_range_bins: int = 128):
        self.num_thermal_frames = num_thermal_frames
        self.radar_duration_s = radar_duration_s
        self.radar_sample_rate = radar_sample_rate
        self.num_range_bins = num_range_bins

    def get_survivor_ground_truth(self) -> list[dict]:
        return list(self.SURVIVOR_PROFILES)

    async def get_thermal_frames(self, mission_id: str) -> AsyncIterator[Frame]:
        """Generate LWIR-style thermal frames with heat signatures at survivor locations."""
        for i in range(self.num_thermal_frames):
            h, w = 480, 640
            rng = np.random.RandomState(i * 53 + 7)

            # Ambient thermal background (18–25°C range)
            bg_temp = rng.uniform(18, 25, (h, w)).astype(np.float64)

            # Environmental heat sources (hot pipes, sun-heated concrete)
            for _ in range(2):
                ex, ey = rng.randint(50, w - 50), rng.randint(50, h - 50)
                ed = np.sqrt((np.arange(w)[None, :] - ex)**2 +
                             (np.arange(h)[:, None] - ey)**2)
                bg_temp += 8 * np.exp(-ed**2 / 3000)

            # Survivor body heat (~37°C, attenuated by burial depth)
            for surv in self.SURVIVOR_PROFILES:
                cx = int(surv["x"] / 100 * w)
                cy = int(surv["y"] / 100 * h)
                dist = np.sqrt((np.arange(w)[None, :] - cx)**2 +
                               (np.arange(h)[:, None] - cy)**2)
                attenuation = np.exp(-surv["depth"] * 0.35)
                # Breathing modulation (subtle thermal oscillation)
                breath_mod = 1.0 + 0.03 * np.sin(2 * np.pi * surv["breathing_freq"] * i * 0.5)
                hotspot = 37 * attenuation * breath_mod * np.exp(-dist**2 / (700 + 300 * attenuation))
                bg_temp += hotspot

            # False-color mapping: cool=blue → warm=yellow → hot=red
            t_norm = np.clip((bg_temp - 14) / 32, 0, 1)
            frame_data = np.zeros((h, w, 3), dtype=np.uint8)
            frame_data[:, :, 0] = (t_norm * 255).astype(np.uint8)
            frame_data[:, :, 1] = (t_norm * (1 - t_norm) * 4 * 220).astype(np.uint8)
            frame_data[:, :, 2] = ((1 - t_norm) * 200).astype(np.uint8)

            yield Frame(index=i, data=frame_data, timestamp=i * 0.5)
            await asyncio.sleep(0.15)

    async def get_radar_returns(self, mission_id: str) -> AsyncIterator[RadarSample]:
        """Generate synthetic UWB radar range-bin data with injected breathing signatures.

        THIS IS REAL SIGNAL PROCESSING INPUT:
        - Static clutter (walls/rubble) is constant across samples
        - White noise floor is random per sample
        - Breathing waveforms are injected as periodic chest-displacement
          modulation at specific range bins corresponding to survivor depth
        - The downstream stage must subtract clutter, compute residual variance,
          and FFT to detect the breathing band — exactly what a real UWB
          processor would do.
        """
        num_samples = int(self.radar_sample_rate * self.radar_duration_s)

        # Static clutter profile (same every sample — represents walls, rubble)
        static_rng = np.random.RandomState(42)
        static_clutter = static_rng.uniform(0.1, 0.85,
                                            self.num_range_bins).astype(np.float32)

        for t_idx in range(num_samples):
            t = t_idx / self.radar_sample_rate

            # Start with static clutter + per-sample noise
            sample_rng = np.random.RandomState(t_idx * 31 + 997)
            noise = sample_rng.normal(0, 0.04, self.num_range_bins).astype(np.float32)
            range_bins = static_clutter.copy() + noise

            # Inject breathing waveforms at survivor depths
            for surv in self.SURVIVOR_PROFILES:
                # Map depth → range bin index
                bin_idx = int(surv["depth"] / 10.0 * self.num_range_bins)
                bin_idx = min(bin_idx, self.num_range_bins - 1)

                # Breathing displacement: ~0.2–0.3 Hz sinusoid
                breathing = surv["amplitude"] * np.sin(
                    2 * np.pi * surv["breathing_freq"] * t)
                # Cardiac micro-motion: ~1.0–1.3 Hz, much weaker
                cardiac = 0.12 * np.sin(2 * np.pi * 1.15 * t)

                # Spread across adjacent bins (realistic beam width)
                for offset in range(-2, 3):
                    idx = bin_idx + offset
                    if 0 <= idx < self.num_range_bins:
                        spread_weight = np.exp(-offset**2 / 1.8)
                        range_bins[idx] += (breathing + cardiac) * spread_weight

            yield RadarSample(range_bins=range_bins, timestamp=t,
                              sample_index=t_idx)
            await asyncio.sleep(1.0 / self.radar_sample_rate * 0.05)


# ── Live Adapter Stubs (TODO) ────────────────────────────────────────

class LiveScanAdapter:
    """TODO: Connect to real drone hardware.

    Swap in by changing one line in orchestrator config:
        scan_adapter = LiveScanAdapter(drone_ip="192.168.1.10")

    Would pull from:
    - RGB: DJI OSDK camera RTSP stream or MAVLink video
    - LiDAR: Livox/Velodyne pointcloud2 via ROS2 topic subscription
    """
    async def get_rgb_frames(self, mission_id: str):
        raise NotImplementedError("Connect real drone RGB camera — see DJI OSDK or MAVLink")

    async def get_lidar_points(self, mission_id: str):
        raise NotImplementedError("Connect real LiDAR — see Livox SDK or ROS2 pointcloud2")

    def get_total_frames(self) -> int:
        raise NotImplementedError("Query real camera frame count")


class LiveDetectionAdapter:
    """TODO: Connect to real thermal camera + UWB radar.

    Would pull from:
    - Thermal: FLIR Lepton/Boson LWIR camera stream
    - UWB: Camero Xaver / Novelda X4 raw range-bin data
    """
    async def get_thermal_frames(self, mission_id: str):
        raise NotImplementedError("Connect FLIR thermal camera")

    async def get_radar_returns(self, mission_id: str):
        raise NotImplementedError("Connect UWB radar — see Novelda X4 / Camero Xaver SDK")

    def get_survivor_ground_truth(self) -> list[dict]:
        return []  # No ground truth for live operations
