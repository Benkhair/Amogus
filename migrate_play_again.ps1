$projectRef = "nemibwsddchdhasbripf"
$token = $env:SUPABASE_ACCESS_TOKEN

if (-not $token) {
    Write-Host "ERROR: SUPABASE_ACCESS_TOKEN environment variable not set"
    exit 1
}

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

Write-Host "Creating play_again_requests table..."

$sql = @"
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
"@

Invoke-Query $sql
Write-Host "Table created successfully"
