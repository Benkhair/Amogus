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
        $errMsg = $_.ErrorDetails.Message
        if ($errMsg -match "already exists") {
            return "already exists"
        }
        Write-Host "  WARNING: $errMsg"
        return $null
    }
}

Write-Host "Adding 3D columns to players table..."
Invoke-Query "alter table players add column if not exists avatar_color text default '#6366f1';" | Out-Null
Write-Host "  avatar_color column OK"
Invoke-Query "alter table players add column if not exists pos_x float default 0;" | Out-Null
Write-Host "  pos_x column OK"
Invoke-Query "alter table players add column if not exists pos_z float default 0;" | Out-Null
Write-Host "  pos_z column OK"

Write-Host ""
Write-Host "Migration complete!"
