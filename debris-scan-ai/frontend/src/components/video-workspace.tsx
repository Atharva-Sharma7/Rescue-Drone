'use client';

import {
  useRef,
  useEffect,
  useCallback,
  useState,
} from 'react';
import { useMissionStore } from '@/stores/mission-store';
import { RgbDetection, ScanPayload } from '@/lib/types';

type PlayState = 'idle' | 'playing' | 'paused' | 'ended' | 'error' | 'loading';

function fmt(s: number): string {
  if (isNaN(s) || !isFinite(s)) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

/**
 * Coordinate transform: map source-frame bbox → canvas pixels.
 *
 * The video uses object-fit: contain, so it may be letterboxed inside the container.
 * We must find the actual rendered rectangle of the video, not just the container size.
 *
 * Returns null if video dimensions are not yet known.
 */
function mapBbox(
  x1: number, y1: number, x2: number, y2: number,
  videoNativeW: number, videoNativeH: number,
  canvasW: number, canvasH: number,
): { cx1: number; cy1: number; cw: number; ch: number } {
  // Canvas is already sized to the actual rendered video rectangle (set in resizeCanvas)
  // so we just scale from native video coords to canvas coords.
  const scaleX = canvasW / videoNativeW;
  const scaleY = canvasH / videoNativeH;
  return {
    cx1: x1 * scaleX,
    cy1: y1 * scaleY,
    cw: (x2 - x1) * scaleX,
    ch: (y2 - y1) * scaleY,
  };
}

export function VideoWorkspace() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animFrameRef = useRef<number | null>(null);

  const [playState, setPlayState] = useState<PlayState>('loading');
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(true);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [videoNativeW, setVideoNativeW] = useState(1280);
  const [videoNativeH, setVideoNativeH] = useState(720);

  const { mission, stagePayloads, stageStatuses, rgbDetections, health } = useMissionStore();
  const currentStage = mission?.current_stage;

  const scanPayload = stagePayloads['scan'] as ScanPayload | undefined;
  const modelName = scanPayload?.model_name ?? health?.models?.vision?.name ?? '—';
  const modelDevice = scanPayload?.model_device ?? health?.models?.vision?.device ?? '—';
  const modelStatus = scanPayload?.model_status ?? (
    health?.models?.vision?.available ? 'READY' : 'RGB MODEL OFFLINE'
  );
  const framesCapt = scanPayload?.frames_captured ?? 0;
  const inferFrames = scanPayload?.inference_frames ?? 0;
  const totalDets = scanPayload?.total_detections ?? rgbDetections.length;
  const avgInfMs = scanPayload?.avg_inference_ms ?? 0;
  const videoFps = scanPayload?.video_fps ?? 0;

  const isInferring = currentStage === 'scan' && stageStatuses['scan'] !== 'complete';

  // ── Resize canvas to match actual rendered video rect ──
  const resizeCanvas = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!video || !canvas || !container) return;

    const cRect = container.getBoundingClientRect();
    const vw = video.videoWidth || videoNativeW;
    const vh = video.videoHeight || videoNativeH;
    const aspect = vw / vh;

    const containerW = cRect.width;
    const containerH = cRect.height;

    // Compute the actual rendered video area (object-fit: contain letterboxing)
    let drawW = containerW;
    let drawH = containerW / aspect;
    if (drawH > containerH) {
      drawH = containerH;
      drawW = containerH * aspect;
    }

    const drawW_i = Math.round(drawW);
    const drawH_i = Math.round(drawH);

    // canvas internal resolution = rendered video pixels
    canvas.width = drawW_i;
    canvas.height = drawH_i;
    canvas.style.width = `${drawW_i}px`;
    canvas.style.height = `${drawH_i}px`;
    // Center canvas over the letterboxed video
    canvas.style.left = `${Math.round((containerW - drawW) / 2)}px`;
    canvas.style.top = `${Math.round((containerH - drawH) / 2)}px`;
  }, [videoNativeW, videoNativeH]);

  // ── Draw detection overlays each rAF ──
  const drawDetections = useCallback(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) {
      animFrameRef.current = requestAnimationFrame(drawDetections);
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      animFrameRef.current = requestAnimationFrame(drawDetections);
      return;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const now = video.currentTime;
    const nativeW = video.videoWidth || videoNativeW;
    const nativeH = video.videoHeight || videoNativeH;

    // Show detections within ±0.5s of current video time
    const visible = rgbDetections.filter(
      (d) => Math.abs(d.timestamp_s - now) < 0.5
    );

    for (const det of visible) {
      const mapped = mapBbox(
        det.bbox.x1, det.bbox.y1, det.bbox.x2, det.bbox.y2,
        nativeW, nativeH,
        canvas.width, canvas.height,
      );

      const conf = det.confidence;
      const color =
        conf > 0.7 ? '#10b981' : conf > 0.4 ? '#f59e0b' : '#ef4444';

      // Bounding box
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(mapped.cx1, mapped.cy1, mapped.cw, mapped.ch);

      // Label
      const label = `${det.class_name}  ${(conf * 100).toFixed(0)}%`;
      ctx.font = '600 10px "IBM Plex Mono", monospace';
      const tw = ctx.measureText(label).width;
      ctx.fillStyle = color + 'dd';
      ctx.fillRect(mapped.cx1, mapped.cy1 - 17, tw + 8, 17);
      ctx.fillStyle = '#fff';
      ctx.fillText(label, mapped.cx1 + 4, mapped.cy1 - 4);
    }

    animFrameRef.current = requestAnimationFrame(drawDetections);
  }, [rgbDetections, videoNativeW, videoNativeH]);

  useEffect(() => {
    animFrameRef.current = requestAnimationFrame(drawDetections);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [drawDetections]);

  // ResizeObserver
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const ro = new ResizeObserver(() => resizeCanvas());
    ro.observe(container);
    return () => ro.disconnect();
  }, [resizeCanvas]);

  // Video event handlers
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onMeta = () => {
      setVideoNativeW(video.videoWidth || 1280);
      setVideoNativeH(video.videoHeight || 720);
      setDuration(video.duration);
      setPlayState('idle');
      resizeCanvas();
    };
    const onPlaying = () => setPlayState('playing');
    const onPause = () => setPlayState('paused');
    const onEnded = () => setPlayState('ended');
    const onError = () => setPlayState('error');
    const onWaiting = () => setPlayState('loading');
    const onTimeUpdate = () => { if (!isScrubbing) setCurrentTime(video.currentTime); };

    video.addEventListener('loadedmetadata', onMeta);
    video.addEventListener('playing', onPlaying);
    video.addEventListener('pause', onPause);
    video.addEventListener('ended', onEnded);
    video.addEventListener('error', onError);
    video.addEventListener('waiting', onWaiting);
    video.addEventListener('timeupdate', onTimeUpdate);

    return () => {
      video.removeEventListener('loadedmetadata', onMeta);
      video.removeEventListener('playing', onPlaying);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('ended', onEnded);
      video.removeEventListener('error', onError);
      video.removeEventListener('waiting', onWaiting);
      video.removeEventListener('timeupdate', onTimeUpdate);
    };
  }, [isScrubbing, resizeCanvas]);

  // Auto-play when Stage 1 starts
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (currentStage === 'scan') {
      video.play().catch(() => {});
    }
  }, [currentStage]);

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (playState === 'playing') v.pause();
    else v.play().catch(() => {});
  };

  const handleScrub = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = videoRef.current;
    if (!v || !duration) return;
    const t = (parseFloat(e.target.value) / 100) * duration;
    v.currentTime = t;
    setCurrentTime(t);
  };

  const toggleMute = () => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
  };

  const restart = () => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = 0;
    v.play().catch(() => {});
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  const modelOffline = modelStatus.includes('OFFLINE');
  const modelColor = modelOffline
    ? 'var(--accent-red)'
    : isInferring
    ? 'var(--accent-green)'
    : 'var(--text-tertiary)';

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      width: '100%', height: '100%', minWidth: 0,
      background: 'var(--surface-card)',
      borderRadius: 6, border: '1px solid var(--surface-border)',
      overflow: 'hidden',
    }}>
      {/* ── VIDEO HEADER ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '5px 12px', borderBottom: '1px solid var(--surface-border)',
        flexShrink: 0, gap: 8, flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{
            background: 'var(--accent-amber-dim)', color: 'var(--accent-amber)',
            fontSize: 9, fontFamily: 'var(--font-mono)', letterSpacing: '0.08em',
            padding: '2px 8px', borderRadius: 4, textTransform: 'uppercase',
          }}>
            Simulated RGB Sensor · Recorded Aerial Data
          </span>
          {currentStage && currentStage !== 'init' && (
            <span style={{
              fontSize: 9, fontFamily: 'var(--font-mono)',
              color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em',
            }}>
              Stage {currentStage.toUpperCase()}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {playState === 'error' && (
            <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--accent-red)' }}>
              VIDEO SOURCE UNAVAILABLE
            </span>
          )}
          {playState === 'playing' && (
            <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--accent-green)' }}>
              ● PLAYING
            </span>
          )}
        </div>
      </div>

      {/* ── VIDEO AREA ── */}
      <div ref={containerRef} style={{
        flex: 1, position: 'relative', background: '#000',
        overflow: 'hidden', minHeight: 0,
      }}>
        <video
          ref={videoRef}
          src="/assets/aerial-survey.mp4"
          muted={muted}
          playsInline
          preload="metadata"
          style={{
            position: 'absolute', inset: 0,
            width: '100%', height: '100%', objectFit: 'contain',
          }}
        />

        {/* Detection canvas — sized to actual video rect */}
        <canvas ref={canvasRef} style={{ position: 'absolute', pointerEvents: 'none' }} />

        {/* Pre-mission / model-offline overlay */}
        {(!currentStage || currentStage === 'init') && (
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.7)', gap: 10,
          }}>
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <circle cx="16" cy="16" r="15" stroke="var(--text-tertiary)" strokeWidth="1" />
              <path d="M12 10l12 6-12 6V10z" fill="var(--text-tertiary)" />
            </svg>
            <p style={{
              fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)',
              textTransform: 'uppercase', letterSpacing: '0.15em',
            }}>
              Ready for Mission
            </p>
            {health?.models?.vision && (
              <p style={{
                fontSize: 9, fontFamily: 'var(--font-mono)',
                color: health.models.vision.available ? 'var(--accent-green)' : 'var(--accent-red)',
              }}>
                {health.models.vision.available
                  ? `RGB Model Ready · ${health.models.vision.name}`
                  : `RGB Model Offline — ${health.models.vision.error ?? 'unavailable'}`}
              </p>
            )}
          </div>
        )}

        {/* Autoplay blocked overlay */}
        {(playState === 'idle' || playState === 'paused' || playState === 'ended') &&
          currentStage === 'scan' && (
            <button onClick={togglePlay} style={{
              position: 'absolute', inset: 0, display: 'flex',
              flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(0,0,0,0.5)', border: 'none', cursor: 'pointer', gap: 8,
            }}>
              <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
                <circle cx="22" cy="22" r="21" stroke="var(--accent-blue)" strokeWidth="1.5" />
                <polygon points="17,13 35,22 17,31" fill="var(--accent-blue)" />
              </svg>
              <span style={{
                fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--accent-blue)',
                textTransform: 'uppercase', letterSpacing: '0.1em',
              }}>
                {playState === 'ended' ? 'Replay Sensor Stream' : 'Click to Start Sensor Stream'}
              </span>
            </button>
          )}

        {/* No detections badge when stage complete */}
        {stageStatuses['scan'] === 'complete' && rgbDetections.length === 0 && (
          <div style={{
            position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)',
            background: 'rgba(0,0,0,0.7)', border: '1px solid var(--surface-border)',
            borderRadius: 4, padding: '4px 12px',
          }}>
            <span style={{
              fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)',
              textTransform: 'uppercase', letterSpacing: '0.1em',
            }}>
              NO TARGETS DETECTED IN RGB
            </span>
          </div>
        )}
      </div>

      {/* ── VIDEO FOOTER ── */}
      <div style={{
        borderTop: '1px solid var(--surface-border)',
        padding: '5px 12px', flexShrink: 0,
        display: 'flex', flexDirection: 'column', gap: 5,
      }}>
        {/* Scrub bar */}
        <input
          type="range" min={0} max={100} step={0.1} value={progress}
          onMouseDown={() => setIsScrubbing(true)}
          onMouseUp={() => setIsScrubbing(false)}
          onChange={handleScrub}
          style={{ width: '100%', height: 3, cursor: 'pointer', accentColor: 'var(--accent-blue)' }}
        />

        {/* Playback controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={togglePlay} style={btnStyle}>
            {playState === 'playing' ? '⏸ Pause' : '▶ Play'}
          </button>
          <button onClick={restart} style={btnStyle}>↺ Restart</button>
          <button onClick={toggleMute} style={btnStyle}>{muted ? '🔇' : '🔊'}</button>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-secondary)', marginLeft: 'auto' }}>
            {fmt(currentTime)} / {fmt(duration)}
          </span>
        </div>

        {/* RGB Inference provenance row */}
        <div style={{
          display: 'flex', gap: 14, flexWrap: 'wrap',
          paddingTop: 4, borderTop: '1px solid var(--surface-border)',
        }}>
          {[
            { label: 'RGB Source', value: 'Simulated Sensor · Recorded Aerial Data', color: 'var(--accent-amber)' },
            { label: 'Model', value: modelName },
            { label: 'Device', value: modelDevice.toUpperCase() },
            {
              label: 'Status',
              value: isInferring ? 'REAL INFERENCE' : modelStatus,
              color: modelColor,
            },
            { label: 'Inference', value: avgInfMs > 0 ? `${avgInfMs.toFixed(1)} ms` : '—' },
            { label: 'Frames', value: framesCapt > 0 ? `${inferFrames}/${framesCapt}` : '—' },
            {
              label: 'Detections',
              value: stageStatuses['scan'] !== undefined ? String(totalDets) : '—',
              color: totalDets > 0 ? 'var(--accent-green)' : undefined,
            },
            { label: 'Tracker', value: 'DETECTION ONLY' },
          ].map((item) => (
            <div key={item.label} style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <span style={{
                fontSize: 8, fontFamily: 'var(--font-mono)',
                color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.07em',
              }}>
                {item.label}
              </span>
              <span style={{
                fontSize: 10, fontFamily: 'var(--font-mono)',
                color: item.color ?? 'var(--text-mono)',
              }}>
                {item.value}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  background: 'none',
  border: '1px solid var(--surface-border)',
  borderRadius: 4, padding: '3px 8px',
  cursor: 'pointer', color: 'var(--text-secondary)',
  fontSize: 10, fontFamily: 'var(--font-mono)', minHeight: 24,
};
