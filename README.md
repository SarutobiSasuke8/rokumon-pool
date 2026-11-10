# Rokumon Pool

A top-down browser pool game for phones and desktop, with four games (8-ball, 9-ball, blackball and the house game, Six Coins) and a ten-opponent campaign. You turn the cue by dragging on the table and shoot with a power bar. Play the campaign, a quick match against the computer, or share the screen with a second player.

It is part of the Rokumon Games family of small browser games.

## Play money only

There is no betting, wagering, currency or real-money mechanic in this game. It is a plain pool game.

## Status

Version 0.10.2. The game is feature complete for 1.0: four games, a campaign with ten opponents and trophies, separate aim and power controls, cue-ball spin, a table rendered in Blender, rolling balls, recorded sound effects, and full menus and results screens. What stands between this and 1.0 is listed in `ROADMAP.md` under Milestone 7: a playtest on a real phone, feel tuning after it, a listening pass on the sound effects and the final name.

Automated checks cover real mouse and touch input in a phone-sized browser. Nobody has yet played it on a physical phone. The generated sound effects and the music have been verified to load and play in a browser, but not yet listened to by a person.

## Run it

You need Node.js 22 or later (the CI workflow uses 22).

```bash
npm install
npm run dev
```

Vite prints a local address to open in a browser. To try it on a phone on the same network, run `npx vite --host` instead and open the address it prints.

| Command | What it does |
| --- | --- |
| `npm run build` | Type checks with `tsc --noEmit`, then builds with Vite into `dist/`. |
| `npm run preview` | Serves the built `dist/` folder locally. |
| `npm test` | Runs the unit tests (vitest) and the Node checks below (rules, computer opponent, HUD labels). |
| `npm run smoke` | Boots the built game in a headless browser, on desktop and a phone-sized touch viewport, and plays it with real input. Needs `npm run build` first. |
| `npm run verify` | Runs `build`, then `npm test`. This is what CI runs. |
| `node scripts/test-rules.mjs` | Node checks for the pure 8-ball rules module. |
| `node scripts/test-ai.mjs` | Node checks for the computer opponent's shot planner. |
| `node scripts/test-labels.mjs` | Node checks for the player-facing name and turn labels. |

## How to play

**Games.** Pick one on the title screen under Quick Match.

- **8-ball.** The first ball you pot decides your group, solids or stripes. Pot one of yours and you shoot again. Clear your group, then pot the 8 to win. Pot the 8 early and you lose; the 8 dropping on the break is respotted.
- **Blackball.** The same rules with seven reds, seven yellows and the black.
- **Six Coins.** The house game, named for the six-coin crest. Six gold coin balls sit in the heart of the rack, guarded by nine reds. First to bank four coins wins.
  - Every visit starts on red. Pot a red and gold is on: your next shot must hit a coin first. Pot it to bank it, and you are back on red.
  - A coin only counts when gold was on and the shot was legal. Any other coin that drops goes back on the table.
  - With every red gone, gold is always on.
  - At three coins each, one coin goes back on the spot and whoever pots it wins.
  - Fouls give two shots, as in 8-ball.
- **9-ball.** Nine balls in a diamond. Always hit the lowest numbered ball first. Any ball potted on a legal shot keeps you at the table, and potting the 9 on a legal shot wins at any time.

**Fouls.** A scratch, missing every ball, or hitting the wrong ball first. A banner in the middle of the table says what went wrong and what the other player gets.

- In 8-ball, blackball and Six Coins a foul gives your opponent **two shots**. A pot does not use one up. The cue ball stays where it lies, except after a scratch, when it is placed behind the head string. The shooter's card shows a red "2 SHOTS" chip.
- In 9-ball a foul gives ball in hand anywhere. The 9 going down on a foul is respotted.
- There is no call-pocket rule.

**Campaign.** A ladder of ten opponents named for the Sanada Ten Braves. Each plays differently (accuracy, shot choice, how hard they hit, how long they think) and some prefer 9-ball, blackball or Six Coins. Beat one to win their trophy and unlock the next. Win without a foul and the trophy is gold. Progress is kept on the device.

