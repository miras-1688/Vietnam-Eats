# 摆正 + 修图 + 加白边相框，输出 4:3 的 JPEG
# 用法：
#   powershell -ExecutionPolicy Bypass -File tools\frame-photo.ps1 -In "a.HEIC" -Out "images\pho-bo__01.jpg"
# 可选：-Width 1600  -Margin 0.045  -Quality 88  -NoEnhance（只摆正和加白边，不修图）

param(
  [Parameter(Mandatory = $true)][string]$In,
  [Parameter(Mandatory = $true)][string]$Out,
  [int]$Width = 1600,
  [double]$Margin = 0.045,
  [int]$Quality = 88,
  [int]$Rotate = 0,
  [string]$Crop = "",
  [switch]$NoEnhance
)

Add-Type -AssemblyName PresentationCore
Add-Type -AssemblyName System.Drawing

# ── 读图：HEIC 走 WIC（已按容器方向摆正），其余走 GDI+ ──
function Load-SourceImage([string]$path) {
  $ext = [IO.Path]::GetExtension($path).ToLowerInvariant()
  if ($ext -eq ".heic" -or $ext -eq ".heif") {
    $fs = [IO.File]::OpenRead($path)
    try {
      $dec = [Windows.Media.Imaging.BitmapDecoder]::Create(
        $fs,
        [Windows.Media.Imaging.BitmapCreateOptions]::PreservePixelFormat,
        [Windows.Media.Imaging.BitmapCacheOption]::OnLoad)
      $frame = $dec.Frames[0]
      $scale = [Math]::Min(1.0, 2600.0 / [Math]::Max($frame.PixelWidth, $frame.PixelHeight))
      if ($scale -lt 1.0) {
        $frame = New-Object Windows.Media.Imaging.TransformedBitmap(
          $frame, (New-Object Windows.Media.ScaleTransform($scale, $scale)))
      }
      $enc = New-Object Windows.Media.Imaging.PngBitmapEncoder
      $enc.Frames.Add([Windows.Media.Imaging.BitmapFrame]::Create($frame))
      $ms = New-Object IO.MemoryStream
      $enc.Save($ms)
      $ms.Position = 0
      return [System.Drawing.Image]::FromStream($ms)
    }
    finally { $fs.Close() }
  }
  return [System.Drawing.Image]::FromFile($path)
}

# ── EXIF 方向（GDI+ 不会自动应用，必须手动转）──
function Get-ExifOrientation([System.Drawing.Image]$img) {
  try {
    foreach ($p in $img.PropertyItems) {
      if ($p.Id -eq 0x0112) { return [int][BitConverter]::ToUInt16($p.Value, 0) }
    }
  } catch {}
  return 1
}

function Set-Upright([System.Drawing.Image]$img, [int]$o) {
  switch ($o) {
    2 { $img.RotateFlip([System.Drawing.RotateFlipType]::RotateNoneFlipX) }
    3 { $img.RotateFlip([System.Drawing.RotateFlipType]::Rotate180FlipNone) }
    4 { $img.RotateFlip([System.Drawing.RotateFlipType]::RotateNoneFlipY) }
    5 { $img.RotateFlip([System.Drawing.RotateFlipType]::Rotate90FlipX) }
    6 { $img.RotateFlip([System.Drawing.RotateFlipType]::Rotate90FlipNone) }
    7 { $img.RotateFlip([System.Drawing.RotateFlipType]::Rotate270FlipX) }
    8 { $img.RotateFlip([System.Drawing.RotateFlipType]::Rotate270FlipNone) }
  }
  return $o -ne 1
}

# ── 量亮度，用来决定提亮多少 ──
function Get-MeanLuma([System.Drawing.Image]$img) {
  $n = 48
  $small = New-Object System.Drawing.Bitmap $n, $n
  $g2 = [System.Drawing.Graphics]::FromImage($small)
  try {
    $g2.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBilinear
    $g2.DrawImage($img, (New-Object System.Drawing.Rectangle 0, 0, $n, $n))
  }
  finally { $g2.Dispose() }
  $sum = 0.0
  for ($y = 0; $y -lt $n; $y++) {
    for ($x = 0; $x -lt $n; $x++) {
      $c = $small.GetPixel($x, $y)
      $sum += (0.299 * $c.R + 0.587 * $c.G + 0.114 * $c.B)
    }
  }
  $small.Dispose()
  return ($sum / ($n * $n)) / 255.0
}

