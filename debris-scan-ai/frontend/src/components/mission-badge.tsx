'use client';

import { useMissionStore } from '../stores/mission-store';

export function MissionBadge() {
  const mission = useMissionStore((state) => state.mission);
  
  if (!mission) return null;

  return (
    <div className="flex items-center space-x-4">
      {mission.adapter_mode === 'mock' && (
        <div className="px-3 py-1 bg-accent-amber/10 border border-accent-amber/30 text-accent-amber rounded-full text-xs font-mono tracking-wide animate-pulse">
          SIMULATED MISSION — RECORDED FLIGHT DATA
        </div>
      )}
      <div className="px-3 py-1 bg-surface-200 border border-surface-100 text-gray-400 rounded-full text-xs font-mono">
        MODE: {mission.adapter_mode.toUpperCase()}
      </div>
    </div>
  );
}
