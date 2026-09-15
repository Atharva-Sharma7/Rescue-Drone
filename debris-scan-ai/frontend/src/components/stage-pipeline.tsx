'use client';

import { useMissionStore } from '@/stores/mission-store';
import { STAGE_ORDER, STAGE_LABELS, STAGE_SHORT, StageId, StageStatus } from '@/lib/types';

function stageNum(id: StageId) {
  return STAGE_ORDER.indexOf(id);
}

function StatusIcon({ status, num }: { status: StageStatus | undefined; num: number }) {
  if (!status || status === 'pending') {
    return (
      <span className="w-5 h-5 rounded-full border border-[var(--surface-border)] flex items-center justify-center text-[10px] font-mono text-[var(--text-tertiary)]">
        {num}
      </span>
    );
  }
  if (status === 'started' || status === 'progress') {
    return (
      <span className="w-5 h-5 rounded-full border border-[var(--accent-blue)] flex items-center justify-center">
        <span className="w-2 h-2 rounded-full bg-[var(--accent-blue)] animate-pulse" />
      </span>
    );
  }
  if (status === 'complete') {
    return (
      <span className="w-5 h-5 rounded-full bg-[var(--accent-green-dim)] border border-[var(--accent-green)] flex items-center justify-center">
        <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
          <path d="M1 4l3 3 5-6" stroke="#10b981" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    );
  }
  if (status === 'failed') {
    return (
      <span className="w-5 h-5 rounded-full bg-[var(--accent-red-dim)] border border-[var(--accent-red)] flex items-center justify-center">
        <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
          <path d="M1 1l6 6M7 1L1 7" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </span>
    );
  }
  return null;
}

/** Desktop vertical sidebar pipeline */
export function StagePipeline() {
  const { stageStatuses, stageProgress, mission } = useMissionStore();
  const current = mission?.current_stage;

  return (
    <div className="h-full flex flex-col bg-[var(--surface-card)] border-r border-[var(--surface-border)] overflow-y-auto">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[var(--surface-border)]">
        <p className="text-[10px] font-mono text-[var(--text-tertiary)] uppercase tracking-widest">Mission Pipeline</p>
        <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">9 Stages · 0–8</p>
      </div>

      {/* Stages */}
      <div className="flex-1 py-2">
        {STAGE_ORDER.map((id) => {
          const num = stageNum(id);
          const status = stageStatuses[id];
          const progress = stageProgress[id] ?? 0;
          const isActive = current === id;

          return (
            <div
              key={id}
              className={`relative px-4 py-3 border-l-2 transition-colors ${
                isActive
                  ? 'border-[var(--accent-blue)] bg-[var(--accent-blue-dim)]/30'
                  : status === 'complete'
                  ? 'border-[var(--accent-green-dim)]'
                  : status === 'failed'
                  ? 'border-[var(--accent-red-dim)]'
                  : 'border-transparent'
              }`}
            >
              <div className="flex items-center gap-3">
                <StatusIcon status={status} num={num} />
                <div className="flex-1 min-w-0">
                  <p
                    className={`text-xs font-medium truncate ${
                      isActive
                        ? 'text-[var(--accent-blue)]'
                        : status === 'complete'
                        ? 'text-[var(--accent-green)]'
                        : status === 'failed'
                        ? 'text-[var(--accent-red)]'
                        : 'text-[var(--text-secondary)]'
                    }`}
                  >
                    {STAGE_LABELS[id]}
                  </p>
                  {status && (
                    <p className="text-[10px] font-mono text-[var(--text-tertiary)] uppercase mt-0.5">
                      {status}
                    </p>
                  )}
                </div>
              </div>

              {/* Progress bar */}
              {(status === 'started' || status === 'progress') && (
                <div className="mt-2 h-0.5 bg-[var(--surface-border)] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[var(--accent-blue)] transition-all duration-300"
                    style={{ width: `${(progress * 100).toFixed(0)}%` }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Mobile horizontal scrollable stage rail */
export function StageRail() {
  const { stageStatuses, mission } = useMissionStore();
  const current = mission?.current_stage;

  return (
    <div className="flex overflow-x-auto scrollbar-hide gap-1 px-3 py-2 bg-[var(--surface-card)] border-b border-[var(--surface-border)]">
      {STAGE_ORDER.map((id) => {
        const num = stageNum(id);
        const status = stageStatuses[id];
        const isActive = current === id;

        return (
          <div
            key={id}
            className={`flex-shrink-0 flex flex-col items-center gap-1 px-3 py-1.5 rounded transition-colors ${
              isActive
                ? 'bg-[var(--accent-blue-dim)] border border-[var(--accent-blue)]'
                : status === 'complete'
                ? 'bg-[var(--accent-green-dim)] border border-transparent'
                : 'border border-transparent'
            }`}
          >
            <StatusIcon status={status} num={num} />
            <span
              className={`text-[9px] font-mono uppercase tracking-wide whitespace-nowrap ${
                isActive ? 'text-[var(--accent-blue)]' : 'text-[var(--text-tertiary)]'
              }`}
            >
              {STAGE_SHORT[id]}
            </span>
          </div>
        );
      })}
    </div>
  );
}
