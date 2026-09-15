import { motion, AnimatePresence } from 'framer-motion';
import { useMissionStore } from '../stores/mission-store';
import { Loader2 } from 'lucide-react';

export function LiveFeed() {
  const { mission, stageProgress, stagePayloads } = useMissionStore();
  const stage = mission?.current_stage;
  
  const renderFeedContent = () => {
    if (!stage || stage === 'init') {
      return (
        <div className="flex flex-col items-center text-gray-500 space-y-4">
          <div className="w-16 h-16 border-2 border-dashed border-gray-700 rounded-full flex items-center justify-center">
            <span className="text-xs">IDLE</span>
          </div>
          <p>Ready to initialize mission</p>
        </div>
      );
    }

    const payload = stagePayloads[stage];
    const progress = stageProgress[stage] || 0;

    switch (stage) {
      case 'scan':
        return (
          <div className="flex flex-col items-center space-y-6">
            <div className="relative w-32 h-32 flex items-center justify-center">
              <svg className="absolute inset-0 w-full h-full transform -rotate-90">
                <circle cx="64" cy="64" r="60" className="stroke-surface-200" strokeWidth="8" fill="none" />
                <circle 
                  cx="64" cy="64" r="60" 
                  className="stroke-accent-blue transition-all duration-500 ease-out" 
                  strokeWidth="8" fill="none" 
                  strokeDasharray="377" 
                  strokeDashoffset={377 - (377 * progress)} 
                />
              </svg>
              <div className="text-center font-mono">
                <div className="text-2xl text-accent-blue">{Math.round(progress * 100)}%</div>
              </div>
            </div>
            <div className="font-mono text-center">
              <p className="text-gray-300">Capturing aerial frames...</p>
              {payload?.frame_count && (
                <p className="text-sm text-gray-500 mt-2">Frames: {payload.frame_count} / {payload.total_frames || '?'}</p>
              )}
            </div>
          </div>
        );
      case 'reconstruct':
        return (
          <div className="flex flex-col items-center space-y-6">
            <Loader2 className="w-16 h-16 text-accent-blue animate-spin" />
            <div className="font-mono text-center">
              <p className="text-gray-300">Building 3D point cloud...</p>
              {payload?.points_processed && (
                <p className="text-sm text-gray-500 mt-2">Points: {payload.points_processed.toLocaleString()}</p>
              )}
            </div>
          </div>
        );
      case 'detect':
        return (
          <div className="flex flex-col items-center space-y-6">
            <div className="relative w-full max-w-md h-24 bg-surface-100 rounded overflow-hidden border border-surface-200">
              <motion.div 
                className="absolute top-0 bottom-0 w-1 bg-accent-amber"
                animate={{ left: ['0%', '100%', '0%'] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                style={{ boxShadow: '0 0 10px 2px rgba(245, 158, 11, 0.5)' }}
              />
            </div>
            <div className="font-mono text-center">
              <p className="text-gray-300">Thermal sweep + UWB radar processing</p>
              {payload?.detections_found !== undefined && (
                <p className="text-sm text-accent-amber mt-2">Candidates found: {payload.detections_found}</p>
              )}
            </div>
          </div>
        );
      case 'fuse':
        return (
          <div className="flex flex-col items-center space-y-6">
            <div className="flex space-x-4">
              {['Thermal', 'Radar', 'Visual'].map((modality, i) => (
                <motion.div 
                  key={modality}
                  className="w-16 h-16 bg-surface-200 rounded flex items-center justify-center font-mono text-xs border border-surface-100"
                  animate={{ borderColor: ['#1a1a24', '#3b82f6', '#1a1a24'] }}
                  transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.3 }}
                >
                  {modality}
                </motion.div>
              ))}
            </div>
            <div className="font-mono text-center">
              <p className="text-gray-300">Computing fusion scores...</p>
            </div>
          </div>
        );
      default:
        return (
          <div className="flex flex-col items-center space-y-4">
            <Loader2 className="w-8 h-8 text-accent-blue animate-spin" />
            <p className="font-mono text-gray-300 uppercase tracking-wider">{stage} IN PROGRESS...</p>
          </div>
        );
    }
  };

  return (
    <div className="bg-surface-50 border border-surface-100 rounded-lg p-8 h-64 flex items-center justify-center relative overflow-hidden">
      <AnimatePresence mode="wait">
        <motion.div
          key={stage || 'idle'}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
          className="w-full flex justify-center"
        >
          {renderFeedContent()}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