**Playing a shot.**

- Aim: drag anywhere on the table to turn the cue. The cue turns by the angle your finger sweeps around the cue ball, so your finger never has to cover the shot. A tap points the cue straight at the tapped spot. On desktop the arrow keys and the mouse wheel give fine aim; hold Shift for finer.
- Power: pull the brass handle on the power bar (left margin) down and let go to shoot. Slide it back to the top and let go to cancel.
- Spin: tap the SPIN ball (bottom right), then touch where the cue should strike. High makes the cue ball follow on, low draws it back, left and right change how it leaves a cushion. Spin resets after every shot. The computer does not use spin.
- The aim guide shows the cue ball's path, a ghost ball at the contact point, the line the object ball will take and where the cue ball heads afterwards. Green means a legal first hit, red a foul. It can be switched off in the pause menu.

**On screen.** The card above the table for each player shows their group and its balls, with the pocketed ones faded; in 9-ball the shooter's card shows the run of balls and which one is on. Pocketed balls collect in the tray on the right. Balls roll as they move and turn their number back up at rest. The results screen shows shots, balls potted, best run and fouls, plus your record or the trophy you won.

## Controls

| Input | Action |
| --- | --- |
| Drag on the table | Turn the cue. |
| Tap or click on the table | Point the cue at that spot. |
| Left and right arrow keys, mouse wheel | Fine aim. Hold Shift with the arrows for finer. |
| Pull the power bar down and release | Shoot. Release at the top to cancel. |
| SPIN ball, bottom right | Open the spin control. |
| C, 1, 2 or Space on the title screen | Campaign (C), vs Computer (1 or Space) or Two Players (2). H opens How to Play. |
| R | Restart. |
| P, Esc or the pause button during a match | Pause menu: resume, restart, sound, music, aim guide, quit. The match also pauses when the tab is hidden, the window loses focus or the rotate-phone prompt covers the table. |
| M | Mute or unmute. |
| Space on the results screen | Play again. |
| Esc on the results screen | Return to the title screen. |

## Art

- The table and the key art are rendered in Blender from one script, `art/blender/build_scene.py`, which builds the scene from the same table measurements the game uses. Run it with Blender, not system Python:
  - `blender --background --python art/blender/build_scene.py -- table` writes `src/art/table.webp`, the top-down table the game plays on.
  - `blender --background --python art/blender/build_scene.py -- hero keyart 1920 1080` writes the key art to `art/renders/` and the title-screen backdrop to `src/art/keyart.webp`.
  - `blender --background --python art/blender/build_scene.py -- save` writes a `.blend` to open in the Blender UI.
- `node scripts/make-banners.mjs` (after `npm run build`) composes the banners, cover and share images in `art/banners/` and takes clean in-game screenshots.
- If `src/art/table.webp` is missing the game draws a plain table in code, so the build never depends on Blender.
- Balls, cue, HUD and menus are drawn in code (`src/systems/ballRender.js`, `src/systems/cueArt.js`, `src/ui/theme.js`). The typefaces are Barlow and Barlow Condensed (SIL Open Font Licence), bundled as woff2.

## Sound and music

- Sound effects are recorded files in `src/audio/`, generated with the ElevenLabs sound-effects API by `scripts/make-sfx.ps1` (Windows PowerShell; reads the key from the `ELEVENLABS_API_KEY` user environment variable and spends credits). Ball clicks come in three strengths and are scaled and pitched by impact speed.
- Any effect whose file is missing falls back to a small built-in synthesiser, so the game never depends on the files.
- Charge-up: pulling the power handle plays a live synthesised tone that rises in pitch and loudness with the pull, with a tick at each quarter. It is generated rather than recorded so it can follow the handle (`chargeStart`, `chargeSet` and `chargeStop` in `src/systems/audio.js`).
- Music: `src/audio/music-main.mp3`, "Smoky Lounge", made with Suno on a Pro plan (commercial use allowed) from a jazz-lounge pool-hall prompt, trimmed and faded for looping (3:32, about 4.6 MB). Any file starting `music` in `src/audio/` is picked up. It loops quietly, pauses with the game, and has its own toggle on the title screen and in the pause menu.

