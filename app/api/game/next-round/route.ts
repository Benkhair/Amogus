import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { cleanupStaleRooms, touchRoomActivity } from '@/lib/supabase/roomMaintenance';

export async function POST(req: NextRequest) {
  const { roomId, sessionId } = await req.json();

  if (!roomId || !sessionId) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }

  const supabase = createServerClient();
  await cleanupStaleRooms(supabase);

  // Verify room exists and game is in appropriate state
  const { data: room } = await supabase.from('rooms').select('*').eq('id', roomId).single();
  if (!room) {
    return NextResponse.json({ error: 'Room not found' }, { status: 404 });
  }

  // Only host can start new round
  if (room.host_id !== sessionId) {
    return NextResponse.json({ error: 'Only host can start new round' }, { status: 403 });
  }

  // Start new round
  const { data: result, error: rpcError } = await supabase.rpc('start_new_round', {
    p_room_id: roomId,
  });

  if (rpcError) {
    console.error('Error starting new round:', rpcError);
    return NextResponse.json({ error: rpcError.message }, { status: 500 });
  }

  await touchRoomActivity(supabase, roomId);

  return NextResponse.json({
    success: true,
    newRound: result?.new_round,
    newWord: result?.new_word,
    newCategory: result?.new_category,
  });
}
