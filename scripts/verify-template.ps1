$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot

& (Join-Path $root "scripts/check-agent-docs.ps1")

$expected = @(
    "profiles/phaser-js/package.json",
    "profiles/phaser-js/src/main.js",
    "profiles/phaser-js/src/ui/UIHousing.js",
    "profiles/phaser-ts/package.json",
    "docs/UI_HOUSING.md",
    "addons/games-hub/docs/GAMES_HUB.md",
    "addons/agentic-operations/docs/AGENTIC_OPERATIONS.md"
)

foreach ($item in $expected) {
    if (-not (Test-Path -LiteralPath (Join-Path $root $item))) { throw "Missing template component: $item" }
}

Write-Host "Browser-game template structure is valid." -ForegroundColor Green
