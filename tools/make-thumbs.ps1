# 给 images/ 里每张图生成 480×360 缩略图到 images/thumbs/
# 卡片和相册用缩略图，抽屉和灯箱才加载原图
param(
  [int]$Width = 480,
  [int]$Quality = 82
)

Add-Type -AssemblyName System.Drawing

$dir = Join-Path $PSScriptRoot "..\images"
$thumbDir = Join-Path $dir "thumbs"
if (-not (Test-Path $thumbDir)) { New-Item -ItemType Directory -Force -Path $thumbDir | Out-Null }

$codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() |
  Where-Object { $_.MimeType -eq "image/jpeg" } | Select-Object -First 1
$ps = New-Object System.Drawing.Imaging.EncoderParameters 1
$ps.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter(
  [System.Drawing.Imaging.Encoder]::Quality, [long]$Quality)

$h = [int]($Width * 3 / 4)
$n = 0
Get-ChildItem $dir -File -Filter *.jpg | ForEach-Object {
  $img = [System.Drawing.Image]::FromFile($_.FullName)
  try {
    $bmp = New-Object System.Drawing.Bitmap $Width, $h
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    try {
      $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
      $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
      $g.DrawImage($img, 0, 0, $Width, $h)
      $bmp.Save((Join-Path $thumbDir $_.Name), $codec, $ps)
      $n++
    }
    finally { $g.Dispose(); $bmp.Dispose() }
  }
  finally { $img.Dispose() }
}
Write-Output "缩略图 $n 张 -> images/thumbs/"
