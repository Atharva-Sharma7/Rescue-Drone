'use client';

import { useState, useEffect } from 'react';
import { useMissionStore } from '@/stores/mission-store';
import { useMissionWs } from '@/hooks/use-mission-ws';
import { StagePipeline, StageRail } from '@/components/stage-pipeline';
import { VideoWorkspace } from '@/components/video-workspace';
import { TargetPanel } from '@/components/target-panel';
import { TelemetryBar } from '@/components/telemetry-bar';
import { EventTimeline } from '@/components/event-timeline';
import * as api from '@/lib/api';

// ── Top global header ──
function GlobalHeader() {
  const {
    mission,
    isConnected,
    backendUrl,
    setBackendUrl,
    health,
    setHealth,
    setIsConnected,
    setError,
  } = useMissionStore();

  useEffect(() => {
    if (!backendUrl) {
      setIsConnected(false);
      return;
    }

    let cancelled = false;

    const checkBackend = async () => {
      try {
        const result = await api.getHealth(backendUrl);

        if (cancelled) return;

        setHealth(result);
        setIsConnected(result?.status === 'healthy');

        if (result?.status === 'healthy') {
          setError(null);
        } else {
          setError('Backend responded but is not healthy');
        }
      } catch (error: any) {
        if (cancelled) return;

        setIsConnected(false);
        setError(error?.message || 'Backend connection failed');
      }
    };

    checkBackend();

    return () => {
      cancelled = true;
    };
  }, [
    backendUrl,
    setHealth,
    setIsConnected,
    setError,
  ]);

  return (
    <header
      style={{
        height: 44,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
        background: 'var(--surface-card)',
        borderBottom: '1px solid var(--surface-border)',
        flexShrink: 0,
        gap: 12,
        zIndex: 10,
      }}
    >
      {/* Wordmark */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontWeight: 700,
            fontSize: 13,
            letterSpacing: '0.2em',
            color: 'var(--text-primary)',
            textTransform: 'uppercase',
          }}
        >
          Debris-Scan AI
        </span>
        <span
          style={{
            fontSize: 8,
            fontFamily: 'var(--font-mono)',
            color: 'var(--text-tertiary)',
            padding: '2px 6px',
            border: '1px solid var(--surface-border)',
            borderRadius: 3,
          }}
        >
          Mission Control v0.2
        </span>
      </div>

      {/* Center: mission ID + stage */}
      {mission && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            color: 'var(--text-secondary)',
          }}
        >
          <span>
            Mission{' '}
            <span style={{ color: 'var(--accent-blue)' }}>{mission.id}</span>
          </span>
          <span
            style={{
              padding: '1px 6px',
              borderRadius: 3,
              background: 'var(--accent-amber-dim)',
              color: 'var(--accent-amber)',
              fontSize: 8,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
            }}
          >
            Simulated Mission
          </span>
        </div>
      )}

      {/* Right: backend URL + connection */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <div
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: isConnected ? 'var(--accent-green)' : 'var(--surface-border)',
            boxShadow: isConnected ? '0 0 5px var(--accent-green)' : 'none',
          }}
          title={isConnected ? 'Backend connected' : 'Not connected'}
        />
        <input
          type="text"
          value={backendUrl}
          onChange={(e) => setBackendUrl(e.target.value)}
          placeholder="localhost:8000"
          style={{
            background: 'var(--surface-raised)',
            border: '1px solid var(--surface-border)',
            borderRadius: 4,
            padding: '3px 8px',
            fontSize: 10,
            fontFamily: 'var(--font-mono)',
            color: 'var(--text-secondary)',
            width: 160,
            outline: 'none',
          }}
        />
        {health && (
          <span
            style={{
              fontSize: 9,
              fontFamily: 'var(--font-mono)',
              color: 'var(--accent-green)',
              padding: '2px 6px',
              border: '1px solid var(--accent-green-dim)',
              borderRadius: 3,
            }}
          >
            {health.gpu ? 'GPU' : 'CPU'} · {health.adapter_mode}
          </span>
        )}
      </div>
    </header>
  );
}

