export type StageId =
  | 'init'
  | 'scan'
  | 'reconstruct'
  | 'detect'
  | 'fuse'
  | 'revisit'
  | 'hazard'
  | 'route'
  | 'report';

export type StageStatus = 'pending' | 'started' | 'progress' | 'complete' | 'failed';

export interface StageEvent {
  mission_id: string;
  stage: StageId;
  status: StageStatus;
  progress?: number;
  payload?: Record<string, any>;
  timestamp: string;
}

export interface Mission {
  id: string;
  site_name: string;
  boundary_coords: number[][];
  current_stage: StageId;
  stage_statuses: Record<string, StageStatus>;
  artifacts: Record<string, any>;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  adapter_mode: 'mock' | 'live';
}

export interface Detection {
  id: string;
  source: 'thermal' | 'radar' | 'visual';
  x: number;
  y: number;
  z: number;
  confidence: number;
  label: string;
  metadata: Record<string, any>;
}

export interface BBox {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/** Detection from the real RGB vision model (YOLO11n). Coordinates are in source-video pixels. */
export interface RgbDetection {
  frame_id: number;
  timestamp_s: number;        // seconds into video — matches video.currentTime
  class_name: string;         // COCO class name e.g. "person"
  bbox: BBox;                 // source-frame pixel coords
  confidence: number;
  track_id: string | null;    // null until a real tracker is active
  model_name: string;         // "yolo11n.pt"
  inference_time_ms: number;
}

export interface FusionResult {
  id: string;
  x: number;
  y: number;
  z: number;
  total_score: number;
  thermal_contribution: number;
  radar_contribution: number;
  structural_contribution: number;
  rgb_score?: number;
  rf_score?: number;
  hazard_penalty: number;
  label: string;
  confirmed: boolean;
}

export interface Waypoint {
  x: number;
  y: number;
  z: number;
  hazard_cost: number;
}

export interface RouteResult {
  target_id: string;
  mode: 'safest' | 'fastest';
  waypoints: Waypoint[];
  total_distance_m: number;
  estimated_time_min: number;
  max_hazard_encountered: number;
  hazard_zone_crossings: number;
}

/** Model status from /health endpoint */
export interface ModelStatus {
  available: boolean;
  name: string;
  version: string;
  device: string;       // "cpu" | "cuda" | "offline"
  error: string | null;
  inference_rate?: string;
}

export interface HealthResponse {
  status: string;
  gpu: boolean;
  adapter_mode: string;
  timestamp: string;
  models: {
    vision: ModelStatus;
    [key: string]: ModelStatus;
  };
}

/** Stage 1 scan payload (sent in progress + complete events) */
export interface ScanPayload {
  frames_captured: number;
  inference_frames: number;
  total_detections: number;
  avg_inference_ms: number;
  model_name: string;
  model_device: string;
  model_status: string;       // "REAL INFERENCE" | "RGB MODEL OFFLINE"
  video_fps: number;
  video_width: number;
  video_height: number;
  total_points: number;
  lidar_batches: number;
  rgb_detections?: RgbDetection[];  // present in complete event only
  // individual detection event fields:
  event_type?: 'rgb_detection';
  detection?: RgbDetection;
  timestamp_s?: number;
  frame_id?: number;
}

export const STAGE_ORDER: StageId[] = [
  'init',
  'scan',
  'reconstruct',
  'detect',
  'fuse',
  'revisit',
  'hazard',
  'route',
  'report',
];

export const STAGE_LABELS: Record<StageId, string> = {
  init:        'Mission Init',
  scan:        'Aerial Scan · RGB AI',
  reconstruct: '3D Reconstruction',
  detect:      'Wide Sweep',
  fuse:        'Multimodal Fusion',
  revisit:     'Precision Revisit',
  hazard:      'Hazard Mapping',
  route:       'Route Planning',
  report:      'Mission Report',
};

export const STAGE_SHORT: Record<StageId, string> = {
  init:        'Init',
  scan:        'Scan',
  reconstruct: '3D',
  detect:      'Detect',
  fuse:        'Fusion',
  revisit:     'Revisit',
  hazard:      'Hazard',
  route:       'Route',
  report:      'Report',
};
