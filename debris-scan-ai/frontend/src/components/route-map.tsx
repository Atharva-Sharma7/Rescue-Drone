import { useEffect, useRef } from 'react';
import { RouteResult, Waypoint } from '../lib/types';

interface RouteMapProps {
  hazardGridB64?: string;
  gridSize?: number;
  routes?: RouteResult[];
  confirmedSurvivors?: { id: string; x: number; y: number }[];
}

export function RouteMap({ hazardGridB64, gridSize, routes, confirmedSurvivors }: RouteMapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !hazardGridB64 || !gridSize) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Decode hazard grid
    let grid: Float32Array;
    try {
      const buffer = Buffer.from(hazardGridB64, 'base64');
      grid = new Float32Array(buffer.buffer, buffer.byteOffset, buffer.byteLength / 4);
    } catch (e) {
      console.error('Failed to decode hazard grid', e);
      return;
    }

    // Set up canvas dimensions
    const width = canvas.width;
    const height = canvas.height;
    const cellW = width / gridSize;
    const cellH = height / gridSize;

    // Draw hazard grid
    ctx.clearRect(0, 0, width, height);
    for (let i = 0; i < grid.length; i++) {
      const x = i % gridSize;
      const y = Math.floor(i / gridSize);
      const hazard = grid[i];
      
      // Color map: 0 = dark green, 1 = bright red
      const r = Math.floor(hazard * 239);
      const g = Math.floor((1 - hazard) * 185);
      const b = Math.floor((1 - hazard) * 129);
      
      ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
      ctx.globalAlpha = 0.3 + (hazard * 0.5);
      ctx.fillRect(x * cellW, y * cellH, cellW, cellH);
    }
    ctx.globalAlpha = 1.0;

    // Coordinate mapping helper
    const mapCoord = (val: number, max: number, canvasMax: number) => {
      // Assuming coordinates are roughly 0 to max, map to canvas
      return (val / max) * canvasMax;
    };

    // Draw routes
    if (routes) {
      routes.forEach(route => {
        if (!route.waypoints || route.waypoints.length === 0) return;
        
        ctx.beginPath();
        const start = route.waypoints[0];
        // Note: Map coordinates based on actual domain bounds. 
        // Here we assume bounds are roughly 0-100 for visualization.
        ctx.moveTo(mapCoord(start.x, 100, width), mapCoord(start.y, 100, height));
        
        for (let i = 1; i < route.waypoints.length; i++) {
          const wp = route.waypoints[i];
          ctx.lineTo(mapCoord(wp.x, 100, width), mapCoord(wp.y, 100, height));
        }

        ctx.strokeStyle = route.mode === 'safest' ? '#10b981' : '#f59e0b';
        ctx.lineWidth = 3;
        ctx.setLineDash(route.mode === 'safest' ? [] : [5, 5]);
        ctx.stroke();
      });
    }

    // Draw survivors
    if (confirmedSurvivors) {
      confirmedSurvivors.forEach(survivor => {
        const cx = mapCoord(survivor.x, 100, width);
        const cy = mapCoord(survivor.y, 100, height);
        
        ctx.beginPath();
        ctx.arc(cx, cy, 6, 0, Math.PI * 2);
        ctx.fillStyle = '#ef4444';
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();
      });
    }

  }, [hazardGridB64, gridSize, routes, confirmedSurvivors]);

  if (!hazardGridB64) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-surface-50 border border-surface-100 rounded-lg text-gray-500 font-mono">
        WAITING FOR HAZARD MAP...
      </div>
    );
  }

  return (
    <div className="relative w-full aspect-square bg-surface-100 rounded-lg overflow-hidden border border-surface-200">
      <canvas 
        ref={canvasRef} 
        width={800} 
        height={800} 
        className="w-full h-full object-contain bg-surface"
      />
      
      <div className="absolute top-4 right-4 bg-surface-50/90 p-3 rounded border border-surface-200 font-mono text-xs space-y-2 backdrop-blur-sm">
        <div className="flex items-center space-x-2">
          <div className="w-4 h-0.5 bg-accent-green" />
          <span>Safest Route</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-4 h-0.5 border-t-2 border-dashed border-accent-amber" />
          <span>Fastest Route</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 rounded-full bg-accent-red border border-white" />
          <span>Target</span>
        </div>
      </div>
    </div>
  );
}
