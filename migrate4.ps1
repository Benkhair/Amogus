$token = "sbp_d746cd97908a16e6173a2875df312f630278c98f"
$projectId = "nemibwsddchdhasbripf"
$url = "https://api.supabase.com/v1/projects/$projectId/database/query"

function Invoke-Query($sql) {
    $body = @{ query = $sql } | ConvertTo-Json -Compress
    try {
        $response = Invoke-RestMethod -Uri $url -Method POST -Headers @{
            "Authorization" = "Bearer $token"
            "Content-Type"  = "application/json"
        } -Body $body
        return $response
    } catch {
        Write-Host "  WARNING: $($_.ErrorDetails.Message)"
        return $null
    }
}

Write-Host "Creating chat_messages table..."
Invoke-Query @"
create table if not exists chat_messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references rooms(id) on delete cascade,
  player_id uuid references players(id) on delete cascade,
  text text not null,
  turn_index int default 0,
  created_at timestamptz default now()
);
"@ | Out-Null
Write-Host "  table created"

Invoke-Query "alter table chat_messages enable row level security;" | Out-Null
Invoke-Query 'create policy "Anyone can read chat" on chat_messages for select using (true);' | Out-Null
Invoke-Query 'create policy "Anyone can insert chat" on chat_messages for insert with check (true);' | Out-Null
Write-Host "  RLS OK"

Invoke-Query "alter publication supabase_realtime add table chat_messages;" | Out-Null
Write-Host "  Realtime OK"

Write-Host ""
Write-Host "Done!"
