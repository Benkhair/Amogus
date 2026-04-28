'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useGame } from '@/context/GameContext';
import { LogOut, X, AlertTriangle, Loader2 } from 'lucide-react';

interface LeaveButtonProps {
  className?: string;
}

export default function LeaveButton({ className = '' }: LeaveButtonProps) {
  const router = useRouter();
  const { myPlayer, room, sessionId, setRoom, setMyPlayer, setPlayers, setGameState } = useGame();
  const [confirming, setConfirming] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const handleLeave = async () => {
    if (!myPlayer || !room) {
      router.push('/');
      return;
    }
    setLeaving(true);
    try {
      await fetch('/api/room/leave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId: myPlayer.id, sessionId, roomId: room.id }),
      });
    } finally {
      setRoom(null);
      setMyPlayer(null);
      setPlayers([]);
      setGameState(null);
      router.push('/');
    }
  };

  if (confirming) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <div className="flex items-center gap-2 bg-red-950/90 border border-red-700/70 rounded-xl px-3 py-2 backdrop-blur-sm">
          <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
          <span className="text-red-300 text-xs font-medium">Leave game?</span>
          <button
            onClick={handleLeave}
            disabled={leaving}
            className="ml-1 px-3 py-1 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition-colors disabled:opacity-50 flex items-center gap-1"
          >
            {leaving ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Yes, Leave'}
          </button>
          <button
            onClick={() => setConfirming(false)}
            disabled={leaving}
            className="p-1 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
          >
            <X className="w-3 h-3 text-gray-300" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className={`flex items-center gap-2 bg-black/60 hover:bg-red-950/80 border border-white/10 hover:border-red-700/60 rounded-xl px-3 py-2 text-gray-400 hover:text-red-400 text-xs font-semibold transition-all backdrop-blur-sm ${className}`}
    >
      <LogOut className="w-4 h-4" />
      Leave
    </button>
  );
}
