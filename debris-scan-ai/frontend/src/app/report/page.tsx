'use client';

import { useMissionStore } from '@/stores/mission-store';

export default function ReportPage() {
  const { stageStatuses, artifacts, stagePayloads, mission } = useMissionStore();

  const reportDone = stageStatuses['report'] === 'complete';
  // Fix: read from artifacts OR stagePayloads (not report.summary which doesn't exist)
  const report = artifacts['report'] ?? stagePayloads['report'] ?? null;

  const downloadJson = () => {
    if (!report || !mission) return;
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mission-report-${mission.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!reportDone || !report) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          Waiting for Stage 8 · Mission Report
        </p>
      </div>
    );
  }

  // Read from top-level fields (matching MissionReport Pydantic model)
  const stats = [
    { label: 'Area Scanned', value: `${((report.total_area_scanned_m2 as number) ?? 0).toLocaleString()} m²` },
    { label: 'Candidates', value: String(report.candidates_detected ?? 0) },
    { label: 'Confirmed', value: String(report.confirmed_survivors ?? 0) },
    { label: 'Duration', value: `${((report.scan_duration_s as number) ?? 0).toFixed(1)} s` },
    { label: 'Routes', value: String((report.routes as any[])?.length ?? 0) },
    { label: 'Adapter', value: String(report.adapter_mode ?? 'mock') },
  ];

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>
      {/* Header */}
      <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--surface-border)', flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <h2 style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            Mission Report
          </h2>
          <p style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
            Stage 8 · Assistive Result — Not Safety-Certified
          </p>
        </div>
        <button
          onClick={downloadJson}
          style={{
            background: 'var(--accent-blue)',
            border: 'none',
            borderRadius: 4,
            padding: '6px 14px',
            fontSize: 11,
            fontFamily: 'var(--font-mono)',
            color: '#fff',
            cursor: 'pointer',
            fontWeight: 600,
          }}
        >
          Download JSON
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Stat cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8 }}>
          {stats.map((s) => (
            <div key={s.label} style={{ padding: '10px 12px', background: 'var(--surface-raised)', borderRadius: 5, border: '1px solid var(--surface-border)' }}>
              <p style={{ fontSize: 8, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
                {s.label}
              </p>
              <p style={{ fontSize: 16, fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--text-primary)' }}>
                {s.value}
              </p>
            </div>
          ))}
        </div>

        {/* Disclaimer */}
        <div style={{ padding: 10, background: 'var(--accent-amber-dim)', border: '1px solid var(--accent-amber)', borderRadius: 4 }}>
          <p style={{ fontSize: 10, color: 'var(--accent-amber)', fontFamily: 'var(--font-mono)' }}>
            ⚠ ASSISTIVE TOOL ONLY — Results are prototype AI outputs on simulated sensor data. 
            All potential targets should be confirmed by qualified rescue personnel. 
            This system is NOT safety-certified.
          </p>
        </div>

        {/* Raw JSON */}
        <div>
          <p style={{ fontSize: 8, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 6 }}>Raw Report Data</p>
          <pre
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              color: 'var(--text-secondary)',
              background: 'var(--surface-raised)',
              border: '1px solid var(--surface-border)',
              borderRadius: 4,
              padding: 12,
              overflow: 'auto',
              maxHeight: 320,
            }}
          >
            {JSON.stringify(report, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  );
}
