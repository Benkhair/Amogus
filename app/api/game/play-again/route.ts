import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  const { roomId, sessionId } = await req.json();

  if (!roomId || !sessionId) {
    return NextResponse.json({ error: 'Missing roomId or sessionId' }, { status: 400 });
  }

  const supabase = createServerClient();

  const { data: room, error: roomError } = await supabase
    .from('rooms')
    .select('id, code, host_id, status')
    .eq('id', roomId)
    .single();

  if (roomError || !room) {
    return NextResponse.json({ error: 'Room not found' }, { status: 404 });
  }

  if (room.host_id !== sessionId) {
    return NextResponse.json({ error: 'Only host can create a play again request' }, { status: 403 });
  }

  if (room.status !== 'ended') {
    return NextResponse.json({ error: 'Play again is only available after the round ends' }, { status: 400 });
  }

  const { error: clearResponsesError } = await supabase
    .from('play_again_responses')
    .delete()
    .eq('room_id', roomId);

  if (clearResponsesError) {
    return NextResponse.json({ error: clearResponsesError.message }, { status: 500 });
  }

  const { error: clearRequestError } = await supabase
    .from('play_again_requests')
    .delete()
    .eq('room_id', roomId);

  if (clearRequestError) {
    return NextResponse.json({ error: clearRequestError.message }, { status: 500 });
  }

  const { data: request, error: insertError } = await supabase
    .from('play_again_requests')
    .insert({
      room_id: roomId,
      host_id: sessionId,
      status: 'pending',
    })
    .select('id, room_id, host_id, status, created_at')
    .single();

  if (insertError || !request) {
    return NextResponse.json({ error: insertError?.message || 'Failed to create play again request' }, { status: 500 });
  }

  return NextResponse.json({ success: true, request });
}
