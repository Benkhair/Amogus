'use client';

import { useState } from 'react';
import { useGame } from '@/context/GameContext';
import dynamic from 'next/dynamic';
import TurnOverlay from './TurnOverlay';
import LeaveButton from './LeaveButton';

const GameWorld = dynamic(() => import('./3d/GameWorld'), { ssr: false });

export default function GameScreen() {
  const { room, myPlayer, players, gameState, currentSpeaker, sessionId } = useGame();
  const [advancing, setAdvancing] = useState(false);

  const advanceTurn = async (skip: boolean = false) => {
    if (!room) return;
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
      setAdvancing(false);
    }
  };

  const activePlayers = players.filter((p) => p.is_connected);

  return (
    <div className="relative w-full h-screen bg-gray-950 overflow-hidden">
      {/* 3D World */}
      <GameWorld
        players={activePlayers}
        currentSpeaker={currentSpeaker}
        myPlayerId={myPlayer?.id ?? ''}
        phase={gameState?.current_phase ?? 'speaking'}
      />

      {/* HUD overlay */}
      <TurnOverlay onAdvance={advanceTurn} advancing={advancing} />

      {/* Leave button — top right */}
      <div className="absolute top-4 right-4 z-50">
        <LeaveButton />
      </div>
    </div>
  );
}
