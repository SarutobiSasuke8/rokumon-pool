# Rokumon Pool

A top-down browser pool game with 8-ball rules, for phones and desktop. You turn the cue by dragging on the table and shoot with a power bar. Play against a computer opponent or share the screen with a second player.

It is part of the Rokumon Games family of small browser games.

## Play money only

There is no betting, wagering, currency or real-money mechanic in this game. It is a plain pool game.

## Status

Version 0.8.0. The game is feature complete for 1.0: separate aim and power controls, cue-ball spin, a table rendered in Blender, rolling balls, a title screen, how-to-play, pause menu, results with match figures and a win/loss record. What stands between this and 1.0 is listed in `ROADMAP.md` under Milestone 7: a playtest on a real phone, feel tuning after it, the final name and a deploy.

Automated checks cover real mouse and touch input in a phone-sized browser. Nobody has yet played it on a physical phone.

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

- On the title screen choose Play vs Computer (click it, press 1, or press Space) or Two Players (click it or press 2). Pick the computer's difficulty (Easy, Normal or Hard) by tapping it or with the left and right arrow keys; the choice is remembered, and your win/loss record against each level is shown.
- Aim: drag anywhere on the table to turn the cue. The cue turns by the angle your finger sweeps around the cue ball, so your finger never has to cover the shot. A tap points the cue straight at the tapped spot. On desktop the arrow keys and the mouse wheel give fine aim; hold Shift for finer.
- Power: pull the brass handle on the power bar (left margin) down and let go to shoot. Slide it back to the top and let go to cancel. Full power is available wherever the cue ball lies.
- Spin: tap the SPIN ball (bottom right), then touch where the cue should strike. High makes the cue ball follow on after contact, low draws it back, left and right change how it leaves a cushion. Spin resets after every shot. The computer does not use spin.
- The aim guide shows the cue ball's path, a ghost ball at the contact point, the line the object ball will take and where the cue ball heads afterwards. The target ball and its path are green when it is a legal first hit for you and red when it would be a foul. The guide can be switched off in the pause menu.
- Standard 15-ball rack with 6 pockets. The first legal pot assigns suits. Pot all of your suit, then pot the 8-ball, to win.
- Potting your own suit lets you continue. A foul gives your opponent ball in hand: tap or drag to place the cue ball, and drag it again to move it before you shoot. Fouls are a scratch, hitting no ball, or hitting the wrong ball first. After a scratch on the break the cue ball goes behind the head string.
- Potting the 8-ball early loses the game. The 8-ball dropping on the break is respotted rather than counted as a loss.
- There is no call-pocket rule: any legal pot of the 8-ball after clearing your suit wins.
- Balls roll: the stripe tumbles and the number comes round as a ball moves. At rest each ball turns its number back up so it can always be read. The cue ball carries red dots so its spin shows.
- The card above the table for each player shows their group (open table, solids, stripes, then on the 8) and the group's balls, with the pocketed ones faded. The lit card is the player to shoot. Pocketed balls collect in the tray on the right in the order they dropped.
- The results screen shows each player's shots, balls potted, best run and fouls, the match time and your record on that difficulty.

## Controls

| Input | Action |
| --- | --- |
| Drag on the table | Turn the cue. |
| Tap or click on the table | Point the cue at that spot. |
| Left and right arrow keys, mouse wheel | Fine aim. Hold Shift with the arrows for finer. |
| Pull the power bar down and release | Shoot. Release at the top to cancel. |
| SPIN ball, bottom right | Open the spin control. |
| 1, 2 or Space on the title screen | Start vs Computer (1 or Space) or Two Players (2). H opens How to Play. |
| R | Restart. |
| P, Esc or the pause button during a match | Pause menu: resume, restart, sound, aim guide, quit. The match also pauses when the tab is hidden, the window loses focus or the rotate-phone prompt covers the table. |
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

## How it works

- The game lays out on a 960x540 logical canvas and renders at twice that size, so text and art stay sharp on phone screens.
- Physics is Phaser's Matter integration, run at 240 Hz substeps, with constant rolling resistance plus light drag and a top speed cap.
- A turn only resolves once every ball is at rest, with a frame-counted shot timeout as a safety net so a turn cannot hang.
- The break adds a tunable scatter kick, because a perfectly modelled rack behaves like a Newton's cradle.
- The 8-ball rules are a pure module in `src/game/rules.js`, kept separate from rendering so it can be checked in Node.
- The computer opponent is a pure planner in `src/game/ai.js`. It scores pots by cut angle, distance, pocket approach and clear paths, falls back to a safety shot, and places the cue ball after fouls so as to set up a pot.
- Sound is synthesised with the Web Audio API.
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
