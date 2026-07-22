param(
  [switch]$WriteGate,
  [string]$DbBackupPath,
  [string]$StorageBackupPath,
  [string]$Signer
)

$ErrorActionPreference = "Stop"
$appRoot = Split-Path -Parent $PSScriptRoot
$gatePath = Join-Path $appRoot "migration-manifests\source-access-and-backup-gate.json"

$argsList = @("scripts/capture-migration-inventory.mjs")
if ($WriteGate) { $argsList += "--write-gate" }
if ($DbBackupPath) { $argsList += "--db-backup=$DbBackupPath" }

Push-Location $appRoot
try {
  node @argsList
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

  if ($WriteGate) {
  $gate = Get-Content -Raw $gatePath | ConvertFrom-Json
  if ($StorageBackupPath) {
    if (-not (Test-Path $StorageBackupPath)) {
      throw "Storage backup not found: $StorageBackupPath"
    }
    $hash = (Get-FileHash -Algorithm SHA256 -Path $StorageBackupPath).Hash.ToLower()
    $gate.storage_backup_hash = $hash
  }
  if ($Signer) {
    $gate.signer = $Signer
    $gate.signed = $true
    $gate.signedAt = (Get-Date).ToString("o")
    $gate.status = "PASS"
  }
  $gate | ConvertTo-Json -Depth 20 | Set-Content -Encoding utf8 $gatePath
  Write-Host "inventory-google-sources: updated gate manifest"
  }
}
finally {
  Pop-Location
}
