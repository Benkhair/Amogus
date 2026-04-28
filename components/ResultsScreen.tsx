'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useGame } from '@/context/GameContext';
import { supabase } from '@/lib/supabase/client';
import { Player } from '@/lib/types';
import { Skull, Trophy, RotateCcw, Check, X, Clock, Loader2 } from 'lucide-react';
import LeaveButton from './LeaveButton';

interface ResultData {
  eliminatedPlayer: Player | null;
  imposter: Player | null;
  imposterWins: boolean;
}

interface PlayerResponse {
  player_id: string;
  response: 'accepted' | 'declined';
}

export default function ResultsScreen() {
  const router = useRouter();
  const { room, players, isHost, myPlayer, sessionId, gameState } = useGame();
  const [result, setResult] = useState<ResultData | null>(null);
  const [requestActive, setRequestActive] = useState(false);
  const [myResponse, setMyResponse] = useState<'pending' | 'accepted' | 'declined'>('pending');
  const [responses, setResponses] = useState<PlayerResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState<{ message: string; playerName: string } | null>(null);
  const previousPlayersRef = useRef(players);

  useEffect(() => {
    if (!players.length) return;
    const imposter = players.find((p) => p.is_imposter) ?? null;
    const eliminated = players.find((p) => p.is_eliminated) ?? null;
    const imposterWins = !imposter?.is_eliminated;
    setResult({ eliminatedPlayer: eliminated, imposter, imposterWins });
  }, [players]);

  // Detect when players leave
  useEffect(() => {
    const prevPlayers = previousPlayersRef.current;
    const currentPlayers = players;

    for (const prevPlayer of prevPlayers) {
      const stillConnected = currentPlayers.find((p) => p.id === prevPlayer.id && p.is_connected);
      if (!stillConnected && prevPlayer.is_connected) {
        setNotification({ message: 'left the game', playerName: prevPlayer.name });
        setTimeout(() => setNotification(null), 4000);
      }
    }

    previousPlayersRef.current = currentPlayers;
  }, [players]);

  const doFetchResponses = async (roomId: string) => {
    try {
      const { data, error } = await supabase
        .from('play_again_responses')
        .select('player_id, response')
        .eq('room_id', roomId);
      if (error) {
        console.error('Error fetching responses:', error);
        return;
      }
      if (data) setResponses(data as PlayerResponse[]);
    } catch (err) {
      console.error('Exception fetching responses:', err);
    }
  };

  const doFetchRequest = async (roomId: string) => {
    try {
      const { data, error } = await supabase
        .from('play_again_requests')
        .select('status, host_id')
        .eq('room_id', roomId)
        .maybeSingle();
      if (error) {
        console.error('Error fetching request:', error);
        return;
      }
      if (data?.status === 'pending') {
        setRequestActive(true);
      } else {
        setRequestActive(false);
        // Reset my response if request is no longer pending
        if (data?.status !== 'pending' && myResponse !== 'pending') {
          setMyResponse('pending');
        }
      }
    } catch (err) {
      console.error('Exception fetching request:', err);
    }
  };

  // Create the realtime channel ONCE when room.id is known — never recreate it
  useEffect(() => {
    if (!room?.id) return;
    const roomId = room.id;

    doFetchRequest(roomId);
    doFetchResponses(roomId);

    const channel = supabase
      .channel(`play_again:${roomId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'play_again_requests', filter: `room_id=eq.${roomId}` },
        (payload: any) => {
          console.log('Play again request change:', payload.eventType, payload);
          if (payload.eventType === 'DELETE' || !payload.new?.id) {
            setRequestActive(false);
            setMyResponse('pending');
            setResponses([]);
          } else if (payload.new?.status === 'pending') {
            console.log('Play again request is now pending - showing modal');
            setRequestActive(true);
            setMyResponse('pending');
            setResponses([]);
          } else {
            // Status changed from pending to something else (completed, cancelled, etc.)
            setRequestActive(false);
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'play_again_responses', filter: `room_id=eq.${roomId}` },
        (payload: any) => {
          console.log('Play again response change:', payload.eventType, payload);
          doFetchResponses(roomId);
        }
      )
      .subscribe((status: 'SUBSCRIBED' | 'TIMED_OUT' | 'CLOSED' | 'CHANNEL_ERROR', err?: any) => {
        console.log('Play again subscription status:', status, err);
        if (status === 'SUBSCRIBED') {
          doFetchRequest(roomId);
          doFetchResponses(roomId);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room?.id]);

  // Host: send play again request
  const handlePlayAgain = async () => {
    if (!room) return;
    setLoading(true);
    try {
      const res = await fetch('/api/game/play-again', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId: room.id, sessionId }),
      });

      const data = await res.json();
      if (!res.ok) {
        console.error('Error creating request:', data.error);
        alert(data.error || 'Failed to create play again request. Please try again.');
        return;
      }
      
      setRequestActive(true);
      setResponses([]);
      setMyResponse('pending');
    } catch (err) {
      console.error('Exception in handlePlayAgain:', err);
      alert('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Non-host: record individual response
  const handleRespond = async (response: 'accepted' | 'declined') => {
    if (!room || !myPlayer || !requestActive) return;
    setLoading(true);
    try {
      const res = await fetch('/api/game/play-again-response', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId: room.id, playerId: myPlayer.id, sessionId, response }),
      });

      const data = await res.json();
      if (!res.ok) {
        console.error('Error recording response:', data.error);
        alert(data.error || 'Failed to record response. Please try again.');
        return;
      }
      
      setMyResponse(response);
      if (response === 'declined') {
        router.push('/');
      }
    } catch (err) {
      console.error('Exception in handleRespond:', err);
      alert('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Host: start the new game after everyone responded
  const handleStartNewGame = async () => {
    if (!room) return;
    setLoading(true);
    try {
      const res = await fetch('/api/game/new-game', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId: room.id, sessionId }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to start a new game');
      }

      router.push(`/room/${data.roomCode ?? room.code}`);
    } finally {
      setLoading(false);
    }
  };

  const handleLeave = () => {
    router.push('/');
  };

  const imposterWins = result?.imposterWins ?? false;

  // Non-host players (exclude host from response tracking)
  const nonHostPlayers = players.filter((p) => p.session_id !== room?.host_id);
  const agreedCount = responses.filter((r) => r.response === 'accepted').length;
  const declinedCount = responses.filter((r) => r.response === 'declined').length;
  const pendingCount = nonHostPlayers.length - agreedCount - declinedCount;
  const allResponded = nonHostPlayers.length > 0 && pendingCount === 0;

  return (
    <div className="cinematic-bg flex flex-col flex-1 items-center justify-center min-h-screen px-4 py-6">
      <div className="w-full max-w-lg">
        {/* Top bar */}
        <div className="flex justify-end mb-4">
          <LeaveButton />
        </div>

        {/* Player left notification */}
        {notification && (
          <div className="mb-4 px-4 py-2 rounded-lg bg-red-500/20 border border-red-500/40 text-red-300 text-sm flex items-center gap-2 animate-slideDown">
            <span>👋</span>
            <span><strong>{notification.playerName}</strong> {notification.message}</span>
          </div>
        )}

        {/* Result Banner */}
        <div
          className={`relative rounded-2xl p-8 mb-6 text-center border overflow-hidden animate-bounceIn ${imposterWins ? 'bg-gradient-to-b from-red-900/40 to-red-950/40 border-red-500/40' : 'bg-gradient-to-b from-green-900/40 to-emerald-950/40 border-green-500/40'} animate-slideUp`}
          style={{
            boxShadow: imposterWins
              ? '0 30px 80px -30px rgba(220,38,38,0.55), inset 0 1px 0 rgba(255,255,255,0.05)'
              : '0 30px 80px -30px rgba(34,197,94,0.55), inset 0 1px 0 rgba(255,255,255,0.05)',
          }}
        >
          <div className={`pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 w-[340px] h-[340px] rounded-full blur-3xl ${imposterWins ? 'bg-red-600/25' : 'bg-emerald-500/25'} animate-glowPulse`} />
          <div className="text-6xl mb-4">{imposterWins ? '🎭' : '🎉'}</div>
          <h1 className={`text-4xl font-black mb-2 ${imposterWins ? 'text-red-400' : 'text-green-400'}`}>
            {imposterWins ? 'Sinungaling Wins!' : 'Normal na Tao Wins!'}
          </h1>
          <p className="text-gray-300 text-lg">
            {imposterWins
              ? 'The Sinungaling successfully blended in!'
              : 'The crew found the Sinungaling!'}
          </p>
        </div>

        {/* Reveal Cards */}
        <div className="grid grid-cols-2 gap-4 mb-6 animate-slideUp" style={{ animationDelay: '0.15s' }}>
          <div className="glass-panel rounded-2xl p-5">
            <p className="text-gray-400 text-xs uppercase tracking-wider mb-3">Eliminated</p>
            {result?.eliminatedPlayer ? (
              <>
                <div className="w-12 h-12 rounded-full flex items-center justify-center text-xl font-black text-white border border-white/20 mb-2" style={{ backgroundColor: result.eliminatedPlayer.avatar_color || '#6366f1' }}>
                  {result.eliminatedPlayer.name[0].toUpperCase()}
                </div>
                <p className="font-bold" style={{ color: result.eliminatedPlayer.avatar_color || '#ffffff' }}>{result.eliminatedPlayer.name}</p>
                <p className="text-gray-500 text-xs mt-1">
                  {result.eliminatedPlayer.is_imposter ? '🎭 Sinungaling' : '🕵️ Normal na Tao'}
                </p>
              </>
            ) : (
              <p className="text-gray-500 text-sm">No one eliminated</p>
            )}
          </div>

          <div className="glass-panel rounded-2xl p-5" style={{ boxShadow: '0 0 30px -12px rgba(220,38,38,0.4), inset 0 1px 0 rgba(255,255,255,0.04)' }}>
            <p className="text-gray-400 text-xs uppercase tracking-wider mb-3">The Sinungaling</p>
            {result?.imposter ? (
              <>
                <div className="w-12 h-12 rounded-full bg-red-600 flex items-center justify-center mb-2">
                  <Skull className="w-6 h-6 text-white" />
                </div>
                <p className="font-bold" style={{ color: result.imposter.avatar_color || '#ffffff' }}>{result.imposter.name}</p>
                <p className="text-red-400 text-xs mt-1">Word: {result.imposter.word}</p>
              </>
            ) : (
              <p className="text-gray-500 text-sm">Unknown</p>
            )}
          </div>
        </div>

        {/* All Players Reveal */}
        <div className="glass-panel rounded-2xl p-5 mb-6 animate-slideUp" style={{ animationDelay: '0.25s' }}>
          <p className="text-gray-400 text-xs uppercase tracking-wider mb-4">All Players</p>
          <div className="flex flex-col gap-2">
            {players.map((p) => (
              <div
                key={p.id}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${
                  p.is_imposter ? 'border-red-700/50 bg-red-900/10' : 'border-gray-800 bg-gray-800/30'
                }`}
              >
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white border border-white/20"
                  style={{ backgroundColor: p.is_imposter ? '#dc2626' : (p.avatar_color || '#6366f1') }}
                >
                  {p.is_imposter ? <Skull className="w-4 h-4" /> : p.name[0].toUpperCase()}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium" style={{ color: p.avatar_color || '#ffffff' }}>{p.name}</p>
                  <p className="text-gray-500 text-xs">
                    {p.is_imposter ? '🎭 Sinungaling' : '🕵️ Normal na Tao'} — <span className="text-gray-400">{p.word}</span>
                  </p>
                </div>
                {p.is_eliminated && (
                  <span className="text-xs bg-red-500/20 text-red-400 border border-red-500/30 px-2 py-0.5 rounded-full">
                    Eliminated
                  </span>
                )}
                {!p.is_eliminated && !p.is_imposter && (
                  <Trophy className="w-4 h-4 text-yellow-400" />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* HOST: Play Again panel */}
        {isHost && requestActive && (
          <div className="glass-panel rounded-2xl p-5 mb-4 animate-slideUp">
            {requestActive && (
              <>
                <p className="text-white font-semibold text-center mb-4">Waiting for responses…</p>
                <div className="flex justify-center gap-6 mb-4">
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-2xl font-black text-green-400">{agreedCount}</span>
                    <span className="text-xs text-gray-400 flex items-center gap-1"><Check className="w-3 h-3 text-green-400" /> Agreed</span>
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-2xl font-black text-red-400">{declinedCount}</span>
                    <span className="text-xs text-gray-400 flex items-center gap-1"><X className="w-3 h-3 text-red-400" /> Declined</span>
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-2xl font-black text-yellow-400">{pendingCount}</span>
                    <span className="text-xs text-gray-400 flex items-center gap-1"><Clock className="w-3 h-3 text-yellow-400" /> Pending</span>
                  </div>
                </div>
                {allResponded && agreedCount > 0 && (
                  <button
                    onClick={handleStartNewGame}
                    disabled={loading}
                    className="w-full py-3 rounded-xl bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-bold transition-colors flex items-center justify-center gap-2 mb-2"
                  >
                    <RotateCcw className="w-5 h-5" /> Start New Game ({agreedCount} joining)
                  </button>
                )}
                {allResponded && agreedCount === 0 && (
                  <p className="text-center text-red-400 text-sm font-semibold mb-2">Everyone declined.</p>
                )}
                {!allResponded && (
                  <p className="text-center text-gray-500 text-xs">Waiting for {pendingCount} more player{pendingCount !== 1 ? 's' : ''} to respond…</p>
                )}
              </>
            )}
          </div>
        )}

        {/* NON-HOST: accepted waiting state (inline) */}
        {!isHost && requestActive && myResponse === 'accepted' && (
          <div className="bg-green-950/60 border border-green-700/50 rounded-2xl p-4 mb-4 text-center">
            <p className="text-green-400 font-semibold">✓ You agreed to play again. Waiting for host to start…</p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3">
          {isHost ? (
            <>
              <button
                onClick={handlePlayAgain}
                disabled={loading || requestActive}
                className={`relative flex-1 py-3 rounded-xl text-white font-bold transition-all flex items-center justify-center gap-2 overflow-hidden ${
                  requestActive
                    ? 'bg-white/5 border border-white/10 text-gray-500 cursor-not-allowed'
                    : 'bg-gradient-to-r from-red-600 to-red-500 shadow-[0_10px_40px_-12px_rgba(220,38,38,0.65)] hover:shadow-[0_10px_40px_-6px_rgba(220,38,38,0.85)]'
                }`}
              >
                {!requestActive && !loading && (
                  <span className="pointer-events-none absolute inset-0 rounded-xl glow-ring-red opacity-40 animate-glowPulse" />
                )}
                <span className="relative flex items-center gap-2">
                  <RotateCcw className="w-5 h-5" /> {requestActive ? 'Request Sent' : 'Play Again'}
                </span>
              </button>
              <button
                onClick={handleLeave}
                className="flex-1 py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold transition-all"
              >
                Leave Room
              </button>
            </>
          ) : (
            <button
              onClick={handleLeave}
              className="w-full py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold transition-all"
            >
              Leave Room
            </button>
          )}
        </div>
      </div>

      {/* NON-HOST: Play Again popup modal */}
      {!isHost && requestActive && myResponse === 'pending' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md">
          <div className="w-full max-w-sm bg-gradient-to-b from-blue-950/90 to-blue-950/70 border border-blue-500/40 rounded-3xl p-8 flex flex-col items-center gap-5 shadow-2xl shadow-blue-900/50 animate-popIn">
            <div className="text-6xl animate-bounce">🎮</div>
            <div className="text-center">
              <p className="text-white font-black text-2xl mb-2">Play Again?</p>
              <p className="text-gray-300 text-sm">The host wants to start a new game!</p>
            </div>
            <div className="flex gap-3 w-full pt-2">
              <button
                onClick={() => handleRespond('accepted')}
                disabled={loading}
                className="flex-1 py-3 rounded-xl bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-bold transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Check className="w-5 h-5" /> Accept</>}
              </button>
              <button
                onClick={() => handleRespond('declined')}
                disabled={loading}
                className="flex-1 py-3 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-bold transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><X className="w-5 h-5" /> Decline</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
