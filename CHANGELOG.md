# Changelog

All notable changes to this project should be documented here.

## Unreleased

### 2026-11-10 completion overhaul (0.8.0)

Changed

- Controls: aim and power are separate. Drag on the table to turn the cue (a tap points it at the spot), pull the power bar to shoot. The old pull-back drag ran out of room when the cue ball sat near a cushion, because the pointer left the canvas before full power.
- The aim guide is always visible on the player's turn and also shows where the cue ball heads after contact. It can be switched off in the pause menu.
- The game renders at twice the logical 960x540 size, so text, lines and balls are sharp on phone screens.
- Table: a top-down Blender render (wood rails, cloth, cushions, leather pocket surrounds, pearl sights, overhead lighting), built by `art/blender/build_scene.py` from the game's own table measurements. A code-drawn table remains as the fallback.
- Balls are live shaded spheres that roll: the stripe tumbles and the number comes round, and a ball at rest turns its number back up. The cue ball carries red dots.
- Cue: a tapered stick with bumper, butt, linen wrap, points, ferrule and chalked tip, with a shadow. It strikes forward on the shot and fades.
- Menus, HUD and results use bundled typefaces (Barlow, Barlow Condensed) and one brass-on-charcoal look. The title screen shows the rendered key art.
- Ball in hand: the cue ball can be dragged again after it is placed, until the shot is taken.

Added

- Cue-ball spin: follow, draw and side, set on a spin control. Tuning in `SPIN` in `src/game/constants.js`.
- Pause menu with resume, restart, sound, aim guide and quit. How-to-play screen.
- Results screen with shots, balls potted, best run and fouls for each player, match time, and a win/loss record per difficulty kept on the device.
- A scratch on the break puts the cue ball behind the head string.
- Fine aim with the arrow keys (Shift for finer) and the mouse wheel.
- Pocketed balls drop into the pocket instead of vanishing.
- Banner and store imagery in `art/banners/`, composed by `scripts/make-banners.mjs` from the Blender key art.
- Tests: `tests/ball-roll.test.js`, `tests/stats.test.js`. The browser smokes now drive the power bar with real mouse and touch input.
- The two mobile fixes from `codex/pool-mobile-playtest-20261104` (pause while the rotate prompt covers the table; an OS-cancelled touch drops the pull without shooting).

Not done

- No playtest on a physical phone. Spin strength and the feel constants are untuned by hand.
- No call-pocket rule for the 8-ball (an open decision).

### 2026-10-23 ball readability (0.3.0, #11)

Changed

- Balls are painted in the standard pool look: numbers 1 to 15 on a white disc, solids coloured all over, stripes white with a coloured band, a black 8, a dark rim and a soft contact shadow. Textures are painted at twice the display size so the numbers stay sharp when the canvas is scaled.
- Ball colours follow the standard order. The 6 and 14 are a lighter green, because the old dark green almost vanished into the cloth.
- The aim guide is a solid line on a dark underlay with a ghost ball, and the target ball and its path are green for a legal first hit and red for a foul. The power meter moved to the left margin.

Added

- Player cards above the table: name, group (open table, solids, stripes, on the 8), the group's balls with pocketed ones faded, and the shooter's card lit. The turn line and message sit below the table.
- A pocketed-ball tray in the right margin, in the order the balls dropped.
- Tests: `tests/ball-identity.test.js`, `tests/hud.test.js` and the browser smoke `scripts/readability-smoke.mjs` (desktop and phone), run from `scripts/hub-smoke.mjs`.

### 2026-10-16 beta polish

Added

- The match pauses when the tab is hidden or the window loses focus (P or Esc by hand too), a loading line while the bundle loads, a meta description and an inline favicon, and the canvas is centred on tall screens with page scroll and overscroll locked.

### 2026-10-08 computer difficulty (#4)

Added

