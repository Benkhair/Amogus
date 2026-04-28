'use client';

import { useEffect } from 'react';

export function useHeartbeat(playerId: string | undefined, sessionId: string, intervalMs = 10000) {
  useEffect(() => {
    if (!playerId || !sessionId) return;

    const send = (connected: boolean) =>
      fetch('/api/room/heartbeat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId, sessionId, connected }),
        keepalive: true,
      }).catch(() => {});

    send(true);
    const id = setInterval(() => send(true), intervalMs);

    const handleUnload = () => send(false);
    window.addEventListener('beforeunload', handleUnload);

    return () => {
      clearInterval(id);
      window.removeEventListener('beforeunload', handleUnload);
      send(false);
    };
  }, [playerId, sessionId, intervalMs]);
}
