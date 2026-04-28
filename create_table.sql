create table if not exists play_again_requests (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references rooms(id) on delete cascade,
  host_id text not null,
  status text default 'pending',
  created_at timestamptz default now(),
  unique(room_id)
);

alter table play_again_requests enable row level security;
create policy "Anyone can read play_again_requests" on play_again_requests for select using (true);
-- Writes are handled by the server-side API routes.

alter publication supabase_realtime add table play_again_requests;