- Easy, Normal and Hard for the computer opponent, chosen on the menu by tap, click or the left and right arrow keys, and remembered per browser like mute (falls back to Normal if storage is unavailable). The level carries through R restarts and the game-over restart, and shows in the HUD ("Computer (Hard)") and on the game-over screen.
- One tuning table, `AI_DIFFICULTY` in `src/game/constants.js`. Easy aims looser (skill 0.35), takes a weaker legal pot 45% of the time and puts ball in hand on a workable but not best spot 60% of the time. Normal is unchanged (skill 0.62, best shot, best placement). Hard takes the best shot with tighter aim and power (skill 0.85).
- `planShot` and `planPlacement` accept an optional `random` source, so `scripts/test-ai.mjs` checks the levels with a seeded generator (11 checks: Hard has a smaller mean angle error than Normal, Normal smaller than Easy; Normal matches the original planner exactly).
- Debug harness: `startGame(data)` takes scene data and `inspect()` reports mode, difficulty and AI tuning.

### 2026-09-30 push forward (0.2.0)

Added

- Computer opponent: menu offers Play vs Computer or Two Players. The planner (`src/game/ai.js`, pure) scores every target and pocket pair by cut angle, distances, pocket approach angle and clear cue and object paths, falls back to a direct safety, and chooses a ball-in-hand spot that sets up a pot. Shots are previewed with the aim guide before they are taken. `scripts/test-ai.mjs` covers 6 cases.
- The 8-ball dropping on the break is respotted instead of losing the game (rules test cases added, 16 total).
- Mute toggle (M key and a HUD button), remembered per browser.
- Portrait phones get a rotate-to-landscape prompt.
- Game-over screen shows You win / Computer wins in solo mode and returns to the same mode; Esc goes to the menu.
- Manual-trigger GitHub Pages workflow. Catalogued in the Rokumon Games hub as `rokumon-pool` (version 0.2.0).

### 2026-09-30 build review

Fixed

- Shots taken after the balls fell asleep did nothing and silently passed the turn: Matter's `Body.setVelocity` never wakes a sleeping body. The cue ball is now woken on every shot.
- The engine now runs four physics substeps per frame so a fast cue ball cannot bury itself in the rack before contact is detected. All balls are woken when a shot begins as a precaution (measured: rack sleeping state made no difference to the break once the cue ball itself was awake).
- Ball motion now uses constant rolling resistance plus light drag instead of heavy exponential drag, so full-power shots travel about two table lengths and soft shots settle in about a second.
- The break adds a random scatter kick to the pack on first contact. A pure simulation of a triangular rack only sends the wing balls to the corners (Newton's cradle along the rack edges), which reads as a dud break; rack gap and jitter were measured and do not change this.
- Any tap on the table fired a full shot from the tap position. Input is now a drag vector (pull back from anywhere, release to shoot) and taps below the drag threshold are ignored.
- The cue ball was respotted on a fixed point after a scratch, which could overlap another ball.
- The shot-settle safety net used wall-clock time, so a throttled background tab force-stopped shots mid-flight. It now counts simulated frames.
- `npm run build` failed on Phaser 4's own type definitions; `skipLibCheck` is on.

Added

- Standard 8-ball fouls: scratch, no contact, wrong first contact (opponent's suit, or the 8 when not on it). Fouls give the opponent ball in hand with a placement mode that rejects spots overlapping balls or pockets.
- Aim guide: cue stick, projected cue-ball path, ghost ball at first contact, object-ball travel line, power bar.
- Web Audio sound synth (cue strike, ball click, cushion thud, pocket drop) with no asset files.
- HUD shows each player's suit and remaining balls; open table is labelled.
- Outer frame walls behind the pocket gaps and an off-table sanity check so no ball can leave play.
- Pure rules module (`src/game/rules.js`) with a Node check (`scripts/test-rules.mjs`, 13 cases).
- Debug harness: deterministic `stepFrames` on virtual time, `placeCue`, renderer `snapshot`.

Earlier

- Initial template setup.
- Added a reusable branded-HUD housing contract: normalized safe insets, Phaser containment auditing/debug guides, and screenshot-based QA guidance.
