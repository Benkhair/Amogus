'use client';

import { useEffect, use, useState, useRef, Suspense } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useGame } from '@/context/GameContext';
import { supabase } from '@/lib/supabase/client';
import { useHeartbeat } from '@/hooks/useHeartbeat';

// Dynamic imports for code splitting
const LobbyScreen = dynamic(() => import('@/components/LobbyScreen'), { ssr: false });
const GameScreen = dynamic(() => import('@/components/GameScreen'), { ssr: false });
const VotingScreen = dynamic(() => import('@/components/VotingScreen'), { ssr: false });
const ResultsScreen = dynamic(() => import('@/components/ResultsScreen'), { ssr: false });
const RoleSplashScreen = dynamic(() => import('@/components/RoleSplashScreen'), { ssr: false });
const VotingSplashScreen = dynamic(() => import('@/components/VotingSplashScreen'), { ssr: false });
const EliminationRevealScreen = dynamic(() => import('@/components/EliminationRevealScreen'), { ssr: false });

export default function RoomPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const router = useRouter();
  const { room, gameState, myPlayer, setRoom, sessionId } = useGame();

  // null = not yet initialised, string = last known phase
  const prevPhaseRef = useRef<string | null>(null);
  const initialLoadDone = useRef(false);

  const [showRoleSplash, setShowRoleSplash] = useState(false);
  const [showVotingSplash, setShowVotingSplash] = useState(false);
  const [showEliminationReveal, setShowEliminationReveal] = useState(false);
  const [eliminationData, setEliminationData] = useState<{
    eliminatedPlayer: { id: string; name: string; avatar_color: string; is_imposter: boolean } | null;
    isGameOver: boolean;
    imposterWins: boolean;
    shouldContinue: boolean;
  } | null>(null);

  useHeartbeat(myPlayer?.id, sessionId);

  useEffect(() => {
    if (!code || !sessionId) return;

    const load = async () => {
      const { data: roomData } = await supabase
        .from('rooms')
        .select('*')
        .eq('code', code.toUpperCase())
        .single();

      if (!roomData) {
        router.push('/');
        return;
      }
      setRoom(roomData);

      initialLoadDone.current = true;
    };

    load();
  }, [code, sessionId]);

  // Show splash screens only on actual phase transitions, never on initial load
  useEffect(() => {
    if (!initialLoadDone.current) return;
    if (prevPhaseRef.current === null && gameState?.current_phase) {
      prevPhaseRef.current = gameState.current_phase;
      return;
    }
    const prev = prevPhaseRef.current;
    const curr = gameState?.current_phase ?? null;

    if (curr && prev !== curr) {
      if (prev === 'lobby' && curr === 'speaking') {
        setShowRoleSplash(true);
      }
      if (prev === 'speaking' && curr === 'voting') {
        setShowVotingSplash(true);
      }
      // Note: elimination_reveal is handled via eliminationData state, not phase transition
      prevPhaseRef.current = curr;
    }
  }, [gameState?.current_phase]);

  // Handle elimination reveal completion
  const handleEliminationContinue = async () => {
    if (!eliminationData || !room) return;

    setShowEliminationReveal(false);

    if (eliminationData.isGameOver) {
      // Host ends the game and transitions to results
      if (room.host_id === sessionId) {
        try {
          await fetch('/api/game/end-game', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              roomId: room.id,
              sessionId,
              imposterWins: eliminationData.imposterWins,
            }),
          });
        } catch (err) {
          console.error('Failed to end game:', err);
        }
      }
      return;
    }

    if (eliminationData.shouldContinue && gameState?.current_phase !== 'results') {
      // Host starts next round
      if (room.host_id === sessionId) {
        try {
          await fetch('/api/game/next-round', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ roomId: room.id, sessionId }),
          });
        } catch (err) {
          console.error('Failed to start next round:', err);
        }
      }
    }
  };

  if (!room || !gameState) {
    return <ScreenLoader label="Loading room..." />;
  }

  const phase = gameState.current_phase;

  if (showRoleSplash) return <Suspense fallback={<ScreenLoader />}><RoleSplashScreen onDone={() => setShowRoleSplash(false)} /></Suspense>;
  if (showVotingSplash) return <Suspense fallback={<ScreenLoader />}><VotingSplashScreen onDone={() => setShowVotingSplash(false)} /></Suspense>;
  if (showEliminationReveal && eliminationData) {
    return (
      <Suspense fallback={<ScreenLoader />}>
        <EliminationRevealScreen
          eliminatedPlayer={eliminationData.eliminatedPlayer}
          isGameOver={eliminationData.isGameOver}
          imposterWins={eliminationData.imposterWins}
          onContinue={handleEliminationContinue}
        />
      </Suspense>
    );
  }

  if (phase === 'lobby') return <Suspense fallback={<ScreenLoader />}><div className="animate-fadeIn"><LobbyScreen /></div></Suspense>;
  if (phase === 'speaking') return <Suspense fallback={<ScreenLoader />}><div className="animate-fadeIn"><GameScreen /></div></Suspense>;
  if (phase === 'voting') return <Suspense fallback={<ScreenLoader />}><div className="animate-fadeIn"><VotingScreen onElimination={(data) => { setEliminationData(data); setShowEliminationReveal(true); }} /></div></Suspense>;
  if (phase === 'results') return <Suspense fallback={<ScreenLoader />}><div className="animate-fadeIn"><ResultsScreen /></div></Suspense>;

  return null;
}

function ScreenLoader({ label = 'Loading...' }: { label?: string }) {
  return (
    <div className="cinematic-bg flex items-center justify-center min-h-screen overflow-hidden">
      <div className="relative flex flex-col items-center gap-6">
        {/* Ambient glow */}
        <div className="absolute -inset-24 rounded-full bg-red-600/10 blur-3xl animate-glowPulse pointer-events-none" />

        {/* Logo crest */}
        <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center shadow-2xl shadow-red-900/60 animate-floatSlow">
          <div className="absolute inset-0 rounded-full glow-ring-red" />
          <span className="text-3xl">💀</span>
          <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-yellow-400 border-2 border-gray-950" />
        </div>

        {/* Spinner ring */}
        <div className="w-10 h-10 rounded-full border-2 border-white/10 border-t-red-500 animate-spin" />

        <p className="text-shimmer text-xs uppercase tracking-[0.4em] font-bold">{label}</p>
      </div>
    </div>
  );
}
