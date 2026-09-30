# Changelog

All notable changes to this project should be documented here.

## Unreleased

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
