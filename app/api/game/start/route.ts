import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { cleanupStaleRooms, touchRoomActivity } from '@/lib/supabase/roomMaintenance';
import { getRandomWordPair } from '@/lib/words';

export async function POST(req: NextRequest) {
  const { roomId, sessionId } = await req.json();

  if (!roomId || !sessionId) {
    return NextResponse.json({ error: 'Missing roomId or sessionId' }, { status: 400 });
  }

  const supabase = createServerClient();
  await cleanupStaleRooms(supabase);

  // Verify host
  const { data: room } = await supabase.from('rooms').select('*').eq('id', roomId).single();
  if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 });
  if (room.host_id !== sessionId) return NextResponse.json({ error: 'Only host can start the game' }, { status: 403 });
  if (room.status !== 'waiting') return NextResponse.json({ error: 'Game already started' }, { status: 400 });

  // Get players
  const { data: players } = await supabase
    .from('players')
    .select('*')
    .eq('room_id', roomId)
    .eq('is_eliminated', false)
    .eq('is_connected', true);

  if (!players || players.length < 3) {
    return NextResponse.json({ error: 'Need at least 3 players to start' }, { status: 400 });
  }

  // Pick a random word pair (history-aware per room)
  const wordPair = getRandomWordPair(roomId);

  // Randomly assign imposter
  const imposterIndex = Math.floor(Math.random() * players.length);

  // Shuffle turn order
  const shuffled = [...players].sort(() => Math.random() - 0.5);
  const turnOrder = shuffled.map((p) => p.id);

  // Update each player with their role, word, category, and circular spawn position
  const radius = Math.max(3, players.length * 0.8);
  for (let i = 0; i < players.length; i++) {
    const isImposter = players[i].id === players[imposterIndex].id;
    const angle = (i / players.length) * Math.PI * 2;
    await supabase
      .from('players')
      .update({
        is_imposter: isImposter,
        word: isImposter ? wordPair.imposter : wordPair.sudlat,
        category: wordPair.category,
        pos_x: parseFloat((Math.cos(angle) * radius).toFixed(2)),
        pos_z: parseFloat((Math.sin(angle) * radius).toFixed(2)),
      })
      .eq('id', players[i].id);
  }

  // Set turn timer (30 seconds from now for first speaker)
  const timerEnd = new Date(Date.now() + 30000).toISOString();

  // Get current round and increment it for the new game
  const { data: currentGs } = await supabase.from('game_state').select('round').eq('room_id', roomId).single();
  const nextRound = (currentGs?.round ?? 0) + 1;

  // Update game state
  await supabase
    .from('game_state')
    .update({
      current_phase: 'speaking',
      current_turn_index: 0,
      turn_order: turnOrder,
      timer_end: timerEnd,
      round: nextRound,
      updated_at: new Date().toISOString(),
    })
    .eq('room_id', roomId);

  // Update room status
  await supabase.from('rooms').update({ status: 'playing' }).eq('id', roomId);

  await touchRoomActivity(supabase, roomId);

  return NextResponse.json({ success: true, wordPair: { category: wordPair.category } });
}
