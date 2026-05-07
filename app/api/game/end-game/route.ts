import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  const { roomId, sessionId, imposterWins } = await req.json();

  if (!roomId || !sessionId) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }

  const supabase = createServerClient();

  // Verify the requester is the host
  const { data: room } = await supabase
    .from('rooms')
    .select('host_id')
    .eq('id', roomId)
    .single();

  if (!room || room.host_id !== sessionId) {
    return NextResponse.json({ error: 'Only host can end game' }, { status: 403 });
  }

  // Call end_game function
  const { error } = await supabase.rpc('end_game', {
    p_room_id: roomId,
    p_imposter_wins: imposterWins ?? false,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
