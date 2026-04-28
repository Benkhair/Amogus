import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { cleanupStaleRooms, touchRoomActivity } from '@/lib/supabase/roomMaintenance';

export async function POST(req: NextRequest) {
  const { roomId, sessionId } = await req.json();

  if (!roomId || !sessionId) {
    return NextResponse.json({ error: 'Missing roomId or sessionId' }, { status: 400 });
  }

  const supabase = createServerClient();
  await cleanupStaleRooms(supabase);

  const { data: room, error: roomError } = await supabase
    .from('rooms')
    .select('id, code, host_id, status')
    .eq('id', roomId)
    .single();

  if (roomError || !room) {
    return NextResponse.json({ error: 'Room not found' }, { status: 404 });
  }

  if (room.host_id !== sessionId) {
    return NextResponse.json({ error: 'Only host can start a new game' }, { status: 403 });
  }

  if (room.status !== 'ended') {
    return NextResponse.json({ error: 'Game is not ready to restart' }, { status: 400 });
  }

  const { data, error } = await supabase.rpc('reset_room_for_new_game', {
    p_room_id: roomId,
    p_session_id: sessionId,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await touchRoomActivity(supabase, roomId);

  return NextResponse.json({ success: true, roomCode: room.code, data });
}
