'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useGame } from '@/context/GameContext';
import { supabase } from '@/lib/supabase/client';
import { Copy, CheckCheck, Users, Crown, Loader2, Skull, MessageCircle, Send } from 'lucide-react';
import LeaveButton from './LeaveButton';

interface LobbyChatMessage {
  playerId: string;
  playerName: string;
  color: string;
  text: string;
  ts: number;
}

function LobbyScreen() {
  const { room, players, myPlayer, isHost, sessionId } = useGame();
  const [copied, setCopied] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');
  const [chatError, setChatError] = useState('');

  // Lobby Chat state
  const [chatMessages, setChatMessages] = useState<LobbyChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [sendingChat, setSendingChat] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [notification, setNotification] = useState<{ message: string; playerName: string } | null>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const playersRef = useRef(players);
  const previousPlayersRef = useRef(players);
  
  useEffect(() => { playersRef.current = players; }, [players]);

  // Detect when players leave
  useEffect(() => {
    const prevPlayers = previousPlayersRef.current;
    const currentPlayers = players;

    for (const prevPlayer of prevPlayers) {
      const stillConnected = currentPlayers.find((p) => p.id === prevPlayer.id && p.is_connected);
      if (!stillConnected && prevPlayer.is_connected) {
        setNotification({ message: 'left the lobby', playerName: prevPlayer.name });
        setTimeout(() => setNotification(null), 4000);
      }
    }

    previousPlayersRef.current = currentPlayers;
  }, [players]);

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

  const copyCode = () => {
    if (!room) return;
    navigator.clipboard.writeText(room.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleStart = async () => {
    if (!room) return;
    setStarting(true);
    setError('');
    try {
      const res = await fetch('/api/game/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId: room.id, sessionId }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error);
    } catch {
      setError('Failed to start game');
    } finally {
      setStarting(false);
    }
  };

  const connectedPlayers = useMemo(() => players.filter((p) => p.is_connected && !p.is_eliminated), [players]);
  const canStart = useMemo(() => connectedPlayers.length >= 3, [connectedPlayers]);

  // Load lobby chat messages
  useEffect(() => {
    if (!room) return;
    
    // Load history
    supabase
      .from('chat_messages')
      .select('*, players(name, avatar_color)')
      .eq('room_id', room.id)
      .eq('type', 'lobby')
      .order('created_at')
      .then(({ data }) => {
        if (data) {
          setChatMessages(data.map((m: any) => ({
            playerId: m.player_id,
            playerName: m.players?.name ?? 'Unknown',
            color: m.players?.avatar_color ?? '#6366f1',
            text: m.text,
            ts: new Date(m.created_at).getTime(),
          })));
        }
      });

    // Realtime subscription for lobby chat
    const channel = supabase
      .channel(`lobby-chat:${room.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `room_id=eq.${room.id}` }, async (payload) => {
        const row = payload.new as any;
        if (row.type !== 'lobby') return;
        const player = playersRef.current.find((p) => p.id === row.player_id);
        setChatMessages((prev) => [...prev, {
          playerId: row.player_id,
          playerName: player?.name ?? 'Unknown',
          color: player?.avatar_color ?? '#6366f1',
          text: row.text,
          ts: new Date(row.created_at).getTime(),
        }]);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room?.id]);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const sendLobbyChat = async () => {
    if (!chatInput.trim() || !myPlayer || !room || sendingChat) return;
    const text = chatInput.trim();
    setSendingChat(true);
    setChatError('');
    try {
      const res = await fetch('/api/game/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId: room.id, playerId: myPlayer.id, text, type: 'lobby' }),
      });
      const data = await res.json();
      if (!res.ok) {
        const message = data?.error || 'Failed to send message';
        setChatError(message);
        return;
      }
      setChatInput('');
    } catch (err) {
      console.error('Failed to send chat:', err);
      setChatError('Failed to send message. Please try again.');
    } finally {
      setSendingChat(false);
    }
  };

  const handleChatKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendLobbyChat();
    }
  };

  return (
    <div className="cinematic-bg flex flex-col flex-1 min-h-screen px-4 py-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6 animate-slideDown max-w-5xl mx-auto w-full">
        <div className="relative w-12 h-12 rounded-full bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center shadow-lg shadow-red-900/50">
          <div className="absolute inset-0 rounded-full glow-ring-red" />
          <Skull className="w-6 h-6 text-white relative" />
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-black text-white tracking-tight">Lobby</h1>
          <p className="text-gray-400 text-xs uppercase tracking-[0.25em] mt-0.5">Waiting for players</p>
        </div>
        <LeaveButton />
      </div>

      {/* Player left notification */}
      {notification && (
        <div className="mb-4 max-w-5xl mx-auto w-full px-4 py-2 rounded-lg bg-red-500/20 border border-red-500/40 text-red-300 text-sm flex items-center gap-2 animate-slideDown">
          <span>👋</span>
          <span><strong>{notification.playerName}</strong> {notification.message}</span>
        </div>
      )}

      {/* Main Content - Two Columns */}
      <div className="flex-1 flex gap-4 max-w-5xl mx-auto w-full min-h-0 items-start">
        {/* LEFT: Lobby Chat - Fixed height with scroll */}
        <div className="w-72 flex-shrink-0 glass-panel rounded-2xl animate-slideUp flex flex-col" style={{ animationDelay: '0.12s', height: '520px' }}>
          {/* Header */}
          <div className="flex items-center gap-2 px-3 py-2 flex-shrink-0">
            <MessageCircle className="w-4 h-4 text-blue-400" />
            <span className="text-gray-300 font-semibold text-sm">Lobby Chat</span>
            <span className="text-xs text-gray-500 ml-auto">{chatMessages.length} messages</span>
          </div>

          {/* Chat messages */}
          <div className="flex-1 overflow-y-auto flex flex-col gap-1.5 px-2 py-2 min-h-0" style={{ scrollbarWidth: 'thin', scrollbarColor: '#374151 transparent' }}>
            {chatMessages.length === 0 && (
              <div className="flex items-center justify-center h-full text-gray-500 text-xs text-center">
              </div>
            )}
            {chatMessages.map((m, i) => (
              <div key={i} className={`flex gap-2 text-xs ${m.playerId === myPlayer?.id ? 'flex-row-reverse' : ''}`}>
                <div
                  className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-white text-xs font-bold border border-white/20"
                  style={{ backgroundColor: m.color }}
                >
                  {m.playerName[0].toUpperCase()}
                </div>
                <div className={`max-w-[200px] ${m.playerId === myPlayer?.id ? 'items-end' : 'items-start'} flex flex-col gap-0.5`}>
                  <span className="text-gray-500 text-[10px] px-1">{m.playerName}</span>
                  <div
                    className="px-2.5 py-1.5 rounded-lg text-xs text-white backdrop-blur-sm border"
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

          {/* Chat input */}
          <div className="relative flex gap-1.5 px-2 py-2 border-t border-white/5 flex-shrink-0" ref={emojiPickerRef}>

            {/* Emoji picker panel */}
            {showEmojiPicker && (
              <div className="absolute bottom-full mb-2 left-0 z-20 bg-gray-900 border border-gray-700 rounded-2xl p-3 shadow-2xl animate-popIn">
                <div className="grid grid-cols-4 gap-1.5">
                  {[
                    '😂','😊','😢','😭','😠','😉','😛','😍',
                    '😎','🤔','😅','🥹','😤','🤣','🫡',
                    '👍','👎','🔥','👻',
                  ].map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => setChatInput((prev) => prev + emoji)}
                      className="w-9 h-9 flex items-center justify-center rounded-xl text-lg hover:bg-gray-700 active:scale-90 transition-all"
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
              className={`px-2 py-1.5 rounded-lg border text-base transition-all flex-shrink-0 ${
                showEmojiPicker
                  ? 'bg-yellow-500/20 border-yellow-500/50 text-yellow-300'
                  : 'bg-gray-800 hover:bg-gray-700 border-gray-700 text-gray-400 hover:text-yellow-300'
              }`}
            >
              😊
            </button>

            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={handleChatKeyDown}
              placeholder="Type a message..."
              maxLength={100}
              className="flex-1 px-2 py-1.5 rounded-lg bg-gray-800 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:border-blue-400 text-xs transition-all"
            />
            <button
              onClick={sendLobbyChat}
              disabled={!chatInput.trim() || sendingChat}
              className="px-2 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-all flex-shrink-0"
            >
              {sendingChat ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            </button>
          </div>
          {chatError && <p className="px-2 py-1 text-[10px] text-red-400 flex-shrink-0">{chatError}</p>}
        </div>

        {/* RIGHT: Everything else */}
        <div className="flex-1 flex flex-col gap-4">
          {/* Room Code */}
          <div className="relative glass-panel rounded-2xl p-6 animate-slideUp overflow-hidden">
            <div className="pointer-events-none absolute -top-16 -right-16 w-56 h-56 rounded-full bg-red-600/15 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-16 -left-16 w-56 h-56 rounded-full bg-indigo-600/10 blur-3xl" />
            <p className="text-gray-400 text-[10px] mb-3 uppercase tracking-[0.3em] font-bold relative">Room Code</p>
            <div className="flex items-center gap-3 relative">
              <span className="text-4xl md:text-5xl font-black tracking-[0.35em] font-mono bg-gradient-to-b from-white to-gray-400 bg-clip-text text-transparent drop-shadow-[0_0_25px_rgba(255,255,255,0.15)]">{room?.code}</span>
              <button
                onClick={copyCode}
                className={`ml-auto flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-all border ${
                  copied
                    ? 'bg-green-500/15 border-green-500/40 text-green-300'
                    : 'bg-white/5 hover:bg-white/10 border-white/10 text-gray-300'
                }`}
              >
                {copied ? <CheckCheck className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <p className="text-gray-500 text-xs mt-3 relative">Share this code with friends to let them join</p>
          </div>

          {/* Players List */}
          <div className="glass-panel rounded-2xl p-6 animate-slideUp" style={{ animationDelay: '0.08s' }}>
            <div className="flex items-center gap-2 mb-4">
              <Users className="w-5 h-5 text-gray-400" />
              <span className="text-gray-300 font-semibold tracking-wide">
                Players <span className="text-gray-500 font-normal">({connectedPlayers.length}/10)</span>
              </span>
              {connectedPlayers.length < 3 && (
                <span className="ml-auto text-[10px] uppercase tracking-widest text-yellow-400 bg-yellow-500/10 border border-yellow-500/30 px-2 py-1 rounded-full">
                  Need {3 - connectedPlayers.length} more
                </span>
              )}
            </div>
            <div className="flex flex-col gap-2">
              {connectedPlayers.map((p, i) => {
                const isHost = p.session_id === room?.host_id;
                const isSelf = p.id === myPlayer?.id;
                return (
                  <div
                    key={p.id}
                    className={`relative flex items-center gap-3 px-4 py-3 rounded-xl border transition-all animate-popIn overflow-hidden ${
                      isSelf
                        ? 'border-red-500/40 bg-gradient-to-r from-red-500/10 to-transparent'
                        : 'border-white/5 bg-white/[0.03] hover:bg-white/[0.06]'
                    }`}
                    style={{ animationDelay: `${0.1 + i * 0.05}s` }}
                  >
                    <div
                      className="relative w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white border border-white/20 shadow-lg"
                      style={{ backgroundColor: p.avatar_color || '#6366f1', boxShadow: `0 0 20px -6px ${p.avatar_color || '#6366f1'}80` }}
                    >
                      {p.name[0].toUpperCase()}
                    </div>
                    <span className="text-white font-medium">{p.name}</span>
                    <div className="ml-auto flex items-center gap-2">
                      {isSelf && (
                        <span className="text-[10px] uppercase tracking-widest text-red-300 bg-red-400/10 border border-red-400/20 px-2 py-0.5 rounded-full">You</span>
                      )}
                      {isHost && (
                        <span className="flex items-center gap-1 text-[10px] uppercase tracking-widest text-yellow-300 bg-yellow-400/10 border border-yellow-400/20 px-2 py-0.5 rounded-full">
                          <Crown className="w-3 h-3" /> Host
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
              {connectedPlayers.length === 0 && (
                <p className="text-gray-500 text-sm text-center py-6 italic">No players yet…</p>
              )}
            </div>
          </div>

          {/* Error */}
          {error && (
            <p className="text-red-400 text-sm text-center">{error}</p>
          )}

          {/* Start Button */}
          {isHost ? (
            <button
              onClick={handleStart}
              disabled={!canStart || starting}
              className={`relative w-full py-4 rounded-xl text-white font-bold text-lg transition-all flex items-center justify-center gap-2 animate-popIn active:scale-95 overflow-hidden ${
                canStart
                  ? 'bg-gradient-to-r from-red-600 to-red-500 shadow-[0_10px_40px_-12px_rgba(220,38,38,0.65)] hover:shadow-[0_10px_40px_-6px_rgba(220,38,38,0.85)]'
                  : 'bg-white/5 border border-white/10 text-gray-500 cursor-not-allowed'
              }`}
              style={{ animationDelay: '0.2s' }}
            >
              {canStart && !starting && (
                <span className="pointer-events-none absolute inset-0 rounded-xl glow-ring-red opacity-50 animate-glowPulse" />
              )}
              <span className="relative flex items-center gap-2">
                {starting ? (
                  <><Loader2 className="w-5 h-5 animate-spin" /> Starting…</>
                ) : (
                  <>🎮 Start Game</>
                )}
              </span>
            </button>
          ) : (
            <div className="w-full py-4 rounded-xl glass-panel text-gray-300 text-center font-medium flex items-center justify-center gap-2">
              <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
              Waiting for host to start the game…
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default React.memo(LobbyScreen);
