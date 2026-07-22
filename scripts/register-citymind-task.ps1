param(
  [switch]$Register,
  [switch]$Verify,
  [switch]$Unregister,
  [string]$BindHost = "127.0.0.1",
  [int]$Port = 3000,
  [string]$TaskName = "CityMind"
)

$ErrorActionPreference = "Stop"

$frontendRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$operationsRoot = Join-Path $frontendRoot "operations"
$runtimeDecisionPath = Join-Path $operationsRoot "operator-runtime-decision.json"
$logDir = Join-Path $operationsRoot "logs"
$stdoutLog = Join-Path $logDir "citymind-stdout.log"
$stderrLog = Join-Path $logDir "citymind-stderr.log"

function Write-Info([string]$Message) {
  Write-Host "register-citymind-task: $Message"
}

function Fail([string]$Message) {
  Write-Error "register-citymind-task: $Message"
  exit 1
}

function Get-NodeExecutable {
  $node = Get-Command node -ErrorAction SilentlyContinue
  if (-not $node) {
    Fail "node executable not found on PATH (Node 22+ required)"
  }
  $version = & $node.Source -v
  $major = [int]($version.TrimStart("v").Split(".")[0])
  if ($major -lt 22) {
    Fail "Node 22+ required (found $version at $($node.Source))"
  }
  return $node.Source
}

function Read-RuntimeDecision {
  if (-not (Test-Path $runtimeDecisionPath)) {
    return $null
  }
  return Get-Content -Raw $runtimeDecisionPath | ConvertFrom-Json
}

function Resolve-BindHost {
  $decision = Read-RuntimeDecision
  if ($decision -and $decision.bindHost) {
    return [string]$decision.bindHost
  }
  return $BindHost
}

function Assert-LoopbackBind([string]$HostValue) {
  if ($HostValue -eq "0.0.0.0" -or $HostValue -eq "::") {
    Fail "Refusing non-loopback bind $HostValue without signed publicExposureApproved runtime decision"
  }
  $decision = Read-RuntimeDecision
  if ($HostValue -ne "127.0.0.1" -and $HostValue -ne "localhost") {
    if (-not $decision -or $decision.publicExposureApproved -ne $true) {
      Fail "Non-loopback bind $HostValue requires signed operator-runtime-decision with publicExposureApproved=true"
    }
  }
}

function New-TriageStartScript {
  New-Item -ItemType Directory -Force -Path $logDir | Out-Null
  $scriptPath = Join-Path $operationsRoot "start-citymind-triage.cmd"
  $triageStdout = Join-Path $logDir "citymind-triage-stdout.log"
  $triageStderr = Join-Path $logDir "citymind-triage-stderr.log"
  $lines = @(
    "@echo off",
    "setlocal",
    "cd /d `"$frontendRoot`"",
    "set NODE_ENV=production",
    "call npm run triage:worker >> `"$triageStdout`" 2>> `"$triageStderr`""
  )
  Set-Content -Path $scriptPath -Value ($lines -join "`r`n") -Encoding ASCII
  return $scriptPath
}

function Register-CityMindTriageTask {
  $startScript = New-TriageStartScript
  $triageTaskName = "CityMind-Triage"

  $action = New-ScheduledTaskAction `
    -Execute $startScript `
    -WorkingDirectory $frontendRoot

  $triggerLogon = New-ScheduledTaskTrigger -AtLogOn
  $triggerStartup = New-ScheduledTaskTrigger -AtStartup

  $settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -RestartCount 3 `
    -RestartInterval (New-TimeSpan -Minutes 1) `
    -ExecutionTimeLimit ([TimeSpan]::Zero)

  $principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited

  Register-ScheduledTask `
    -TaskName $triageTaskName `
    -Action $action `
    -Trigger @($triggerLogon, $triggerStartup) `
    -Settings $settings `
    -Principal $principal `
    -Force | Out-Null

  Write-Info "Registered task '$triageTaskName' (workdir=$frontendRoot)"
}

