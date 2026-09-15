import { useMissionStore } from '../stores/mission-store';
import { STAGE_ORDER, STAGE_LABELS, StageId } from '../lib/types';
import { Check, X, Loader2 } from 'lucide-react';
import Link from 'next/link';

export function StageStepper() {
  const { stageStatuses, stageProgress } = useMissionStore();

  const getStagePath = (stageId: StageId) => {
    switch (stageId) {
      case 'reconstruct': return '/reconstruction';
      case 'detect':
      case 'fuse': return '/detection';
      case 'route':
      case 'hazard': return '/routes';
      case 'report': return '/report';
      default: return '/';
    }
  };

  return (
    <div className="flex flex-col space-y-4 p-4 bg-surface-50 border border-surface-100 rounded-lg h-full overflow-y-auto">
      <h2 className="text-sm font-mono text-gray-400 mb-2 uppercase tracking-wider">Pipeline Status</h2>
      {STAGE_ORDER.map((stageId, index) => {
        const status = stageStatuses[stageId] || 'pending';
        const progress = stageProgress[stageId] || 0;
        
        let statusColor = 'bg-gray-800 border-gray-700 text-gray-500';
        let Icon = null;
        let isPulsing = false;
        let showProgress = false;

        if (status === 'started') {
          statusColor = 'bg-accent-blue/20 border-accent-blue/50 text-accent-blue';
          Icon = <Loader2 className="w-4 h-4 animate-spin" />;
          isPulsing = true;
        } else if (status === 'progress') {
          statusColor = 'bg-accent-blue/20 border-accent-blue/50 text-accent-blue';
          showProgress = true;
        } else if (status === 'complete') {
          statusColor = 'bg-accent-green/20 border-accent-green/50 text-accent-green';
          Icon = <Check className="w-4 h-4" />;
        } else if (status === 'failed') {
          statusColor = 'bg-accent-red/20 border-accent-red/50 text-accent-red';
          Icon = <X className="w-4 h-4" />;
        }

        const content = (
          <div className="flex items-start space-x-3 group cursor-pointer">
            <div className={`flex items-center justify-center w-8 h-8 rounded-full border ${statusColor} ${isPulsing ? 'animate-pulse' : ''} shrink-0 mt-1`}>
              {Icon ? Icon : <span className="text-xs font-mono">{index + 1}</span>}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className={`text-sm font-medium ${status === 'pending' ? 'text-gray-500' : 'text-gray-200'}`}>
                  {STAGE_LABELS[stageId]}
                </span>
                <span className="text-xs font-mono text-gray-500 ml-2">
                  {status.toUpperCase()}
                </span>
              </div>
              {showProgress && (
                <div className="w-full bg-surface-200 rounded-full h-1.5 mt-2">
                  <div 
                    className="bg-accent-blue h-1.5 rounded-full transition-all duration-300 ease-out"
                    style={{ width: `${progress * 100}%` }}
                  />
                </div>
              )}
            </div>
          </div>
        );

        if (status === 'complete' || status === 'progress') {
          return (
            <Link key={stageId} href={getStagePath(stageId)}>
              {content}
            </Link>
          );
        }

        return <div key={stageId}>{content}</div>;
      })}
    </div>
  );
}
