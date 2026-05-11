'use client';

import { useEffect, useState, useRef, Suspense, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useRouter, useParams } from 'next/navigation';
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

export default function RoomPage() {
  const params = useParams();
  const code = typeof params.code === 'string' ? params.code : '';
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

  const MAX_RETRIES = 5;
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attemptRef = useRef(0);
  const loadAbortedRef = useRef(false);

  const loadRoom = useCallback(async (attempt: number = 0) => {
    if (!code || !sessionId) return;
    attemptRef.current = attempt;
    loadAbortedRef.current = false;
    setIsRetrying(attempt > 0);

    try {
      const { data: roomData, error: roomError } = await supabase
        .from('rooms')
        .select('*')
        .eq('code', code.toUpperCase())
        .single();

      if (loadAbortedRef.current) return;

      // Check if room not found (PGRST116 = not found, or no data/error combo)
      const isNotFound = roomError?.code === 'PGRST116' || (!roomData && !roomError);

      if (isNotFound) {
        if (attempt < MAX_RETRIES) {
          // Retry for "not found" - allow time for newly created rooms to propagate
          console.log(`Room not found (attempt ${attempt + 1}), retrying...`);
          const delay = attempt === 0 ? 500 : Math.min(1000 * 2 ** (attempt - 1), 8000);
          setRetryCount(attempt + 1);
          retryTimeoutRef.current = setTimeout(() => loadRoom(attempt + 1), delay);
        } else {
          // After all retries, definitively not found
          setLoadError('room_not_found');
          setIsRetrying(false);
        }
        return;
      }

      if (roomError) {
        console.error(`Room load error (attempt ${attempt + 1}):`, roomError);
        if (attempt < MAX_RETRIES) {
          // 500ms, 1s, 2s, 4s, 8s — fast first retry for cold-start latency
          const delay = attempt === 0 ? 500 : Math.min(1000 * 2 ** (attempt - 1), 8000);
          setRetryCount(attempt + 1);
          retryTimeoutRef.current = setTimeout(() => loadRoom(attempt + 1), delay);
        } else {
          setLoadError('network_error');
          setIsRetrying(false);
        }
        return;
      }

      setIsRetrying(false);
      setLoadError(null);
      setRoom(roomData);
      initialLoadDone.current = true;
    } catch (err) {
      if (loadAbortedRef.current) return;
      console.error(`Unexpected error loading room (attempt ${attempt + 1}):`, err);
      if (attempt < MAX_RETRIES) {
        const delay = attempt === 0 ? 500 : Math.min(1000 * 2 ** (attempt - 1), 8000);
        setRetryCount(attempt + 1);
        retryTimeoutRef.current = setTimeout(() => loadRoom(attempt + 1), delay);
      } else {
        setLoadError('network_error');
        setIsRetrying(false);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, sessionId]);

  useEffect(() => {
    if (!code || !sessionId) return;
    loadRoom(0);
    return () => {
      loadAbortedRef.current = true;
      if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
    };
  }, [code, sessionId, loadRoom]);

  // MUST be above all early returns — Rules of Hooks

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
      // Trigger role splash on any transition TO 'speaking' (covers lobby->speaking AND play-again results->speaking)
      if (curr === 'speaking' && prev !== null) {
        setShowRoleSplash(true);
      }
      if (prev === 'speaking' && curr === 'voting') {
        setShowVotingSplash(true);
      }
      // Note: elimination_reveal is handled via eliminationData state, not phase transition
      prevPhaseRef.current = curr;
    }
  }, [gameState?.current_phase]);

  // Hide elimination reveal when phase changes to results
  useEffect(() => {
    if (gameState?.current_phase === 'results' && showEliminationReveal) {
      setShowEliminationReveal(false);
    }
  }, [gameState?.current_phase, showEliminationReveal]);

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

  // --- All hooks declared above. Conditional returns below. ---

  // Show retrying state (transient — don't flash error screen yet)
  if (isRetrying) {
    return (
      <ScreenLoader label={`Reconnecting... (${retryCount}/${MAX_RETRIES})`} />
    );
  }

  // Show error screen only after all retries exhausted or definitive 404
  if (loadError) {
    const isNotFound = loadError === 'room_not_found';
    return (
      <div className="min-h-screen bg-[#0a0a14] flex items-center justify-center px-4">
        <div className="max-w-sm w-full text-center space-y-6">
          <div className="relative mx-auto w-20 h-20">
            <div className="absolute inset-0 bg-red-600/20 blur-2xl rounded-full" />
            <div className="relative w-20 h-20 rounded-full bg-gray-900 border border-red-500/30 flex items-center justify-center">
              <span className="text-3xl">{isNotFound ? '🚪' : '📡'}</span>
            </div>
          </div>
          <div>
            <h1 className="text-xl font-bold text-white mb-2">
              {isNotFound ? 'Room Not Found' : 'Something went wrong'}
            </h1>
            <p className="text-gray-400 text-sm leading-relaxed">
              {isNotFound
                ? 'This room may have been deleted or expired.'
                : "We couldn't load the room. This might be due to a network issue or the room no longer exists."}
            </p>
          </div>
          <div className="space-y-3">
            {!isNotFound && (
              <button
                onClick={() => { setLoadError(null); setRetryCount(0); attemptRef.current = 0; loadRoom(0); }}
                className="w-full py-3.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-semibold transition-all flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                Try Again
              </button>
            )}
            <button
              onClick={() => router.push('/')}
              className="w-full py-3.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-white font-semibold transition-all flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
              Back to Home
            </button>
          </div>
        </div>
      </div>
    );
  }

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
    <div className="cinematic-bg flex items-center justify-center min-h-screen overflow-hidden bg-[#0a0a14]">
      <div className="relative flex flex-col items-center gap-8">
        {/* Animated ambient glow */}
        <div className="absolute -inset-32 rounded-full bg-gradient-to-r from-red-600/20 via-orange-600/10 to-red-600/20 blur-3xl animate-glowPulse pointer-events-none" />

        {/* Logo crest with enhanced animation */}
        <div className="relative">
          {/* Outer glow ring */}
          <div className="absolute inset-0 rounded-full bg-red-500/30 blur-xl animate-pulse" />
          
          {/* Main logo container */}
          <div className="relative w-24 h-24 rounded-full bg-gradient-to-br from-red-400 via-red-600 to-red-800 flex items-center justify-center shadow-2xl shadow-red-900/60 animate-floatSlow border-2 border-red-400/50">
            {/* Inner ring effect */}
            <div className="absolute inset-1 rounded-full border border-red-300/30" />
            <div className="absolute inset-0 rounded-full glow-ring-red" />
            
            {/* Skull emoji with bounce */}
            <span className="text-4xl animate-bounce" style={{ animationDuration: '2s' }}>💀</span>
            
            {/* Status indicator dot */}
            <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-yellow-400 border-2 border-gray-950 animate-pulse" />
          </div>
        </div>

        {/* Enhanced spinner with dual rings */}
        <div className="relative w-12 h-12">
          {/* Outer ring */}
          <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-red-500/60 border-r-red-500/30 animate-spin" style={{ animationDuration: '1.5s' }} />
          {/* Inner ring */}
          <div className="absolute inset-2 rounded-full border-2 border-transparent border-t-red-400 animate-spin" style={{ animationDuration: '1s', animationDirection: 'reverse' }} />
          {/* Center dot */}
          <div className="absolute inset-4 rounded-full bg-red-500/80 animate-pulse" />
        </div>

        {/* Loading text with typing effect */}
        <div className="text-center space-y-2">
          <p className="text-white/90 text-sm font-bold tracking-wider uppercase animate-pulse">{label}</p>
          <div className="flex items-center justify-center gap-1">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-2 h-2 rounded-full bg-red-500/60 animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-2 h-2 rounded-full bg-red-500/30 animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        </div>

        {/* Game title */}
        <p className="text-gray-600 text-xs uppercase tracking-[0.3em] font-medium">Sino-ngaling</p>
      </div>
    </div>
  );
}