// ── Mission controls ──
function MissionControls() {
  const {
    mission,
    missionId,
    createMission,
    startMission,
    reset,
    isConnected,
    error,
    stageStatuses,
  } = useMissionStore();
  const [siteName, setSiteName] = useState('Sector Alpha — Collapsed Complex');
  const [creating, setCreating] = useState(false);

  const canCreate = !mission && isConnected && !creating;
  const canStart = !!mission && mission.current_stage === 'init' && stageStatuses['scan'] === 'pending';
  const missionDone = stageStatuses['report'] === 'complete';

  const handleCreate = async () => {
    setCreating(true);
    await createMission(siteName);
    setCreating(false);
  };

  return (
    <div
      style={{
        padding: '8px 12px',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        borderBottom: '1px solid var(--surface-border)',
        background: 'var(--surface-card)',
        flexShrink: 0,
        flexWrap: 'wrap',
      }}
    >
      <input
        type="text"
        value={siteName}
        onChange={(e) => setSiteName(e.target.value)}
        disabled={!!mission}
        placeholder="Site name"
        style={{
          background: 'var(--surface-raised)',
          border: '1px solid var(--surface-border)',
          borderRadius: 4,
          padding: '4px 10px',
          fontSize: 11,
          fontFamily: 'var(--font-mono)',
          color: 'var(--text-primary)',
          flex: 1,
          minWidth: 140,
          outline: 'none',
          opacity: mission ? 0.5 : 1,
        }}
      />

      {!mission && (
        <button
          onClick={handleCreate}
          disabled={!canCreate}
          style={{
            background: canCreate ? 'var(--surface-raised)' : 'transparent',
            border: '1px solid var(--surface-border)',
            borderRadius: 4,
            padding: '4px 12px',
            fontSize: 11,
            fontFamily: 'var(--font-mono)',
            color: canCreate ? 'var(--text-primary)' : 'var(--text-tertiary)',
            cursor: canCreate ? 'pointer' : 'not-allowed',
            flexShrink: 0,
          }}
        >
          {creating ? '...' : 'Create Mission'}
        </button>
      )}

      {canStart && (
        <button
          onClick={startMission}
          style={{
            background: 'var(--accent-blue)',
            border: 'none',
            borderRadius: 4,
            padding: '5px 16px',
            fontSize: 11,
            fontFamily: 'var(--font-mono)',
            fontWeight: 700,
            color: '#fff',
            cursor: 'pointer',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            flexShrink: 0,
          }}
        >
          START AUTONOMOUS SEARCH
        </button>
      )}

      {missionDone && (
        <button
          onClick={reset}
          style={{
            background: 'var(--surface-raised)',
            border: '1px solid var(--surface-border)',
            borderRadius: 4,
            padding: '4px 12px',
            fontSize: 11,
            fontFamily: 'var(--font-mono)',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          New Mission
        </button>
      )}

      {error && (
        <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--accent-red)' }}>
          {error}
        </span>
      )}

      {missionId && (
        <span
          style={{
            fontSize: 10,
            fontFamily: 'var(--font-mono)',
            color: 'var(--text-tertiary)',
            marginLeft: 'auto',
          }}
        >
          ID: {missionId}
        </span>
      )}
    </div>
  );
}

// ── Main page ──
export default function MissionControl() {
  const { mission } = useMissionStore();

  useMissionWs();

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100dvh',
        overflow: 'hidden',
        background: 'var(--surface-bg)',
      }}
    >
      {/* Global header */}
      <GlobalHeader />

      {/* Mission controls bar */}
      <MissionControls />

      {/* Mobile stage rail */}
      <div className="md-hide-stage-rail">
        <StageRail />
      </div>

      {/* Main content area */}
      <div
        style={{
          flex: 1,
          display: 'grid',
          minHeight: 0,
          overflow: 'hidden',
          // Desktop: 220px | 1fr | 320px
          // Mobile: single column via media query (handled via style tag below)
        }}
        className="mission-grid"
      >
        {/* Left: Stage pipeline (desktop) */}
        <div className="stage-sidebar" style={{ overflow: 'hidden', minWidth: 0 }}>
          <StagePipeline />
        </div>

        {/* Center: Video/3D workspace */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            minWidth: 0,
            padding: 8,
            gap: 8,
          }}
        >
          <div style={{ flex: 1, minHeight: 0 }}>
  {mission ? (
    <VideoWorkspace />
  ) : (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: 10,
        background: 'var(--surface-card)',
        border: '1px solid var(--surface-border)',
        borderRadius: 6,
        fontFamily: 'var(--font-mono)',
        textTransform: 'uppercase',
      }}
    >
      <div
        style={{
          fontSize: 12,
          color: 'var(--text-primary)',
          letterSpacing: '0.12em',
        }}
      >
        CREATE A MISSION FIRST
      </div>

      <div
        style={{
          fontSize: 9,
          color: 'var(--text-tertiary)',
          letterSpacing: '0.08em',
        }}
      >
        Mission video stream will be available after mission initialization
      </div>
    </div>
  )}
</div>
        </div>

        {/* Right: Target intel + timeline */}
        <div
          className="right-panels"
          style={{
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            minWidth: 0,
          }}
        >
          <div style={{ flex: '0 0 60%', minHeight: 0, overflow: 'hidden' }}>
            <TargetPanel />
          </div>
          <div style={{ flex: '0 0 40%', minHeight: 0, overflow: 'hidden' }}>
            <EventTimeline />
          </div>
        </div>
      </div>

      {/* Bottom telemetry bar */}
      <TelemetryBar />

      {/* Responsive styles */}
      <style>{`
        /* Desktop default */
        .mission-grid {
          grid-template-columns: 220px minmax(0, 1fr) 320px;
        }
        .md-hide-stage-rail {
          display: none;
        }
        .stage-sidebar {
          display: block;
        }

        /* Tablet: 768px */
        @media (max-width: 900px) {
          .mission-grid {
            grid-template-columns: minmax(0, 1fr) 280px;
          }
          .stage-sidebar {
            display: none;
          }
          .md-hide-stage-rail {
            display: block;
          }
          .right-panels {
            display: flex;
          }
        }

        /* Mobile: 600px */
        @media (max-width: 600px) {
          .mission-grid {
            grid-template-columns: 1fr;
            grid-template-rows: auto;
          }
          .right-panels {
            display: none;
          }
          .stage-sidebar {
            display: none;
          }
          .md-hide-stage-rail {
            display: block;
          }
        }

        /* Prevent horizontal overflow */
        * {
          min-width: 0;
        }

        /* Range input */
        input[type=range] {
          -webkit-appearance: none;
          width: 100%;
          height: 3px;
          background: var(--surface-border);
          border-radius: 2px;
          outline: none;
        }
        input[type=range]::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: var(--accent-blue);
          cursor: pointer;
        }

        /* Scrollbar hide utility */
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }

        /* Fade-in */
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.6; } }
      `}</style>
    </div>
  );
}
