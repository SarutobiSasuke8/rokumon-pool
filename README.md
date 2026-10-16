# Rokumon Pool

A top-down browser pool game with 8-ball rules. You aim by dragging back from the cue ball and shooting on release. Play against a computer opponent or share the screen with a second player.

It is part of the Rokumon Games family of small browser games. This repository is private by decision and is not currently deployed.

## Play money only

There is no betting, wagering, currency or real-money mechanic in this game. It is a plain pool game.

## Status

Playable at version 0.2.0. A full table, the 8-ball rules and a computer opponent work. Real desktop mouse input has been tested. Touch devices have not been playtested, and the physics feel constants are still waiting on a human judgement. The deployment route is an open decision (see below).

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
| `npm test` | Runs the Node checks below (rules, computer opponent, HUD labels). |
| `npm run verify` | Runs `build`, then `npm test`. This is what CI runs. |
| `node scripts/test-rules.mjs` | Node checks for the pure 8-ball rules module. |
| `node scripts/test-ai.mjs` | Node checks for the computer opponent's shot planner. |
| `node scripts/test-labels.mjs` | Node checks for the player-facing name and turn labels. |

## How to play

- On the title screen choose Play vs Computer (click it, press 1, or press Space) or Two Players (click it or press 2). Pick the computer's difficulty (Easy, Normal or Hard) by tapping it or with the left and right arrow keys; the choice is remembered.
- Drag anywhere on the table to pull the cue back, then release to shoot. A tap on its own does nothing. The pull-back distance sets the power.
- While you drag, the game shows a cue stick, the projected path, a ghost ball, the line the object ball will take and a power bar.
- Standard 15-ball rack with 6 pockets. The first legal pot assigns suits. Pot all of your suit, then pot the 8-ball, to win.
- Potting your own suit lets you continue. A foul gives your opponent ball in hand. Fouls are a scratch, hitting no ball, or hitting the wrong ball first.
- Potting the 8-ball early loses the game. The 8-ball dropping on the break is respotted rather than counted as a loss.
- There is no call-pocket rule: any legal pot of the 8-ball after clearing your suit wins.
- Solid and striped balls differ by pattern as well as colour, so suits can be told apart without relying on colour.

## Controls

| Input | Action |
| --- | --- |
| Mouse drag or touch drag, then release | Aim and shoot. |
| 1, 2 or Space on the title screen | Start vs Computer (1 or Space) or Two Players (2). |
| R | Restart. |
| P or Esc during a match | Pause or resume. The match also pauses by itself when the tab is hidden or the window loses focus; tap, click or press Space to resume. |
| M | Mute or unmute (there is also a button in the HUD). |
| Space on the game-over screen | Play again. |
| Esc on the game-over screen | Return to the title screen. |

## How it works

- Physics is Phaser's Matter integration, run at 240 Hz substeps, with constant rolling resistance plus light drag and a top speed cap.
- A turn only resolves once every ball is at rest, with a frame-counted shot timeout as a safety net so a turn cannot hang.
- The break adds a tunable scatter kick, because a perfectly modelled rack behaves like a Newton's cradle.
- The 8-ball rules are a pure module in `src/game/rules.js`, kept separate from rendering so it can be checked in Node.
- The computer opponent is a pure planner in `src/game/ai.js`. It scores pots by cut angle, distance, pocket approach and clear paths, falls back to a safety shot, and places the cue ball after fouls so as to set up a pot.
- Sound is synthesised with the Web Audio API.
- Tuning values (`rollingDecel`, `frictionAir`, `maxShotSpeed`, `breakScatter` and others) live in `src/game/constants.js`.
- A small `postMessage` bridge in `src/integrations/hub.js` can report ready, score and game-over events to a host page.

## Tech

- [Phaser](https://phaser.io/) 4 with Matter physics
- Vite 8 and TypeScript for the entry point and type checking. Most game modules are plain JavaScript.
- Node scripts for the rules and AI checks. No other test framework is configured.

The repository ships no image or audio assets.

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

Run `npm test` and `node scripts/hub-smoke.mjs` after building to check forwarding and standalone play.

## Automated rule coverage

`npm test` runs 4 Vitest rack checks, the existing 24 shot/turn/foul/win checks, 11 AI checks, 7 HUD-label checks and optional SDK forwarding checks. `npm run build` typechecks and bundles the game. The rack tests cover triangular rows, unique ball IDs, the centre 8-ball, suit counts and initial remaining balls. Physics contacts and the live pocket sensors remain browser/playtest work.