$src = Load-SourceImage (Resolve-Path -LiteralPath $In).Path
$rotated = $false
try {
  $rotated = Set-Upright $src (Get-ExifOrientation $src)
  if ($Rotate -ne 0) {
    switch ($Rotate) {
      90 { $src.RotateFlip([System.Drawing.RotateFlipType]::Rotate90FlipNone) }
      180 { $src.RotateFlip([System.Drawing.RotateFlipType]::Rotate180FlipNone) }
      270 { $src.RotateFlip([System.Drawing.RotateFlipType]::Rotate270FlipNone) }
    }
    $rotated = $true
  }

  # 可选：先从原图裁出一块（归一化坐标 "left,top,width,height"，0..1）
  if ($Crop) {
    $parts = $Crop -split ','
    if ($parts.Count -eq 4) {
      $cx = [int]([double]$parts[0] * $src.Width)
      $cy = [int]([double]$parts[1] * $src.Height)
      $cw = [int]([double]$parts[2] * $src.Width)
      $ch = [int]([double]$parts[3] * $src.Height)
      $cx = [Math]::Max(0, [Math]::Min($cx, $src.Width - 2))
      $cy = [Math]::Max(0, [Math]::Min($cy, $src.Height - 2))
      $cw = [Math]::Max(1, [Math]::Min($cw, $src.Width - $cx))
      $ch = [Math]::Max(1, [Math]::Min($ch, $src.Height - $cy))
      $cropBmp = New-Object System.Drawing.Bitmap $cw, $ch
      $cg = [System.Drawing.Graphics]::FromImage($cropBmp)
      $cg.DrawImage($src, (New-Object System.Drawing.Rectangle 0, 0, $cw, $ch),
        (New-Object System.Drawing.Rectangle $cx, $cy, $cw, $ch), [System.Drawing.GraphicsUnit]::Pixel)
      $cg.Dispose()
      $src.Dispose()
      $src = $cropBmp
    }
  }

  $h = [int]($Width * 3 / 4)
  $canvas = New-Object System.Drawing.Bitmap $Width, $h
  $g = [System.Drawing.Graphics]::FromImage($canvas)
  try {
    $g.Clear([System.Drawing.Color]::White)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality

    $m = [int]($Width * $Margin)
    $availW = $Width - 2 * $m
    $availH = $h - 2 * $m

    $s = [Math]::Max($availW / $src.Width, $availH / $src.Height)
    $dw = [int]($src.Width * $s)
    $dh = [int]($src.Height * $s)
    $x = $m + [int](($availW - $dw) / 2)
    $y = $m + [int](($availH - $dh) / 2)
    $destRect = New-Object System.Drawing.Rectangle $x, $y, $dw, $dh
    $inner = New-Object System.Drawing.Rectangle $m, $m, $availW, $availH

    # 修图：按平均亮度提亮，轻加对比和饱和度
    $attr = $null
    $luma = 0.5
    if (-not $NoEnhance) {
      $luma = Get-MeanLuma $src
      $bOff = [Math]::Max(-0.05, [Math]::Min(0.13, (0.46 - $luma) * 0.55))
      $c = 1.07
      $sat = 1.06
      $sr = (1 - $sat) * 0.299; $sg = (1 - $sat) * 0.587; $sb = (1 - $sat) * 0.114
      $off = 0.5 - 0.5 * $c + $bOff

      $cm = New-Object System.Drawing.Imaging.ColorMatrix
      $cm.Matrix00 = ($sr + $sat) * $c; $cm.Matrix01 = $sg * $c; $cm.Matrix02 = $sb * $c; $cm.Matrix03 = 0; $cm.Matrix04 = $off
      $cm.Matrix10 = $sr * $c; $cm.Matrix11 = ($sg + $sat) * $c; $cm.Matrix12 = $sb * $c; $cm.Matrix13 = 0; $cm.Matrix14 = $off
      $cm.Matrix20 = $sr * $c; $cm.Matrix21 = $sg * $c; $cm.Matrix22 = ($sb + $sat) * $c; $cm.Matrix23 = 0; $cm.Matrix24 = $off
      $cm.Matrix30 = 0; $cm.Matrix31 = 0; $cm.Matrix32 = 0; $cm.Matrix33 = 1; $cm.Matrix34 = 0
      $cm.Matrix40 = 0; $cm.Matrix41 = 0; $cm.Matrix42 = 0; $cm.Matrix43 = 0; $cm.Matrix44 = 1

      $attr = New-Object System.Drawing.Imaging.ImageAttributes
      $attr.SetColorMatrix($cm)
      $attr.SetWrapMode([System.Drawing.Drawing2D.WrapMode]::TileFlipXY)
    }

    $g.SetClip($inner)
    if ($attr) {
      $g.DrawImage($src, $destRect, 0, 0, $src.Width, $src.Height, [System.Drawing.GraphicsUnit]::Pixel, $attr)
    } else {
      $g.DrawImage($src, $destRect, 0, 0, $src.Width, $src.Height, [System.Drawing.GraphicsUnit]::Pixel)
    }
    $g.ResetClip()

    $codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() |
      Where-Object { $_.MimeType -eq "image/jpeg" } | Select-Object -First 1
    $ps = New-Object System.Drawing.Imaging.EncoderParameters 1
    $ps.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter(
      [System.Drawing.Imaging.Encoder]::Quality, [long]$Quality)

    $outDir = Split-Path -Parent $Out
    if ($outDir -and -not (Test-Path $outDir)) { New-Item -ItemType Directory -Force -Path $outDir | Out-Null }
    $canvas.Save($Out, $codec, $ps)

    $flag = @()
    if ($rotated) { $flag += "已摆正" }
    if ($attr) { $flag += ("亮度 {0:N2}" -f $luma) }
    Write-Output ("ok " + [IO.Path]::GetFileName($Out) + " " + ($flag -join " / "))
  }
  finally { $g.Dispose(); $canvas.Dispose() }
}
finally { $src.Dispose() }
