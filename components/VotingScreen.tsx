'use client';

import { useState, useEffect } from 'react';
import { useGame } from '@/context/GameContext';
import { supabase } from '@/lib/supabase/client';
import { Vote, CheckCircle, Loader2, Skull, Edit3 } from 'lucide-react';
import LeaveButton from './LeaveButton';

interface Clue {
  playerId: string;
  playerName: string;
  color: string;
  text: string;
}

export default function VotingScreen() {
  const { room, myPlayer, players, votes, gameState, sessionId } = useGame();
  const [selectedTarget, setSelectedTarget] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [clues, setClues] = useState<Clue[]>([]);
  const [loadingClues, setLoadingClues] = useState(true);

  const activePlayers = players.filter((p) => !p.is_eliminated && p.is_connected);
  const votablePlayers = activePlayers.filter((p) => p.id !== myPlayer?.id);
  const myVote = votes.find((v) => v.voter_id === myPlayer?.id);
  const hasVoted = submitted || !!myVote;
  const noOneToVote = votablePlayers.length === 0;

  // Load clues from this round
  const currentRound = gameState?.round ?? 1;
  useEffect(() => {
    if (!room) return;
    
    const loadClues = async () => {
      setLoadingClues(true);
      const { data } = await supabase
        .from('chat_messages')
        .select('*, players(name, avatar_color)')
        .eq('room_id', room.id)
        .eq('type', 'clue')
        .eq('round', currentRound)
        .order('created_at');
        
      if (data) {
        setClues(data.map((m: any) => ({
          playerId: m.player_id,
          playerName: m.players?.name ?? 'Unknown',
          color: m.players?.avatar_color ?? '#6366f1',
          text: m.text,
        })));
      }
      setLoadingClues(false);
    };
    
    loadClues();
  }, [room?.id, currentRound]);

  // Tally votes for display
  const tally: Record<string, number> = {};
  for (const v of votes) {
    tally[v.target_id] = (tally[v.target_id] || 0) + 1;
  }

  const handleSkip = async () => {
    if (!room || !myPlayer) return;
    setSubmitting(true);
    try {
      // Solo test: self-vote to trigger tally and move to results
      await fetch('/api/game/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId: room.id, voterId: myPlayer.id, targetId: myPlayer.id }),
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleVote = async () => {
    if (!selectedTarget || !room || !myPlayer) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/game/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId: room.id, voterId: myPlayer.id, targetId: selectedTarget }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error);
      } else {
        setSubmitted(true);
      }
    } catch {
      setError('Failed to submit vote');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="cinematic-bg flex flex-col flex-1 min-h-screen px-4 py-6">
      {/* Main layout: Clues on left, Voting on right */}
      <div className="flex-1 flex gap-4 max-w-6xl mx-auto w-full">
        
        {/* LEFT: Clues Panel */}
        <div className="w-72 glass-panel rounded-2xl p-4 animate-slideUp flex flex-col">
          <div className="flex items-center gap-2 mb-4">
            <Edit3 className="w-4 h-4 text-gray-400" />
            <h2 className="text-gray-400 font-semibold text-sm">Clues from this round</h2>
          </div>
          
          <div className="flex-1 overflow-y-auto flex flex-col gap-2" style={{ scrollbarWidth: 'thin', scrollbarColor: '#374151 transparent' }}>
            {loadingClues ? (
              <p className="text-gray-500 text-xs text-center py-4">Loading clues...</p>
            ) : clues.length === 0 ? (
              <p className="text-gray-500 text-xs text-center py-4 italic">No clues found</p>
            ) : (
              clues.map((clue, i) => (
                <div 
                  key={i} 
                  className="rounded-lg p-3 border transition-all"
                  style={{ 
                    backgroundColor: `${clue.color}15`,
                    borderColor: `${clue.color}40`,
                  }}
                >
                  <div className="flex gap-2 items-center mb-1.5">
                    <div
                      className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-white text-xs font-bold border border-white/20"
                      style={{ backgroundColor: clue.color }}
                    >
                      {clue.playerName[0].toUpperCase()}
                    </div>
                    <span className="text-gray-300 text-sm font-medium">{clue.playerName}</span>
                  </div>
                  <p className="text-sm leading-relaxed" style={{ color: clue.color }}>&ldquo;{clue.text}&rdquo;</p>
                </div>
              ))
            )}
          </div>
          
          <div className="mt-3 pt-3 border-t border-gray-800">
            <p className="text-gray-500 text-xs text-center">
              {clues.length} clue{clues.length !== 1 ? 's' : ''} submitted
            </p>
          </div>
        </div>

        {/* RIGHT: Voting Panel */}
        <div className="flex-1 flex flex-col">
          {/* Header */}
          <div className="flex items-center gap-3 mb-6 animate-slideDown">
            <div className="relative w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center shadow-lg shadow-purple-900/40">
              <div className="absolute inset-0 rounded-full" style={{ boxShadow: '0 0 30px -8px rgba(168,85,247,0.55), 0 0 0 1px rgba(168,85,247,0.35)' }} />
              <Vote className="w-6 h-6 text-white relative" />
            </div>
            <div className="flex-1">
              <h1 className="text-2xl font-black text-white tracking-tight">Vote</h1>
              <p className="text-gray-400 text-xs uppercase tracking-[0.25em] mt-0.5">Who is the Sinungaling?</p>
            </div>
            <LeaveButton />
          </div>

          {/* Voting status */}
          <div className="glass-panel rounded-2xl p-4 mb-4 animate-slideUp">
            <div className="flex items-center justify-between">
              <span className="text-gray-400 text-[10px] uppercase tracking-[0.25em] font-bold">Votes cast</span>
              <span className="text-white font-black tabular-nums">{votes.length} <span className="text-gray-500">/ {activePlayers.length}</span></span>
            </div>
            <div className="w-full bg-white/5 rounded-full h-1.5 mt-3 overflow-hidden">
              <div
                className="h-1.5 rounded-full bg-gradient-to-r from-purple-500 to-fuchsia-400 transition-all"
                style={{
                  width: activePlayers.length > 0 ? `${(votes.length / activePlayers.length) * 100}%` : '0%',
                  boxShadow: '0 0 20px rgba(168,85,247,0.6)',
                }}
              />
            </div>
          </div>

        {/* Player list to vote */}
        <div className="glass-panel rounded-2xl p-5 mb-5 animate-slideUp" style={{ animationDelay: '0.08s' }}>
          <p className="text-gray-400 text-[10px] uppercase tracking-[0.3em] font-bold mb-4">Select the Sinungaling</p>
          <div className="flex flex-col gap-3">
            {noOneToVote && (
              <p className="text-gray-500 text-sm text-center py-4 italic">No other players to vote for (solo test mode)</p>
            )}
            {votablePlayers.map((p) => {
                const voteCount = tally[p.id] || 0;
                const isSelected = selectedTarget === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => !hasVoted && setSelectedTarget(p.id)}
                    disabled={hasVoted}
                    className={`relative flex items-center gap-4 px-4 py-3 rounded-xl border text-left transition-all active:scale-95 overflow-hidden ${
                      isSelected
                        ? 'border-red-500/60 bg-gradient-to-r from-red-500/15 via-red-500/5 to-transparent shadow-[0_0_30px_-12px_rgba(220,38,38,0.7)]'
                        : 'border-white/5 bg-white/[0.03] hover:bg-white/[0.06] hover:border-white/10'
                    } disabled:cursor-default disabled:opacity-70`}
                  >
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white border border-white/20 shadow-lg"
                      style={{ backgroundColor: p.avatar_color || '#6366f1', boxShadow: `0 0 22px -6px ${p.avatar_color || '#6366f1'}90` }}
                    >
                      {p.name[0].toUpperCase()}
                    </div>
                    <span className="font-medium flex-1 text-white">{p.name}</span>
                    {isSelected && <CheckCircle className="w-5 h-5 text-red-400" />}
                    {voteCount > 0 && (
                      <span className="text-[10px] uppercase tracking-widest bg-purple-500/15 text-purple-200 border border-purple-500/30 px-2 py-0.5 rounded-full tabular-nums">
                        {voteCount} vote{voteCount > 1 ? 's' : ''}
                      </span>
                    )}
                  </button>
                );
              })}
          </div>
        </div>

        {/* Error */}
        {error && <p className="text-red-400 text-sm text-center mb-3">{error}</p>}

        {/* Submit button */}
        {noOneToVote ? (
          <button
            onClick={handleSkip}
            disabled={submitting}
            className="w-full py-4 rounded-xl bg-gray-700 hover:bg-gray-600 text-white font-bold text-lg transition-colors flex items-center justify-center gap-2"
          >
            {submitting ? <><Loader2 className="w-5 h-5 animate-spin" /> Loading...</> : '⏭️ Skip to Results (test mode)'}
          </button>
        ) : !hasVoted ? (
          <button
            onClick={handleVote}
            disabled={!selectedTarget || submitting}
            className={`relative w-full py-4 rounded-xl text-white font-bold text-lg transition-all flex items-center justify-center gap-2 overflow-hidden ${
              selectedTarget && !submitting
                ? 'bg-gradient-to-r from-red-600 to-red-500 shadow-[0_10px_40px_-12px_rgba(220,38,38,0.65)] hover:shadow-[0_10px_40px_-6px_rgba(220,38,38,0.85)]'
                : 'bg-white/5 border border-white/10 text-gray-500 cursor-not-allowed'
            }`}
          >
            {selectedTarget && !submitting && (
              <span className="pointer-events-none absolute inset-0 rounded-xl glow-ring-red opacity-50 animate-glowPulse" />
            )}
            <span className="relative flex items-center gap-2">
              {submitting ? (
                <><Loader2 className="w-5 h-5 animate-spin" /> Submitting…</>
              ) : (
                <><Skull className="w-5 h-5" /> Cast Vote</>
              )}
            </span>
          </button>
        ) : (
          <div className="w-full py-4 rounded-xl glass-panel border-green-500/30 text-green-300 text-center font-semibold flex items-center justify-center gap-2" style={{ boxShadow: '0 0 30px -12px rgba(34,197,94,0.55)' }}>
            <CheckCircle className="w-5 h-5" />
            Vote submitted — waiting for others…
          </div>
        )}
        </div>
      </div>
    </div>
  );
}
