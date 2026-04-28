import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { cleanupStaleRooms, touchRoomActivity } from '@/lib/supabase/roomMaintenance';
import { generateRoomCode } from '@/lib/roomCode';

export async function POST(req: NextRequest) {
  try {
    const { hostName, sessionId, avatarColor } = await req.json();
    console.log('[create] body:', { hostName, sessionId, avatarColor });

    if (!hostName || !sessionId) {
      return NextResponse.json({ error: 'Missing hostName or sessionId' }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    console.log('[create] supabase url:', supabaseUrl ? supabaseUrl.slice(0, 40) : 'MISSING');
    console.log('[create] supabase key:', supabaseKey ? 'present' : 'MISSING');

    const supabase = createServerClient();
    await cleanupStaleRooms(supabase);
    let code = generateRoomCode();
    console.log('[create] generated code:', code);

    // Ensure unique code
    let tries = 0;
    while (tries < 10) {
      const { data } = await supabase.from('rooms').select('id').eq('code', code).single();
      if (!data) break;
      code = generateRoomCode();
      tries++;
    }

    console.log('[create] inserting room...');
    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .insert({ code, host_id: sessionId, status: 'waiting' })
      .select()
      .single();

    if (roomError || !room) {
      console.error('[create] room error:', roomError);
      return NextResponse.json({ error: roomError?.message || 'Failed to create room' }, { status: 500 });
    }
    console.log('[create] room created:', room.id);

    const requestedAvatarColor = typeof avatarColor === 'string' ? avatarColor.trim() : '';

    const playerInsert: Record<string, any> = {
      room_id: room.id,
      name: hostName,
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
      console.error('[create] player error:', playerError);
      return NextResponse.json({ error: playerError?.message || 'Failed to create player' }, { status: 500 });
    }
    console.log('[create] player created:', player.id);

    if (requestedAvatarColor && player.avatar_color !== requestedAvatarColor) {
      await supabase.from('players').update({ avatar_color: requestedAvatarColor }).eq('id', player.id);
    }

    const { error: gsError } = await supabase
      .from('game_state')
      .insert({ room_id: room.id, current_phase: 'lobby', current_turn_index: 0, turn_order: [], round: 1 });

    if (gsError) {
      console.error('[create] game_state error:', gsError);
      return NextResponse.json({ error: gsError.message }, { status: 500 });
    await touchRoomActivity(supabase, room.id);

    }

    await touchRoomActivity(supabase, room.id);

    console.log('[create] done');
    return NextResponse.json({ room, player });
  } catch (err) {
    console.error('[create] uncaught exception:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
