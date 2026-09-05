param(
    [string]$ManifestPath = "assets/asset-manifest.json"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $ManifestPath)) {
    throw "Asset manifest not found: $ManifestPath"
}

$manifest = Get-Content -Raw -LiteralPath $ManifestPath | ConvertFrom-Json
$errors = New-Object System.Collections.Generic.List[string]
$keys = @{}

foreach ($asset in $manifest.assets) {
    if ([string]::IsNullOrWhiteSpace($asset.key)) { $errors.Add("Asset has no key."); continue }
    if ($keys.ContainsKey($asset.key)) { $errors.Add("Duplicate asset key: $($asset.key)") }
    $keys[$asset.key] = $true
    if ([string]::IsNullOrWhiteSpace($asset.type)) { $errors.Add("$($asset.key): missing type") }
    if ([string]::IsNullOrWhiteSpace($asset.license)) { $errors.Add("$($asset.key): missing licence/source status") }
    if ($asset.runtimePath -and -not (Test-Path -LiteralPath $asset.runtimePath)) { $errors.Add("$($asset.key): missing runtime path $($asset.runtimePath)") }
}

if ($errors.Count -gt 0) {
    $errors | ForEach-Object { Write-Host " - $_" -ForegroundColor Red }
    exit 1
}

Write-Host "Asset manifest is valid ($($manifest.assets.Count) assets)." -ForegroundColor Green
