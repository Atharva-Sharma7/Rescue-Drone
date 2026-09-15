'use client';

import { useMissionStore } from '@/stores/mission-store';
import { PointCloudViewer } from '@/components/point-cloud-viewer';

export default function ReconstructionPage() {
  const { stageStatuses, artifacts, stagePayloads } = useMissionStore();

  const status = stageStatuses['reconstruct'];
  const ready = status === 'complete' || status === 'progress';

  // Fix: read from artifacts (populated on complete) OR stagePayloads (live progress)
  const data = artifacts['reconstruct'] ?? stagePayloads['reconstruct'] ?? {};
  const pointCloudB64 = data?.point_cloud_b64 ?? null;
  const colorB64 = data?.color_b64 ?? null;
  const totalPoints = data?.total_points ?? 0;
  const method = data?.method ?? '—';
  const bounds = data?.bounds ?? null;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: 12, gap: 8, minHeight: 0 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, flexWrap: 'wrap', gap: 8 }}>
        <div>
          <h2 style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            3D Reconstruction
          </h2>
          <p style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
            Stage 2 · Point Cloud
          </p>
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {[
            { label: 'Points', value: totalPoints ? totalPoints.toLocaleString() : '—' },
            { label: 'Method', value: method },
            { label: 'Status', value: status ?? 'pending' },
          ].map((item) => (
            <div key={item.label} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontSize: 8, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>
                {item.label}
              </span>
              <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-mono)' }}>
                {item.value}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Provenance */}
      <div style={{ display: 'flex', gap: 10, flexShrink: 0, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--accent-amber)', padding: '2px 8px', background: 'var(--accent-amber-dim)', borderRadius: 3 }}>
          Simulated LiDAR Input
        </span>
        <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--accent-green)', padding: '2px 8px', background: 'var(--accent-green-dim)', borderRadius: 3 }}>
          {method.includes('depth_anything') ? 'Depth Anything V2 · Real Inference' : 'Depth Estimation · Processing'}
        </span>
      </div>

      {/* Viewer */}
      <div style={{ flex: 1, minHeight: 0, borderRadius: 6, border: '1px solid var(--surface-border)', overflow: 'hidden' }}>
        {ready && pointCloudB64 ? (
          <PointCloudViewer pointCloudB64={pointCloudB64} colorB64={colorB64} />
        ) : (
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <p style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              {status === 'started' || status === 'progress' ? 'Building Point Cloud...' : 'Waiting for Stage 2'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
