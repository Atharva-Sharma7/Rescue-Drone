import { useEffect, useRef } from 'react';
import { useMissionStore } from '../stores/mission-store';
import { StageEvent } from '../lib/types';
import * as api from '../lib/api';

export function useMissionWs() {
  const ws = useRef<WebSocket | null>(null);
  const reconnectTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const keepaliveInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  const { backendUrl, missionId, handleStageEvent, handleSnapshot, setIsConnected } =
    useMissionStore();

  useEffect(() => {
    if (!missionId || !backendUrl) return;

    let attempt = 0;
    let cancelled = false;

    const connect = async () => {
      if (cancelled) return;

      // Fetch snapshot first so refresh reconnects show correct state
      try {
        const snap = await api.getMission(backendUrl, missionId);
        handleSnapshot(snap);
      } catch {
        // Non-fatal — WS will carry state
      }

      const wsUrl = backendUrl.startsWith('http')
        ? backendUrl.replace(/^http/, 'ws')
        : `ws://${backendUrl}`;
      const url = `${wsUrl}/missions/${missionId}/events`;

      try {
        ws.current = new WebSocket(url);

        ws.current.onopen = () => {
          if (cancelled) { ws.current?.close(); return; }
          setIsConnected(true);
          attempt = 0;
          keepaliveInterval.current = setInterval(() => {
            if (ws.current?.readyState === WebSocket.OPEN) {
              ws.current.send(JSON.stringify({ type: 'ping' }));
            }
          }, 25000);
        };

        ws.current.onmessage = (event) => {
          try {
            if (event.data === 'pong') return;
            const data = JSON.parse(event.data);
            if (data.type === 'snapshot' && data.data) {
              handleSnapshot(data.data);
            } else if (data.type === 'pong') {
              // keepalive response, ignore
            } else {
              handleStageEvent(data as StageEvent);
            }
          } catch (e) {
            console.error('Failed to parse WS message', e);
          }
        };

        ws.current.onclose = () => {
          setIsConnected(false);
          if (keepaliveInterval.current) clearInterval(keepaliveInterval.current);
          if (!cancelled) {
            const delay = Math.min(1000 * Math.pow(2, attempt), 30000);
            attempt++;
            reconnectTimeout.current = setTimeout(connect, delay);
          }
        };

        ws.current.onerror = () => {};
      } catch (e) {
        console.error('WS connect error', e);
      }
    };

    connect();

    return () => {
      cancelled = true;
      ws.current?.close();
      if (reconnectTimeout.current) clearTimeout(reconnectTimeout.current);
      if (keepaliveInterval.current) clearInterval(keepaliveInterval.current);
    };
  }, [backendUrl, missionId]);
}
