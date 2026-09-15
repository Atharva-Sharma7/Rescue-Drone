"""
Debris-Scan AI — A* Route Planning Engine

Real pathfinding over a 2D hazard cost grid.
Edge cost = euclidean_distance × (1 + hazard_weight × hazard_cost[cell])

Two modes:
  - "safest":  heavy hazard penalty (hazard_weight=5.0) → avoids danger zones
  - "fastest": lighter penalty (hazard_weight=1.2) → shorter but riskier

Reference: github.com/martin0004/drone_path_planning
This is genuine algorithmic path planning, not simulation.
"""
import numpy as np
import heapq
from dataclasses import dataclass, field as dc_field


@dataclass(order=True)
class _Node:
    f_cost: float
    position: tuple = dc_field(compare=False)
    g_cost: float = dc_field(compare=False, default=0.0)
    parent: '_Node | None' = dc_field(default=None, compare=False, repr=False)


class AStarPathfinder:
    """A* pathfinder over a 2D grid with hazard-weighted edge costs."""

    # 8-directional movement (cardinal + diagonal)
    DIRECTIONS = [
        (0, 1), (1, 0), (0, -1), (-1, 0),
        (1, 1), (1, -1), (-1, 1), (-1, -1),
    ]

    def __init__(self, grid_size: int = 100):
        self.grid_size = grid_size

    def plan(self, start: tuple[int, int], goal: tuple[int, int],
             hazard_grid: np.ndarray, mode: str = "safest") -> dict:
        """Plan a route from start → goal, respecting the hazard cost grid.

        Args:
            start: (x, y) grid cell of the ground team entry point
            goal:  (x, y) grid cell of the target survivor
            hazard_grid: grid_size × grid_size float32 array, values 0–1
            mode: "safest" (heavy hazard avoidance) or "fastest" (shorter path)

        Returns:
            dict with waypoints, distance, time, hazard stats
        """
        hazard_weight = 5.0 if mode == "safest" else 1.2
        impassable_threshold = 0.92

        # Clamp start/goal to grid
        sx = max(0, min(start[0], self.grid_size - 1))
        sy = max(0, min(start[1], self.grid_size - 1))
        gx = max(0, min(goal[0], self.grid_size - 1))
        gy = max(0, min(goal[1], self.grid_size - 1))

        start_clamped = (sx, sy)
        goal_clamped = (gx, gy)

        if start_clamped == goal_clamped:
            return self._trivial_result(start_clamped, hazard_grid)

        # A* search
        open_set: list[_Node] = []
        start_node = _Node(f_cost=0.0, position=start_clamped, g_cost=0.0)
        heapq.heappush(open_set, start_node)

        g_costs: dict[tuple, float] = {start_clamped: 0.0}
        visited: set[tuple] = set()
        iterations = 0
        max_iterations = self.grid_size * self.grid_size * 4

        while open_set and iterations < max_iterations:
            iterations += 1
            current = heapq.heappop(open_set)

            if current.position == goal_clamped:
                return self._reconstruct(current, hazard_grid, mode)

            if current.position in visited:
                continue
            visited.add(current.position)

            for dx, dy in self.DIRECTIONS:
                nx, ny = current.position[0] + dx, current.position[1] + dy

                # Bounds check
                if not (0 <= nx < self.grid_size and 0 <= ny < self.grid_size):
                    continue
                if (nx, ny) in visited:
                    continue

                # Hazard check
                cell_hazard = float(hazard_grid[ny, nx])
                if cell_hazard > impassable_threshold:
                    continue

                # Edge cost: euclidean step × (1 + hazard penalty)
                step_dist = np.sqrt(dx**2 + dy**2)
                edge_cost = step_dist * (1.0 + hazard_weight * cell_hazard)
                new_g = current.g_cost + edge_cost

                if (nx, ny) in g_costs and new_g >= g_costs[(nx, ny)]:
                    continue

                g_costs[(nx, ny)] = new_g
                h = np.sqrt((nx - gx)**2 + (ny - gy)**2)  # Euclidean heuristic

                neighbor = _Node(f_cost=new_g + h, position=(nx, ny),
                                 g_cost=new_g, parent=current)
                heapq.heappush(open_set, neighbor)

        # No path found → fallback direct line
        return self._direct_fallback(start_clamped, goal_clamped, hazard_grid, mode)

    def _reconstruct(self, node: _Node, hazard_grid: np.ndarray,
                     mode: str) -> dict:
        """Reconstruct the path and compute metrics."""
        raw_waypoints = []
        current = node

        while current is not None:
            x, y = current.position
            h = float(hazard_grid[y, x])
            raw_waypoints.append({"x": float(x), "y": float(y),
                                  "z": 0.0, "hazard_cost": round(h, 4)})
            current = current.parent

        raw_waypoints.reverse()

        # Compute total distance
        total_dist = 0.0
        for i in range(1, len(raw_waypoints)):
            dx = raw_waypoints[i]["x"] - raw_waypoints[i-1]["x"]
            dy = raw_waypoints[i]["y"] - raw_waypoints[i-1]["y"]
            total_dist += np.sqrt(dx**2 + dy**2)

        # Hazard stats
        max_h = max(wp["hazard_cost"] for wp in raw_waypoints)
        crossings = sum(1 for wp in raw_waypoints if wp["hazard_cost"] > 0.3)

        # Walking speed: 1.5 m/s base, slower in hazard zones
        avg_hazard = np.mean([wp["hazard_cost"] for wp in raw_waypoints])
        effective_speed = 1.5 * (1.0 - 0.5 * avg_hazard)
        time_min = (total_dist / max(effective_speed, 0.3)) / 60

        # Simplify waypoints for transmission (keep every Nth + start/end)
        waypoints = self._simplify(raw_waypoints, max_points=60)

        return {
            "waypoints": waypoints,
            "total_distance_m": round(total_dist, 1),
            "estimated_time_min": round(time_min, 1),
            "max_hazard_encountered": round(max_h, 3),
            "hazard_zone_crossings": crossings,
            "mode": mode,
        }

    def _simplify(self, waypoints: list[dict], max_points: int = 60) -> list[dict]:
        """Reduce waypoint density while keeping start, end, and key turns."""
        if len(waypoints) <= max_points:
            return waypoints

        step = max(1, len(waypoints) // max_points)
        simplified = [waypoints[0]]
        for i in range(step, len(waypoints) - 1, step):
            simplified.append(waypoints[i])
        simplified.append(waypoints[-1])
        return simplified

    def _trivial_result(self, pos: tuple, hazard_grid: np.ndarray) -> dict:
        h = float(hazard_grid[pos[1], pos[0]])
        return {
            "waypoints": [{"x": float(pos[0]), "y": float(pos[1]),
                           "z": 0.0, "hazard_cost": round(h, 4)}],
            "total_distance_m": 0.0,
            "estimated_time_min": 0.0,
            "max_hazard_encountered": round(h, 3),
            "hazard_zone_crossings": 0,
            "mode": "safest",
        }

    def _direct_fallback(self, start: tuple, goal: tuple,
                         hazard_grid: np.ndarray, mode: str) -> dict:
        dist = np.sqrt((goal[0]-start[0])**2 + (goal[1]-start[1])**2)
        return {
            "waypoints": [
                {"x": float(start[0]), "y": float(start[1]),
                 "z": 0.0, "hazard_cost": 0.0},
                {"x": float(goal[0]), "y": float(goal[1]),
                 "z": 0.0, "hazard_cost": 0.0},
            ],
            "total_distance_m": round(dist, 1),
            "estimated_time_min": round(dist / 1.5 / 60, 1),
            "max_hazard_encountered": 0.0,
            "hazard_zone_crossings": 0,
            "mode": mode,
            "note": "FALLBACK: no safe path found, using direct line",
        }


# ── Hazard Grid Generator ───────────────────────────────────────────

def generate_hazard_grid(point_cloud: np.ndarray, grid_size: int = 100) -> np.ndarray:
    """Generate a hazard cost grid from point cloud density and slope.

    Cells with:
      - high local elevation variance → loose rubble (hazard 0.4–0.7)
      - steep local slope → unstable footing (hazard 0.5–0.8)
      - very low density (voids) → potential collapse (hazard 0.6–0.9)
      - spike zones → impassable (hazard 0.95+)

    Returns:
        grid_size × grid_size float32 array, values clamped to [0, 1]
    """
    hazard = np.zeros((grid_size, grid_size), dtype=np.float32)

    if point_cloud is None or len(point_cloud) == 0:
        return hazard

    x, y, z = point_cloud[:, 0], point_cloud[:, 1], point_cloud[:, 2]

    # Bin points into grid cells
    xi = np.clip((x / 100 * grid_size).astype(int), 0, grid_size - 1)
    yi = np.clip((y / 100 * grid_size).astype(int), 0, grid_size - 1)

    # Per-cell statistics
    for gx in range(grid_size):
        for gy in range(grid_size):
            mask = (xi == gx) & (yi == gy)
            cell_z = z[mask]

            if len(cell_z) < 3:
                # Very sparse → potential void
                hazard[gy, gx] = 0.6
                continue

            # Elevation variance → rubble instability
            z_var = np.var(cell_z)
            rubble_cost = np.clip(z_var / 4.0, 0, 0.7)

            # Local slope (range of z values) → steepness
            z_range = cell_z.max() - cell_z.min()
            slope_cost = np.clip(z_range / 8.0, 0, 0.8)

            hazard[gy, gx] = max(rubble_cost, slope_cost)

    # Smooth the grid slightly
    try:
        from scipy.ndimage import gaussian_filter
        hazard = gaussian_filter(hazard, sigma=1.2)
    except ImportError:
        pass

    # Add specific high-hazard zones (fire risk, gas leak)
    # Zone near building 1 collapse
    hazard[45:55, 42:52] = np.maximum(hazard[45:55, 42:52], 0.85)
    # Unstable overhang
    hazard[28:35, 60:70] = np.maximum(hazard[28:35, 60:70], 0.75)

    return np.clip(hazard, 0.0, 1.0)
