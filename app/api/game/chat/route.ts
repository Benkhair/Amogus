import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { cleanupStaleRooms, touchRoomActivity } from '@/lib/supabase/roomMaintenance';

export async function POST(req: NextRequest) {
  const { roomId, playerId, text, type = 'chat' } = await req.json();
  if (!roomId || !playerId || !text?.trim()) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }

  const supabase = createServerClient();
  await cleanupStaleRooms(supabase);
  let turnIndex = 0;
  let round = 1;

  // Lobby chat is allowed anytime, other types need game phase checks
  if (type !== 'lobby') {
    // Verify game is in speaking phase
    const { data: gs } = await supabase.from('game_state').select('*').eq('room_id', roomId).single();
    if (!gs || gs.current_phase !== 'speaking') {
      return NextResponse.json({ error: 'Not in speaking phase' }, { status: 400 });
    }

    const { data: player } = await supabase
      .from('players')
      .select('is_eliminated')
      .eq('id', playerId)
      .single();

    if (player?.is_eliminated) {
      return NextResponse.json({ error: 'Eliminated players cannot chat' }, { status: 403 });
    }

    turnIndex = gs.current_turn_index;
    round = gs.round ?? 1;

    // If it's a clue, only allow current speaker
    if (type === 'clue') {
      const currentSpeakerId = gs.turn_order[gs.current_turn_index];
      if (currentSpeakerId !== playerId) {
        return NextResponse.json({ error: 'Not your turn to send clue' }, { status: 403 });
      }
    }
  }

  const { error } = await supabase.from('chat_messages').insert({
    room_id: roomId,
    player_id: playerId,
    text: text.trim().slice(0, 120),
    turn_index: turnIndex,
    round,
    type: type === 'clue' ? 'clue' : type === 'lobby' ? 'lobby' : 'chat',
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await touchRoomActivity(supabase, roomId);
  return NextResponse.json({ success: true });
}
