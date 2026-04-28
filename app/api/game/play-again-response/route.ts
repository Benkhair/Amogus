import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  const { roomId, playerId, sessionId, response } = await req.json();

  if (!roomId || !playerId || !sessionId || !response) {
    return NextResponse.json({ error: 'Missing roomId, playerId, sessionId, or response' }, { status: 400 });
  }

  if (response !== 'accepted' && response !== 'declined') {
    return NextResponse.json({ error: 'Invalid response value' }, { status: 400 });
  }

  const supabase = createServerClient();

  const { data: room, error: roomError } = await supabase
    .from('rooms')
    .select('id, host_id, status')
    .eq('id', roomId)
    .single();

  if (roomError || !room) {
    return NextResponse.json({ error: 'Room not found' }, { status: 404 });
  }

  if (room.status !== 'ended') {
    return NextResponse.json({ error: 'Play again is not active' }, { status: 400 });
  }

  const { data: player, error: playerError } = await supabase
    .from('players')
    .select('id, room_id, session_id, is_eliminated, is_connected')
    .eq('id', playerId)
    .single();

  if (playerError || !player || player.room_id !== roomId) {
    return NextResponse.json({ error: 'Player not found in room' }, { status: 404 });
  }

  if (player.session_id !== sessionId) {
    return NextResponse.json({ error: 'Player session mismatch' }, { status: 403 });
  }

  if (player.session_id === room.host_id) {
    return NextResponse.json({ error: 'Host cannot respond to play again requests' }, { status: 403 });
  }

  if (player.is_eliminated) {
    return NextResponse.json({ error: 'Eliminated players cannot respond' }, { status: 403 });
  }

  const { data: request, error: requestError } = await supabase
    .from('play_again_requests')
    .select('id, status')
    .eq('room_id', roomId)
    .maybeSingle();

  if (requestError) {
    return NextResponse.json({ error: requestError.message }, { status: 500 });
  }

  if (!request || request.status !== 'pending') {
    return NextResponse.json({ error: 'No active play again request' }, { status: 400 });
  }

  const { error } = await supabase
    .from('play_again_responses')
    .upsert(
      {
        room_id: roomId,
        player_id: playerId,
        response,
      },
      { onConflict: 'room_id,player_id' }
    );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
