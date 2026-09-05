param(
    [string]$ManifestPath = "assets/asset-manifest.json"
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot

if (Test-Path -LiteralPath (Join-Path $root "AGENTS.md")) {
    & (Join-Path $root "scripts/check-agent-docs.ps1")
}

& (Join-Path $root "scripts/validate-assets.ps1") -ManifestPath (Join-Path $root $ManifestPath)

if (Test-Path -LiteralPath (Join-Path $root "package.json")) {
    Push-Location $root
    try { npm run verify } finally { Pop-Location }
}
