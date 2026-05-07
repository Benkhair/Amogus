'use client';

import { useState, useEffect, useRef } from 'react';
import { useGame } from '@/context/GameContext';
import dynamic from 'next/dynamic';
import TurnOverlay from './TurnOverlay';
import LeaveButton from './LeaveButton';

const GameWorld = dynamic(() => import('./3d/GameWorld'), { ssr: false });
const SpectatorOverlay = dynamic(() => import('./SpectatorOverlay'), { ssr: false });

export default function GameScreen() {
  const { room, myPlayer, players, gameState, currentSpeaker, isHost, sessionId } = useGame();
  const [advancing, setAdvancing] = useState(false);
  const advancingRef = useRef(false);
  const hostWatchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const advanceTurn = async (skip: boolean = false) => {
    if (!room || advancingRef.current) return;
    advancingRef.current = true;
    setAdvancing(true);
    try {
      // Only wait 3s on normal advance (clue submitted), skip immediately on timeout
      if (!skip) {
        await new Promise((resolve) => setTimeout(resolve, 3000));
      }
      
      await fetch('/api/game/next-turn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId: room.id, sessionId, skip }),
      });
    } finally {
      advancingRef.current = false;
      setAdvancing(false);
    }
  };

  // Host watchdog: if the current speaker is disconnected OR the timer has expired,
  // the host auto-advances so the game never gets stuck.
  useEffect(() => {
    if (!isHost || !gameState?.timer_end || gameState?.current_phase !== 'speaking') return;

    if (hostWatchdogRef.current) clearTimeout(hostWatchdogRef.current);

    const timerEndMs = new Date(gameState.timer_end).getTime();
    const speakerIsConnected = currentSpeaker?.is_connected ?? true;

    // If speaker already disconnected, advance after a short grace period
    if (!speakerIsConnected && !advancingRef.current) {
      hostWatchdogRef.current = setTimeout(() => {
        if (!advancingRef.current) advanceTurn(true);
      }, 1500);
      return;
    }

    // Otherwise wait until timer_end + 2s grace then force-advance
    const delay = timerEndMs - Date.now() + 2000;
    if (delay > 0) {
      hostWatchdogRef.current = setTimeout(() => {
        if (!advancingRef.current) advanceTurn(true);
      }, delay);
    } else if (!advancingRef.current) {
      // Already past the deadline
      advanceTurn(true);
    }

    return () => {
      if (hostWatchdogRef.current) clearTimeout(hostWatchdogRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState?.current_turn_index, gameState?.timer_end, gameState?.current_phase, currentSpeaker?.is_connected, isHost]);

  const activePlayers = players.filter((p) => p.is_connected);
  const isEliminated = myPlayer?.is_eliminated ?? false;

  return (
    <div className="relative w-full h-screen bg-gray-950 overflow-hidden">
      {/* 3D World - still visible to spectators */}
      <GameWorld
        players={activePlayers}
        currentSpeaker={currentSpeaker}
        myPlayerId={myPlayer?.id ?? ''}
        phase={gameState?.current_phase ?? 'speaking'}
      />

      {/* HUD overlay - only for alive players */}
      {!isEliminated && <TurnOverlay onAdvance={advanceTurn} advancing={advancing} />}

      {/* Spectator Overlay - only for eliminated players */}
      {isEliminated && <SpectatorOverlay />}

      {/* Leave button — top right */}
      <div className="absolute top-4 right-4 z-50">
        <LeaveButton />
      </div>
    </div>
  );
}
