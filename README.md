# Rokumon Pool

Working-title browser and mobile 8-ball pool. Top-down, physics-driven, local two-player, built on Phaser 4 with Matter physics, TypeScript and Vite. Started from the `vibe-coding-browser-game-template` (`phaser-ts` profile, `games-hub` addon).

## Play

```bash
npm install
npm run dev
```

Open the printed URL. Pick **Play vs Computer** (key 1 or Space) or **Two Players** (key 2).

- **Computer opponent.** Picks the best available pot (cut angle, distances, pocket approach, clear cue and object paths), plays a safety when nothing is on, and places the cue ball to set up a pot after your fouls. Its accuracy is `AI.skill` in `src/scenes/GameScene.js`; the planner is pure code in `src/game/ai.js`.
- **Aim and shoot.** Drag anywhere on the table to pull the cue back, release to shoot. The direction and power come from the drag vector, so your finger never has to cover the cue ball. A tap without a drag does nothing.
- **Aim guide.** While dragging you see the cue stick, the projected cue-ball path, a ghost ball at first contact, the object ball's travel line, and a power bar.
- **Rules.** Standard 8-ball: the first legal pot assigns suits, pot your suit to keep the table, clear your suit then pot the 8 to win. Potting the 8 early, on a scratch, or on a foul loses.
- **Fouls.** Scratch, no ball hit, or hitting the wrong ball first (opponent's suit, or the 8 when you are not on it) gives the opponent ball in hand: tap or drag to place the cue ball anywhere that is free.
- **Break.** The 8-ball dropping on the break is respotted, not a loss.
- **R** restarts, **M** mutes (also the button bottom-right; the choice is remembered in this browser). Phones in portrait get a rotate prompt.

## Verify

```bash
npm run verify
```

Runs the TypeScript check and the Vite build. The pure modules have their own checks:

```bash
node scripts/test-rules.mjs
node scripts/test-ai.mjs
```

## Deploy

`.github/workflows/pages.yml` deploys `dist/` to GitHub Pages on manual trigger. It needs the repository to be public (or a paid plan) and Pages enabled with "GitHub Actions" as the source. Alternatively `npx wrangler pages deploy dist` after `wrangler login`. The game is also catalogued in the Rokumon Games hub (`content/games/rokumon-pool.json` there; refresh the bundle with `npm run sync:game -- rokumon-pool` in the hub).

## Layout

| Path | Purpose |
|---|---|
| `src/main.ts` | Phaser game config (Matter at 240 Hz substeps, sleeping on) |
| `src/game/constants.js` | Table geometry, ball size, physics tuning, colours, rack order |
| `src/game/rules.js` | Pure 8-ball shot resolution: fouls, suits, win and loss |
| `src/game/aim.js` | Pure ray projection for the aim guide |
| `src/game/ai.js` | Pure computer opponent: pot evaluation, safety, ball-in-hand placement |
| `src/scenes/GameScene.js` | Table, balls, input phases (aim, shooting, placing), shot lifecycle |
| `src/scenes/UIScene.js` | HUD: turn, message, remaining balls per player |
| `src/systems/audio.js` | Web Audio synth for cue strike, ball clicks, cushion thuds, pockets |
| `src/systems/debug.js` | `window.__GAME_DEBUG__` deterministic harness |

## Debug harness

In the browser console after a match starts:

```js
__GAME_DEBUG__.shootCue(angleDeg, power)      // fire the cue ball
__GAME_DEBUG__.stepFrames(n)                  // advance n simulated frames on virtual time
__GAME_DEBUG__.teleportToPocket("cue", 0)     // force a scratch
__GAME_DEBUG__.placeCue(x, y)                 // ball-in-hand placement
__GAME_DEBUG__.inspect()                      // phase, first contact, ball states
__GAME_DEBUG__.snapshotState()                // match state
await __GAME_DEBUG__.snapshot()               // JPEG data URL of the current frame
```

## Physics notes

Things about Matter that matter here:

1. `Body.setVelocity` does not wake a sleeping body. Every shot wakes the cue ball explicitly, otherwise a ball that fell asleep between turns ignores the shot and the turn silently passes. All balls are woken at shot start as a precaution.
2. There is no continuous collision detection. The engine runs at 240 Hz (four substeps per frame) so a full-power cue ball cannot bury itself in the rack before contact is detected.
3. Rolling resistance is a constant per-frame speed loss (`rollingDecel`) plus a little exponential drag (`frictionAir`). Pure exponential drag either kills breaks or leaves balls crawling for many seconds.
4. A physically pure break into a triangular rack sends the wing balls down the rack's straight edges to the corners and leaves the middle standing (a Newton's cradle). Rack gap, jitter and sleeping state make no measurable difference. The break therefore adds a random scatter kick to the pack on its first contact (`breakScatter`); set it to 0 for a pure simulation.

The shot-settle safety net counts simulated frames, not wall-clock time, so a throttled background tab cannot force-stop a shot early.

## Agent collaboration

See `AGENTS.md` for the vault contract, `docs/` for briefs and pipelines, and `Session Logs/` for dated work records.
