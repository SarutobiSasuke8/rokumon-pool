# Real-input smoke test

`npm run smoke:input` starts the dev server, opens headless Chrome or Edge, and plays the game with **real** key, mouse and touch events. It exists because agent harnesses that call game code directly have passed games whose real input path was broken: physics bodies that went to sleep and never woke on a shot, controls that only worked through a debug hook, a first frame that crashed when art was missing.

## What every game gets for free

| Check | Catches |
|---|---|
| Boots to a visible canvas | Parse errors, missing entry, blank page |
| Frame loop advances | A stalled or crashed game loop |
| Layout fits at desktop size and 390x844 | Page overflow, canvas clipped off screen |
| Survives a reload | State that only works on a first load |
| No console errors or failed requests | Exceptions, 404s, and missing assets (Vite answers a missing file with HTML, so the test flags that too) |

## What you write: `tests/smoke.plan.mjs`

Play one full loop with real input and assert on state: start, the core action, a win or lose, restart. Helpers on `ctx`:

- `key(name, { hold })`, `click(x, y)`, `tap(x, y)`, `drag(from, to)`, `swipe(from, to)`: real key, mouse and touch events at client coordinates (`swipe` is touch; use it after `viewport("phone")`).
- `point(x, y)`: game-space coordinates to client pixels. It reads the Phaser game directly (`window.__PHASER_GAME__`, or `window.__game` in older games), so a game needs no hook for it. `targets()`: named game-space positions registered through `installDebug` (the third argument), so tests aim at the objective instead of hard-coding coordinates.
- `goto("?seed=7")`: reload with a query string, for games whose tuning comes from the URL. `game`: the game-handle expression, for `ctx.eval` strings.
- `state()`, `waitFor(fn, label)`, `viewport("phone" | "desktop")`, `shot(name)`, `check(name, fn)`, `expect(cond, message)`.

Optional named exports from the plan: `phone = { width, height }` (default 390x844 portrait; a landscape-only game sets 844x390) and `ignore = [/regex/]` for known dev-only noise, each with a comment saying why. A game with no plan fails the smoke test on purpose. Do not replace real input with `window.__GAME_DEBUG__` calls that skip the input path; use the hook only to read state.

## Rules

- A README may say "playable" only while `docs/SMOKE_STATUS.md` says PASS. Refresh it with `npm run smoke:input:record`.
- The smoke test is agent-run input. It does not replace a human playtest of feel and fairness. Say so when you report a result.
- Keep screenshots out of git: `npm run smoke:input:evidence` writes to `tests/evidence/`, which is ignored.
- Override the browser with the `CHROME_PATH` environment variable if auto-detection fails.
- Phaser reads `keyCode`, so new keys need an entry in `NAMED_KEYS` in `scripts/browser-smoke.mjs` (letters and digits already work).

In this game the script is `smoke:input`, because `npm run smoke` is the older hub-boot check. `tests/evidence/` is committed here by convention, so delete screenshots you do not want to keep.
