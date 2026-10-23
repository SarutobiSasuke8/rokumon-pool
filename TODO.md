# TODO

Use this file for actionable game project work. Keep items concrete.

## Inbox

- [x] #task Define the game goal in `docs/PROJECT_BRIEF.md`.
- [x] #task Choose engine and stack (Phaser 4 + TypeScript + Vite, phaser-ts profile, games-hub addon).
- [ ] #task Replace placeholder commands in `AGENTS.md`.
- [ ] #task Complete `docs/SETUP_CHECKLIST.md`.
- [x] #task Choose and initialize a runnable profile from `profiles/`.
- [ ] #task Define the action map, tuning constants, and asset manifest.
- [ ] #task Create the first setup session log.
- [ ] #task Run `./scripts/check-agent-docs.ps1`.
- [ ] #task Resolve open rule/physics-engine/name questions in `docs/PROJECT_BRIEF.md`.

## Next

- [x] #task #next Build the first playable vertical slice (rack, drag-to-aim-and-shoot, pocketing, turn/suit/scratch/8-ball rules, win/loss, restart).
- [x] #task #next Run the deterministic smoke path (`window.__GAME_DEBUG__`) and verify pot/scratch/illegal-8-ball outcomes.
- [x] #task #next Confirm the real drag-to-shoot control with browser mouse input (2026-09-30: real drag works; it exposed the sleeping-cue-ball bug, now fixed).
- [ ] #task #next Human playtest on a touch device: drag-vector aim, ball-in-hand placement by touch, sound on iOS after first tap.
- [ ] #task #next Tune feel after the physics changes: `frictionAir`, `restitutionBall`, `maxShotSpeed` in `src/game/constants.js`. Break spread and long-roll settle time are the two things to judge.

## Backlog

- [ ] #task Fill in `Templates/INPUT_CONTROL_MAP.md` (drag-vector aim and shoot, ball-in-hand placement, mouse + touch).
- [ ] #task Set tile size, sprite resolution, and virtual resolution in `docs/ASSET_PIPELINE.md`.
- [ ] #task Run the first playtest with `Templates/PLAYTEST_CHECKLIST.md`.
- [ ] #task Add deployment or sharing notes.
- [ ] #task Decide the current stage using `Templates/GAME_STAGE_GATE.md`.
- [ ] #task Replace procedural table art with a real art pass once the feel is confirmed (ball art got the standard numbered look on 2026-10-23, #11).
- [ ] #task Phone playtest of ball readability on a real device (#11); the canvas renders at 960x540, so a high-DPI render pass is the next step if the numbers look soft.
- [ ] #task Consider call-pocket rules for the 8-ball shot (currently any legal pot after clearing suit wins).
- [ ] #task Kitchen-only placement after a break scratch (the 8 on the break is now respotted).
- [ ] #task Cue-ball spin (english) and a draw/follow control, only if playtests ask for it.
- [x] #task Single-player mode against a computer opponent (`src/game/ai.js`, 2026-09-30).
- [x] #task Mute toggle (M key + HUD button, 2026-09-30).
- [x] #task AI difficulty levels (Easy/Normal/Hard) exposed on the menu (2026-10-08, #4; tuning in `AI_DIFFICULTY`).
- [ ] #task Human playtest of the three difficulty levels on desktop and touch; retune `AI_DIFFICULTY` if Easy still wins too often or Hard feels unbeatable.
- [ ] #task Deploy: make the repo public and run the Pages workflow, or `wrangler login` and deploy `dist/` to Cloudflare Pages. Then a phone playtest.
- [ ] #task Hub media for the Rokumon Games catalogue entry: cover, hero, logo, screenshots (manifest has them as null).

## Done

- 2026-09-06: playable core (table, rack, rules, debug harness).
- 2026-09-30: build review fixes and gameplay upgrade (see `CHANGELOG.md`).
