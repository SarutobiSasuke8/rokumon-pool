param(
    [Parameter(Mandatory = $true)]
    [string]$Destination,
    [ValidateSet("phaser-js", "phaser-ts")]
    [string]$Profile = "phaser-js",
    [switch]$GamesHub,
    [switch]$MobileFirst,
    [switch]$AgenticOperations
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$profilePath = Join-Path $root "profiles/$Profile"

if (-not (Test-Path -LiteralPath $profilePath)) {
    throw "Profile not found: $Profile"
}

if (-not (Test-Path -LiteralPath $Destination)) {
    New-Item -ItemType Directory -Path $Destination -Force | Out-Null
}

$assetsPath = Join-Path $Destination "assets"
New-Item -ItemType Directory -Path $assetsPath -Force | Out-Null
$manifestDestination = Join-Path $assetsPath "asset-manifest.json"
if (-not (Test-Path -LiteralPath $manifestDestination)) {
    Copy-Item -LiteralPath (Join-Path $root "Templates/ASSET_MANIFEST.json") -Destination $manifestDestination
}

if ($Profile -eq "phaser-ts") {
    Get-ChildItem -LiteralPath (Join-Path $root "profiles/phaser-js") -Force | Copy-Item -Destination $Destination -Recurse -Force
}

Get-ChildItem -LiteralPath $profilePath -Force | Copy-Item -Destination $Destination -Recurse -Force

if ($Profile -eq "phaser-ts") {
    Remove-Item -LiteralPath (Join-Path $Destination "src/main.js") -Force -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath (Join-Path $Destination "vite.config.js") -Force -ErrorAction SilentlyContinue
}

function Install-Addon {
    param([string]$Name)
    $addonPath = Join-Path $root "addons/$Name"
    if (-not (Test-Path -LiteralPath $addonPath)) {
        throw "Addon not found: $Name"
    }
    Get-ChildItem -LiteralPath $addonPath -Force | Copy-Item -Destination $Destination -Recurse -Force
}

if ($GamesHub) { Install-Addon "games-hub" }
if ($MobileFirst) { Install-Addon "mobile-first" }
if ($AgenticOperations) { Install-Addon "agentic-operations" }

Write-Host "Installed $Profile browser-game profile in $Destination." -ForegroundColor Green
Write-Host "Next: npm install, update docs/PROJECT_BRIEF.md, then run npm run verify." -ForegroundColor Cyan
