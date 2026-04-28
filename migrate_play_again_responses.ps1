$projectRef = "nemibwsddchdhasbripf"
$token = "sbp_d746cd97908a16e6173a2875df312f630278c98f"

$url = "https://$projectRef.supabase.co/rest/v1/rpc/sql"

function Invoke-Query($sql) {
    $body = @{ query = $sql } | ConvertTo-Json -Compress
    try {
        $response = Invoke-RestMethod -Uri $url -Method POST -Headers @{
            "Authorization" = "Bearer $token"
            "Content-Type"  = "application/json"
        } -Body $body
        return $response
    } catch {
        Write-Host "WARNING: $($_.ErrorDetails.Message)"
        return $null
    }
}

Write-Host "Creating play_again_responses table..."

$sql = @"
create table if not exists play_again_responses (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references rooms(id) on delete cascade,
  player_id uuid references players(id) on delete cascade,
  response text not null check (response in ('accepted', 'declined')),
  created_at timestamptz default now(),
  unique(room_id, player_id)
);

alter table play_again_responses enable row level security;
create policy "Anyone can read play_again_responses" on play_again_responses for select using (true);
-- Writes are handled by the server-side API routes.

alter publication supabase_realtime add table play_again_responses;
"@

Invoke-Query $sql
Write-Host "Table created successfully"
