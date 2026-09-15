'use client';

import { useMissionStore, MissionEvent } from '@/stores/mission-store';

function EventRow({ event }: { event: MissionEvent }) {
  const color =
    event.status === 'complete'
      ? 'var(--accent-green)'
      : event.status === 'failed'
      ? 'var(--accent-red)'
      : event.status === 'started'
      ? 'var(--accent-blue)'
      : 'var(--text-tertiary)';

  const ts = new Date(event.timestamp);
  const timeStr = ts.toLocaleTimeString('en', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '4px 12px',
        borderBottom: '1px solid var(--surface-border)',
      }}
    >
      <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', flexShrink: 0 }}>
        {timeStr}
      </span>
      <div
        style={{
          width: 5,
          height: 5,
          borderRadius: '50%',
          background: color,
          flexShrink: 0,
        }}
      />
      <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
        {event.message}
      </span>
    </div>
  );
}

export function EventTimeline() {
  const { events } = useMissionStore();

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--surface-card)',
        borderLeft: '1px solid var(--surface-border)',
        overflow: 'hidden',
        minWidth: 0,
      }}
    >
      <div style={{ padding: '6px 12px', borderBottom: '1px solid var(--surface-border)', flexShrink: 0 }}>
        <p style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          Mission Timeline
        </p>
      </div>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {events.length === 0 ? (
          <div style={{ padding: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <p style={{ fontSize: 9, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase' }}>
              No events yet
            </p>
          </div>
        ) : (
          [...events].reverse().map((e, i) => <EventRow key={i} event={e} />)
        )}
      </div>
    </div>
  );
}
