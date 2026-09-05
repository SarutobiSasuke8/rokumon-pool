# Vibe Coding Browser Game Template

Starter template for browser games and playable prototypes. It keeps the collaboration discipline of the generalist template while adding runnable browser-game profiles, deterministic smoke-test hooks, asset contracts, and evidence-based playtest gates.

Use this when the first meaningful milestone is a playable loop, not a landing page or menu.

## Includes

- Agent-ready project contract and adapters with a game-specific quality bar (playable-first, protected playfield, responsive input).
- Preserved agent collaboration layer: model adapters, persona council, specialist personas, session logs, and alignment checks.
- Game-focused project brief.
- Persona council and specialist prompts, including a Game Designer / Gameplay Lead persona and a `/playtest` slash command.
- Playtest checklist (`Templates/PLAYTEST_CHECKLIST.md`), input/control map (`Templates/INPUT_CONTROL_MAP.md`), and asset pipeline conventions (`docs/ASSET_PIPELINE.md`).
- `TODO.md` task capture, roadmap, setup checklist, and session logs.
- Drift checks for agent docs.
- Runnable Phaser + Vite profiles for plain JavaScript and TypeScript.
- Optional Games Hub, mobile-first, and agentic-operations addons.
- Architecture, distribution, tuning, save-state, asset-manifest, stage-gate, and playtest-report templates.
- A reusable Phaser branded-HUD housing helper with authored safe areas,
  containment auditing, and visual debug guides (`docs/UI_HOUSING.md`).
- Template CI plus a profile-provided build workflow for initialized Phaser games.
- Template notes explaining when to use this variant.

## First Milestone

A playable vertical slice with:

- player input
- visible objective
- success/failure/restart state
- basic HUD
- short playtest checklist

## Quality Bar

The first screen must be playable, not a menu pretending a game exists.

## First Setup

1. Fill in `docs/PROJECT_BRIEF.md` and choose a browser-game profile.
2. After creating a repository from this template, run `./scripts/init-browser-game.ps1 -Destination . -Profile phaser-js` from its root.
3. Add `-GamesHub`, `-MobileFirst`, or `-AgenticOperations` only when the project needs them.
4. Fill in `Templates/INPUT_CONTROL_MAP.md`, `Templates/GAMEPLAY_CONSTANTS.md`, and `Templates/ASSET_MANIFEST.json`.
5. Replace starter tasks in `TODO.md`, then run `./scripts/check-agent-docs.ps1`.
6. Verify the vertical slice with the smoke harness and `Templates/PLAYTEST_REPORT.md`.
7. Run `./scripts/check-agent-docs.ps1 -Strict` once placeholders are replaced.

## Scope

This is deliberately a browser-game template. It is optimized for Phaser, Three.js, and React Three Fiber projects; Unity, Godot, Roblox, and Unreal should get sibling templates that share the collaboration materials but respect their different editors and build pipelines.
