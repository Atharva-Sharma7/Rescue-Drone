'use client';

import { useRef, useEffect } from 'react';
import { useMissionStore } from '@/stores/mission-store';
import { RouteResult } from '@/lib/types';

function RouteCanvas({
  hazardGridB64,
  gridSize,
  routes,
}: {
  hazardGridB64: string | null;
  gridSize: number;
  routes: RouteResult[];
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const w = container.clientWidth;
    const h = container.clientHeight;
    canvas.width = w;
    canvas.height = h;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, w, h);

    const mapCoord = (v: number, max: number, size: number) => (v / max) * size;

    // Draw hazard grid
    if (hazardGridB64) {
      try {
        const binary = atob(hazardGridB64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        const floats = new Float32Array(bytes.buffer);
        const cellSize = w / gridSize;

        for (let gy = 0; gy < gridSize; gy++) {
          for (let gx = 0; gx < gridSize; gx++) {
            const hazard = floats[gy * gridSize + gx] ?? 0;
            const r = Math.floor(hazard * 239);
            const g = Math.floor((1 - hazard) * 185);
            const b = Math.floor((1 - hazard) * 129);
            const a = 0.15 + hazard * 0.6;
            ctx.fillStyle = `rgba(${r},${g},${b},${a})`;
            ctx.fillRect(gx * cellSize, gy * cellSize, cellSize, cellSize);
          }
        }
      } catch (e) {
        // Grid decode failed — skip
      }
    }

    // Draw routes
    for (const route of routes) {
      const pts = route.waypoints;
      if (!pts.length) continue;
      ctx.beginPath();
      ctx.moveTo(mapCoord(pts[0].x, gridSize, w), mapCoord(pts[0].y, gridSize, h));
      for (let i = 1; i < pts.length; i++) {
        ctx.lineTo(mapCoord(pts[i].x, gridSize, w), mapCoord(pts[i].y, gridSize, h));
      }
      ctx.strokeStyle = route.mode === 'safest' ? '#10b981' : '#f59e0b';
      ctx.lineWidth = 2;
      if (route.mode === 'fastest') ctx.setLineDash([5, 4]);
      else ctx.setLineDash([]);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }, [hazardGridB64, gridSize, routes]);

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%', position: 'relative' }}
    >
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
    </div>
  );
}

export default function RoutesPage() {
  const { stageStatuses, artifacts, stagePayloads } = useMissionStore();

  const routeDone = stageStatuses['route'] === 'complete';
  const hazardDone = stageStatuses['hazard'] === 'complete';

  const routeData = artifacts['route'] ?? stagePayloads['route'] ?? {};
  const hazardData = artifacts['hazard'] ?? stagePayloads['hazard'] ?? {};

  const routes: RouteResult[] = routeData?.routes ?? [];
  const hazardGridB64: string | null = hazardData?.hazard_grid_b64 ?? null;
  const gridSize: number = hazardData?.grid_size ?? 100;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>
      {/* Header */}
      <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--surface-border)', flexShrink: 0, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <h2 style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            Route Planning
          </h2>
          <p style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
            Stages 6–7 · Hazard Map + A* Routes
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--accent-green)', padding: '2px 8px', background: 'var(--accent-green-dim)', borderRadius: 3 }}>
            A* · Real Computation
          </span>
          <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', padding: '2px 8px', background: 'var(--surface-raised)', borderRadius: 3 }}>
            {routes.length} routes computed
          </span>
        </div>
      </div>

      {/* Legend */}
      <div style={{ padding: '4px 12px', borderBottom: '1px solid var(--surface-border)', display: 'flex', gap: 16, flexShrink: 0 }}>
        {[
          { label: 'Safest Route', color: '#10b981', dash: false },
          { label: 'Fastest Route', color: '#f59e0b', dash: true },
        ].map((l) => (
          <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <svg width="24" height="4">
              <line x1="0" y1="2" x2="24" y2="2" stroke={l.color} strokeWidth="2" strokeDasharray={l.dash ? '4 3' : 'none'} />
            </svg>
            <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>{l.label}</span>
          </div>
        ))}
      </div>

      {!hazardDone && !routeDone ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <p style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            Waiting for Stages 6–7
          </p>
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', minHeight: 0, overflow: 'hidden' }}>
          {/* Map canvas */}
          <div style={{ flex: '0 0 55%', minHeight: 0, padding: 8 }}>
            <div style={{ height: '100%', border: '1px solid var(--surface-border)', borderRadius: 6, overflow: 'hidden' }}>
              <RouteCanvas hazardGridB64={hazardGridB64} gridSize={gridSize} routes={routes} />
            </div>
          </div>

          {/* Route table */}
          <div style={{ flex: 1, overflowY: 'auto', padding: 8 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {routes.map((r, i) => (
                <div key={i} style={{ padding: 10, background: 'var(--surface-raised)', borderRadius: 5, border: '1px solid var(--surface-border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', fontWeight: 600 }}>
                      {r.target_id.substring(0, 10).toUpperCase()}
                    </span>
                    <span
                      style={{
                        fontSize: 8,
                        fontFamily: 'var(--font-mono)',
                        padding: '2px 8px',
                        borderRadius: 3,
                        background: r.mode === 'safest' ? 'var(--accent-green-dim)' : 'var(--accent-amber-dim)',
                        color: r.mode === 'safest' ? 'var(--accent-green)' : 'var(--accent-amber)',
                        textTransform: 'uppercase',
                      }}
                    >
                      {r.mode}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                    {[
                      { label: 'Distance', value: `${r.total_distance_m.toFixed(1)} m` },
                      { label: 'Est. Time', value: `${r.estimated_time_min.toFixed(1)} min` },
                      { label: 'Max Hazard', value: `${(r.max_hazard_encountered * 100).toFixed(0)}%` },
                      { label: 'Hazard Zones', value: String(r.hazard_zone_crossings) },
                    ].map((s) => (
                      <div key={s.label} style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                        <span style={{ fontSize: 8, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>{s.label}</span>
                        <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-mono)' }}>{s.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
