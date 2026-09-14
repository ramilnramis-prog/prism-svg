<#
.SYNOPSIS
  Пуш в GitHub в обход git-транспорта.

.DESCRIPTION
  Зачем обход. В этом окружении git и curl (libcurl) и .NET-стек PowerShell 5.1
  не проходят TLS до api.github.com: соединение закрывается на рукопожатии.
  При этом Node.js и gh (Go) в сеть ходят нормально.

  Обратная проблема: Node в песочнице не может порождать процессы с перехватом
  вывода (EPERM), то есть сам прочитать файлы через git не способен.

  Поэтому работа делится:
    1. PowerShell вызывает git, читает файлы и пишет манифест (пути + base64).
    2. Node читает манифест и собирает коммит через Git Data API:
       blob на файл -> tree -> commit -> ref.

.EXAMPLE
  & .\tools\gh-push.ps1 -DryRun
  & .\tools\gh-push.ps1 -Limit 3
  & .\tools\gh-push.ps1
#>
[CmdletBinding()]
param(
  [string]$RepoPath = (Split-Path -Parent $PSScriptRoot),
  [string]$Owner = 'ramilnramis-prog',
  [string]$Repo = 'prism-svg',
  [string]$Branch = 'main',
  [string]$Message,
  [int]$Limit = 0,
  [switch]$DryRun
)

$ErrorActionPreference = 'Stop'
Set-Location $RepoPath

function Write-Step($t) { Write-Host $t -ForegroundColor Cyan }
function Write-Ok($t) { Write-Host $t -ForegroundColor Green }

Write-Step "Репозиторий: $Owner/$Repo, ветка $Branch"
Write-Host "  папка: $RepoPath"

# --- токен -------------------------------------------------------------------
$token = $null
foreach ($i in 1..3) {
  $token = (& gh auth token --hostname github.com 2>$null | Select-Object -First 1)
  if ($token) { break }
  Start-Sleep -Seconds 2
}
if (-not $token) { throw 'Не удалось получить токен: gh auth token' }
Write-Host ("  токен получен ({0} симв.)" -f $token.Length)

# --- список файлов ------------------------------------------------------------
$files = @(& git ls-files)
if ($Limit -gt 0) { $files = $files | Select-Object -First $Limit }
if (-not $files) { throw 'git ls-files пуст — нечего загружать' }

if (-not $Message) {
  $Message = (& git log -1 --pretty=%B | Out-String).Trim()
  if (-not $Message) { $Message = 'feat: генератор процедурных SVG-постеров' }
  $Message += "`n`n(загружено через GitHub API: git-транспорт в этом окружении недоступен)"
}

$authorName = (& git config user.name)
$authorEmail = (& git config user.email)
Write-Host "  файлов: $($files.Count), автор: $authorName <$authorEmail>"

if ($DryRun) {
  $files | ForEach-Object { Write-Host "  $_" }
  Write-Host 'Режим -DryRun: ничего не отправлял.' -ForegroundColor Yellow
  return
}

# --- содержимое ---------------------------------------------------------------
Write-Step 'Читаю файлы...'
$items = New-Object System.Collections.Generic.List[object]
$total = 0
foreach ($f in $files) {
  $bytes = [System.IO.File]::ReadAllBytes((Join-Path $RepoPath $f))
  $total += $bytes.Length
  $items.Add(@{
      path    = ($f -replace '\\', '/')
      content = [Convert]::ToBase64String($bytes)
      size    = $bytes.Length
    })
}
Write-Ok ("  прочитано: {0} файлов, {1:N2} МБ" -f $items.Count, ($total / 1MB))

$manifest = @{
  owner   = $Owner
  repo    = $Repo
  branch  = $Branch
  message = $Message
  author  = @{ name = $authorName; email = $authorEmail }
  files   = $items.ToArray()
}

$manifestPath = Join-Path $env:TEMP 'prism-svg-manifest.json'
Write-Step "Пишу манифест: $manifestPath"
[System.IO.File]::WriteAllText(
  $manifestPath,
  ($manifest | ConvertTo-Json -Depth 10 -Compress),
  [System.Text.UTF8Encoding]::new($false)
)
Write-Host ("  размер: {0:N2} МБ" -f ((Get-Item $manifestPath).Length / 1MB))

if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw 'Node.js не найден' }

# --- HTTP на Node -------------------------------------------------------------
Write-Step 'Собираю коммит через GitHub API...'
$env:GITHUB_TOKEN = $token
& node (Join-Path $PSScriptRoot 'gh-push-http.mjs') --manifest $manifestPath
$code = $LASTEXITCODE
Remove-Item $manifestPath -ErrorAction SilentlyContinue
$env:GITHUB_TOKEN = $null

if ($code -ne 0) { throw "HTTP-часть завершилась с кодом $code" }
Write-Ok 'Готово.'
