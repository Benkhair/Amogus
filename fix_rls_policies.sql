-- Fix missing RLS policies for votes table
-- Run this in your Supabase SQL Editor

-- Add UPDATE policy for votes
create policy if not exists "Anyone can update votes" 
  on votes 
  for update 
  using (true);

-- Add DELETE policy for votes
create policy if not exists "Anyone can delete votes" 
  on votes 
  for delete 
  using (true);

-- Verify all policies exist
select 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
from pg_policies 
where tablename = 'votes';
