$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

Write-Host "Starting TailTots Local Cloud..."
docker compose -f docker-compose.local-server.yml up -d

$llmLogDir = Join-Path $root "tmp\server"
New-Item -ItemType Directory -Force $llmLogDir | Out-Null
$llmOut = Join-Path $llmLogDir "tailtots-local-llm.out.log"
$llmErr = Join-Path $llmLogDir "tailtots-local-llm.err.log"

$existing = Get-NetTCPConnection -State Listen -LocalPort 18181 -ErrorAction SilentlyContinue
if (-not $existing) {
  Start-Process -FilePath node.exe `
    -ArgumentList "scripts/local-llm-server.mjs" `
    -WorkingDirectory $root `
    -WindowStyle Hidden `
    -RedirectStandardOutput $llmOut `
    -RedirectStandardError $llmErr | Out-Null
}

Write-Host ""
Write-Host "TailTots Local Cloud is starting."
Write-Host "Database:  localhost:15432"
Write-Host "REST API:  http://localhost:18000"
Write-Host "DB Admin:  http://localhost:18080"
Write-Host "LLM API:   http://localhost:18181/health"
Write-Host ""
Write-Host "Adminer login:"
Write-Host "  System:   PostgreSQL"
Write-Host "  Server:   tailtots-db"
Write-Host "  Username: tailtots_app"
Write-Host "  Password: tailtots_local_change_me"
Write-Host "  Database: tailtots"

