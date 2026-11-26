# 生成斗笠图标：512 / 192 / 180(iOS) / ico
Add-Type -AssemblyName System.Drawing

$out = Join-Path $PSScriptRoot "..\assets"
$bg = [System.Drawing.Color]::FromArgb(255, 11, 14, 12)
$gold = [System.Drawing.Color]::FromArgb(255, 217, 169, 74)
$goldSoft = [System.Drawing.Color]::FromArgb(70, 217, 169, 74)

function New-Icon([int]$size) {
  $bmp = New-Object System.Drawing.Bitmap $size, $size
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.Clear($bg)

  $s = $size / 512.0
  $g.ScaleTransform($s, $s)

  # 斗笠：宽扁的圆锥 + 向下微弯的帽檐
  $hat = New-Object System.Drawing.Drawing2D.GraphicsPath
  $hat.AddBezier(52, 366, 116, 256, 194, 190, 256, 164)
  $hat.AddBezier(256, 164, 318, 190, 396, 256, 460, 366)
  $hat.AddBezier(460, 366, 344, 400, 168, 400, 52, 366)
  $hat.CloseFigure()

  $fill = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(30, 217, 169, 74))
  $g.FillPath($fill, $hat)

  $pen = New-Object System.Drawing.Pen $gold, 20
  $pen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
  $g.DrawPath($pen, $hat)

  # 帽面上的三根箍线
  $pen2 = New-Object System.Drawing.Pen $goldSoft, 10
  $pen2.StartCap = 'Round'
  $pen2.EndCap = 'Round'
  foreach ($x in @(152, 256, 360)) {
    $ridge = New-Object System.Drawing.Drawing2D.GraphicsPath
    $ridge.AddBezier(256, 178, 250, 250, $x + (8 * [Math]::Sign(256 - $x)), 320, $x, 386)
    $g.DrawPath($pen2, $ridge)
    $ridge.Dispose()
  }

  # 帽尖
  $dot = New-Object System.Drawing.SolidBrush $gold
  $g.FillEllipse($dot, 246, 154, 20, 20)

  $g.Dispose()
  $hat.Dispose(); $fill.Dispose(); $pen.Dispose(); $pen2.Dispose(); $dot.Dispose()
  return $bmp
}

foreach ($spec in @(@(512, "icon-512.png"), @(192, "icon-192.png"), @(180, "apple-touch-icon.png"))) {
  $img = New-Icon $spec[0]
  $path = Join-Path $out $spec[1]
  $img.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $img.Dispose()
  Write-Output ("ok " + $spec[1])
}

# .ico（用 256 那张）
$icoSrc = New-Icon 256
$ico = [System.Drawing.Icon]::FromHandle($icoSrc.GetHicon())
$fs = [IO.File]::Create((Join-Path $out "app.ico"))
$ico.Save($fs)
$fs.Close()
$icoSrc.Dispose()
Write-Output "ok app.ico"
