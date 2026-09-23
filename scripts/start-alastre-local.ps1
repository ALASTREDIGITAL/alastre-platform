$ErrorActionPreference = "Stop"

$projectDir = Split-Path -Parent $PSScriptRoot
$port = 5175
$url = "http://127.0.0.1:$port"
$healthUrl = "http://127.0.0.1:$port"

function Test-AlastreServer {
  try {
    $response = Invoke-WebRequest -Uri $healthUrl -UseBasicParsing -TimeoutSec 10
    return $response.StatusCode -ge 200 -and $response.StatusCode -lt 500
  } catch {
    return $false
  }
}

function Open-AlastreChrome {
  $chromeCandidates = @(@(
    (Get-Command chrome.exe -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source -First 1),
    "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
    "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
    "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
  ) | Where-Object { $_ -and (Test-Path -LiteralPath $_) } | Select-Object -Unique)

  if (-not $chromeCandidates) {
    throw "Google Chrome nao foi encontrado. Abra manualmente: $url"
  }

  Start-Process -FilePath $chromeCandidates[0] -ArgumentList $url
}

try {
  Write-Host "Alastre Platform - inicializacao local" -ForegroundColor Cyan

  if (Test-AlastreServer) {
    Write-Host "O servidor ja esta ativo na porta $port." -ForegroundColor Green
    Open-AlastreChrome
    Write-Host "Chrome aberto em $url"
    exit 0
  }

  $bun = Get-Command bun.exe -ErrorAction SilentlyContinue
  if (-not $bun) {
    throw "Bun nao foi encontrado. Instale o Bun e tente novamente."
  }
  if (-not (Test-Path -LiteralPath "$projectDir\node_modules\.bin\vite.cmd")) {
    throw "Dependencias nao encontradas. Execute 'bun install' no projeto e tente novamente."
  }

  Set-Location -LiteralPath $projectDir
  $env:WRANGLER_LOG_PATH = ".wrangler/wrangler.log"
  Write-Host "Iniciando servidor em $url ..." -ForegroundColor Yellow
  $server = Start-Process -FilePath $bun.Source -ArgumentList @(
    "run", "dev", "--", "--host", "0.0.0.0", "--port", "$port"
  ) -NoNewWindow -PassThru

  $deadline = (Get-Date).AddSeconds(180)
  while ((Get-Date) -lt $deadline) {
    if ($server.HasExited) {
      throw "O servidor encerrou antes de ficar disponivel (codigo $($server.ExitCode))."
    }
    if (Test-AlastreServer) {
      Write-Host "Servidor pronto." -ForegroundColor Green
      Open-AlastreChrome
      Write-Host "Chrome aberto. Feche esta janela para encerrar o servidor." -ForegroundColor Cyan
      Wait-Process -Id $server.Id
      exit $server.ExitCode
    }
    Start-Sleep -Milliseconds 750
  }

  if (-not $server.HasExited) { Stop-Process -Id $server.Id }
  throw "O servidor nao respondeu em 180 segundos. Confira as mensagens acima."
} catch {
  Write-Host "ERRO: $($_.Exception.Message)" -ForegroundColor Red
  Write-Host "Pressione qualquer tecla para fechar."
  $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
  exit 1
}
