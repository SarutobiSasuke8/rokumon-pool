<#
.SYNOPSIS
  Ship this game's current build to the Rokumon Games hub as a ready-to-review branch.

.DESCRIPTION
  Wraps the hub's own scripts (sync:game, check:games) so every game ships the same way:
    1. verify the game (npm run verify:full: build + real-input smoke test)
    2. cut a fresh hub worktree from origin/master (never touches your hub checkout)
    3. build the game and mirror its bundle into public/games/<slug>
    4. optionally bump version, delivery.release and updatedAt in the manifest
    5. run the hub's bundle check
    6. commit on a ship/<slug>-<version> branch

  Nothing is pushed unless you pass -Pr. A merged hub PR auto-deploys to
  rokumongames.com, so -Pr is the outward-facing step and is opt-in.

  First-time intake (no manifest in the hub yet) is not handled here: follow the hub's
  docs/GAME_INTAKE.md, then use this script for every release after.

.EXAMPLE
  powershell -File scripts/ship-hub.ps1 -Slug crazy-crystal-factory -Version 0.3.0
  powershell -File scripts/ship-hub.ps1 -Slug crazy-crystal-factory -Version 0.3.0 -Pr
  powershell -File scripts/ship-hub.ps1 -Slug rokumon-pool -DryRun
#>
param(
    [Parameter(Mandatory = $true)]
    [string]$Slug,
    [string]$Version,
    [string]$HubRepo,
    [string]$WorktreeRoot = "C:\Dev\Projects\_wt",
    [switch]$SkipVerify,
    [switch]$AllowDirty,
    [switch]$DryRun,
    [switch]$Pr
)

$ErrorActionPreference = "Stop"
$gameRoot = Split-Path -Parent $PSScriptRoot

if (-not $HubRepo) { $HubRepo = $env:ROKUMON_GAMES_REPO }
if (-not $HubRepo) { $HubRepo = "C:\Users\sarut\Documents\Games Development Hub\Rokumon Games" }
if ($Slug -notmatch '^[a-z0-9]+(-[a-z0-9]+)*$') { throw "Slug must be kebab-case: $Slug" }
if ($Version -and $Version -notmatch '^\d+\.\d+\.\d+$') { throw "Version must look like 1.2.3: $Version" }
if (-not (Test-Path -LiteralPath (Join-Path $HubRepo "content/games"))) { throw "Not a Rokumon Games checkout: $HubRepo (set -HubRepo or ROKUMON_GAMES_REPO)" }

function Step([string]$Message) { Write-Host "`n== $Message" -ForegroundColor Cyan }

function Invoke-Git {
    param([string]$Repo, [Parameter(ValueFromRemainingArguments = $true)][string[]]$GitArgs)
    $output = & git -c "safe.directory=$Repo" -C $Repo @GitArgs
    if ($LASTEXITCODE -ne 0) { throw "git $($GitArgs -join ' ') failed in $Repo" }
    return $output
}

# 1. The game itself must be committed and verified.
Step "Check the game"
$dirty = Invoke-Git $gameRoot status --porcelain
if ($dirty -and -not $AllowDirty) {
    throw "The game has uncommitted changes. Commit them so the shipped bundle matches a revision, or pass -AllowDirty."
}
$gameRevision = (Invoke-Git $gameRoot rev-parse --short HEAD)
Write-Host "Game revision $gameRevision"

if (-not $SkipVerify) {
    Push-Location $gameRoot
    try {
        npm run verify:full
        if ($LASTEXITCODE -ne 0) { throw "verify:full failed. Fix the game before shipping, or pass -SkipVerify and say why." }
    } finally { Pop-Location }
} else {
    Write-Host "Skipping verify:full (-SkipVerify). Say why in the PR." -ForegroundColor Yellow
}

# 2. A fresh hub worktree off origin/master.
Step "Prepare a hub worktree"
Invoke-Git $HubRepo fetch origin master | Out-Null
$manifestRel = "content/games/$Slug.json"
# Windows PowerShell 5.1 turns redirected native stderr into a terminating error under
# "Stop", so probe with "Continue" and read the exit code instead.
$ErrorActionPreference = "Continue"
& git -c "safe.directory=$HubRepo" -C $HubRepo cat-file -e "origin/master:$manifestRel" 2>$null
$onMaster = ($LASTEXITCODE -eq 0)
$ErrorActionPreference = "Stop"
if (-not $onMaster) { throw "$manifestRel is not on hub origin/master. This is a first-time intake: follow docs/GAME_INTAKE.md in the hub." }