## How it works

- The game lays out on a 960x540 logical canvas and renders at twice that size, so text and art stay sharp on phone screens.
- Physics is Phaser's Matter integration, run at 240 Hz substeps, with constant rolling resistance plus light drag and a top speed cap.
- A turn only resolves once every ball is at rest, with a frame-counted shot timeout as a safety net so a turn cannot hang.
- The break adds a tunable scatter kick, because a perfectly modelled rack behaves like a Newton's cradle.
- The rules for all three games are a pure module in `src/game/rules.js`, kept separate from rendering so they can be checked in Node. The campaign ladder and its progress logic are in `src/systems/campaign.js`.
- The computer opponent is a pure planner in `src/game/ai.js`. It scores pots by cut angle, distance, pocket approach and clear paths, falls back to a safety shot, and places the cue ball after fouls so as to set up a pot.
- Spin is applied the frame after the contact that triggers it: follow and draw after the first object-ball contact, side spin on a cushion rebound.
- Tuning values (`rollingDecel`, `frictionAir`, `maxShotSpeed`, `breakScatter`, `SPIN` and others) live in `src/game/constants.js`.
- A small `postMessage` bridge in `src/integrations/hub.js` can report ready, score and game-over events to a host page.

## Tech

- [Phaser](https://phaser.io/) 4 with Matter physics
- Vite 8 and TypeScript for the entry point and type checking. Most game modules are plain JavaScript.
- Node scripts for the rules and AI checks. No other test framework is configured.

The repository ships no image or audio assets. Ball art is painted at runtime into canvas textures (`src/systems/ballArt.js`).

## Project layout

- `src/main.ts`: Phaser game setup.
- `src/scenes/`: boot, menu, game, HUD and game-over scenes.
- `src/game/`: rules, AI, aiming, constants and match state.
- `src/systems/`: input, audio and debug helpers.
- `src/ui/`: HUD housing helper.
- `scripts/`: the Node checks above plus project verification scripts.
- `docs/`, `Templates/`, `personas/`, `profiles/`, `addons/`, `Session Logs/`, `AGENTS.md` and the other agent files: the working agreement and notes from the browser game template this project started from. See `TEMPLATE_NOTES.md`.
- `.github/workflows/pages.yml`: a manual-only GitHub Pages deployment. It cannot succeed while the repository is private on the free plan, and the repository visibility is deliberately left private.

## Open work

- A human playtest on a touch device: drag aim, ball-in-hand placement by touch and iOS audio unlock.
- Judging and tuning the physics feel constants.
- Easy, Normal and Hard computer difficulty levels.
- Choosing a deployment route that does not require making the repository public.

## Licence

See `LICENSE`.

## Rokumon hub events

The optional `/hub-bridge.js` SDK receives ready, score (object balls legally removed by both sides, 0 to 14), and gameOver once at match end with duration. Calls remain safe without the SDK. Static `dist/` assets use relative URLs.

- `match-won`: winner (number, 1 or 2), mode (string), seconds (number).

Run `npm test` and `node scripts/hub-smoke.mjs` (or `npm run smoke`) after building to check forwarding and standalone play. `hub-smoke.mjs` also runs `scripts/readability-smoke.mjs`, which checks the painted ball textures, the HUD cards and the tray on a desktop and a phone (667x375) viewport and writes screenshots to `tests/evidence/`.

## Automated rule coverage

`npm test` runs 4 Vitest rack checks, 14 Vitest ball-identity checks (numbers, stripes against solids, colours, contrast with the cloth), 10 Vitest HUD checks (group assignment, remaining balls, tray), the existing 24 shot/turn/foul/win checks, 11 AI checks, 7 HUD-label checks and optional SDK forwarding checks. `npm run build` typechecks and bundles the game. The rack tests cover triangular rows, unique ball IDs, the centre 8-ball, suit counts and initial remaining balls. Physics contacts and the live pocket sensors remain browser/playtest work.
