'use client';

import { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';

function PointCloudMesh({
  pointCloudB64,
  colorB64,
}: {
  pointCloudB64: string;
  colorB64: string | null;
}) {
  const meshRef = useRef<THREE.Points>(null);

  const geometry = new THREE.BufferGeometry();

  // Fix: use atob() instead of Buffer (browser-safe)
  const decodedPositions = (() => {
    try {
      const bin = atob(pointCloudB64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return new Float32Array(bytes.buffer);
    } catch { return null; }
  })();

  const decodedColors = (() => {
    if (!colorB64) return null;
    try {
      const bin = atob(colorB64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const uint8 = new Uint8Array(bytes.buffer);
      // Convert uint8 RGB to float32 [0,1]
      const floats = new Float32Array(uint8.length);
      for (let i = 0; i < uint8.length; i++) floats[i] = uint8[i] / 255;
      return floats;
    } catch { return null; }
  })();

  if (decodedPositions) {
    geometry.setAttribute('position', new THREE.BufferAttribute(decodedPositions, 3));
  }
  if (decodedColors) {
    geometry.setAttribute('color', new THREE.BufferAttribute(decodedColors, 3));
  }

  geometry.computeBoundingBox();
  geometry.center();

  const material = new THREE.PointsMaterial({
    size: 0.15,
    vertexColors: !!decodedColors,
    color: decodedColors ? undefined : new THREE.Color('#3b82f6'),
    sizeAttenuation: true,
  });

  return <primitive object={new THREE.Points(geometry, material)} ref={meshRef} />;
}

function Scene({
  pointCloudB64,
  colorB64,
}: {
  pointCloudB64: string;
  colorB64: string | null;
}) {
  return (
    <>
      <ambientLight intensity={0.4} />
      <PointCloudMesh pointCloudB64={pointCloudB64} colorB64={colorB64} />
      <OrbitControls
        enableDamping
        dampingFactor={0.05}
        rotateSpeed={0.5}
        zoomSpeed={0.8}
      />
    </>
  );
}

export function PointCloudViewer({
  pointCloudB64,
  colorB64,
}: {
  pointCloudB64: string | null;
  colorB64?: string | null;
}) {
  if (!pointCloudB64) {
    return (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--surface-card)',
        }}
      >
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>
          Awaiting Point Cloud Data
        </p>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', background: '#050507' }}>
      <Canvas
        camera={{ position: [50, 50, 80], fov: 60 }}
        style={{ width: '100%', height: '100%' }}
        gl={{ antialias: true }}
      >
        <Scene pointCloudB64={pointCloudB64} colorB64={colorB64 ?? null} />
      </Canvas>
      {/* Corner label */}
      <div
        style={{
          position: 'absolute',
          bottom: 8,
          left: 8,
          fontSize: 9,
          fontFamily: 'var(--font-mono)',
          color: 'rgba(255,255,255,0.3)',
          pointerEvents: 'none',
        }}
      >
        Reconstructed Point Cloud · Orbit: drag · Zoom: scroll
      </div>
    </div>
  );
}
