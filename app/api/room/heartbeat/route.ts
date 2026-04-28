import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { cleanupStaleRooms, touchRoomActivity } from '@/lib/supabase/roomMaintenance';

export async function POST(req: NextRequest) {
  const { playerId, sessionId, connected } = await req.json();
  if (!playerId || !sessionId) {
    return NextResponse.json({ error: 'Missing playerId or sessionId' }, { status: 400 });
  }

  const supabase = createServerClient();
  await cleanupStaleRooms(supabase);

  const { data: player, error: playerError } = await supabase
    .from('players')
    .select('id, session_id, room_id')
    .eq('id', playerId)
    .single();

  if (playerError || !player) {
    return NextResponse.json({ error: 'Player not found' }, { status: 404 });
  }

  if (player.session_id !== sessionId) {
    return NextResponse.json({ error: 'Unauthorized heartbeat' }, { status: 403 });
  }

  await supabase
    .from('players')
    .update({ is_connected: connected ?? true })
    .eq('id', playerId);

  if (connected ?? true) {
    await touchRoomActivity(supabase, player.room_id);
  }

  return NextResponse.json({ ok: true });
}
