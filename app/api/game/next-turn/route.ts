import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { cleanupStaleRooms, touchRoomActivity } from '@/lib/supabase/roomMaintenance';

const TURN_TIMER_MS = 45000; // 45 seconds per turn

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

  // Get all players in turn order and filter out disconnected ones
  const { data: allPlayers } = await supabase
    .from('players')
    .select('id, is_connected')
    .in('id', gs.turn_order);
  
  const connectedPlayerIds = new Set(
    allPlayers?.filter(p => p.is_connected).map(p => p.id) || []
  );
  
  // Filter turn order to only include connected players
  let turnOrder = gs.turn_order.filter((id: string) => connectedPlayerIds.has(id));
  
  // Find current speaker's position in filtered turn order
  const currentIndexInFiltered = turnOrder.indexOf(currentSpeakerId);

  // Handle skip system - each player gets 1 skip
  if (skip && currentSpeakerId && currentIndexInFiltered !== -1) {
    // Check if player has already used their skip
    const { data: currentPlayer } = await supabase
      .from('players')
      .select('has_skipped')
      .eq('id', currentSpeakerId)
      .single();
    
    if (currentPlayer && !currentPlayer.has_skipped) {
      // First skip - mark as skipped and re-add to end of rotation
      await supabase
        .from('players')
        .update({ has_skipped: true })
        .eq('id', currentSpeakerId);
      
      // Add player back to end of turn order for another chance
      turnOrder.push(currentSpeakerId);
    }
    // If already skipped, they don't get another chance - move to next player
  }

  // Calculate next index based on filtered turn order
  const effectiveCurrentIndex = currentIndexInFiltered !== -1 ? currentIndexInFiltered : 0;
  const nextIndex = effectiveCurrentIndex + 1;
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
