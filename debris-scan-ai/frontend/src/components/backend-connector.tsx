import { useState, useEffect } from 'react';
import { useMissionStore } from '../stores/mission-store';
import * as api from '../lib/api';

export function BackendConnector() {
  const {
    backendUrl,
    setBackendUrl,
    isConnected,
    setIsConnected,
    setHealth,
    setError,
  } = useMissionStore();

  const [urlInput, setUrlInput] = useState(backendUrl);
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('backendUrl');

    if (saved) {
      setUrlInput(saved);
      setBackendUrl(saved);
    }
  }, [setBackendUrl]);

  const handleConnect = async () => {
    const url = urlInput.trim();

    if (!url) {
      setIsConnected(false);
      setError('Backend URL cannot be empty');
      return;
    }

    setConnecting(true);
    setIsConnected(false);
    setError(null);

    try {
      // Save the URL so it persists after refresh.
      localStorage.setItem('backendUrl', url);
      setBackendUrl(url);

      // Check the actual FastAPI backend.
      const health = await api.getHealth(url);

      // Backend must return the expected healthy status.
      if (health?.status !== 'healthy') {
        throw new Error('Backend responded, but health status is not healthy');
      }

      // Store the backend health information.
      setHealth(health);

      // Mark the frontend data link as connected.
      setIsConnected(true);
    } catch (e: any) {
      console.error('Backend connection failed:', e);

      setIsConnected(false);
      setError(e?.message || 'Unable to connect to backend');
    } finally {
      setConnecting(false);
    }
  };

  return (
    <div className="flex items-center space-x-4 p-4 bg-surface-50 border border-surface-100 rounded-lg font-mono text-sm">
      {/* Connection status */}
      <div className="flex items-center space-x-2">
        <div
          className={`w-3 h-3 rounded-full ${
            isConnected
              ? 'bg-accent-green shadow-[0_0_8px_rgba(16,185,129,0.5)]'
              : 'bg-accent-red'
          }`}
        />

        <span className="text-gray-400">
          {isConnected ? 'CONNECTED' : 'DISCONNECTED'}
        </span>
      </div>

      {/* Backend URL */}
      <input
        type="text"
        value={urlInput}
        onChange={(e) => setUrlInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !connecting) {
            handleConnect();
          }
        }}
        className="bg-surface-200 border border-surface-100 rounded px-3 py-1.5 text-gray-200 focus:outline-none focus:border-accent-blue min-w-[250px]"
        placeholder="localhost:8000"
        disabled={connecting}
      />

      {/* Connect button */}
      <button
        onClick={handleConnect}
        disabled={connecting}
        className="px-4 py-1.5 bg-surface-200 hover:bg-surface-100 border border-surface-100 rounded text-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {connecting ? 'CONNECTING...' : 'CONNECT'}
      </button>
    </div>
  );
}