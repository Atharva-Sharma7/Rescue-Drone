import { create } from 'zustand';
import {
  Mission, StageId, StageStatus, StageEvent,
  FusionResult, HealthResponse, RgbDetection,
} from '../lib/types';
import * as api from '../lib/api';

export interface DroneTelemetry {
  altitude_m: number;
  speed_ms: number;
  heading_deg: number;
  battery_pct: number;
  lat: number;
  lng: number;
  distance_to_target_m: number | null;
}

export interface MissionEvent {
  timestamp: string;
  stage: string;
  status: string;
  message: string;
}

interface MissionState {
  backendUrl: string;
  missionId: string | null;
  mission: Mission | null;
  stageStatuses: Record<StageId, StageStatus>;
  stageProgress: Record<StageId, number>;
  stagePayloads: Record<StageId, any>;
  artifacts: Record<StageId, any>;
  isConnected: boolean;
  error: string | null;
  health: HealthResponse | null;
  telemetry: DroneTelemetry | null;
  events: MissionEvent[];
  selectedTargetId: string | null;

  /** Live RGB detections from Stage 1 — accumulated as events arrive */
  rgbDetections: RgbDetection[];

  setBackendUrl: (url: string) => void;
  createMission: (siteName: string) => Promise<void>;
  startMission: () => Promise<void>;
  handleStageEvent: (event: StageEvent) => void;
  handleSnapshot: (mission: Mission) => void;
  setIsConnected: (connected: boolean) => void;
  setError: (error: string | null) => void;
  setHealth: (h: HealthResponse) => void;
  setSelectedTarget: (id: string | null) => void;
  reset: () => void;
}

const empty = {} as Record<StageId, any>;

const getInitialBackendUrl = (): string => {
  if (typeof window === 'undefined') return 'debris-scan-backend.onrender.com';
  const saved = localStorage.getItem('backendUrl');
  if (
    !saved ||
    (window.location.protocol === 'https:' &&
      (saved.includes('localhost') || saved.includes('loca.lt') || saved.includes('trycloudflare.com')))
  ) {
    localStorage.setItem('backendUrl', 'debris-scan-backend.onrender.com');
    return 'debris-scan-backend.onrender.com';
  }
  return saved;
};

export const useMissionStore = create<MissionState>((set, get) => ({
  backendUrl: getInitialBackendUrl(),
  missionId: null,
  mission: null,
  stageStatuses: { ...empty },
  stageProgress: { ...empty },
  stagePayloads: { ...empty },
  artifacts: { ...empty },
  isConnected: false,
  error: null,
  health: null,
  telemetry: null,
  events: [],
  selectedTargetId: null,
  rgbDetections: [],

  setBackendUrl: (url) => {
    if (typeof window !== 'undefined') localStorage.setItem('backendUrl', url);
    set({ backendUrl: url });
  },

  createMission: async (siteName) => {
    try {
      set({ error: null });
      const mission = await api.createMission(get().backendUrl, siteName);
      set({
        missionId: mission.id,
        mission,
        stageStatuses: mission.stage_statuses as Record<StageId, StageStatus>,
        rgbDetections: [],
        events: [{
          timestamp: new Date().toISOString(),
          stage: 'init',
          status: 'complete',
          message: `Mission ${mission.id} created — ${mission.site_name}`,
        }],
      });
    } catch (e: any) {
      set({ error: e.message || 'Failed to create mission' });
    }
  },

  startMission: async () => {
    const { backendUrl, missionId } = get();
    if (!missionId) return;
    try {
      set({ error: null });
      await api.startMission(backendUrl, missionId);
    } catch (e: any) {
      set({ error: e.message || 'Failed to start mission' });
    }
  },

  handleStageEvent: (event) => {
    set((state) => {
      const payload = event.payload;
      const newArtifacts = { ...state.artifacts };

      // On complete, store payload as artifact
      if (event.status === 'complete' && payload) {
        newArtifacts[event.stage] = payload;
      }

      // Handle RGB detection progress events — accumulate live detections
      let newRgbDetections = state.rgbDetections;
      if (event.stage === 'scan' && payload?.event_type === 'rgb_detection' && payload.detection) {
        const det = payload.detection as RgbDetection;
        // Avoid duplicating if we somehow get the same frame_id twice
        const alreadyHave = state.rgbDetections.some(
          (d) => d.frame_id === det.frame_id && d.class_name === det.class_name
        );
        if (!alreadyHave) {
          newRgbDetections = [...state.rgbDetections, det];
        }
      }

      // On scan complete, if rgb_detections array provided (batch), replace
      if (event.stage === 'scan' && event.status === 'complete' && payload?.rgb_detections) {
        newRgbDetections = payload.rgb_detections as RgbDetection[];
      }

      // Only add to event timeline for non-progress events (avoid noise)
      // Exception: rgb_detection progress events also go to timeline
      const shouldLog =
        event.status !== 'progress' ||
        (event.status === 'progress' && payload?.event_type === 'rgb_detection');

      const eventMessage = (() => {
        if (payload?.event_type === 'rgb_detection' && payload.detection) {
          const d = payload.detection;
          return `TARGET DETECTED — ${d.class_name.toUpperCase()} @ ${(d.confidence * 100).toFixed(0)}% conf (frame ${d.frame_id})`;
        }
        if (payload?.status) return payload.status;
        return `Stage ${event.stage}: ${event.status}`;
      })();

      const newEvents: MissionEvent[] = shouldLog
        ? [
            ...state.events,
            {
              timestamp: event.timestamp,
              stage: event.stage,
              status: event.status,
              message: eventMessage,
            },
          ]
        : state.events;

      return {
        stageStatuses: { ...state.stageStatuses, [event.stage]: event.status },
        stageProgress:
          event.progress !== undefined
            ? { ...state.stageProgress, [event.stage]: event.progress }
            : state.stageProgress,
        stagePayloads: payload
          ? { ...state.stagePayloads, [event.stage]: payload }
          : state.stagePayloads,
        artifacts: newArtifacts,
        mission: state.mission
          ? { ...state.mission, current_stage: event.stage as StageId }
          : state.mission,
        events: newEvents,
        rgbDetections: newRgbDetections,
      };
    });
  },

  handleSnapshot: (mission) => {
    // Restore detections from snapshot if available (for browser refresh)
    const snapshotDetections: RgbDetection[] =
      (mission as any).artifacts?.scan?.rgb_detections ?? [];

    set({
      mission,
      missionId: mission.id,
      stageStatuses: mission.stage_statuses as Record<StageId, StageStatus>,
      artifacts: (mission as any).artifacts as Record<StageId, any> ?? {},
      rgbDetections: snapshotDetections,
    });
  },

  setIsConnected: (connected) => set({ isConnected: connected }),
  setError: (error) => set({ error }),
  setHealth: (h) => set({ health: h }),
  setSelectedTarget: (id) => set({ selectedTargetId: id }),

  reset: () =>
    set({
      missionId: null,
      mission: null,
      stageStatuses: { ...empty },
      stageProgress: { ...empty },
      stagePayloads: { ...empty },
      artifacts: { ...empty },
      error: null,
      telemetry: null,
      events: [],
      selectedTargetId: null,
      rgbDetections: [],
    }),
}));
