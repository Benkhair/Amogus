import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { cleanupStaleRooms, touchRoomActivity } from '@/lib/supabase/roomMaintenance';

export async function POST(req: NextRequest) {
  const { playerId, sessionId, roomId } = await req.json();

  if (!playerId || !sessionId || !roomId) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }

  const supabase = createServerClient();
  await cleanupStaleRooms(supabase);

  // Mark player as disconnected
  const { error } = await supabase
    .from('players')
    .update({ is_connected: false, is_eliminated: true })
    .eq('id', playerId)
    .eq('session_id', sessionId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // If host is leaving, try to reassign host to another connected player
  const { data: room } = await supabase.from('rooms').select('*').eq('id', roomId).single();
  if (room && room.host_id === sessionId) {
    const { data: others } = await supabase
      .from('players')
      .select('*')
      .eq('room_id', roomId)
      .eq('is_connected', true)
      .neq('id', playerId)
      .order('joined_at')
      .limit(1);

    if (others && others.length > 0) {
      await supabase.from('rooms').update({ host_id: others[0].session_id }).eq('id', roomId);
    } else {
      // No one left — end the room
      await supabase.from('rooms').update({ status: 'ended' }).eq('id', roomId);
    }
  }

  await touchRoomActivity(supabase, roomId);

  return NextResponse.json({ success: true });
}
