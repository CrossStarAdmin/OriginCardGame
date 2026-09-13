# イラストとカード枠を合成して完成カードを作る
# 配置は カード/ のサンプルに合わせている（効果テキストは絵の上の半透明板、パネル下段は種族タグか種類）
# 使い方: powershell -ExecutionPolicy Bypass -File カードフレーム/tools/compose.ps1 [-Deck 名] [-Card 名] [-Force] [-Config 設定.json]
param(
  [string]$Deck,
  [string]$Card,
  [switch]$Force,
  [string]$ArtDir = 'イラスト',
  [string]$OutDir = 'カード',
  [string]$FrameDir = 'カードフレーム',
  [string]$DeckDir = 'デッキ',
  [string]$Config
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$frameJson = if ($Config) { $Config } else { Join-Path $FrameDir 'frame.json' }
if (-not (Test-Path $frameJson)) { throw "$frameJson が無い" }
$F = Get-Content -Path $frameJson -Raw -Encoding UTF8 | ConvertFrom-Json

# フォントは設定ファイルからの相対パスで読む。インストールしていない環境でも同じ見た目になる
$fontCollection = New-Object System.Drawing.Text.PrivateFontCollection
$configDir = Split-Path -Parent (Resolve-Path $frameJson).Path
foreach ($file in $F.fontFiles) {
  $fontPath = Join-Path $configDir $file
  if (-not (Test-Path $fontPath)) { throw "$fontPath が無い" }
  $fontCollection.AddFontFile((Resolve-Path $fontPath).Path)
}

function Get-FontSpec($spec) {
  if ($null -eq $spec) { throw 'frame.json の fonts に name / stat / label / text が要る' }
  $family = $fontCollection.Families | Where-Object { $_.Name -eq $spec.family } | Select-Object -First 1
  if ($null -eq $family) { $family = New-Object System.Drawing.FontFamily $spec.family }
  [pscustomobject]@{ family = $family; style = [System.Drawing.FontStyle]$spec.style }
}

$Fonts = @{
  name  = Get-FontSpec $F.fonts.name
  stat  = Get-FontSpec $F.fonts.stat
  label = Get-FontSpec $F.fonts.label
  text  = Get-FontSpec $F.fonts.text
}

function ConvertTo-Color([string]$hex) {
  [System.Drawing.ColorTranslator]::FromHtml($hex)
}

# ファイルを掴んだままにしないよう、バイト列から読む
function Read-Image([string]$path) {
  $bytes = [System.IO.File]::ReadAllBytes($path)
  $stream = New-Object System.IO.MemoryStream (,$bytes)
  [System.Drawing.Image]::FromStream($stream)
}

function New-Format([string]$align, [string]$valign) {
  $f = New-Object System.Drawing.StringFormat
  $f.Alignment = [System.Drawing.StringAlignment]$align
  $f.LineAlignment = [System.Drawing.StringAlignment]$valign
  $f.Trimming = [System.Drawing.StringTrimming]::None
  $f
}

# 窓を埋めるように拡縮し、上を基準に余った下を切る
function Draw-Art($g, $art, $slot) {
  $scale = [Math]::Max($slot.width / $art.Width, $slot.height / $art.Height)
  $w = [int][Math]::Ceiling($art.Width * $scale)
  $h = [int][Math]::Ceiling($art.Height * $scale)
  $x = $slot.x - [int](($w - $slot.width) / 2)
  $clip = New-Object System.Drawing.Rectangle $slot.x, $slot.y, $slot.width, $slot.height
  $g.SetClip($clip)
  $g.DrawImage($art, $x, [int]$slot.y, $w, $h)
  $g.ResetClip()
}

# 枠に収まるまで文字を小さくする
function Get-FittedFont($g, [string]$text, $fontSpec, [int]$size, [int]$width, [int]$height, $format) {
  $limit = New-Object System.Drawing.SizeF ([float]$width), ([float]9999)
  $unit = [System.Drawing.GraphicsUnit]::Pixel
  for ($s = $size; $s -ge 10; $s--) {
    $font = New-Object System.Drawing.Font $fontSpec.family, ([float]$s), $fontSpec.style, $unit
    $measured = $g.MeasureString($text, $font, $limit, $format)
    if ($measured.Height -le $height) { return $font }
    $font.Dispose()
  }
  New-Object System.Drawing.Font $fontSpec.family, ([float]10), $fontSpec.style, $unit
}

function Draw-Text($g, [string]$text, $slot, $fontSpec, [string]$align, [string]$valign) {
  if ([string]::IsNullOrWhiteSpace($text)) { return }
  $format = New-Format $align $valign
  $font = Get-FittedFont $g $text $fontSpec ([int]$slot.size) ([int]$slot.width) ([int]$slot.height) $format
  $rect = New-Object System.Drawing.RectangleF ([float]$slot.x), ([float]$slot.y), ([float]$slot.width), ([float]$slot.height)
  $brush = New-Object System.Drawing.SolidBrush (ConvertTo-Color $slot.color)
  $g.DrawString($text, $font, $brush, $rect, $format)
  $brush.Dispose(); $font.Dispose(); $format.Dispose()
}

function New-RoundedRect([int]$x, [int]$y, [int]$w, [int]$h, [int]$r) {
  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $d = $r * 2
  $path.AddArc($x, $y, $d, $d, 180, 90)
  $path.AddArc(($x + $w - $d), $y, $d, $d, 270, 90)
  $path.AddArc(($x + $w - $d), ($y + $h - $d), $d, $d, 0, 90)
  $path.AddArc($x, ($y + $h - $d), $d, $d, 90, 90)
  $path.CloseFigure()
  $path
}

# 効果テキストは絵の上に敷いた半透明の板に載せる
function Draw-EffectBox($g, [string]$text, $slot, $fontSpec) {
  if ([string]::IsNullOrWhiteSpace($text)) { return }
  $path = New-RoundedRect ([int]$slot.x) ([int]$slot.y) ([int]$slot.width) ([int]$slot.height) ([int]$slot.radius)
  $base = ConvertTo-Color $slot.fill
  $color = [System.Drawing.Color]::FromArgb([int]$slot.alpha, $base.R, $base.G, $base.B)
  $brush = New-Object System.Drawing.SolidBrush $color
  $g.FillPath($brush, $path)
  $brush.Dispose(); $path.Dispose()

  $inner = [pscustomobject]@{
    x      = [int]$slot.x + [int]$slot.padX
    y      = [int]$slot.y + [int]$slot.padY
    width  = [int]$slot.width - 2 * [int]$slot.padX
    height = [int]$slot.height - 2 * [int]$slot.padY
    size   = [int]$slot.size
    color  = $slot.color
  }
  Draw-Text $g $text $inner $fontSpec $slot.align $slot.valign
}

# 宝石と丸の中の数字。縁取りを付けて背景から浮かせる
function Draw-Stat($g, [string]$text, $slot, $fontSpec, [string]$fill, [string]$outline) {
  if ([string]::IsNullOrWhiteSpace($text)) { return }
  $size = [float]$slot.size
  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $format = New-Format 'Center' 'Center'
  $origin = New-Object System.Drawing.PointF ([float]$slot.cx), ([float]$slot.cy)
  $path.AddString($text, $fontSpec.family, [int]$fontSpec.style, $size, $origin, $format)
  $pen = New-Object System.Drawing.Pen (ConvertTo-Color $outline), ([float]($size * 0.14))
  $pen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
  $g.DrawPath($pen, $path)
  $brush = New-Object System.Drawing.SolidBrush (ConvertTo-Color $fill)
  $g.FillPath($brush, $path)
  $brush.Dispose(); $pen.Dispose(); $format.Dispose(); $path.Dispose()
}

function Compose-Card($card, [string]$artPath, [string]$destPath) {
  $spec = $F.($card.type)
  if ($null -eq $spec) { throw "枠の定義が無い種類: $($card.type)" }
  $frameName = $spec.frames.($card.className)
  if (-not $frameName) { throw "$($card.type) にクラス $($card.className) の枠が無い" }
  $framePath = Join-Path (Join-Path $FrameDir $spec.dir) $frameName
  if (-not (Test-Path $framePath)) { throw "$framePath が無い" }

  $frame = Read-Image $framePath
  $art = Read-Image $artPath
  $bmp = New-Object System.Drawing.Bitmap ([int]$spec.canvas.width), ([int]$spec.canvas.height)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

  Draw-Art $g $art $spec.art

  $effectText = ($card.effects -join "`n")

  # 効果の板は枠より先に敷く。枠の飾りが上に来る
  if ($card.type -ne 'リーダー') { Draw-EffectBox $g $effectText $spec.effectBox $Fonts.text }

  $g.DrawImage($frame, 0, 0, $frame.Width, $frame.Height)

  if ($card.type -eq 'リーダー') {
    Draw-Text $g $card.name $spec.name $Fonts.name 'Center' 'Center'
    Draw-Text $g $spec.skillLabel.text $spec.skillLabel $Fonts.label 'Center' 'Center'
    Draw-Text $g $card.skillName $spec.skillName $Fonts.name 'Center' 'Center'
    Draw-Text $g $effectText $spec.skillText $Fonts.text 'Center' 'Center'
    Draw-Text $g $spec.type.text $spec.type $Fonts.label 'Center' 'Center'
  } else {
    # パネル下段は種族タグ。タグの無いキャラクターは空欄、スペルは種類を出す
    $sub = $card.tag
    if ([string]::IsNullOrWhiteSpace($sub) -and $card.type -ne 'キャラクター') { $sub = $card.type }
    Draw-Text $g $card.name $spec.name $Fonts.name 'Center' 'Center'
    Draw-Text $g $sub $spec.type $Fonts.label 'Center' 'Center'
    Draw-Stat $g $card.cost $spec.cost $Fonts.stat $spec.style.statText $spec.style.statOutline
    if ($card.type -eq 'キャラクター') {
      Draw-Stat $g $card.atk $spec.atk $Fonts.stat $spec.style.statText $spec.style.statOutline
      Draw-Stat $g $card.hp $spec.hp $Fonts.stat $spec.style.statText $spec.style.statOutline
    }
  }

  $dir = Split-Path -Parent $destPath
  if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
  $bmp.Save($destPath, [System.Drawing.Imaging.ImageFormat]::Png)

  $g.Dispose(); $bmp.Dispose(); $art.Dispose(); $frame.Dispose()
}

if (-not (Test-Path $ArtDir)) { throw "$ArtDir が無い。先にイラストを生成する" }

# 数値と効果はデッキの md から取る。イラストの .json は取り込んだ時点の写しで古くなる
# 書式は システム/デッキ読み込み/decks.js と揃える。Node は日本語パスのモジュールを require すると落ちるので PowerShell で読む
$CARD_FIELDS = @{ 'クラス' = 'className'; '種類' = 'type'; 'コスト' = 'cost'; '攻撃力' = 'atk'; 'HP' = 'hp'; '種族タグ' = 'tag' }
$BLANK = @('', '-', '─', '—')

function Read-CardMarkdown([string]$path) {
  $card = [ordered]@{}
  $effects = New-Object System.Collections.Generic.List[string]
  $section = $null
  foreach ($raw in [System.IO.File]::ReadAllLines($path, [System.Text.Encoding]::UTF8)) {
    $line = $raw.Trim()
    if (-not $card.Contains('name') -and $line -match '^#\s+(.+)$') { $card.name = $Matches[1].Trim(); continue }
    if ($line -match '^##\s+(.+)$') { $section = $Matches[1].Trim(); continue }
    if ($line.StartsWith('|')) {
      $cells = @($line.Trim('|').Split('|') | ForEach-Object { $_.Trim() })
      if ($cells.Count -eq 2 -and $CARD_FIELDS.ContainsKey($cells[0]) -and $BLANK -notcontains $cells[1]) {
        $card[$CARD_FIELDS[$cells[0]]] = $cells[1]
      }
      continue
    }
    if ($section -ne '効果' -or -not $line -or $line -match '^[>#]') { continue }
    $text = ($line -replace '^[-*]\s+', '' -replace '^\d+\.\s*', '' -replace '\*\*', '').Trim()
    if ($text -and $text -ne '効果なし') { $effects.Add($text) }
  }

  # リーダーは「テンションスキル：名前」の行をスキル名にし、残りを効果本文にする
  $skill = $effects | Where-Object { $_ -like 'テンションスキル*' } | Select-Object -First 1
  if ($card.type -eq 'リーダー' -and $skill) {
    $card.skillName = ($skill -replace '^テンションスキル\s*[:：]\s*', '').Trim()
    [void]$effects.Remove($skill)
  }
  $card.effects = @($effects)
  [pscustomobject]$card
}

$deckCache = @{}
function Get-DeckCards([string]$deckName) {
  if ($deckCache.ContainsKey($deckName)) { return $deckCache[$deckName] }
  $dir = Join-Path $DeckDir $deckName
  $cardsDir = Join-Path $dir 'カード一覧'
  if (-not (Test-Path $cardsDir)) { throw "$cardsDir が無い" }
  $overview = Join-Path $dir 'overview.md'
  $deckClass = if (Test-Path $overview) { (Read-CardMarkdown $overview).className } else { $null }

  $cards = @(Get-ChildItem -Path $cardsDir -Filter '*.md' | ForEach-Object {
    $c = Read-CardMarkdown $_.FullName
    if (-not $c.className) { $c | Add-Member -NotePropertyName className -NotePropertyValue $deckClass -Force }
    $c
  })
  $deckCache[$deckName] = $cards
  $cards
}

$metaFiles = Get-ChildItem -Path $ArtDir -Filter '*.json' -Recurse
if ($Deck) { $metaFiles = $metaFiles | Where-Object { $_.Directory.Name -eq $Deck } }

$done = 0; $skipped = 0; $failed = 0
$errors = @()

foreach ($file in $metaFiles) {
  $meta = Get-Content -Path $file.FullName -Raw -Encoding UTF8 | ConvertFrom-Json
  $name = $meta.card.name
  if ($Card -and $name -ne $Card) { continue }

  $deckName = $file.Directory.Name
  $artPath = Join-Path $file.Directory.FullName "$name.png"
  $destPath = Join-Path (Join-Path $OutDir $deckName) "$name.png"

  if (-not (Test-Path $artPath)) {
    $failed++; $errors += "$deckName/$name : イラストが無い"
    Write-Output "NG   $deckName/$name : イラストが無い"
    continue
  }
  if ((Test-Path $destPath) -and -not $Force) {
    $skipped++
    continue
  }

  # $Card 引数と同名にならないよう別名にする（PowerShell の変数は大文字小文字を区別しない）
  $deckCard = Get-DeckCards $deckName | Where-Object { $_.name -eq $name } | Select-Object -First 1
  if ($null -eq $deckCard) {
    $failed++; $errors += "$deckName/$name : デッキの md にカードが無い"
    Write-Output "NG   $deckName/$name : デッキの md にカードが無い"
    continue
  }

  try {
    Compose-Card $deckCard $artPath $destPath
    $done++
    Write-Output "OK   $deckName/$name"
  } catch {
    $failed++; $errors += "$deckName/$name : $($_.Exception.Message)"
    Write-Output "NG   $deckName/$name : $($_.Exception.Message)"
  }
}

Write-Output ''
Write-Output "完了: 作成 $done 枚 / スキップ $skipped 枚 / 失敗 $failed 枚"
if ($skipped -gt 0) { Write-Output '既にあるカードはスキップした。作り直すなら -Force' }
if ($errors.Count -gt 0) {
  Write-Output '失敗したカード:'
  foreach ($e in $errors) { Write-Output "  $e" }
  exit 1
}
