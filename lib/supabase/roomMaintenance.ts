import type { SupabaseClient } from '@supabase/supabase-js';

export async function cleanupStaleRooms(supabase: SupabaseClient) {
  await supabase.rpc('cleanup_stale_rooms');
}

export async function touchRoomActivity(supabase: SupabaseClient, roomId: string) {
  await supabase.rpc('touch_room_activity', { p_room_id: roomId });
}
