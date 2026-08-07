$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

Write-Host "Stopping TailTots Local Cloud..."
docker compose -f docker-compose.local-server.yml down

$llm = Get-NetTCPConnection -State Listen -LocalPort 18181 -ErrorAction SilentlyContinue
if ($llm) {
  foreach ($processId in ($llm.OwningProcess | Select-Object -Unique)) {
    Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
  }
}

Write-Host "Stopped."
