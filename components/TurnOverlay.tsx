'use client';

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useGame } from '@/context/GameContext';
import { supabase } from '@/lib/supabase/client';
import { Send, Loader2, Eye, EyeOff, MessageCircle, Edit3, Timer } from 'lucide-react';

const TURN_DURATION = 45;

interface ChatMessage {
  id: string;
  playerId: string;
  playerName: string;
  color: string;
  text: string;
  ts: number;
  type: 'chat' | 'clue';
}

interface TurnOverlayProps {
  onAdvance: (skip?: boolean) => void;
  advancing: boolean;
}

function TurnOverlay({ onAdvance, advancing }: TurnOverlayProps) {
  const { myPlayer, gameState, currentSpeaker, isMyTurn, room } = useGame();
  const [wordVisible, setWordVisible] = useState(false);
  const [generalChatInput, setGeneralChatInput] = useState('');
  const [clueInput, setClueInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sending, setSending] = useState(false);
  const [loadingTime, setLoadingTime] = useState(0);
  const [myClue, setMyClue] = useState<string>('');
  const [countdown, setCountdown] = useState<number>(TURN_DURATION);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const hasAutoSkipped = useRef(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);

  // Close emoji picker on click outside
  useEffect(() => {
    if (!showEmojiPicker) return;
    const handler = (e: MouseEvent) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(e.target as Node)) {
        setShowEmojiPicker(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showEmojiPicker]);

  const turnIndex = gameState?.current_turn_index ?? 0;
  const totalTurns = gameState?.turn_order?.length ?? 0;
  const LOADING_DURATION = 3;
  
  // Memoize computed values
  const loadingPct = useMemo(() => LOADING_DURATION > 0 ? (loadingTime / LOADING_DURATION) * 100 : 0, [loadingTime]);
  const loadingColor = useMemo(() => loadingPct > 66 ? 'text-green-400' : loadingPct > 33 ? 'text-yellow-400' : 'text-red-400', [loadingPct]);
  const loadingBg = useMemo(() => loadingPct > 66 ? 'bg-green-500' : loadingPct > 33 ? 'bg-yellow-500' : 'bg-red-500', [loadingPct]);
  
  // Memoize filtered messages
  const chatMessages = useMemo(() => messages.filter(m => m.type === 'chat'), [messages]);
  const currentClue = useMemo(() => messages.find(m => m.type === 'clue' && m.playerId === currentSpeaker?.id), [messages, currentSpeaker?.id]);
  
  // Get all submitted clues (excluding current turn if still being typed)
  const submittedClues = useMemo(() => messages.filter(m => m.type === 'clue'), [messages]);

  // Reset loading timer when advancing changes
  useEffect(() => {
    if (!advancing) {
      setLoadingTime(0);
    }
  }, [advancing]); // eslint-disable-line react-hooks/exhaustive-deps

  // Clear messages when entering lobby or when round changes
  const currentRound = gameState?.round ?? 1;
  useEffect(() => {
    if (gameState?.current_phase === 'lobby' || gameState?.current_phase === 'speaking') {
      setMessages([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState?.current_phase, currentRound]);

  // Loading timer after clicking Done
  useEffect(() => {
    if (!advancing || loadingTime >= LOADING_DURATION) return;
    const interval = setInterval(() => {
      setLoadingTime((prev) => {
        if (prev >= LOADING_DURATION) {
          clearInterval(interval);
          return LOADING_DURATION;
        }
        return prev + 0.1;
      });
    }, 100);
    return () => clearInterval(interval);
  }, [advancing, loadingTime]);

  // Load existing messages for current round only (skip if lobby)
  useEffect(() => {
    if (!room || gameState?.current_phase === 'lobby') return;
    
    const loadMessages = async () => {
      const { data } = await supabase
        .from('chat_messages')
        .select('*, players(name, avatar_color)')
        .eq('room_id', room.id)
        .eq('round', currentRound)
        .order('created_at');
        
      if (data) {
        setMessages(data.map((m: { id: string; player_id: string; players?: { name?: string; avatar_color?: string }; text: string; created_at: string; type?: 'chat' | 'clue' }) => ({
          id: m.id,
          playerId: m.player_id,
          playerName: m.players?.name ?? 'Unknown',
          color: m.players?.avatar_color ?? '#6366f1',
          text: m.text,
          ts: new Date(m.created_at).getTime(),
          type: m.type || 'chat',
        })));
      }
    };
    
    loadMessages();
  }, [room?.id, gameState?.current_phase, currentRound]);

  // Realtime subscription - always active to receive new messages
  useEffect(() => {
    if (!room) return;

    const channel = supabase
      .channel(`chat:${room.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `room_id=eq.${room.id}` }, async (payload) => {
        const row = payload.new as { id: string; player_id: string; text: string; type?: 'chat' | 'clue'; created_at: string; round?: number; players?: { name?: string; avatar_color?: string } };
        // Only add messages from the current round
        if (row.round && row.round !== currentRound) return;
        // Fetch fresh player data instead of relying on captured players variable
        const { data: playerData } = await supabase
          .from('players')
          .select('name, avatar_color')
          .eq('id', row.player_id)
          .single();
        
        setMessages((prev) => {
          if (prev.some((message) => message.id === row.id)) {
            return prev;
          }

          return [...prev, {
            id: row.id,
            playerId: row.player_id,
            playerName: playerData?.name ?? 'Unknown',
            color: playerData?.avatar_color ?? '#6366f1',
            text: row.text,
            ts: new Date(row.created_at).getTime(),
            type: row.type || 'chat',
          }];
        });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [room?.id, currentRound]);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Reset myClue and countdown when turn changes
  useEffect(() => {
    setMyClue('');
    setClueInput('');
    hasAutoSkipped.current = false;
  }, [gameState?.current_turn_index]);

  // Countdown timer based on timer_end from game state
  useEffect(() => {
    if (!gameState?.timer_end || gameState?.current_phase !== 'speaking') {
      setCountdown(TURN_DURATION);
      return;
    }

    const tick = () => {
      const end = new Date(gameState.timer_end!).getTime();
      const remaining = Math.max(0, Math.ceil((end - Date.now()) / 1000));
      setCountdown(remaining);

      // Auto-skip if timer expires and I'm the speaker and no clue was sent
      if (remaining <= 0 && isMyTurn && !currentClue && !hasAutoSkipped.current) {
        hasAutoSkipped.current = true;
        onAdvance(true);
      }
    };

    tick();
    const interval = setInterval(tick, 250);
    return () => clearInterval(interval);
  }, [gameState?.timer_end, gameState?.current_phase, isMyTurn, currentClue, onAdvance]);

  const sendMessage = async (inputText: string, isClue: boolean = false) => {
    if (!inputText.trim() || !myPlayer || !room || sending) return;
    const text = inputText.trim();
    setSending(true);
    try {
      await fetch('/api/game/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId: room.id, playerId: myPlayer.id, text, type: isClue ? 'clue' : 'chat' }),
      });
      // If it was my turn and it's a clue, remember it
      if (isMyTurn && isClue) {
        setMyClue(text);
      }
    } finally {
      setSending(false);
    }
  };

  const sendGeneralChat = async () => {
    if (!generalChatInput.trim()) return;
    await sendMessage(generalChatInput, false);
    setGeneralChatInput('');
  };

  const sendClue = async () => {
    if (!clueInput.trim() || advancing) return;
    const text = clueInput.trim();
    setClueInput('');
    await sendMessage(text, true);
    if (isMyTurn) {
      onAdvance(false);
    }
  };

  const handleGeneralChatKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendGeneralChat();
    }
  };

  const handleClueKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendClue();
    }
  };

  return (
    <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-3 gap-2">

      {/* TOP BAR — turn progress + timer */}
      <div className="flex items-center gap-2 pointer-events-auto">
        <div className="bg-black/70 backdrop-blur-sm rounded-xl px-3 py-1.5 border border-white/10 flex items-center gap-2">
          <span className="text-gray-400 text-xs uppercase tracking-wider">Turn</span>
          <span className="text-white font-bold tabular-nums text-sm">{turnIndex + 1} / {totalTurns}</span>
          <div className="flex gap-1 ml-1">
            {gameState?.turn_order?.map((pid, i) => (
              <div
                key={pid}
                className={`w-1.5 h-1.5 rounded-full transition-all ${
                  i < turnIndex ? 'bg-gray-600' : i === turnIndex ? 'bg-green-400 scale-125' : 'bg-gray-700'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Countdown Timer - Enhanced with pressure animations */}
        {!currentClue && gameState?.current_phase === 'speaking' && (
          <div className={`backdrop-blur-md rounded-xl px-4 py-2 border flex items-center gap-2.5 transition-all duration-200 ${
            countdown <= 5 
              ? 'bg-gradient-to-r from-red-950/90 to-red-900/70 border-red-500/80 shadow-lg shadow-red-900/50 animate-pulse' 
              : countdown <= 10 
              ? 'bg-gradient-to-r from-yellow-950/80 to-yellow-900/60 border-yellow-500/60 shadow-lg shadow-yellow-900/30' 
              : 'bg-black/60 border-white/20'
          }`}>
            <Timer className={`w-4 h-4 flex-shrink-0 transition-all ${
              countdown <= 5 ? 'text-red-300 animate-spin' : countdown <= 10 ? 'text-yellow-300' : 'text-gray-400'
            }`} />
            <span className={`font-black tabular-nums text-base transition-all ${
              countdown <= 5 ? 'text-red-200 scale-110' : countdown <= 10 ? 'text-yellow-200' : 'text-white'
            }`}>
              {countdown}s
            </span>
          </div>
        )}

        {/* Skip indicator */}
        {myPlayer && (
          <div className={`bg-black/60 backdrop-blur-sm rounded-xl px-3 py-1.5 border flex items-center gap-2 ${
            myPlayer.has_skipped ? 'border-gray-700/50' : 'border-blue-500/40'
          }`}>
            <span className="text-xs">⏭️</span>
            <span className={`text-xs font-semibold ${myPlayer.has_skipped ? 'text-gray-500' : 'text-blue-300'}`}>
              {myPlayer.has_skipped ? 'No skips' : '1 skip'}
            </span>
          </div>
        )}
      </div>

      {/* MIDDLE SECTION — Chat (left) + Clue (center) */}
      <div className="flex-1 flex gap-3 pointer-events-auto min-h-0">
        
        {/* LEFT: General Chat only */}
        <div className="w-56 bg-black/60 backdrop-blur-md rounded-xl border border-white/10 p-2 flex flex-col">
          <div className="text-xs uppercase tracking-wider text-gray-400 font-semibold mb-2 flex items-center gap-1.5 shrink-0">
            <MessageCircle className="w-3 h-3" />
            Chat
          </div>
          <div className="flex-1 overflow-y-auto flex flex-col gap-1.5 pr-1 min-h-0" style={{ scrollbarWidth: 'thin', scrollbarColor: '#374151 transparent' }}>
            {chatMessages.length === 0 && (
              <div className="flex items-center justify-center h-full text-gray-500 text-xs text-center px-2">
                <p>💬 Chat with other players...</p>
              </div>
            )}
            {chatMessages.map((m, i) => (
              <div key={i} className={`flex gap-1.5 items-end text-xs ${m.playerId === myPlayer?.id ? 'flex-row-reverse' : ''}`}>
                <div
                  className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center text-white text-xs font-bold border border-white/20"
                  style={{ backgroundColor: m.color }}
                  title={m.playerName}
                >
                  {m.playerName[0].toUpperCase()}
                </div>
                <div className={`max-w-[140px] ${m.playerId === myPlayer?.id ? 'items-end' : 'items-start'} flex flex-col gap-0.5`}>
                  <span className="text-gray-500 text-[10px] px-1">{m.playerName}</span>
                  <div
                    className="px-2 py-1 rounded-md text-xs text-white backdrop-blur-sm border transition-all"
                    style={{
                      backgroundColor: `${m.color}22`,
                      borderColor: `${m.color}66`,
                    }}
                  >
                    {m.text}
                  </div>
                </div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>
          {/* Chat input for all players */}
          <div className="flex flex-col gap-1 pt-1 border-t border-white/10 shrink-0" ref={emojiPickerRef}>
            {/* Emoji picker panel - opens downward inside container */}
            {showEmojiPicker && (
              <div className="bg-gray-900 border border-gray-700 rounded-lg p-2 shadow-lg animate-popIn">
                <div className="grid grid-cols-4 gap-1">
                  {[
                    '😂','😊','😢','😭','😠','😉','😛','😍',
                    '😎','🤔','😅','🥹','😤','🤣','😇','🫡',
                    '👍','👎','🔥','👻',
                  ].map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => setGeneralChatInput((prev) => prev + emoji)}
                      className="w-7 h-7 flex items-center justify-center rounded text-sm hover:bg-gray-700 active:scale-90 transition-all"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Input row */}
            <div className="flex gap-1">
              {/* Emoji toggle button */}
              <button
                onClick={() => setShowEmojiPicker((v) => !v)}
                className={`px-1.5 py-1 rounded text-sm transition-all flex-shrink-0 ${
                  showEmojiPicker
                    ? 'bg-yellow-500/20 border border-yellow-500/50 text-yellow-300'
                    : 'bg-black/50 hover:bg-gray-800 border border-white/20 text-gray-400 hover:text-yellow-300'
                }`}
              >
                😊
              </button>

              <input
                type="text"
                value={generalChatInput}
                onChange={(e) => setGeneralChatInput(e.target.value)}
                onKeyDown={handleGeneralChatKeyDown}
                placeholder="Chat..."
                maxLength={100}
                className="flex-1 px-2 py-1 rounded text-xs bg-black/50 border border-white/20 text-white placeholder-gray-500 focus:outline-none focus:border-blue-400 transition-all"
              />
              <button
                onClick={sendGeneralChat}
                disabled={!generalChatInput.trim() || sending}
                className="px-1.5 py-1 rounded bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-all flex-shrink-0"
              >
                {sending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
              </button>
            </div>
          </div>
        </div>

        {/* CENTER: Clue Panel — Only for current speaker */}
        <div className="flex-1 flex flex-col items-center justify-center max-w-sm mx-auto">
          <div className={`w-full bg-black/70 backdrop-blur-xl rounded-xl border p-3 flex flex-col transition-all ${
            isMyTurn ? 'border-green-500/50 shadow-lg shadow-green-900/20' : 'border-white/10'
          }`}>
            <div className="text-xs uppercase tracking-wider text-gray-300 font-semibold mb-2 flex items-center gap-2">
              <Edit3 className={`w-3 h-3 ${isMyTurn ? 'text-green-400' : 'text-gray-400'}`} />
              <span className="flex-1">{isMyTurn ? 'Send your clue' : `Waiting for ${currentSpeaker?.name || '...'}`}</span>
              {!currentClue && (
                <span className={`tabular-nums font-black text-xs transition-all ${
                  countdown <= 5 ? 'text-red-400 scale-125 animate-pulse' : countdown <= 10 ? 'text-yellow-400' : 'text-gray-500'
                }`}>
                  {countdown}s
                </span>
              )}
            </div>
            
            {/* Show current speaker's clue if sent, or input if it's my turn and no clue yet */}
            {(() => {
              
              if (currentClue) {
                // Show the sent clue
                return (
                  <div className="flex flex-col gap-2">
                    <div className="w-full px-3 py-2 rounded-lg bg-green-900/30 border border-green-500/30 text-white text-sm">
                      <span className="text-green-400 text-xs block mb-1">{currentSpeaker?.name}&apos;s clue:</span>
                      {currentClue.text}
                    </div>
                    {isMyTurn && advancing && (
                      <div className="w-full py-1.5 rounded-lg bg-green-900/30 border border-green-500/30 text-green-300 font-semibold text-sm flex items-center justify-center gap-1.5">
                        <Loader2 className="w-3 h-3 animate-spin" /> Passing turn…
                      </div>
                    )}
                  </div>
                );
              }
              
              if (isMyTurn) {
                // Show input for speaker
                return (
                  <div className="flex flex-col gap-2">
                    <textarea
                      value={clueInput}
                      onChange={(e) => setClueInput(e.target.value)}
                      onKeyDown={handleClueKeyDown}
                      placeholder="Type your clue here..."
                      maxLength={120}
                      rows={2}
                      autoFocus
                      className="w-full px-3 py-2 rounded-lg bg-black/50 border border-green-500/40 text-white placeholder-gray-500 focus:outline-none focus:border-green-400 focus:ring-1 focus:ring-green-400/50 text-sm resize-none transition-all"
                    />
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500">{clueInput.length}/120</span>
                      <button
                        onClick={sendClue}
                        disabled={!clueInput.trim() || sending}
                        className="px-4 py-1.5 rounded-lg bg-green-600 hover:bg-green-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-sm transition-all flex items-center gap-1.5"
                      >
                        {sending ? <Loader2 className="w-3 h-3 animate-spin" /> : <><Send className="w-3 h-3" /> Send Clue</>}
                      </button>
                    </div>
                  </div>
                );
              }
              
              // Waiting for speaker
              return (
                <div className="flex items-center gap-3 py-2">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm border border-white/20"
                    style={{ backgroundColor: currentSpeaker?.avatar_color || '#6366f1' }}
                  >
                    {currentSpeaker?.name?.[0]?.toUpperCase() ?? '?'}
                  </div>
                  <div className="flex-1">
                    <p className="text-white font-medium text-sm">{currentSpeaker?.name || 'Waiting...'}</p>
                    <p className="text-xs text-gray-400">is sending their clue...</p>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>

        {/* RIGHT: Submitted Clues */}
        <div className="w-56 bg-black/60 backdrop-blur-md rounded-xl border border-white/10 p-3 flex flex-col">
          <div className="text-xs uppercase tracking-wider text-gray-400 font-semibold mb-2 flex items-center gap-1.5 shrink-0">
            <Edit3 className="w-3 h-3" />
            Clues ({submittedClues.length}/{totalTurns})
          </div>
          <div className="flex-1 overflow-y-auto flex flex-col gap-2 pr-1 min-h-0" style={{ scrollbarWidth: 'thin', scrollbarColor: '#374151 transparent' }}>
            {submittedClues.length === 0 ? (
              <p className="text-gray-500 text-xs italic text-center mt-4">No clues yet...</p>
            ) : (
              submittedClues.map((clue, i) => (
                <div 
                  key={i} 
                  className="rounded-lg p-2 border transition-all"
                  style={{ 
                    backgroundColor: `${clue.color}15`,
                    borderColor: `${clue.color}40`,
                  }}
                >
                  <div className="flex gap-1.5 items-center mb-1">
                    <div
                      className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center text-white text-[10px] font-bold border border-white/20"
                      style={{ backgroundColor: clue.color }}
                      title={clue.playerName}
                    >
                      {clue.playerName[0].toUpperCase()}
                    </div>
                    <span className="text-gray-300 text-xs font-medium truncate">{clue.playerName}</span>
                  </div>
                  <p className="text-xs leading-tight" style={{ color: clue.color }}>&ldquo;{clue.text}&rdquo;</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* BOTTOM SECTION — centered word container */}
      <div className="flex flex-col gap-3 pointer-events-auto items-center justify-center">

        {/* My word card - centered, not too wide */}
        {myPlayer && (
          <div className={`rounded-2xl px-6 py-3.5 border backdrop-blur-md flex items-center gap-4 w-full max-w-md transition-all ${
            wordVisible
              ? 'bg-gradient-to-r from-blue-950/70 to-blue-900/50 border-blue-600/50 shadow-lg shadow-blue-900/30'
              : 'bg-gradient-to-r from-gray-900/60 to-gray-950/50 border-gray-700/40'
          }`}>
            <span className="text-2xl">{myPlayer.is_imposter ? '🎭' : '🕵️'}</span>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-gray-400 uppercase tracking-widest font-bold mb-1">
                {myPlayer.is_imposter ? 'Sinungaling' : 'Normal na Tao'}
              </p>
              <p
                className="font-black text-lg text-white transition-all duration-200"
                style={{ filter: wordVisible ? 'none' : 'blur(8px)', userSelect: wordVisible ? 'auto' : 'none' }}
              >
                {myPlayer.word || '???'}
              </p>
            </div>
            <button onClick={() => setWordVisible(!wordVisible)} className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors flex-shrink-0">
              {wordVisible ? <EyeOff className="w-4 h-4 text-gray-300" /> : <Eye className="w-4 h-4 text-gray-300" />}
            </button>
          </div>
        )}

      </div>
    </div>
  );
}

export default React.memo(TurnOverlay);
