"""
Debris-Scan AI — Multi-Modal Fusion Engine

Explainable confidence scoring, NOT a black-box model.

confidence(cell) = w_thermal × thermal_score
                 + w_radar   × radar_score
                 + w_geom    × structural_plausibility
                 - w_hazard  × instability_penalty

Each term is normalized [0,1]. The per-term breakdown is stored alongside
the total so the frontend can show "why did this point score high?"

This is genuinely how multi-sensor SAR fusion is approached in practice.
"""
import numpy as np
from models import Detection, FusionResult


class MultiModalFusion:
    """Weighted multi-sensor confidence fusion with full explainability."""

    def __init__(self,
                 w_thermal: float = 0.35,
                 w_radar: float = 0.30,
                 w_geom: float = 0.25,
                 w_hazard: float = 0.10,
                 spatial_merge_radius: float = 8.0):
        self.w_thermal = w_thermal
        self.w_radar = w_radar
        self.w_geom = w_geom
        self.w_hazard = w_hazard
        self.spatial_merge_radius = spatial_merge_radius

    def fuse(self,
             thermal_detections: list[Detection],
             radar_detections: list[Detection],
             point_cloud: np.ndarray | None = None,
             hazard_grid: np.ndarray | None = None,
             grid_size: int = 100) -> list[FusionResult]:
        """Fuse detections from thermal and radar into confidence-scored candidates.

        1. Spatially cluster nearby detections from different sensors
        2. Score each cluster with the weighted formula
        3. Return sorted results with per-term breakdown
        """
        # Collect all detections into a unified list
        all_detections = []
        for d in thermal_detections:
            all_detections.append({"det": d, "source": "thermal"})
        for d in radar_detections:
            all_detections.append({"det": d, "source": "radar"})

        if not all_detections:
            return []

        # Spatial clustering: merge detections within merge_radius
        clusters = self._cluster_detections(all_detections)

        # Score each cluster
        results = []
        for i, cluster in enumerate(clusters):
            result = self._score_cluster(
                cluster_id=f"FUS-{i+1:02d}",
                cluster=cluster,
                point_cloud=point_cloud,
                hazard_grid=hazard_grid,
                grid_size=grid_size,
            )
            results.append(result)

        # Sort by total score descending
        results.sort(key=lambda r: r.total_score, reverse=True)
        return results

    def _cluster_detections(self, all_dets: list[dict]) -> list[list[dict]]:
        """Group spatially nearby detections into clusters."""
        used = [False] * len(all_dets)
        clusters = []

        for i, item_i in enumerate(all_dets):
            if used[i]:
                continue
            cluster = [item_i]
            used[i] = True

            for j, item_j in enumerate(all_dets):
                if used[j]:
                    continue
                dist = np.sqrt(
                    (item_i["det"].x - item_j["det"].x) ** 2 +
                    (item_i["det"].y - item_j["det"].y) ** 2
                )
                if dist < self.spatial_merge_radius:
                    cluster.append(item_j)
                    used[j] = True

            clusters.append(cluster)

        return clusters

    def _score_cluster(self, cluster_id: str, cluster: list[dict],
                       point_cloud: np.ndarray | None,
                       hazard_grid: np.ndarray | None,
                       grid_size: int) -> FusionResult:
        """Compute the explainable fusion score for a detection cluster."""
        # Centroid
        xs = [item["det"].x for item in cluster]
        ys = [item["det"].y for item in cluster]
        zs = [item["det"].z for item in cluster]
        cx, cy, cz = np.mean(xs), np.mean(ys), np.mean(zs)

        # ── Thermal contribution ──
        thermal_items = [item for item in cluster if item["source"] == "thermal"]
        if thermal_items:
            thermal_score = np.mean([item["det"].confidence for item in thermal_items])
        else:
            thermal_score = 0.0

        # ── Radar contribution ──
        radar_items = [item for item in cluster if item["source"] == "radar"]
        if radar_items:
            radar_score = np.mean([item["det"].confidence for item in radar_items])
        else:
            radar_score = 0.0

        # ── Structural plausibility ──
        # High score if the point is near a void/cavity in the point cloud
        structural_score = self._compute_structural_plausibility(
            cx, cy, point_cloud, grid_size)

        # ── Hazard penalty ──
        hazard_penalty = 0.0
        if hazard_grid is not None:
            gx = int(np.clip(cx / 100 * grid_size, 0, grid_size - 1))
            gy = int(np.clip(cy / 100 * grid_size, 0, grid_size - 1))
            hazard_penalty = float(hazard_grid[gy, gx])

        # ── Weighted fusion ──
        total = (
            self.w_thermal * thermal_score
            + self.w_radar * radar_score
            + self.w_geom * structural_score
            - self.w_hazard * hazard_penalty
        )
        total = float(np.clip(total, 0.0, 1.0))

        # Multi-sensor bonus: if BOTH thermal and radar agree, boost confidence
        if thermal_items and radar_items:
            multi_sensor_bonus = 0.08
            total = min(1.0, total + multi_sensor_bonus)

        return FusionResult(
            id=cluster_id,
            x=round(float(cx), 2),
            y=round(float(cy), 2),
            z=round(float(cz), 2),
            total_score=round(total, 4),
            thermal_contribution=round(float(thermal_score), 4),
            radar_contribution=round(float(radar_score), 4),
            structural_contribution=round(float(structural_score), 4),
            hazard_penalty=round(float(hazard_penalty), 4),
        )

    def _compute_structural_plausibility(self, x: float, y: float,
                                         point_cloud: np.ndarray | None,
                                         grid_size: int) -> float:
        """Estimate void/cavity likelihood from local point cloud density.

        Low density = potential void underneath rubble = more plausible
        that a survivor could be sheltering there.
        """
        if point_cloud is None or len(point_cloud) == 0:
            return 0.5  # Neutral when no data

        # Points near (x, y)
        radius = 5.0
        px, py = point_cloud[:, 0], point_cloud[:, 1]
        dist = np.sqrt((px - x)**2 + (py - y)**2)
        nearby = point_cloud[dist < radius]

        if len(nearby) < 5:
            # Very sparse → likely a void → high plausibility
            return 0.85

        # Check elevation variance (high variance = rubble pile with gaps)
        z_var = np.var(nearby[:, 2])
        z_range = nearby[:, 2].max() - nearby[:, 2].min()

        # High variance + high range → complex structure with voids
        void_score = np.clip(z_var / 3.0, 0, 0.5) + np.clip(z_range / 10.0, 0, 0.5)
        return float(np.clip(void_score, 0.0, 1.0))
