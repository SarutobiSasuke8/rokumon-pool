# Template Notes - Vibe Coding Browser Game Template

## What this template is for

Use this template for browser games and playable prototypes where the first milestone must be an actual playable loop. It is a browser-specific evolution of the former game template, not a generic all-engine starter.

Best fits:

- Phaser 2D games
- Three.js or React Three Fiber game prototypes
- canvas games
- top-down, sidescroller, card, board, puzzle, or single-room experiments
- vibe-coded game jams and experiments

## When not to use it

- Do not use this for non-interactive websites.
- Do not use this for pure asset packs.
- Do not use this when the work is mainly a SaaS, dashboard, or content site.

## Default stack

- Phaser + TypeScript + Vite for 2D games.
- Three.js or React Three Fiber when the core experience is genuinely 3D.
- DOM overlay only for HUD, menus, settings, and non-playfield UI.

## Expected first milestone

A playable vertical slice with:

- player input
- visible objective
- win/loss or success/failure condition
- restart loop
- basic HUD

## Quality bar

The first screen must be playable, not a menu pretending a game exists.

Protect the playfield. Do not let HUD, modal, or decorative UI block the core interaction.

## What is retained from the generalist template

This template retains the high-value collaboration system from `vibe-coding-generalist-template`:

- `AGENTS.md` as the canonical contract, plus self-contained Claude, Codex, Gemini, Copilot, and Cursor adapters.
- The full persona council, including Product, Game Design, Design, CTO, QA, security, deployment, analytics, growth, research, delivery, and code review roles.
- Session logging: an append-only log template, index, naming convention, and decision/verification handoff discipline.
- `TODO.md`, `ROADMAP.md`, setup checklist, agent alignment rules, and the alignment validation script.
- The core commands for council, product, CTO, QA, research, security, code review, and playtesting.

The generalist remains upstream for shared agent-facing files. When those improve upstream, sync changes deliberately and re-run `./scripts/check-agent-docs.ps1`.

The agentic runtime layer is now available as the opt-in `agentic-operations` addon. It provides `Agent State/`, `Memory/`, and `QA/` operating surfaces without imposing them on game-jam or one-session prototypes.

Game-specific and owned here: runnable profiles, game quality bar, `personas/game-designer-vibe-coding.md`, `/playtest`, architecture and distribution contracts, stage gates, deterministic smoke-test hooks, asset manifest conventions, input controls, and playtest evidence.
