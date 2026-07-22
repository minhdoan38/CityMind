param(
  [Parameter(Mandatory = $true)]
  [string]$Input,
  [ValidateSet("isolated", "in-place")]
  [string]$Target = "isolated"
)

$ErrorActionPreference = "Stop"
$appRoot = Split-Path -Parent $PSScriptRoot
Push-Location $appRoot
try {
  node scripts/restore-citymind.mjs -Input $Input -Target $Target
  exit $LASTEXITCODE
}
finally {
  Pop-Location
}
