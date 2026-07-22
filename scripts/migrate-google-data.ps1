param(
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"
$appRoot = Split-Path -Parent $PSScriptRoot
$gatePath = Join-Path $appRoot "migration-manifests\source-access-and-backup-gate.json"

if (-not (Test-Path $gatePath)) {
  throw "Missing gate manifest: $gatePath"
}

$gate = Get-Content -Raw $gatePath | ConvertFrom-Json
if (-not $gate.signed -or $gate.status -ne "PASS") {
  throw "source-access-and-backup-gate.json must be signed PASS before migration writes"
}

Push-Location $appRoot
try {
  node scripts/verify-tooling-decision.mjs --file operations/tooling-decision.json

  if (-not $DryRun) {
    node scripts/run-supabase-sql.mjs -f supabase/migrations/20260721130004_evidence_path_additive.sql
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    node scripts/run-supabase-sql.mjs -f supabase/tests/07_evidence_additive.sql
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
  }

  node scripts/reconcile-migration.mjs --write --require-pass --require-signed
  exit $LASTEXITCODE
}
finally {
  Pop-Location
}
