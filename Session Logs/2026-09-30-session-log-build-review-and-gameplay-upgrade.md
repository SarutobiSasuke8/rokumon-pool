---
type: session-log
date: 2026-09-30
status: complete
mutability: append-only
---

# Session Log: Build Review and Gameplay Upgrade

## Goal

Review the 2026-09-06 playable core and apply the improvements worth making.

## Findings

1. **Every shot after the first second did nothing.** Matter body sleeping puts every ball to sleep after 60 idle frames, and `Body.setVelocity` never wakes a sleeping body. A real drag registered, the turn passed, the cue ball never moved. The 09-06 harness verification fired shots before the balls slept, so it never saw this. Confirmed with a real mouse drag and with the harness.
2. **Any tap fired a shot.** Aim was computed from the pointer's absolute position relative to the cue ball, so a tap anywhere farther than 6 px was a shot in that direction.
3. **Scratch respot could overlap a ball** (fixed spot, no check).
4. **No foul rules** beyond scratch: wrong-suit first contact and no-contact were legal.
5. **`npm run build` was red** on Phaser 4's own `.d.ts` (`skipLibCheck` missing), so CI failed.
6. **Shot timeout was wall-clock**, so a throttled or hidden tab force-stopped shots mid-flight. This also confounded the first break tests in this session.
7. **Break physics.** Measured, not guessed: a pure simulation of a triangular rack sends the wing balls down the rack edges to the corners and leaves the pack standing (Newton's cradle). Rack gap (0 to 2 px), jitter, and whether the rack was asleep made no measurable difference to spread. Single ball-on-ball collisions were physically correct.

## Changes

- Cue ball (and all balls) woken at shot start; Matter runner at 240 Hz (four substeps per frame); position/velocity iterations 8/6.
- Drag-vector input: pull back from anywhere, release to shoot; taps under 14 px ignored; `pointerupoutside` handled.
- Aim guide: cue stick, dashed projected path, ghost ball at first contact, object-ball line, power bar. Pure projection in `src/game/aim.js`.
- Rules moved to pure `src/game/rules.js`: scratch, no-contact and wrong-first-contact fouls; ball in hand for the opponent; 8-ball win/loss cases including "last ball and 8 together" and "8 on a foul". `scripts/test-rules.mjs` covers 13 cases.
- Ball-in-hand placement mode: cue ball lifted from the world, follows pointer, rejects overlap with balls or pockets, tap or release to confirm.
- Rolling resistance: constant per-frame speed loss (0.06) plus light drag (0.008); full power now 32 px/frame. Full-power shot travels about two table lengths in three seconds.
- Arcade break scatter (`breakScatter` 0.28) on the break's first contact. Mean spread from rack centre went from about 46 px to 63 to 104 px across runs, 5 to 12 of 15 balls displaced.
- Web Audio synth: cue strike, ball click, cushion thud, pocket drop. No assets.
- HUD: per-player suit and remaining mini-balls; open-table label.
- Outer frame walls behind pocket gaps and an off-table sanity check.
- Frame-counted shot timeout (600 frames).
- Debug harness: `stepFrames` on virtual time via `game.step`, `placeCue`, `getScene`, renderer `snapshot`; dev-only `window.__PHASER_GAME__` so a hidden tab can still be driven.
- `skipLibCheck` in tsconfig; build green.
- README rewritten for the game; CHANGELOG and TODO updated.

## Verification

- `npm run build` green (tsc + vite). `node scripts/test-rules.mjs`: 13 passed.
- Browser (built-in pane, real mouse drag): drag after idle fires a shot; aim guide renders; break resolves; scratch enters placement; placement rejects ball and pocket overlap and accepts a free spot; no console errors.
- Deterministic harness runs for physics measurements (per-ball speeds through impact, A/B of rack variants, spread metric).

## Testing notes for future sessions

- The desktop app's browser pane pauses `requestAnimationFrame` when hidden. Wall-clock waits and `renderer.snapshot` (which needs a rendered frame) hang. Drive the loop with `__GAME_DEBUG__.stepFrames`, and after requesting a snapshot step one frame before awaiting it.
- Phaser listens for `mousedown/mousemove/mouseup` (and touch events), not Pointer Events. Synthetic drags must dispatch `MouseEvent`s on the canvas, with `mouseup` on `window`.
- The pane's screenshot tool captured a cropped 1.5x region of this page; use the renderer snapshot instead.

## Open

- Touch-device playtest (drag vector, placement by touch, iOS audio unlock).
- Feel tuning after a human playtest: `rollingDecel`, `frictionAir`, `maxShotSpeed`, `breakScatter`.
- Break rule refinements (kitchen-only placement after a break scratch, 8 on the break).
- Uncommitted: all changes are in the working tree on `master`, not committed.
