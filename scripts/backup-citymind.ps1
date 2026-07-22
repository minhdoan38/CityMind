param(
  [Parameter(Mandatory = $true)]
  [string]$Output
)

$ErrorActionPreference = "Stop"
$appRoot = Split-Path -Parent $PSScriptRoot
Push-Location $appRoot
try {
  node scripts/backup-citymind.mjs -Output $Output
  exit $LASTEXITCODE
}
finally {
  Pop-Location
}
