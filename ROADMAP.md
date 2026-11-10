# Roadmap

Game direction, milestones and tradeoffs. Tactical tasks live in `TODO.md`.

## Completion plan (2026-11-10)

Goal: take Rokumon Pool from a playable core (0.3.0) to a finished 1.0 game: a top-down 8-ball game for phones and desktop browsers that looks tangible, controls well with a thumb, and has the screens and depth a complete game needs.

Direction decided 2026-11-10: stay top-down in Phaser, with art rendered in Blender. A full 3D version is a separate later project that would reuse the same Blender assets and the pure rules, AI and aim modules.

### Milestone 1: Controls (0.4.0)

- [x] Aim and power are separate: drag on the table to turn the cue, pull the power bar to shoot.
- [x] The aim guide is always visible on the player's turn.
- [x] Fine aim: arrow keys and mouse wheel on desktop.
- [x] Full power is reachable wherever the cue ball sits, including against a cushion.
- [x] Bring in the two mobile fixes from `codex/pool-mobile-playtest-20261104`.

### Milestone 2: Sharp rendering (0.4.0)

- [x] Render at twice the logical 960x540 size so text, balls and lines are sharp on phone screens.
- [x] Ball textures painted at the higher resolution.

### Milestone 3: Art (0.5.0)

- [x] Blender scene built by script from the game's own table constants, so the render lines up with the physics.
- [x] Table: wood rails, cloth with nap, rubber cushions, pocket liners with depth, diamond sights, baked overhead lighting.
- [x] Cue: tapered shaft, ferrule, tip, wrap and butt, with a shadow.
- [x] Balls: glossier shading, sharper numbers, a rolling look.
- [x] Background: a dim room, not a flat colour.

### Milestone 4: Menus, fonts and HUD (0.6.0)

- [x] Bundled display and body typefaces (no system sans-serif).
- [x] Title screen with key art, mode buttons and difficulty.
- [x] HUD restyled to match the table: player cards, turn line, potted tray, power bar.
- [x] Pause menu with resume, restart, sound and quit.
- [x] How-to-play screen.
- [x] Results screen with match stats, and a win/loss record kept on the device.

### Milestone 5: Depth (0.7.0)

- [x] Cue-ball spin: follow, draw and side.
- [x] Cue ball behind the head string after a break scratch.
- [ ] Call the pocket on the 8-ball (open decision: the arcade rule stands until Alexei decides).
- [ ] Break physics, spin strength and feel constants tuned (needs the phone playtest).
- [x] Juice: balls drop into pockets, the cue strikes and follows through.

### Milestone 6: Imagery (0.8.0)

- [x] Banner key art rendered from the Blender scene (wide hero, social, square).
- [x] Rokumon Games hub media made: hero, cover and screenshots in `art/banners/`.
- [x] Favicon and share image.

### Milestone 6b: Games, campaign and sound (0.9.0)

- [x] Two shots after a foul (pub rules) with a foul banner and a shots counter.
- [x] 9-ball.
- [x] Blackball (reds and yellows).
- [x] Campaign: ten opponents, trophies, gold for a clean win.
- [x] Recorded sound effects from ElevenLabs, with the synthesiser as fallback.
- [x] Music support and toggle.
- [ ] Music track from Suno (needs Alexei: one download left; drop it at `src/audio/music-main.mp3`).
- [ ] Listen to the sound effects in play and regenerate any that are wrong (needs Alexei's ears).

### Milestone 7: Release (1.0.0)

- [ ] Phone playtest on a real device (needs Alexei).
- [ ] Feel tuning after the playtest (needs Alexei's judgement).
- [ ] Final name confirmed (needs Alexei).
- [x] Deployed to a shareable URL: rokumongames.com/play/pool (unlisted while in preview).
- [x] Bundle, media and manifest prepared for the Rokumon Games hub: local branch `ship/pool-0.9.0` in `C:/Dev/Projects/_wt/hub-ship-pool`, hub slug `pool`.
- [x] Hub branch merged and deployed 2026-11-10 (SarutobiSasuke8/rokumon-games#68). Live as an unlisted preview at rokumongames.com/game/pool.
- [ ] Promote from preview to public in the hub manifest (needs Alexei: his playtest is the sign-off; it is a one-line change to `publication.status`).

### After 1.0

- Speed pool (solo, against the clock) and trick-shot puzzles.
- Character portraits and venues for the campaign.
- Snooker, as a separate game on the same engine.
- Online or pass-the-link multiplayer.
- Cue and table skins.
- A 3D version from the same Blender assets.

## Decisions

| Date | Decision | Reason | Revisit When |
|---|---|---|---|
| 2026-09-06 | Phaser 4 + Matter, top-down | Fast to a playable core; pool physics is planar | A 3D version is started |
| 2026-10-01 | Repo stays private | Rokumon game repos are private by pattern | Never without Alexei |
| 2026-11-10 | Stay 2D, art rendered in Blender | Top-down suits a phone; the complaints were art and controls, not the lack of 3D; assets carry over to 3D later | After 1.0 |
| 2026-11-10 | Two shots after a foul in 8-ball and blackball | Alexei chose pub rules over ball in hand | Phone playtest |
| 2026-11-10 | Snooker to be its own game | Bigger table, 22 balls, different scoring; cramped inside this layout | When it is started |
| 2026-11-10 | Aim and power separated | A pull-back drag runs out of room when the cue ball is near a cushion | Phone playtest |

## Risks

| Risk | Impact | Mitigation |
|---|---|---|
| No phone playtest yet | Controls and feel may be wrong on a real device | Milestone 7 gate; controls built to genre convention |
| Rendered table drifts from physics | Balls bounce off invisible edges | Scene built from `src/game/constants.js` values; overlay check |
| Art weight on mobile | Slow first load | One compressed table image; everything else painted in code |
| Spin tuning by guesswork | Unnatural cue-ball behaviour | Conservative defaults; tune in the playtest |
