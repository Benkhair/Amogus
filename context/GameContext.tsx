'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase/client';
import { getSessionId } from '@/lib/session';
import { Room, Player, GameState, Vote } from '@/lib/types';

// Connection status types
type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

interface GameContextValue {
  sessionId: string;
  room: Room | null;
  myPlayer: Player | null;
  players: Player[];
  gameState: GameState | null;
  votes: Vote[];
  timeLeft: number;
  currentSpeaker: Player | null;
  isMyTurn: boolean;
  isHost: boolean;
  connectionStatus: ConnectionStatus;
  isLoading: boolean;
  setRoom: (r: Room | null) => void;
  setMyPlayer: (p: Player | null) => void;
  setPlayers: (p: Player[]) => void;
  setGameState: (gs: GameState | null) => void;
  refreshPlayers: () => Promise<void>;
  refreshGameState: () => Promise<void>;
  refreshVotes: () => Promise<void>;
  reconnect: () => void;
}

const GameContext = createContext<GameContextValue | null>(null);

export function GameProvider({ children }: { children: React.ReactNode }) {
  const [sessionId, setSessionId] = useState('');
  const [room, setRoom] = useState<Room | null>(null);
  const [myPlayer, setMyPlayer] = useState<Player | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [votes, setVotes] = useState<Vote[]>([]);
  const [timeLeft, setTimeLeft] = useState(0);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting');
  const [isLoading, setIsLoading] = useState(true);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSubscribedRef = useRef(false);
  const gameStateRef = useRef<GameState | null>(null);
  const lastRoomIdRef = useRef<string | null>(null);

  useEffect(() => {
    setSessionId(getSessionId());
  }, []);

  // Reset room-scoped state when the active room changes so stale data cannot leak across rooms.
  useEffect(() => {
    const nextRoomId = room?.id ?? null;
    if (lastRoomIdRef.current === nextRoomId) return;

    lastRoomIdRef.current = nextRoomId;

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    isSubscribedRef.current = false;
    gameStateRef.current = null;
    setMyPlayer(null);
    setPlayers([]);
    setGameState(null);
    setVotes([]);
    setTimeLeft(0);

    if (!nextRoomId) {
      setConnectionStatus('connecting');
      setIsLoading(false);
      return;
    }

    setConnectionStatus('connecting');
    setIsLoading(true);
  }, [room?.id]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, []);

  // Timer countdown
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);

    if (gameState?.timer_end) {
      const tick = () => {
        const diff = Math.max(0, Math.ceil((new Date(gameState.timer_end!).getTime() - Date.now()) / 1000));
        setTimeLeft(diff);
      };
      tick();
      timerRef.current = setInterval(tick, 500);
    } else {
      setTimeLeft(0);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [gameState?.timer_end]);

  // Clear votes when game phase changes to lobby (new game)
  useEffect(() => {
    if (gameState?.current_phase === 'lobby') {
      setVotes([]);
    }
  }, [gameState?.current_phase]);

  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  const refreshPlayers = useCallback(async () => {
    if (!room) return;
    try {
      const { data, error } = await supabase.rpc('get_players_for_room', { p_room_id: room.id });
      if (error) {
        console.error('Error refreshing players:', error);
        return;
      }
      if (data) {
        setPlayers(data);
        const me = data.find((p: Player) => p.session_id === sessionId);
        if (me) setMyPlayer(me);
      }
    } catch (err) {
      console.error('Exception refreshing players:', err);
    }
  }, [room, sessionId]);

  const refreshGameState = useCallback(async () => {
    if (!room) return;
    try {
      const { data, error } = await supabase.from('game_state').select('*').eq('room_id', room.id).single();
      if (error) {
        console.error('Error refreshing game state:', error);
        return;
      }
      if (data) {
        gameStateRef.current = data;
        setGameState(data);
      }
    } catch (err) {
      console.error('Exception refreshing game state:', err);
    }
  }, [room]);

  const refreshVotes = useCallback(async (roundOverride?: number) => {
    const round = roundOverride ?? gameStateRef.current?.round;
    if (!room || round == null) return;
    try {
      const { data, error } = await supabase
        .from('votes')
        .select('*')
        .eq('room_id', room.id)
        .eq('round', round);
      if (error) {
        console.error('Error refreshing votes:', error);
        return;
      }
      if (data) setVotes(data);
    } catch (err) {
      console.error('Exception refreshing votes:', err);
    }
  }, [room]);

  // Setup realtime subscriptions with error handling and reconnection
  const setupSubscriptions = useCallback(() => {
    if (!room || isSubscribedRef.current) return;

    setConnectionStatus('connecting');
    setIsLoading(true);

    // Remove existing channel synchronously before creating a new one
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    // Build and subscribe the channel synchronously — no awaits before .subscribe()
    // so Supabase never sees .on() calls added after subscribe().
    const roomChannel = supabase
      .channel(`room:${room.id}`, {
        config: {
          broadcast: { self: false },
          presence: { key: sessionId || 'anonymous' }
        }
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'players',
        filter: `room_id=eq.${room.id}`
      }, (payload) => {
        console.log('Players change:', payload.eventType, payload);
        refreshPlayers();
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'game_state',
        filter: `room_id=eq.${room.id}`
      }, (payload) => {
        console.log('Game state change:', payload.eventType, payload);
        if (payload.new) {
          gameStateRef.current = payload.new as GameState;
          setGameState(payload.new as GameState);
        }
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'rooms',
        filter: `id=eq.${room.id}`
      }, (payload) => {
        console.log('Room change:', payload.eventType, payload);
        if (payload.new) setRoom(payload.new as Room);
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'votes',
        filter: `room_id=eq.${room.id}`
      }, (payload) => {
        console.log('Votes change:', payload.eventType, payload);
        refreshVotes((payload as any).new?.round ?? gameStateRef.current?.round);
      })
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          console.log('Realtime subscribed successfully');
          isSubscribedRef.current = true;
          setConnectionStatus('connected');
          // Load initial data only after subscription is confirmed
          Promise.all([refreshPlayers(), refreshGameState()])
            .then(() => refreshVotes(gameStateRef.current?.round))
            .finally(() => setIsLoading(false));
        } else if (status === 'CHANNEL_ERROR' || err) {
          console.error('Realtime subscription error:', err);
          setConnectionStatus('error');
          setIsLoading(false);
          isSubscribedRef.current = false;
          // Auto-reconnect after 3 seconds
          reconnectTimeoutRef.current = setTimeout(() => {
            isSubscribedRef.current = false;
            setupSubscriptions();
          }, 3000);
        } else if (status === 'CLOSED') {
          console.log('Realtime connection closed');
          setConnectionStatus('disconnected');
          isSubscribedRef.current = false;
        }
      });

    channelRef.current = roomChannel;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room?.id, sessionId]);

  // Manual reconnect function
  const reconnect = useCallback(() => {
    isSubscribedRef.current = false;
    setConnectionStatus('connecting');
    setupSubscriptions();
  }, [setupSubscriptions]);

  // Setup subscriptions when room changes
  useEffect(() => {
    if (room) {
      setupSubscriptions();
    } else {
      setConnectionStatus('connecting');
      setIsLoading(false);
      isSubscribedRef.current = false;
    }
    
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [room?.id, setupSubscriptions]);

  // Derived values
  const currentSpeakerId = gameState?.turn_order?.[gameState.current_turn_index];
  const currentSpeaker = players.find((p) => p.id === currentSpeakerId) ?? null;
  const isMyTurn = !!myPlayer && myPlayer.id === currentSpeakerId;
  const isHost = !!myPlayer && !!room && room.host_id === sessionId;

  return (
    <GameContext.Provider
      value={{
        sessionId,
        room,
        myPlayer,
        players,
        gameState,
        votes,
        timeLeft,
        currentSpeaker,
        isMyTurn,
        isHost,
        connectionStatus,
        isLoading,
        setRoom,
        setMyPlayer,
        setPlayers,
        setGameState,
        refreshPlayers,
        refreshGameState,
        refreshVotes,
        reconnect,
      }}
    >
      {children}
      {/* Connection Status Indicator */}
      {room && connectionStatus !== 'connected' && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50">
          <div className={`px-4 py-2 rounded-full text-sm font-medium flex items-center gap-2 ${
            connectionStatus === 'connecting' ? 'bg-yellow-600/90 text-white' :
            connectionStatus === 'error' ? 'bg-red-600/90 text-white' :
            'bg-gray-600/90 text-white'
          }`}>
            {connectionStatus === 'connecting' && (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Connecting...
              </>
            )}
            {connectionStatus === 'error' && (
              <>
                <span className="w-2 h-2 rounded-full bg-white" />
                Connection error
                <button onClick={reconnect} className="ml-2 underline text-xs hover:text-yellow-200">
                  Retry
                </button>
              </>
            )}
            {connectionStatus === 'disconnected' && (
              <>
                <span className="w-2 h-2 rounded-full bg-red-300" />
                Disconnected
                <button onClick={reconnect} className="ml-2 underline text-xs hover:text-yellow-200">
                  Reconnect
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </GameContext.Provider>
  );
}

export function useGame() {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame must be used within GameProvider');
  return ctx;
}
