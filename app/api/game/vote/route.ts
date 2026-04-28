import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { cleanupStaleRooms, touchRoomActivity } from '@/lib/supabase/roomMaintenance';

export async function POST(req: NextRequest) {
  const { roomId, voterId, targetId } = await req.json();

  if (!roomId || !voterId || !targetId) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }

  const supabase = createServerClient();
  await cleanupStaleRooms(supabase);

  const { data: gs } = await supabase.from('game_state').select('*').eq('room_id', roomId).single();
  if (!gs || gs.current_phase !== 'voting') {
    return NextResponse.json({ error: 'Not in voting phase' }, { status: 400 });
  }

  // Upsert vote
  const { error } = await supabase
    .from('votes')
    .upsert({ room_id: roomId, voter_id: voterId, target_id: targetId, round: gs.round }, { onConflict: 'room_id,voter_id,round' });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Check if all active players have voted
  const { data: activePlayers } = await supabase
    .from('players')
    .select('id')
    .eq('room_id', roomId)
    .eq('is_eliminated', false)
    .eq('is_connected', true);

  const { data: currentVotes } = await supabase
    .from('votes')
    .select('*')
    .eq('room_id', roomId)
    .eq('round', gs.round);

  const allVoted = activePlayers && currentVotes && currentVotes.length >= activePlayers.length;

  if (allVoted) {
    const { data: result, error: rpcError } = await supabase.rpc('finalize_voting', {
      p_room_id: roomId,
      p_round: gs.round,
    });

    if (rpcError) return NextResponse.json({ error: rpcError.message }, { status: 500 });

    if (result?.already_finalized) {
      return NextResponse.json({ success: true, allVoted: true, alreadyFinalized: true });
    }

    await touchRoomActivity(supabase, roomId);

    return NextResponse.json({
      success: true,
      allVoted: true,
      tie: result.tie ?? false,
      eliminatedId: result.eliminated_id ?? null,
      imposterWins: result.imposter_wins,
      imposterId: result.imposter_id,
      imposterWord: result.imposter_word,
    });
  }

  await touchRoomActivity(supabase, roomId);

  return NextResponse.json({ success: true, allVoted: false });
}
