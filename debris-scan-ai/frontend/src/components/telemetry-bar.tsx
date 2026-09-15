'use client';

import { useMissionStore } from '@/stores/mission-store';

function StatCell({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ flex: 1, minWidth: 80, display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span
        style={{
          fontSize: 8,
          fontFamily: 'var(--font-mono)',
          color: 'var(--text-tertiary)',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: 13,
          fontFamily: 'var(--font-mono)',
          color: color ?? 'var(--text-mono)',
          fontWeight: 600,
        }}
      >
        {value}
      </span>
    </div>
  );
}

export function TelemetryBar() {
  const { telemetry, mission, stagePayloads, isConnected } = useMissionStore();

  const scanPayload = stagePayloads['scan'] as any;
  const framesCapt = scanPayload?.frames_captured ?? '—';
  const totalPts = (stagePayloads['reconstruct'] as any)?.total_points ?? '—';
  const candidates = (stagePayloads['fuse'] as any)?.fusion_results?.length ?? '—';

  const alt = telemetry?.altitude_m?.toFixed(1) ?? '—';
  const spd = telemetry?.speed_ms?.toFixed(1) ?? '—';
  const bat = telemetry ? `${telemetry.battery_pct.toFixed(0)}%` : '—';
  const hdg = telemetry ? `${telemetry.heading_deg.toFixed(0)}°` : '—';

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 0,
        padding: '6px 16px',
        background: 'var(--surface-card)',
        borderTop: '1px solid var(--surface-border)',
        overflowX: 'auto',
        flexShrink: 0,
      }}
    >
      {/* Connection dot */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginRight: 20, flexShrink: 0 }}>
        <div
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: isConnected ? 'var(--accent-green)' : 'var(--surface-border)',
            boxShadow: isConnected ? '0 0 6px var(--accent-green)' : 'none',
          }}
        />
        <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>
          {isConnected ? 'Backend Connected' : 'Disconnected'}
        </span>
      </div>

      <div style={{ width: 1, height: 24, background: 'var(--surface-border)', marginRight: 20 }} />

      {/* Drone telemetry */}
      <div style={{ display: 'flex', gap: 20, flexShrink: 0 }}>
        <StatCell label="Altitude" value={alt === '—' ? alt : `${alt} m`} />
        <StatCell label="Speed" value={spd === '—' ? spd : `${spd} m/s`} />
        <StatCell label="Heading" value={hdg} />
        <StatCell label="Battery" value={bat} color={telemetry && telemetry.battery_pct < 20 ? 'var(--accent-red)' : undefined} />
      </div>

      <div style={{ width: 1, height: 24, background: 'var(--surface-border)', margin: '0 20px' }} />

      {/* Pipeline stats */}
      <div style={{ display: 'flex', gap: 20, flexShrink: 0 }}>
        <StatCell label="Frames" value={String(framesCapt)} />
        <StatCell label="Points" value={String(totalPts)} />
        <StatCell label="Candidates" value={String(candidates)} />
      </div>

      {/* Mission mode badge */}
      {mission && (
        <>
          <div style={{ width: 1, height: 24, background: 'var(--surface-border)', margin: '0 20px' }} />
          <span
            style={{
              fontSize: 8,
              fontFamily: 'var(--font-mono)',
              padding: '3px 8px',
              borderRadius: 3,
              background: 'var(--accent-amber-dim)',
              color: 'var(--accent-amber)',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              flexShrink: 0,
              animation: 'pulse 3s infinite',
            }}
          >
            Simulated Mission · Recorded Flight Data
          </span>
        </>
      )}
    </div>
  );
}
