import { FusionResult } from '../lib/types';

interface ScoreBreakdownProps {
  result: FusionResult;
}

export function ScoreBreakdown({ result }: ScoreBreakdownProps) {
  const getScoreColor = (score: number) => {
    if (score > 0.8) return 'text-accent-green';
    if (score > 0.5) return 'text-accent-amber';
    return 'text-accent-red';
  };

  const getBarColor = (score: number) => {
    if (score > 0.8) return 'bg-accent-green';
    if (score > 0.5) return 'bg-accent-amber';
    return 'bg-accent-red';
  };

  const metrics = [
    { label: 'Thermal', value: result.thermal_contribution, weight: '40%' },
    { label: 'Radar', value: result.radar_contribution, weight: '30%' },
    { label: 'Structural', value: result.structural_contribution, weight: '30%' },
  ];

  return (
    <div className="bg-surface-50 border border-surface-100 rounded-lg p-6 font-mono">
      <div className="flex justify-between items-end mb-8 border-b border-surface-200 pb-4">
        <div>
          <h3 className="text-gray-400 text-sm mb-1 uppercase">Total Confidence</h3>
          <div className="text-sm text-gray-500 mt-1">ID: {result.id}</div>
        </div>
        <div className={`text-4xl font-bold ${getScoreColor(result.total_score)}`}>
          {(result.total_score * 100).toFixed(1)}%
        </div>
      </div>

      <div className="space-y-6">
        {metrics.map((m) => (
          <div key={m.label}>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-300">{m.label} (w: {m.weight})</span>
              <span className="text-gray-400">{(m.value * 100).toFixed(1)}%</span>
            </div>
            <div className="w-full h-2 bg-surface-200 rounded-full overflow-hidden">
              <div 
                className={`h-full ${getBarColor(m.value)} opacity-80`}
                style={{ width: `${Math.max(0, m.value * 100)}%` }}
              />
            </div>
          </div>
        ))}

        <div className="pt-4 border-t border-surface-200">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-gray-300">Hazard Penalty</span>
            <span className="text-accent-red">{(result.hazard_penalty * 100).toFixed(1)}%</span>
          </div>
          <p className="text-xs text-gray-500 mt-4 leading-relaxed">
            * Final score is sum of weighted contributions minus hazard penalty. Confirmed status requires score &gt; 0.75.
          </p>
        </div>
      </div>
    </div>
  );
}