$label = if ($Version) { $Version } else { (Get-Date -Format "yyyyMMdd") }
$branch = "ship/$Slug-$label"
$worktree = Join-Path $WorktreeRoot "hub-ship-$Slug"
if (Test-Path -LiteralPath $worktree) { throw "Worktree path already exists: $worktree. Remove it (git worktree remove) or pick another -WorktreeRoot." }
New-Item -ItemType Directory -Path $WorktreeRoot -Force | Out-Null
Invoke-Git $HubRepo worktree add -b $branch $worktree origin/master | Out-Null
Write-Host "Worktree $worktree on $branch"

function Remove-ShipWorktree {
    $ErrorActionPreference = "Continue"
    & git -c "safe.directory=$HubRepo" -C $HubRepo worktree remove --force $worktree 2>$null
    & git -c "safe.directory=$HubRepo" -C $HubRepo branch -D $branch 2>$null | Out-Null
    $ErrorActionPreference = "Stop"
}

try {
    # 3. Build the game and mirror its bundle (the manifest's source.* paths drive this).
    Step "Build and mirror the bundle"
    Push-Location $worktree
    try {
        node scripts/sync-game.mjs $Slug
        if ($LASTEXITCODE -ne 0) { throw "sync-game failed" }

        # 4. Manifest bump.
        $manifestPath = Join-Path $worktree $manifestRel
        $json = [System.IO.File]::ReadAllText($manifestPath)
        $title = ([regex]::Match($json, '"title"\s*:\s*"([^"]*)"')).Groups[1].Value
        if ($Version) {
            $today = Get-Date -Format "yyyy-MM-dd"
            $json = [regex]::Replace($json, '("version"\s*:\s*)"[^"]*"', "`$1`"$Version`"", 1)
            $json = [regex]::Replace($json, '("release"\s*:\s*)"[^"]*"', "`$1`"$Version`"", 1)
            $json = [regex]::Replace($json, '("updatedAt"\s*:\s*)"[^"]*"', "`$1`"$today`"", 1)
            [System.IO.File]::WriteAllText($manifestPath, $json, (New-Object System.Text.UTF8Encoding($false)))
            Write-Host "Manifest bumped to $Version ($today)"
        } else {
            Write-Host "No -Version given: manifest left as is (bundle refresh only)."
        }

        # 5. The hub's own bundle check.
        Step "Hub bundle check"
        node scripts/check-game-bundles.mjs
        if ($LASTEXITCODE -ne 0) { throw "check-game-bundles failed" }
    } finally { Pop-Location }

    # 6. Commit.
    Step "Commit"
    $changed = Invoke-Git $worktree status --porcelain
    if (-not $changed) { throw "Nothing changed in the hub: the bundle already matches origin/master." }
    if ($DryRun) {
        Write-Host "DRY RUN: would commit these changes (first 15):" -ForegroundColor Yellow
        $changed | Select-Object -First 15 | ForEach-Object { Write-Host "  $_" }
        Remove-ShipWorktree
        Write-Host "Dry run complete. Worktree and branch removed." -ForegroundColor Green
        return
    }
    Invoke-Git $worktree add -- $manifestRel "public/games/$Slug" | Out-Null
    $message = if ($Version) { "${title} ${Version}: ship from game revision ${gameRevision}" } else { "${title}: refresh bundle from game revision ${gameRevision}" }
    Invoke-Git $worktree commit -m $message | Out-Null
    Write-Host "Committed on $branch" -ForegroundColor Green
} catch {
    Remove-ShipWorktree
    throw
}

if ($Pr) {
    Step "Push and open the PR"
    Invoke-Git $worktree push -u origin $branch | Out-Null
    $body = "Ships $Slug from game revision $gameRevision.`n`n- verify:full: $(if ($SkipVerify) { 'skipped' } else { 'passed (build + real-input smoke test)' })`n- Merging auto-deploys to rokumongames.com."
    Push-Location $worktree
    try { gh pr create --base master --title $message --body $body } finally { Pop-Location }
} else {
    Write-Host "`nNot pushed. Review it in $worktree, then push and open the PR:" -ForegroundColor Cyan
    Write-Host "  git -C `"$worktree`" push -u origin $branch"
    Write-Host "  (or remove it with: git -C `"$HubRepo`" worktree remove --force `"$worktree`"; git -C `"$HubRepo`" branch -D $branch)"
    Write-Host "Next time pass -Pr to push and open the PR in the same run."
}
