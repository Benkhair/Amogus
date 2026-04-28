-- Fix missing RLS policy for players table
-- Run this in your Supabase SQL editor

alter table players enable row level security;

create policy if not exists "Anyone can insert players"
  on players
  for insert
  with check (true);

-- Verify players policies
select
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where tablename = 'players';
