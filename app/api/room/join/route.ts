import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { cleanupStaleRooms, touchRoomActivity } from '@/lib/supabase/roomMaintenance';

export async function POST(req: NextRequest) {
  const { playerName, sessionId, code, avatarColor } = await req.json();

  if (!playerName || !sessionId || !code) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const supabase = createServerClient();
  await cleanupStaleRooms(supabase);

  const { data: room, error: roomError } = await supabase
    .from('rooms')
    .select('*')
    .eq('code', code.toUpperCase())
    .single();

  if (roomError || !room) {
    return NextResponse.json({ error: 'Room not found' }, { status: 404 });
  }

  if (room.status !== 'waiting') {
    return NextResponse.json({ error: 'Game already in progress' }, { status: 400 });
  }

  const requestedAvatarColor = typeof avatarColor === 'string' ? avatarColor.trim() : '';

  // Check if session already in room
  const { data: existing } = await supabase
    .from('players')
    .select('*')
    .eq('room_id', room.id)
    .eq('session_id', sessionId)
    .single();

  if (existing) {
    if (requestedAvatarColor) {
      const { data: colorConflict } = await supabase
        .from('players')
        .select('id, session_id')
        .eq('room_id', room.id)
        .eq('avatar_color', requestedAvatarColor)
        .eq('is_eliminated', false)
        .neq('id', existing.id)
        .maybeSingle();

      if (colorConflict) {
        return NextResponse.json({ error: 'That avatar color is already taken' }, { status: 409 });
      }
    }

    // Re-activate the player if they were disconnected/eliminated
    const updates: Record<string, any> = { is_connected: true, is_eliminated: false };
    if (playerName) updates.name = playerName;
    if (requestedAvatarColor) updates.avatar_color = requestedAvatarColor;

    const { data: reactivated } = await supabase
      .from('players')
      .update(updates)
      .eq('id', existing.id)
      .select()
      .single();

    await touchRoomActivity(supabase, room.id);
    return NextResponse.json({ room, player: reactivated ?? existing });
  }

  // Count current players
  const { count } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true })
    .eq('room_id', room.id)
    .eq('is_eliminated', false);

  if ((count ?? 0) >= 10) {
    return NextResponse.json({ error: 'Room is full' }, { status: 400 });
  }

  if (requestedAvatarColor) {
    const { data: colorConflict } = await supabase
      .from('players')
      .select('id, session_id')
      .eq('room_id', room.id)
      .eq('avatar_color', requestedAvatarColor)
      .eq('is_eliminated', false)
      .maybeSingle();

    if (colorConflict) {
      return NextResponse.json({ error: 'That avatar color is already taken' }, { status: 409 });
    }
  }

  const playerInsert: Record<string, any> = {
    room_id: room.id,
    name: playerName,
    session_id: sessionId,
  };
  if (requestedAvatarColor) {
    playerInsert.avatar_color = requestedAvatarColor;
  }

  const { data: player, error: playerError } = await supabase
    .from('players')
    .insert(playerInsert)
    .select()
    .single();

  if (playerError || !player) {
    return NextResponse.json({ error: playerError?.message || 'Failed to join room' }, { status: 500 });
  }

  // Best-effort fallback if the column wasn't in the schema cache during insert
  if (requestedAvatarColor && player.avatar_color !== requestedAvatarColor) {
    await supabase.from('players').update({ avatar_color: requestedAvatarColor }).eq('id', player.id);
  }

  await touchRoomActivity(supabase, room.id);

  return NextResponse.json({ room, player });
}
