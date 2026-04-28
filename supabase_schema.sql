-- =============================================================
-- IMPOSTER WORD GAME — Supabase Schema
-- Run this in your Supabase SQL editor
-- =============================================================

-- Enable UUID extension
create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------
-- ROOMS
-- ----------------------------------------------------------------
create table if not exists rooms (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  host_id text not null,
  status text not null default 'waiting', -- waiting | playing | voting | ended
  created_at timestamptz default now()
);

alter table rooms enable row level security;
create policy "Anyone can read rooms" on rooms for select using (true);
create policy "Anyone can insert rooms" on rooms for insert with check (true);
create policy "Anyone can update rooms" on rooms for update using (true);

-- ----------------------------------------------------------------
-- PLAYERS
-- ----------------------------------------------------------------
create table if not exists players (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references rooms(id) on delete cascade,
  name text not null,
  session_id text not null,
  avatar_color text default '#6366f1',
  is_imposter boolean default false,
  word text default '',
  is_eliminated boolean default false,
  is_connected boolean default true,
  pos_x float default 0,
  pos_z float default 0,
  joined_at timestamptz default now()
);

alter table players enable row level security;
create policy "Anyone can read players" on players for select using (true);
create policy "Anyone can insert players" on players for insert with check (true);
create policy "Anyone can update players" on players for update using (true);

-- ----------------------------------------------------------------
-- GAME STATE
-- ----------------------------------------------------------------
create table if not exists game_state (
  id uuid primary key default gen_random_uuid(),
  room_id uuid unique references rooms(id) on delete cascade,
  current_phase text default 'lobby', -- lobby | speaking | voting | results
  current_turn_index int default 0,
  turn_order text[] default '{}',   -- array of player IDs
  timer_end timestamptz,
  round int default 1,
  updated_at timestamptz default now()
);

alter table game_state enable row level security;
create policy "Anyone can read game_state" on game_state for select using (true);
create policy "Anyone can insert game_state" on game_state for insert with check (true);
create policy "Anyone can update game_state" on game_state for update using (true);

-- ----------------------------------------------------------------
-- VOTES
-- ----------------------------------------------------------------
create table if not exists votes (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references rooms(id) on delete cascade,
  voter_id uuid references players(id) on delete cascade,
  target_id uuid references players(id) on delete cascade,
  round int default 1,
  created_at timestamptz default now(),
  unique(room_id, voter_id, round)
);

alter table votes enable row level security;
create policy "Anyone can read votes" on votes for select using (true);
create policy "Anyone can insert votes" on votes for insert with check (true);

-- ----------------------------------------------------------------
-- FEEDBACK
-- ----------------------------------------------------------------
create table if not exists feedback (
  id uuid primary key default gen_random_uuid(),
  player_name text default 'Anonymous',
  type text not null default 'bug', -- bug | suggestion | other
  message text not null,
  created_at timestamptz default now()
);

alter table feedback enable row level security;
create policy "Anyone can insert feedback" on feedback for insert with check (true);
create policy "Anyone can read feedback" on feedback for select using (true);

-- ----------------------------------------------------------------
-- Enable Realtime on all tables
-- ----------------------------------------------------------------
alter publication supabase_realtime add table rooms;
alter publication supabase_realtime add table players;
alter publication supabase_realtime add table game_state;
alter publication supabase_realtime add table votes;
