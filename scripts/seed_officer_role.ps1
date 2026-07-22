param(
    [Parameter(Mandatory = $true)]
    [string]$Email
)

$frontendEnv = Join-Path $PSScriptRoot "..\.env.local"
if (-not (Test-Path $frontendEnv)) {
    Write-Error ".env.local not found. Configure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY first."
    exit 1
}

$envMap = @{}
Get-Content $frontendEnv | ForEach-Object {
    if ($_ -match '^\s*([^#=]+)=(.*)$') {
        $envMap[$matches[1].Trim()] = $matches[2].Trim()
    }
}

$baseUrl = $envMap["SUPABASE_URL"].TrimEnd("/")
$serviceKey = $envMap["SUPABASE_SERVICE_ROLE_KEY"]
if (-not $serviceKey) {
    $serviceKey = $envMap["SUPABASE_SECRET_KEY"]
}
if (-not $baseUrl -or -not $serviceKey) {
    Write-Error "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required in .env.local"
    exit 1
}

$headers = @{
    apikey         = $serviceKey
    Authorization  = "Bearer $serviceKey"
    "Content-Type" = "application/json"
}

$users = Invoke-RestMethod -Uri "$baseUrl/auth/v1/admin/users?page=1&per_page=200" -Headers $headers
$match = $users.users | Where-Object { $_.email -eq $Email } | Select-Object -First 1
if (-not $match) {
    Write-Error "No Supabase user found for $Email"
    exit 1
}

$body = @{
    app_metadata = @{
        provider  = "email"
        providers = @("email")
        role      = "officer"
    }
} | ConvertTo-Json -Depth 4 -Compress

Invoke-RestMethod -Uri "$baseUrl/auth/v1/admin/users/$($match.id)" -Method PUT -Headers $headers -Body $body | Out-Null
Write-Host "Granted officer role to $Email (id=$($match.id))"
