import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { cleanupStaleRooms, touchRoomActivity } from '@/lib/supabase/roomMaintenance';

const TURN_TIMER_MS = 30000; // 30 seconds per turn

export async function POST(req: NextRequest) {
  const { roomId, sessionId, skip } = await req.json();

  if (!roomId || !sessionId) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }

  const supabase = createServerClient();
  await cleanupStaleRooms(supabase);

  const { data: gs } = await supabase.from('game_state').select('*').eq('room_id', roomId).single();
  if (!gs) return NextResponse.json({ error: 'Game state not found' }, { status: 404 });

  const { data: room } = await supabase.from('rooms').select('*').eq('id', roomId).single();
  if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 });

  // Current speaker OR host can advance the turn
  const currentSpeakerId = gs.turn_order[gs.current_turn_index];
  const { data: currentSpeaker } = await supabase
    .from('players')
    .select('session_id')
    .eq('id', currentSpeakerId)
    .single();

  const isCurrentSpeaker = currentSpeaker?.session_id === sessionId;
  const isHost = room.host_id === sessionId;

  if (!isCurrentSpeaker && !isHost) {
    return NextResponse.json({ error: 'Only the current speaker or host can advance the turn' }, { status: 403 });
  }

  let turnOrder = [...gs.turn_order];

  // If the speaker was skipped (timer expired, no clue), re-append them for one more chance
  if (skip && currentSpeakerId) {
    // Count how many times this player already appears AFTER current index
    const remainingAppearances = turnOrder.slice(gs.current_turn_index + 1).filter(id => id === currentSpeakerId).length;
    // Only re-queue once (prevent infinite loop)
    if (remainingAppearances === 0) {
      turnOrder.push(currentSpeakerId);
    }
  }

  const nextIndex = gs.current_turn_index + 1;
  const allDone = nextIndex >= turnOrder.length;

  if (allDone) {
    // Move to voting phase
    await supabase
      .from('game_state')
      .update({ current_phase: 'voting', timer_end: null, turn_order: turnOrder, updated_at: new Date().toISOString() })
      .eq('room_id', roomId);
    await supabase.from('rooms').update({ status: 'voting' }).eq('id', roomId);
  } else {
    const timerEnd = new Date(Date.now() + TURN_TIMER_MS).toISOString();
    await supabase
      .from('game_state')
      .update({
        current_turn_index: nextIndex,
        turn_order: turnOrder,
        timer_end: timerEnd,
        updated_at: new Date().toISOString(),
      })
      .eq('room_id', roomId);
  }

  await touchRoomActivity(supabase, roomId);

  return NextResponse.json({ success: true, allDone });
}
