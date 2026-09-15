import { useMissionStore } from '../stores/mission-store';

export function TelemetryPanel() {
  const { stagePayloads, mission } = useMissionStore();
  const currentStage = mission?.current_stage;
  
  const payload = currentStage && currentStage !== 'init' ? stagePayloads[currentStage] : null;

  return (
    <div className="bg-surface-50 border border-surface-100 rounded-lg p-4 h-full font-mono text-xs flex flex-col">
      <h2 className="text-gray-400 mb-4 uppercase tracking-wider border-b border-surface-200 pb-2">Live Telemetry</h2>
      
      {!payload ? (
        <div className="flex-1 flex items-center justify-center text-gray-600 italic">
          WAITING FOR TELEMETRY...
        </div>
      ) : (
        <div className="space-y-4 overflow-y-auto">
          {Object.entries(payload).map(([key, value]) => (
            <div key={key} className="flex flex-col border-b border-surface-200/50 pb-2">
              <span className="text-gray-500 mb-1">{key.replace(/_/g, ' ').toUpperCase()}</span>
              <span className="text-accent-blue text-sm break-all">
                {typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
