$ErrorActionPreference = "Stop"

$branch = (git branch --show-current).Trim()
if ($branch -ne "main") {
  throw "Tento fix aplikuj na main. Aktuálna vetva: $branch"
}

Write-Host "Odstraňujem 3 samostatné Vercel Serverless Functions..." -ForegroundColor Cyan
$remove = @(
  "api/order-options.js",
  "api/public-bootstrap.js",
  "api/public-promos.js"
)
foreach ($file in $remove) {
  if (Test-Path -LiteralPath $file) {
    Remove-Item -LiteralPath $file -Force
    Write-Host "REMOVED $file"
  } else {
    Write-Host "ALREADY MISSING $file" -ForegroundColor DarkGray
  }
}

Write-Host "`nKontrola zmenených súborov:" -ForegroundColor Cyan
git status --short

Write-Host "`nPo aplikovaní spusti:" -ForegroundColor Green
Write-Host 'git add api/orders.js js/public-data.js js/orders.js js/script.js'
Write-Host 'git add -u -- api/order-options.js api/public-bootstrap.js api/public-promos.js'
Write-Host 'git diff --cached --check'
Write-Host 'git diff --cached --stat'
Write-Host 'git commit -m "fix: fit Vercel Hobby serverless function limit"'
Write-Host 'git push origin main'
