$token = "sbp_d746cd97908a16e6173a2875df312f630278c98f"
$projectId = "nemibwsddchdhasbripf"
$url = "https://api.supabase.com/v1/projects/$projectId/database/query"

function Invoke-Query($sql) {
    $body = @{ query = $sql } | ConvertTo-Json -Compress
    $response = Invoke-RestMethod -Uri $url -Method POST -Headers @{
        "Authorization" = "Bearer $token"
        "Content-Type"  = "application/json"
    } -Body $body -ErrorAction SilentlyContinue
    return $response
}

Write-Host "Running migration on Sudlat project ($projectId)..."

# 1. Extension
Invoke-Query "create extension if not exists pgcrypto;" | Out-Null
Write-Host "[1/8] pgcrypto extension OK"

# 2. rooms table
Invoke-Query @"
create table if not exists rooms (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  host_id text not null,
  status text not null default 'waiting',
  created_at timestamptz default now()
);
"@ | Out-Null
Write-Host "[2/8] rooms table OK"

# 3. rooms RLS
Invoke-Query "alter table rooms enable row level security;" | Out-Null
Invoke-Query 'create policy if not exists "Anyone can read rooms" on rooms for select using (true);' | Out-Null
Invoke-Query 'create policy if not exists "Anyone can insert rooms" on rooms for insert with check (true);' | Out-Null
Invoke-Query 'create policy if not exists "Anyone can update rooms" on rooms for update using (true);' | Out-Null
Write-Host "[3/8] rooms RLS OK"

# 4. players table
Invoke-Query @"
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
"@ | Out-Null
Write-Host "[4/8] players table OK"

# 5. players RLS
Invoke-Query "alter table players enable row level security;" | Out-Null
Invoke-Query 'create policy if not exists "Anyone can read players" on players for select using (true);' | Out-Null
Invoke-Query 'create policy if not exists "Anyone can insert players" on players for insert with check (true);' | Out-Null
Invoke-Query 'create policy if not exists "Anyone can update players" on players for update using (true);' | Out-Null
Write-Host "[5/8] players RLS OK"

# 6. game_state table
Invoke-Query @"
create table if not exists game_state (
  id uuid primary key default gen_random_uuid(),
  room_id uuid unique references rooms(id) on delete cascade,
  current_phase text default 'lobby',
  current_turn_index int default 0,
  turn_order text[] default '{}',
  timer_end timestamptz,
  round int default 1,
  updated_at timestamptz default now()
);
"@ | Out-Null
Write-Host "[6/8] game_state table OK"

# 7. game_state RLS
Invoke-Query "alter table game_state enable row level security;" | Out-Null
Invoke-Query 'create policy if not exists "Anyone can read game_state" on game_state for select using (true);' | Out-Null
Invoke-Query 'create policy if not exists "Anyone can insert game_state" on game_state for insert with check (true);' | Out-Null
Invoke-Query 'create policy if not exists "Anyone can update game_state" on game_state for update using (true);' | Out-Null
Write-Host "[7/8] game_state RLS OK"

# 8. votes table
Invoke-Query @"
create table if not exists votes (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references rooms(id) on delete cascade,
  voter_id uuid references players(id) on delete cascade,
  target_id uuid references players(id) on delete cascade,
  round int default 1,
  created_at timestamptz default now(),
  unique(room_id, voter_id, round)
);
"@ | Out-Null
Invoke-Query "alter table votes enable row level security;" | Out-Null
Invoke-Query 'create policy if not exists "Anyone can read votes" on votes for select using (true);' | Out-Null
Invoke-Query 'create policy if not exists "Anyone can insert votes" on votes for insert with check (true);' | Out-Null
Invoke-Query 'create policy if not exists "Anyone can update votes" on votes for update using (true);' | Out-Null
Invoke-Query 'create policy if not exists "Anyone can delete votes" on votes for delete using (true);' | Out-Null
Write-Host "[8/8] votes table OK"

# 9. Realtime
Invoke-Query "alter publication supabase_realtime add table rooms;" | Out-Null
Invoke-Query "alter publication supabase_realtime add table players;" | Out-Null
Invoke-Query "alter publication supabase_realtime add table game_state;" | Out-Null
Invoke-Query "alter publication supabase_realtime add table votes;" | Out-Null
Write-Host "[9/9] Realtime OK"

Write-Host ""
Write-Host "Migration complete! Fetching anon key..."

# Get anon key
$keys = Invoke-RestMethod -Uri "https://api.supabase.com/v1/projects/$projectId/api-keys" -Method GET -Headers @{
    "Authorization" = "Bearer $token"
}
$anonKey = ($keys | Where-Object { $_.name -eq "anon" }).api_key
$projectUrl = "https://$projectId.supabase.co"

Write-Host ""
Write-Host "=== ADD TO .env.local ==="
Write-Host "NEXT_PUBLIC_SUPABASE_URL=$projectUrl"
Write-Host "NEXT_PUBLIC_SUPABASE_ANON_KEY=$anonKey"
