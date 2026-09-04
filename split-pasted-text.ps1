$source = 'C:\Users\fujifilm\.codex\attachments\f95419cf-dcd2-462f-98bf-a2a8a1405ba9\pasted-text.txt'
$outputDir = 'C:\SUPSERSCAM\superSCM-main\pasted-text-parts'

if (-not (Test-Path -LiteralPath $source)) {
  throw "원본 파일을 찾을 수 없습니다: $source"
}

New-Item -ItemType Directory -Force -Path $outputDir | Out-Null
$lines = Get-Content -LiteralPath $source -Encoding UTF8
$partCount = 5
$total = $lines.Count
$baseSize = [math]::Floor($total / $partCount)
$remainder = $total % $partCount
$start = 0

for ($part = 1; $part -le $partCount; $part++) {
  $size = $baseSize
  if ($part -le $remainder) { $size++ }
  $target = Join-Path $outputDir ("pasted-text-part-{0}.txt" -f $part)
  if ($size -gt 0) {
    $lines[$start..($start + $size - 1)] | Set-Content -LiteralPath $target -Encoding UTF8
  } else {
    Set-Content -LiteralPath $target -Value '' -Encoding UTF8
  }
  $start += $size
}

Write-Output "완료: $partCount개 파일을 만들었습니다."
