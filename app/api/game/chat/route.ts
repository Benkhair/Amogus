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
  let messageType = type;

  // Get player status
  const { data: player } = await supabase
    .from('players')
    .select('is_eliminated, is_imposter, word, category')
    .eq('id', playerId)
    .single();

  const isEliminated = player?.is_eliminated ?? false;

  // Lobby chat is allowed anytime, other types need game phase checks
  if (type === 'lobby') {
    // Lobby chat - no restrictions
  } else if (type === 'spectator_chat') {
    // Spectator chat - only eliminated players can send
    if (!isEliminated) {
      return NextResponse.json({ error: 'Only eliminated players can use spectator chat' }, { status: 403 });
    }
    // Get current game round for spectator messages
    const { data: gs } = await supabase.from('game_state').select('round').eq('room_id', roomId).single();
    round = gs?.round ?? 1;
  } else {
    // Regular chat and clue - only alive players
    if (isEliminated) {
      // Convert regular chat to spectator chat for eliminated players
      messageType = 'spectator_chat';
      const { data: gs } = await supabase.from('game_state').select('round').eq('room_id', roomId).single();
      round = gs?.round ?? 1;
    } else {
      // Alive player - check game phase
      const { data: gs } = await supabase.from('game_state').select('*').eq('room_id', roomId).single();
      if (!gs || gs.current_phase !== 'speaking') {
        return NextResponse.json({ error: 'Not in speaking phase' }, { status: 400 });
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
  }

  // Validate message type
  const validTypes = ['chat', 'clue', 'lobby', 'spectator_chat'];
  if (!validTypes.includes(messageType)) {
    messageType = 'chat';
  }

  const { error } = await supabase.from('chat_messages').insert({
    room_id: roomId,
    player_id: playerId,
    text: text.trim().slice(0, 120),
    turn_index: turnIndex,
    round,
    type: messageType,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Mark player as having submitted their clue so they aren't re-queued after a skip
  if (messageType === 'clue') {
    await supabase
      .from('players')
      .update({ has_submitted_clue: true })
      .eq('id', playerId);
  }

  await touchRoomActivity(supabase, roomId);
  return NextResponse.json({ success: true, type: messageType });
}
