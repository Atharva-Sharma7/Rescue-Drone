'use client';

import { useMissionStore } from '@/stores/mission-store';
import { FusionResult } from '@/lib/types';
import { TargetPanel } from '@/components/target-panel';

export default function DetectionPage() {
  const { stageStatuses, artifacts, stagePayloads } = useMissionStore();

  const fuseDone = stageStatuses['fuse'] === 'complete';
  const detectDone = stageStatuses['detect'] === 'complete';

  // Fix: read from artifacts OR stagePayloads
  const fuseData = artifacts['fuse'] ?? stagePayloads['fuse'] ?? {};
  const detectData = artifacts['detect'] ?? stagePayloads['detect'] ?? {};

  const fusionResults: FusionResult[] = fuseData?.fusion_results ?? [];
  const thermalCount = detectData?.thermal_candidates ?? 0;
  const radarCount = detectData?.radar_candidates ?? 0;
  const detectorModel = detectData?.thermal_model ?? '—';
  const radarMethod = detectData?.radar_method ?? 'real_fft_signal_processing';

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>
      {/* Header bar */}
      <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--surface-border)', flexShrink: 0, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <h2 style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            Detections & Fusion
          </h2>
          <p style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
            Stages 3–4 · Wide Sweep + Multimodal Fusion
          </p>
        </div>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          {[
            { label: 'Thermal candidates', value: thermalCount },
            { label: 'Radar candidates', value: radarCount },
            { label: 'Fused targets', value: fusionResults.length },
          ].map((s) => (
            <div key={s.label} style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <span style={{ fontSize: 8, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>{s.label}</span>
              <span style={{ fontSize: 14, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', fontWeight: 700 }}>{s.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Provenance */}
      <div style={{ padding: '6px 12px', borderBottom: '1px solid var(--surface-border)', display: 'flex', gap: 8, flexWrap: 'wrap', flexShrink: 0 }}>
        <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--accent-amber)', padding: '2px 8px', background: 'var(--accent-amber-dim)', borderRadius: 3 }}>
          Thermal: Simulated Sensor
        </span>
        <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--accent-green)', padding: '2px 8px', background: 'var(--accent-green-dim)', borderRadius: 3 }}>
          Model: {detectorModel !== '—' ? detectorModel : 'Thermal YOLO · Real Inference'}
        </span>
        <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--accent-amber)', padding: '2px 8px', background: 'var(--accent-amber-dim)', borderRadius: 3 }}>
          Radar: Simulated UWB
        </span>
        <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--accent-green)', padding: '2px 8px', background: 'var(--accent-green-dim)', borderRadius: 3 }}>
          DSP: {radarMethod}
        </span>
      </div>

      {/* Content */}
      {!detectDone && !fuseDone ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <p style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            Waiting for Stage 3–4 (Wide Sweep + Fusion)
          </p>
        </div>
      ) : (
        <div style={{ flex: 1, overflow: 'hidden', minHeight: 0 }}>
          <TargetPanel />
        </div>
      )}
    </div>
  );
}
