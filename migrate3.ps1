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
        Write-Host "  ERROR: $($_.ErrorDetails.Message)"
        return $null
    }
}

Write-Host "Checking current players columns..."
$cols = Invoke-Query "SELECT column_name FROM information_schema.columns WHERE table_name = 'players' ORDER BY ordinal_position;"
$cols | ForEach-Object { Write-Host "  column: $($_.column_name)" }

Write-Host ""
Write-Host "Adding missing columns..."
Invoke-Query "ALTER TABLE players ADD COLUMN IF NOT EXISTS avatar_color text DEFAULT '#6366f1';" | Out-Null
Write-Host "  avatar_color: done"
Invoke-Query "ALTER TABLE players ADD COLUMN IF NOT EXISTS pos_x float DEFAULT 0;" | Out-Null
Write-Host "  pos_x: done"
Invoke-Query "ALTER TABLE players ADD COLUMN IF NOT EXISTS pos_z float DEFAULT 0;" | Out-Null
Write-Host "  pos_z: done"

Write-Host ""
Write-Host "Reloading PostgREST schema cache..."
try {
    Invoke-RestMethod -Uri "https://api.supabase.com/v1/projects/$projectId/database/schema-cache-refresh" -Method POST -Headers @{
        "Authorization" = "Bearer $token"
        "Content-Type"  = "application/json"
    } | Out-Null
    Write-Host "  Schema cache refreshed OK"
} catch {
    Write-Host "  Schema refresh response: $($_.ErrorDetails.Message)"
}

Write-Host ""
Write-Host "Verifying columns now exist..."
$cols2 = Invoke-Query "SELECT column_name FROM information_schema.columns WHERE table_name = 'players' ORDER BY ordinal_position;"
$cols2 | ForEach-Object { Write-Host "  column: $($_.column_name)" }