function New-StartScript([string]$NodeExe, [string]$HostValue, [int]$ListenPort) {
  New-Item -ItemType Directory -Force -Path $logDir | Out-Null
  $scriptPath = Join-Path $operationsRoot "start-citymind.cmd"
  $lines = @(
    "@echo off",
    "setlocal",
    "cd /d `"$frontendRoot`"",
    "set HOSTNAME=$HostValue",
    "set PORT=$ListenPort",
    "set NODE_ENV=production",
    "call npm run start -- -H $HostValue -p $ListenPort >> `"$stdoutLog`" 2>> `"$stderrLog`""
  )
  Set-Content -Path $scriptPath -Value ($lines -join "`r`n") -Encoding ASCII
  return $scriptPath
}

function Register-CityMindTask {
  $hostValue = Resolve-BindHost
  Assert-LoopbackBind $hostValue
  $nodeExe = Get-NodeExecutable
  $startScript = New-StartScript -NodeExe $nodeExe -HostValue $hostValue -ListenPort $Port

  $action = New-ScheduledTaskAction `
    -Execute $startScript `
    -WorkingDirectory $frontendRoot

  $triggerLogon = New-ScheduledTaskTrigger -AtLogOn
  $triggerStartup = New-ScheduledTaskTrigger -AtStartup

  $settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -RestartCount 3 `
    -RestartInterval (New-TimeSpan -Minutes 1) `
    -ExecutionTimeLimit ([TimeSpan]::Zero)

  $principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited

  Register-ScheduledTask `
    -TaskName $TaskName `
    -Action $action `
    -Trigger @($triggerLogon, $triggerStartup) `
    -Settings $settings `
    -Principal $principal `
    -Force | Out-Null

  Write-Info "Registered task '$TaskName' (bind=$hostValue port=$Port workdir=$frontendRoot)"
  Write-Info "Logs: $stdoutLog / $stderrLog"
}

function Unregister-CityMindTask {
  $existing = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
  if ($existing) {
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
    Write-Info "Unregistered task '$TaskName'"
  } else {
    Write-Info "Task '$TaskName' not found"
  }
}

function Test-Readiness([string]$HostValue, [int]$ListenPort) {
  $url = "http://${HostValue}:${ListenPort}/api/ready"
  $deadline = (Get-Date).AddSeconds(60)
  while ((Get-Date) -lt $deadline) {
    try {
      $response = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 5
      if ($response.StatusCode -eq 200) {
        Write-Info "Readiness OK at $url"
        return
      }
    } catch {
      Start-Sleep -Seconds 2
    }
  }
  Fail "Timed out waiting for readiness at $url"
}

function Verify-CityMindTask {
  $hostValue = Resolve-BindHost
  Assert-LoopbackBind $hostValue

  $task = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
  if (-not $task) {
    Fail "Scheduled task '$TaskName' is not registered (run with -Register first)"
  }

  $info = Get-ScheduledTaskInfo -TaskName $TaskName
  Write-Info "Task state=$($task.State) lastResult=$($info.LastTaskResult)"

  $action = $task.Actions | Select-Object -First 1
  if (-not $action) {
    Fail "Task '$TaskName' has no actions"
  }

  $workdir = $action.WorkingDirectory
  if ($workdir -ne $frontendRoot) {
    Fail "Unexpected working directory '$workdir' (expected $frontendRoot)"
  }

  if ($action.Execute -notmatch "start-citymind\.cmd$") {
    Fail "Unexpected execute target '$($action.Execute)'"
  }

  $settings = $task.Settings
  if ($settings.RestartCount -lt 1) {
    Fail "Task restart policy is not configured"
  }

  Test-Readiness -HostValue $hostValue -ListenPort $Port
}

if ($Unregister) {
  Unregister-CityMindTask
  exit 0
}

if ($Register) {
  Register-CityMindTask
  Register-CityMindTriageTask
}

if ($Verify) {
  Verify-CityMindTask
  exit 0
}

if (-not $Register) {
  Write-Host @"
CityMind Task Scheduler helper

  -Register     Create or update the '$TaskName' scheduled task (loopback bind)
  -Verify        Assert task definition and poll /api/ready on loopback
  -Unregister    Remove the scheduled task

Optional: -BindHost 127.0.1 -Port 3000 -TaskName CityMind
"@
}
