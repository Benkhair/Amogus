export type RoomStatus = 'waiting' | 'playing' | 'voting' | 'ended';
export type GamePhase = 'lobby' | 'speaking' | 'voting' | 'results';

export interface Room {
  id: string;
  code: string;
  host_id: string;
  status: RoomStatus;
  created_at: string;
}

export interface Player {
  id: string;
  room_id: string;
  name: string;
  session_id: string;
  avatar_color: string;
  is_imposter: boolean;
  word: string;
  category: string;
  is_eliminated: boolean;
  is_connected: boolean;
  has_skipped: boolean;
  pos_x: number;
  pos_z: number;
  joined_at: string;
}

export interface GameState {
  id: string;
  room_id: string;
  current_phase: GamePhase;
  current_turn_index: number;
  turn_order: string[];
  timer_end: string | null;
  round: number;
  updated_at: string;
}

export interface Vote {
  id: string;
  room_id: string;
  voter_id: string;
  target_id: string;
  round: number;
  created_at: string;
}

export interface WordPair {
  sudlat: string;
  imposter: string;
  category: string;
}
