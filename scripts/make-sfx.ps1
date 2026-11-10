# Generates the game's sound effects with the ElevenLabs sound-generation API
# and writes them to src/audio/. The key is read from the Windows user
# environment variable ELEVENLABS_API_KEY and is never printed.
#
#   powershell -File scripts/make-sfx.ps1            # only files that are missing
#   powershell -File scripts/make-sfx.ps1 -Force     # regenerate everything
#   powershell -File scripts/make-sfx.ps1 -Only clack-1,clack-2
#
# Each call spends ElevenLabs credits. The game falls back to its built-in
# synthesised sounds for any file that is missing.
param([switch]$Force, [string[]]$Only)

$ErrorActionPreference = 'Stop'
$key = [Environment]::GetEnvironmentVariable('ELEVENLABS_API_KEY', 'User')
if (-not $key) { throw 'ELEVENLABS_API_KEY is not set in the Windows user environment.' }

$out = Join-Path (Split-Path $PSScriptRoot -Parent) 'src\audio'
New-Item -ItemType Directory -Force $out | Out-Null

$dry = 'Close microphone, completely dry, no reverb, no echo, no music, no voices, no background noise.'
$sounds = @(
  @{ name = 'clack-1';   seconds = 0.5; influence = 0.75; text = "A single sharp crisp click of two hard phenolic resin billiard balls colliding once. $dry" },
  @{ name = 'clack-2';   seconds = 0.5; influence = 0.75; text = "One hard bright clack of two pool balls striking each other at speed, a single impact. $dry" },
  @{ name = 'clack-3';   seconds = 0.5; influence = 0.75; text = "A single light gentle tick of two billiard balls touching softly. $dry" },
  @{ name = 'cue-soft';  seconds = 0.5; influence = 0.7;  text = "A leather pool cue tip striking a cue ball gently, one soft tock. $dry" },
  @{ name = 'cue-hard';  seconds = 0.6; influence = 0.7;  text = "A pool cue striking the cue ball hard for a power break shot, one firm punchy crack. $dry" },
  @{ name = 'cushion-1'; seconds = 0.5; influence = 0.7;  text = "A billiard ball bouncing off the rubber cushion of a pool table, one dull muffled thud. $dry" },
  @{ name = 'cushion-2'; seconds = 0.5; influence = 0.7;  text = "A pool ball hitting a cloth-covered rubber rail, one soft low bump. $dry" },
  @{ name = 'pocket-1';  seconds = 1.0; influence = 0.6;  text = "A billiard ball dropping into a leather pool table pocket with a short hollow rattle. $dry" },
  @{ name = 'pocket-2';  seconds = 1.0; influence = 0.6;  text = "A pool ball falling into a corner pocket and thudding down against other balls. $dry" },
  @{ name = 'ui-click';  seconds = 0.5; influence = 0.7;  text = "One short soft wooden tick, a user interface button press. $dry" },
  @{ name = 'foul';      seconds = 0.8; influence = 0.6;  text = "A short low muted double thump, a subtle game foul notification, wooden and soft, not harsh. No voices." },
  @{ name = 'rack';      seconds = 1.6; influence = 0.6;  text = "Pool balls rattling and settling as they are pushed tight in a wooden rack triangle on cloth. Dry, no music, no voices." },
  @{ name = 'win';       seconds = 3.0; influence = 0.5;  text = "A short triumphant lounge jazz sting, vibraphone and muted brass, warm and classy, ends cleanly. No voices." },
  @{ name = 'lose';      seconds = 2.5; influence = 0.5;  text = "A short gentle descending jazz sting on upright bass and Rhodes piano, rueful not sad, ends cleanly. No voices." },
  @{ name = 'trophy';    seconds = 2.0; influence = 0.5;  text = "A bright sparkling chime and soft gong, an award won, elegant and short. No voices." }
)

foreach ($s in $sounds) {
  if ($Only -and ($Only -notcontains $s.name)) { continue }
  $file = Join-Path $out ($s.name + '.mp3')
  if ((Test-Path $file) -and -not $Force) { Write-Output "skip $($s.name) (exists)"; continue }
  $body = @{ text = $s.text; duration_seconds = $s.seconds; prompt_influence = $s.influence } | ConvertTo-Json
  try {
    Invoke-WebRequest -Uri 'https://api.elevenlabs.io/v1/sound-generation?output_format=mp3_44100_128' -Method Post `
      -Headers @{ 'xi-api-key' = $key } -ContentType 'application/json' -Body $body -OutFile $file -UseBasicParsing | Out-Null
    Write-Output "wrote $($s.name).mp3 ($((Get-Item $file).Length) bytes)"
  } catch {
    Write-Output "FAILED $($s.name): $($_.Exception.Message)"
    if (Test-Path $file) { Remove-Item $file -Confirm:$false }
  }
}
