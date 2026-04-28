'use client';

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useGame } from '@/context/GameContext';
import { supabase } from '@/lib/supabase/client';
import { Send, Loader2, Eye, EyeOff, MessageCircle, Edit3, Timer } from 'lucide-react';

const TURN_DURATION = 30;

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
  }, [advancing]);

  // Clear messages when entering lobby or when round changes
  const currentRound = gameState?.round ?? 1;
  useEffect(() => {
    if (gameState?.current_phase === 'lobby') {
      setMessages([]);
    }
  }, [gameState?.current_phase]);

  useEffect(() => {
    setMessages([]);
  }, [currentRound]);

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
        setMessages(data.map((m: any) => ({
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
        const row = payload.new as any;
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

        {/* Countdown Timer */}
        {!currentClue && gameState?.current_phase === 'speaking' && (
          <div className={`bg-black/70 backdrop-blur-sm rounded-xl px-3 py-1.5 border flex items-center gap-2 transition-all ${
            countdown <= 5 ? 'border-red-500/60 animate-pulse' : countdown <= 10 ? 'border-yellow-500/40' : 'border-white/10'
          }`}>
            <Timer className={`w-3.5 h-3.5 ${
              countdown <= 5 ? 'text-red-400' : countdown <= 10 ? 'text-yellow-400' : 'text-gray-400'
            }`} />
            <span className={`font-black tabular-nums text-sm ${
              countdown <= 5 ? 'text-red-400' : countdown <= 10 ? 'text-yellow-400' : 'text-white'
            }`}>
              {countdown}s
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
          <div className="relative flex gap-1.5 mt-2 pt-2 border-t border-white/10 shrink-0" ref={emojiPickerRef}>

            {/* Emoji picker panel */}
            {showEmojiPicker && (
              <div className="absolute bottom-full mb-2 left-0 z-20 bg-gray-900 border border-gray-700 rounded-xl p-2 shadow-2xl animate-popIn">
                <div className="grid grid-cols-4 gap-1">
                  {[
                    '😂','😊','😢','😭','😠','😉','😛','😍',
                    '😎','🤔','😅','🥹','😤','🤣','😇','🫡',
                    '👍','👎','🔥','👻',
                  ].map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => setGeneralChatInput((prev) => prev + emoji)}
                      className="w-8 h-8 flex items-center justify-center rounded-lg text-base hover:bg-gray-700 active:scale-90 transition-all"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Emoji toggle button */}
            <button
              onClick={() => setShowEmojiPicker((v) => !v)}
              className={`px-2 py-1.5 rounded-md border text-base transition-all flex-shrink-0 ${
                showEmojiPicker
                  ? 'bg-yellow-500/20 border-yellow-500/50 text-yellow-300'
                  : 'bg-black/50 hover:bg-gray-800 border-white/20 text-gray-400 hover:text-yellow-300'
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
              className="flex-1 px-2 py-1.5 rounded-md bg-black/50 border border-white/20 text-white placeholder-gray-500 focus:outline-none focus:border-blue-400 text-xs transition-all"
            />
            <button
              onClick={sendGeneralChat}
              disabled={!generalChatInput.trim() || sending}
              className="px-2 py-1.5 rounded-md bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-all flex-shrink-0"
            >
              {sending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
            </button>
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
                <span className={`tabular-nums font-black text-xs ${
                  countdown <= 5 ? 'text-red-400' : countdown <= 10 ? 'text-yellow-400' : 'text-gray-500'
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

      {/* BOTTOM SECTION */}
      <div className="flex flex-col gap-2 pointer-events-auto">

        {/* My word card */}
        {myPlayer && (
          <div className="rounded-xl px-4 py-2.5 border backdrop-blur-sm flex items-center gap-3 bg-blue-950/80 border-blue-700/60">
            <span className="text-lg">{myPlayer.is_imposter ? '🎭' : '🕵️'}</span>
            <div className="flex-1">
              <p className="text-xs text-gray-400 uppercase tracking-wider">
                {myPlayer.is_imposter ? 'Sinungaling' : 'Normal na Tao'} — Your word
              </p>
              <p
                className="font-black text-base text-white transition-all"
                style={{ filter: wordVisible ? 'none' : 'blur(6px)', userSelect: wordVisible ? 'auto' : 'none' }}
              >
                {myPlayer.word || '???'}
              </p>
            </div>
            <button onClick={() => setWordVisible(!wordVisible)} className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors">
              {wordVisible ? <EyeOff className="w-4 h-4 text-gray-300" /> : <Eye className="w-4 h-4 text-gray-300" />}
            </button>
          </div>
        )}

      </div>
    </div>
  );
}

export default React.memo(TurnOverlay);
