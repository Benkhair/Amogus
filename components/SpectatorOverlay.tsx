'use client';

import { useState, useEffect, useRef } from 'react';
import { useGame } from '@/context/GameContext';
import { supabase } from '@/lib/supabase/client';
import { Ghost, Eye, Send, Users, Skull } from 'lucide-react';
import dynamic from 'next/dynamic';

const LeaveButton = dynamic(() => import('./LeaveButton'), { ssr: false });

interface ChatMessage {
  id: string;
  playerId: string;
  playerName: string;
  color: string;
  text: string;
  ts: number;
  type: 'chat' | 'spectator_chat';
}

interface PlayerWord {
  id: string;
  name: string;
  isImposter: boolean;
  word: string;
  category: string;
  avatarColor: string;
  isEliminated: boolean;
}

export default function SpectatorOverlay() {
  const { room, myPlayer, players, gameState, sessionId } = useGame();
  const [aliveMessages, setAliveMessages] = useState<ChatMessage[]>([]);
  const [deadMessages, setDeadMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [playerWords, setPlayerWords] = useState<PlayerWord[]>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const currentRound = gameState?.round ?? 1;

  // Load player words (spectators can see all words)
  useEffect(() => {
    if (!room) return;

    const loadWords = async () => {
      const { data } = await supabase
        .from('players')
        .select('id, name, is_imposter, word, category, avatar_color, is_eliminated')
        .eq('room_id', room.id);

      if (data) {
        setPlayerWords(
          data.map((p) => ({
            id: p.id,
            name: p.name,
            isImposter: p.is_imposter,
            word: p.word,
            category: p.category,
            avatarColor: p.avatar_color || '#6366f1',
            isEliminated: p.is_eliminated,
          }))
        );
      }
    };

    loadWords();
  }, [room?.id]);

  // Load existing messages
  useEffect(() => {
    if (!room) return;

    const loadMessages = async () => {
      // Load alive chat (normal chat)
      const { data: aliveData } = await supabase
        .from('chat_messages')
        .select('*, players(name, avatar_color)')
        .eq('room_id', room.id)
        .eq('round', currentRound)
        .in('type', ['chat', 'clue'])
        .order('created_at');

      if (aliveData) {
        setAliveMessages(
          aliveData.map((m) => ({
            id: m.id,
            playerId: m.player_id,
            playerName: m.players?.name ?? 'Unknown',
            color: m.players?.avatar_color ?? '#6366f1',
            text: m.text,
            ts: new Date(m.created_at).getTime(),
            type: m.type || 'chat',
          }))
        );
      }

      // Load dead chat (spectator chat)
      const { data: deadData } = await supabase
        .from('chat_messages')
        .select('*, players(name, avatar_color)')
        .eq('room_id', room.id)
        .eq('type', 'spectator_chat')
        .order('created_at');

      if (deadData) {
        setDeadMessages(
          deadData.map((m) => ({
            id: m.id,
            playerId: m.player_id,
            playerName: m.players?.name ?? 'Unknown',
            color: m.players?.avatar_color ?? '#6366f1',
            text: m.text,
            ts: new Date(m.created_at).getTime(),
            type: 'spectator_chat',
          }))
        );
      }
    };

    loadMessages();
  }, [room?.id, currentRound]);

  // Realtime subscription for both chat types
  useEffect(() => {
    if (!room) return;

    const channel = supabase
      .channel(`spectator_chat:${room.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `room_id=eq.${room.id}`,
        },
        async (payload) => {
          const row = payload.new as {
            id: string;
            player_id: string;
            text: string;
            type?: string;
            created_at: string;
            round?: number;
          };

          // Fetch player data
          const { data: playerData } = await supabase
            .from('players')
            .select('name, avatar_color')
            .eq('id', row.player_id)
            .single();

          const newMessage: ChatMessage = {
            id: row.id,
            playerId: row.player_id,
            playerName: playerData?.name ?? 'Unknown',
            color: playerData?.avatar_color ?? '#6366f1',
            text: row.text,
            ts: new Date(row.created_at).getTime(),
            type: row.type === 'spectator_chat' ? 'spectator_chat' : 'chat',
          };

          if (row.type === 'spectator_chat') {
            setDeadMessages((prev) => {
              if (prev.some((m) => m.id === row.id)) return prev;
              return [...prev, newMessage];
            });
          } else if (row.type === 'chat' || row.type === 'clue') {
            // Only add alive messages from current round
            if (row.round === currentRound) {
              setAliveMessages((prev) => {
                if (prev.some((m) => m.id === row.id)) return prev;
                return [...prev, newMessage];
              });
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [room?.id, currentRound]);

  // Auto-scroll dead chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [deadMessages]);

  const sendMessage = async () => {
    if (!inputText.trim() || !room || !myPlayer || sending) return;

    setSending(true);
    try {
      await fetch('/api/game/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId: room.id,
          playerId: myPlayer.id,
          text: inputText.trim(),
          type: 'spectator_chat',
        }),
      });
      setInputText('');
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Get eliminated players (spectators)
  const spectators = players.filter((p) => p.is_eliminated);

  return (
    <div className="absolute inset-0 pointer-events-none flex flex-col p-4">
      {/* Top bar - Spectator indicator + Leave button */}
      <div className="pointer-events-auto flex items-center justify-between mb-4">
        <div className="flex-1" /> {/* Spacer */}
        <div className="bg-gray-900/80 backdrop-blur-md border border-gray-700 rounded-full px-6 py-3 flex items-center gap-3">
          <Ghost className="w-5 h-5 text-gray-400" />
          <span className="text-gray-300 font-semibold">Spectator Mode</span>
          <span className="text-gray-500 text-sm">|</span>
          <span className="text-red-400 text-sm font-medium">You are eliminated</span>
        </div>
        <div className="flex-1 flex justify-end">
          <LeaveButton />
        </div>
      </div>

      {/* Middle section - Word reveal + Chats */}
      <div className="flex-1 flex gap-4 min-h-0 pointer-events-auto">
        {/* LEFT: Alive Chat (Read-only) */}
        <div className="w-64 bg-black/60 backdrop-blur-md rounded-xl border border-white/10 p-3 flex flex-col">
          <div className="flex items-center gap-2 mb-3 pb-2 border-b border-white/10">
            <Eye className="w-4 h-4 text-green-400" />
            <span className="text-green-400 text-xs font-semibold uppercase tracking-wider">
              Alive Players
            </span>
            <span className="text-xs text-gray-500 ml-auto">(Read-only)</span>
          </div>

          <div
            className="flex-1 overflow-y-auto flex flex-col gap-2 pr-1 min-h-0"
            style={{ scrollbarWidth: 'thin', scrollbarColor: '#374151 transparent' }}
          >
            {aliveMessages.length === 0 ? (
              <p className="text-gray-600 text-xs text-center italic">
                Waiting for players to chat...
              </p>
            ) : (
              aliveMessages.map((m) => (
                <div key={m.id} className="flex gap-2 items-start">
                  <div
                    className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-white text-[10px] font-bold border border-white/20"
                    style={{ backgroundColor: m.color }}
                  >
                    {m.playerName[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] text-gray-500 mb-0.5">{m.playerName}</p>
                    <p
                      className="text-xs text-gray-300 break-words px-2 py-1 rounded bg-white/5"
                      style={{ borderLeft: `2px solid ${m.color}40` }}
                    >
                      {m.text}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* CENTER: Word Reveal Panel */}
        <div className="flex-1 flex flex-col items-center">
          <div className="w-full max-w-md bg-gradient-to-b from-gray-900/80 to-gray-950/80 backdrop-blur-md border border-gray-700 rounded-xl p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-gray-300 text-sm font-semibold flex items-center gap-2">
                <Skull className="w-4 h-4 text-red-400" />
                Revealed Words
              </h3>
              <span className="text-xs text-gray-500">Spectator Only</span>
            </div>

            <div className="space-y-2 max-h-48 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
              {playerWords.map((p) => (
                <div
                  key={p.id}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg border ${
                    p.isImposter
                      ? 'bg-red-900/20 border-red-700/30'
                      : 'bg-gray-800/30 border-gray-700/30'
                  }`}
                >
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white border border-white/20 flex-shrink-0"
                    style={{ backgroundColor: p.avatarColor }}
                  >
                    {p.isImposter ? '🎭' : p.name[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-200 truncate">{p.name}</p>
                    <p className="text-xs text-gray-500">
                      {p.isImposter ? 'Sinungaling' : 'Normal na Tao'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-bold ${p.isImposter ? 'text-red-400' : 'text-green-400'}`}>
                      {p.word || '???'}
                    </p>
                    <p className="text-[10px] text-gray-500">{p.category}</p>
                  </div>
                  {p.isEliminated && (
                    <Ghost className="w-4 h-4 text-gray-500 flex-shrink-0" />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Spectator List */}
          <div className="mt-4 w-full max-w-md">
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-4 h-4 text-gray-400" />
              <span className="text-gray-400 text-xs">Spectators ({spectators.length})</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {spectators.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-gray-800/50 border border-gray-700/50"
                >
                  <Ghost className="w-3 h-3 text-gray-500" />
                  <span className="text-xs text-gray-400">{s.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT: Dead Chat (Interactive) */}
        <div className="w-64 bg-black/60 backdrop-blur-md rounded-xl border border-gray-700 p-3 flex flex-col">
          <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-700">
            <Ghost className="w-4 h-4 text-purple-400" />
            <span className="text-purple-400 text-xs font-semibold uppercase tracking-wider">
              Ghost Chat
            </span>
            <span className="text-xs text-gray-500 ml-auto">(Spectators Only)</span>
          </div>

          <div
            className="flex-1 overflow-y-auto flex flex-col gap-2 pr-1 min-h-0"
            style={{ scrollbarWidth: 'thin', scrollbarColor: '#374151 transparent' }}
          >
            {deadMessages.length === 0 ? (
              <p className="text-gray-600 text-xs text-center italic py-4">
                Chat with other eliminated players...
              </p>
            ) : (
              deadMessages.map((m) => (
                <div key={m.id} className="flex gap-2 items-start">
                  <div
                    className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-white text-[10px] font-bold border border-white/20 opacity-70"
                    style={{ backgroundColor: m.color }}
                  >
                    {m.playerName[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] text-gray-500 mb-0.5">{m.playerName}</p>
                    <p className="text-xs text-purple-300 break-words px-2 py-1 rounded bg-purple-950/30 border border-purple-800/30">
                      {m.text}
                    </p>
                  </div>
                </div>
              ))
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input for dead chat */}
          <div className="mt-2 pt-2 border-t border-gray-700">
            <div className="flex gap-2">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Chat with ghosts..."
                maxLength={100}
                className="flex-1 px-3 py-2 rounded-lg bg-gray-800/50 border border-gray-700 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-colors"
              />
              <button
                onClick={sendMessage}
                disabled={!inputText.trim() || sending}
                className="px-3 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-colors"
              >
                {sending ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom spacer */}
      <div className="h-16" />
    </div>
  );
}
