-- Fix missing RLS policy for chat_messages table
-- Run this in your Supabase SQL editor

alter table chat_messages enable row level security;

create policy if not exists "Anyone can insert chat"
  on chat_messages
  for insert
  with check (true);

-- Verify chat_messages policies
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
where tablename = 'chat_messages';
