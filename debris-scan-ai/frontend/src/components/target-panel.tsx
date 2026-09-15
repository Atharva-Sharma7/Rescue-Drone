'use client';

import { useMissionStore } from '@/stores/mission-store';
import { FusionResult } from '@/lib/types';

interface TargetPanelProps {
  compact?: boolean; // true = mobile collapsed view
}

function ScoreBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span
          style={{
            fontSize: 9,
            fontFamily: 'var(--font-mono)',
            color: 'var(--text-tertiary)',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
          }}
        >
          {label}
        </span>
        <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color }}>
          {(value * 100).toFixed(0)}%
        </span>
      </div>
      <div
        style={{
          height: 3,
          borderRadius: 2,
          background: 'var(--surface-border)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${(value * 100).toFixed(1)}%`,
            height: '100%',
            background: color,
            transition: 'width 0.4s ease',
          }}
        />
      </div>
    </div>
  );
}

function TargetCard({ result, isSelected, onSelect }: {
  result: FusionResult;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const score = result.total_score;
  const scoreColor = score > 0.75 ? 'var(--accent-green)' : score > 0.5 ? 'var(--accent-amber)' : 'var(--accent-red)';
  const priority = score > 0.75 ? 'CRITICAL' : score > 0.5 ? 'HIGH' : 'MEDIUM';

  return (
    <button
      onClick={onSelect}
      style={{
        width: '100%',
        textAlign: 'left',
        background: isSelected ? 'var(--accent-blue-dim)' : 'transparent',
        border: isSelected ? '1px solid var(--accent-blue)' : '1px solid var(--surface-border)',
        borderRadius: 5,
        padding: '8px 10px',
        cursor: 'pointer',
        transition: 'all 0.15s',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div>
          <p
            style={{
              fontSize: 11,
              fontFamily: 'var(--font-mono)',
              color: 'var(--text-primary)',
              fontWeight: 600,
            }}
          >
            {result.id.substring(0, 10).toUpperCase()}
          </p>
          <p style={{ fontSize: 9, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
            {result.confirmed ? 'CONFIRMED' : 'CANDIDATE'}
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={{ fontSize: 16, fontFamily: 'var(--font-mono)', fontWeight: 700, color: scoreColor }}>
            {(score * 100).toFixed(0)}%
          </p>
          <p style={{ fontSize: 8, color: scoreColor, fontFamily: 'var(--font-mono)', marginTop: 1 }}>
            {priority}
          </p>
        </div>
      </div>
    </button>
  );
}

function ExplainTarget(result: FusionResult): string {
  const parts: string[] = [];
  if (result.thermal_contribution > 0.7) parts.push('strong thermal signature');
  if (result.radar_contribution > 0.7) parts.push('confirmed radar breathing signal');
  if (result.structural_contribution > 0.7) parts.push('spatially plausible enclosed region');
  if ((result.rgb_score ?? 0) > 0.6) parts.push('RGB visual detection agreement');
  if (result.hazard_penalty > 0.4) parts.push(`note: high hazard penalty (${(result.hazard_penalty * 100).toFixed(0)}%) reduces total confidence`);

  if (parts.length === 0) return 'Evidence is ambiguous across modalities.';
  return `Confidence is elevated because: ${parts.join(', ')}.`;
}

export function TargetPanel() {
  const { artifacts, selectedTargetId, setSelectedTarget, stageStatuses } = useMissionStore();

  const fuseReady = stageStatuses['fuse'] === 'complete';
  const fuseArtifact = artifacts['fuse'] as any;
  const fusionResults: FusionResult[] = fuseArtifact?.fusion_results ?? [];

  const selected = fusionResults.find((r) => r.id === selectedTargetId) ?? fusionResults[0] ?? null;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: 'var(--surface-card)',
        borderLeft: '1px solid var(--surface-border)',
        minWidth: 0,
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '8px 12px',
          borderBottom: '1px solid var(--surface-border)',
          flexShrink: 0,
        }}
      >
        <p
          style={{
            fontSize: 9,
            fontFamily: 'var(--font-mono)',
            color: 'var(--text-tertiary)',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
          }}
        >
          Target Intelligence
        </p>
        <p style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 2 }}>
          {fuseReady ? `${fusionResults.length} candidates` : 'Awaiting fusion'}
        </p>
      </div>

      {!fuseReady ? (
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            padding: 16,
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              border: '1px solid var(--surface-border)',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="7" stroke="var(--text-tertiary)" strokeWidth="1" />
              <path d="M8 4v5l3 1.5" stroke="var(--text-tertiary)" strokeWidth="1" strokeLinecap="round" />
            </svg>
          </div>
          <p
            style={{
              fontSize: 9,
              fontFamily: 'var(--font-mono)',
              color: 'var(--text-tertiary)',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              textAlign: 'center',
            }}
          >
            Waiting for Stage 4<br />Multimodal Fusion
          </p>
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Target list */}
          <div
            style={{
              padding: 8,
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
              overflowY: 'auto',
              borderBottom: '1px solid var(--surface-border)',
              maxHeight: '40%',
            }}
          >
            {fusionResults.map((r) => (
              <TargetCard
                key={r.id}
                result={r}
                isSelected={selectedTargetId === r.id || (!selectedTargetId && r === fusionResults[0])}
                onSelect={() => setSelectedTarget(r.id)}
              />
            ))}
          </div>

          {/* Selected target details */}
          {selected && (
            <div style={{ flex: 1, overflowY: 'auto', padding: '10px 12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <p
                  style={{
                    fontSize: 11,
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 700,
                    color: 'var(--text-primary)',
                  }}
                >
                  {selected.id.substring(0, 12).toUpperCase()}
                </p>
                <span
                  style={{
                    fontSize: 8,
                    fontFamily: 'var(--font-mono)',
                    padding: '2px 6px',
                    borderRadius: 3,
                    background: selected.confirmed ? 'var(--accent-green-dim)' : 'var(--accent-amber-dim)',
                    color: selected.confirmed ? 'var(--accent-green)' : 'var(--accent-amber)',
                    textTransform: 'uppercase',
                  }}
                >
                  {selected.confirmed ? 'Confirmed' : 'Candidate'}
                </span>
              </div>

              {/* Position */}
              <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
                {[['X', selected.x.toFixed(1)], ['Y', selected.y.toFixed(1)], ['Z', selected.z.toFixed(1)]].map(([ax, v]) => (
                  <div key={ax} style={{ flex: 1 }}>
                    <p style={{ fontSize: 8, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase' }}>{ax}</p>
                    <p style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-mono)' }}>{v}</p>
                  </div>
                ))}
              </div>

              {/* Score breakdown */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                <ScoreBar label="Fused Confidence" value={selected.total_score} color={selected.total_score > 0.75 ? 'var(--accent-green)' : 'var(--accent-amber)'} />
                <div style={{ height: 1, background: 'var(--surface-border)' }} />
                <ScoreBar label="Thermal" value={selected.thermal_contribution} color="var(--accent-amber)" />
                <ScoreBar label="Radar" value={selected.radar_contribution} color="var(--accent-cyan)" />
                <ScoreBar label="Structural" value={selected.structural_contribution} color="var(--accent-blue)" />
                {selected.rgb_score != null && <ScoreBar label="RGB" value={selected.rgb_score} color="var(--accent-green)" />}
                {selected.rf_score != null && <ScoreBar label="RF" value={selected.rf_score} color="#a78bfa" />}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Hazard Penalty</span>
                    <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--accent-red)' }}>−{(selected.hazard_penalty * 100).toFixed(0)}%</span>
                  </div>
                  <div style={{ height: 3, borderRadius: 2, background: 'var(--surface-border)', overflow: 'hidden' }}>
                    <div style={{ width: `${(selected.hazard_penalty * 100).toFixed(1)}%`, height: '100%', background: 'var(--accent-red)' }} />
                  </div>
                </div>
              </div>

              {/* Why this target */}
              <div
                style={{
                  marginTop: 12,
                  padding: 8,
                  background: 'var(--surface-raised)',
                  borderRadius: 4,
                  border: '1px solid var(--surface-border)',
                }}
              >
                <p style={{ fontSize: 8, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 4 }}>
                  Why This Target?
                </p>
                <p style={{ fontSize: 10, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  {ExplainTarget(selected)}
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
