# 把本地 images/ 里的照片、封面和打卡状态推到 Cloudflare Worker
# 用法：
#   powershell -ExecutionPolicy Bypass -File tools\push-cloud.ps1 -Url "https://xxx.workers.dev" [-Key "密钥"]

param(
  [Parameter(Mandatory = $true)][string]$Url,
  [string]$Key = "",
  [switch]$SkipThumbs
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$imgDir = Join-Path $root "images"
$thumbDir = Join-Path $imgDir "thumbs"
$coversFile = Join-Path $imgDir "covers.json"
$stateFile = Join-Path $root "data\state.json"

$base = $Url.TrimEnd("/")
$headers = @{}
if ($Key) { $headers["X-Key"] = $Key }

function Post-File([string]$path, [string]$endpoint, [string]$name) {
  $bytes = [IO.File]::ReadAllBytes($path)
  $u = "$base/$endpoint`?name=" + [uri]::EscapeDataString($name)
  Invoke-RestMethod -Uri $u -Method Post -Headers $headers -ContentType "image/jpeg" -Body $bytes | Out-Null
}

Write-Host "目标：$base"
Write-Host ""

# 1. 原图
$photos = Get-ChildItem $imgDir -File -Filter *.jpg
$i = 0
foreach ($f in $photos) {
  $i++
  Write-Host ("[{0}/{1}] {2}" -f $i, $photos.Count, $f.Name)
  Post-File $f.FullName "api/photos" $f.Name
}

# 2. 缩略图
if (-not $SkipThumbs -and (Test-Path $thumbDir)) {
  $thumbs = Get-ChildItem $thumbDir -File -Filter *.jpg
  Write-Host ""
  Write-Host "缩略图 $($thumbs.Count) 张"
  $i = 0
  foreach ($f in $thumbs) {
    $i++
    Write-Host ("[{0}/{1}] {2}" -f $i, $thumbs.Count, $f.Name)
    Post-File $f.FullName "api/thumbs" $f.Name
  }
}

# 3. 封面
if (Test-Path $coversFile) {
  $covers = Get-Content -Raw $coversFile | ConvertFrom-Json
  $names = @($covers.PSObject.Properties.Name)
  if ($names.Count) {
    Write-Host ""
    Write-Host "封面 $($names.Count) 条"
    foreach ($id in $names) {
      $name = $covers.$id
      $u = "$base/api/cover?name=" + [uri]::EscapeDataString($name)
      try { Invoke-RestMethod -Uri $u -Method Post -Headers $headers | Out-Null; Write-Host "  $id -> $name" }
      catch { Write-Host "  $id 失败：$($_.Exception.Message)" }
    }
  }
}

# 4. 打卡状态
if (Test-Path $stateFile) {
  Write-Host ""
  Write-Host "打卡状态"
  $raw = Get-Content -Raw $stateFile
  Invoke-RestMethod -Uri "$base/api/state" -Method Post -Headers $headers -ContentType "application/json" -Body $raw | Out-Null
  Write-Host "  已推送"
} else {
  Write-Host ""
  Write-Host "没找到 data\state.json（本机服务跑过才会有），打卡状态先跳过。"
}

Write-Host ""
Write-Host "完成。打开线上站点的 /upload.html，云同步里填同一个地址，刷新即可看到。"
