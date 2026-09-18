param([switch]$SkipBuild)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$runDirectory = Join-Path $projectRoot '.local-run'
$pythonExecutable = Join-Path $projectRoot 'backend\.venv\Scripts\python.exe'
$nodeExecutable = (Get-Command node.exe -ErrorAction Stop).Source
$nextCli = Join-Path $projectRoot 'node_modules\next\dist\bin\next'
if (!(Test-Path -LiteralPath $pythonExecutable)) { throw 'Instale as dependências conforme o README antes de iniciar.' }
foreach ($port in @(3000, 8000)) {
    if (Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue) { throw "A porta $port já está ocupada. Encerre a instância anterior." }
}
Push-Location $projectRoot
try {
    if (!$SkipBuild) {
        & npm.cmd run build
        if ($LASTEXITCODE -ne 0) { throw 'Build do frontend falhou.' }
    }
    New-Item -ItemType Directory -Path $runDirectory -Force | Out-Null
    $apiProcess = Start-Process -FilePath $pythonExecutable -ArgumentList @('-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', '8000', '--no-access-log') -WorkingDirectory (Join-Path $projectRoot 'backend') -WindowStyle Hidden -RedirectStandardOutput (Join-Path $runDirectory 'api.log') -RedirectStandardError (Join-Path $runDirectory 'api-error.log') -PassThru
    $records = @(@{ id = $apiProcess.Id; started = $apiProcess.StartTime.ToUniversalTime().ToString('o'); role = 'api' })
    $records | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $runDirectory 'processes.json') -Encoding UTF8
    $webProcess = Start-Process -FilePath $nodeExecutable -ArgumentList @("`"$nextCli`"", 'start', '--hostname', '127.0.0.1', '--port', '3000') -WorkingDirectory $projectRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $runDirectory 'web.log') -RedirectStandardError (Join-Path $runDirectory 'web-error.log') -PassThru
    $records += @{ id = $webProcess.Id; started = $webProcess.StartTime.ToUniversalTime().ToString('o'); role = 'web' }
    $records | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $runDirectory 'processes.json') -Encoding UTF8
    $healthy = $false
    for ($attempt = 0; $attempt -lt 20; $attempt++) {
        try {
            $response = Invoke-RestMethod -Uri 'http://127.0.0.1:3000/api/health' -TimeoutSec 2
            if ($response.status -eq 'ok') { $healthy = $true; break }
        } catch { Start-Sleep -Milliseconds 500 }
    }
    if (!$healthy) { throw 'O sistema não iniciou. Verifique .local-run e confirme que o banco foi inicializado.' }
    Write-Host 'Sistema disponível em http://127.0.0.1:3000. Para encerrar: .\scripts\stop-local.ps1'
} catch {
    & (Join-Path $PSScriptRoot 'stop-local.ps1')
    throw
} finally { Pop-Location }
