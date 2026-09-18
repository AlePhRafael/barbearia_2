$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$recordPath = Join-Path $projectRoot '.local-run\processes.json'
if (!(Test-Path -LiteralPath $recordPath)) { Write-Host 'Nenhum processo registrado.'; return }
$records = Get-Content -LiteralPath $recordPath -Raw | ConvertFrom-Json
$processes = Get-CimInstance Win32_Process
function Stop-ProcessTree([int]$processIdentifier) {
    foreach ($child in $processes | Where-Object { $_.ParentProcessId -eq $processIdentifier }) {
        Stop-ProcessTree -processIdentifier $child.ProcessId
    }
    Stop-Process -Id $processIdentifier -ErrorAction SilentlyContinue
}
foreach ($record in $records) {
    $process = Get-Process -Id $record.id -ErrorAction SilentlyContinue
    if ($process -and $process.StartTime.ToUniversalTime().ToString('o') -eq $record.started) {
        Stop-ProcessTree -processIdentifier $record.id
    }
}
Write-Host 'Processos registrados do sistema encerrados.'
