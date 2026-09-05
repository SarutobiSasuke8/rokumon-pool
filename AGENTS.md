# AGENTS.md - Canonical Agent Contract

This is the source of truth for all AI coding agents working in this repository.

Every model-specific instruction file must stay aligned with this contract:

- `CLAUDE.md`
- `CODEX.md`
- `GEMINI.md`
- `.github/copilot-instructions.md`
- `.cursor/rules/vibe-coding-core.mdc`

When this file changes, update the adapters and run:

```powershell
./scripts/check-agent-docs.ps1
```

## Project Identity

- Project name: `TODO`
- Project type: `TODO`
- Primary user: `TODO`
- Current stage: `prototype | active build | maintenance | archived`
- Product owner persona: `personas/head-of-product-vibe-coding.md`
- Technical owner persona: `personas/cto-vibe-coding.md`
- Persona council protocol: `personas/agent-council-protocol.md`

## Product Goal

Describe the real user-facing outcome this repo exists to create.

```text
TODO: one or two paragraphs explaining what good looks like, who it helps, and what feeling it should create.
```

## Non-Negotiable Standard

The project must be useful, reliable, and vibe-true.

Speed matters, but only as speed to quality. Do not ship impressive-looking work that fails under ordinary use. Do not bury uncertainty. Do not inflate scope. Protect the product feeling and the codebase at the same time.

## Operating Loop

For non-trivial work, follow this loop:

1. Understand the request and inspect relevant files.
2. State assumptions, ambiguities, and tradeoffs when they matter.
3. Define success criteria before implementing.
4. Make the smallest coherent change.
5. Verify with the narrowest meaningful check.
6. Report what changed, what was verified, and what risk remains.

For trivial one-line fixes, use judgment and keep the handoff concise.

## Core Principles

These principles are adapted from the Karpathy-style agent guidance in `docs/AGENT_OPERATING_PRINCIPLES.md`.

### 1. Think Before Coding

Do not silently choose an interpretation when multiple plausible meanings exist.

- State assumptions explicitly.
- Ask when the ambiguity changes implementation or risk.
- Present tradeoffs when there are multiple reasonable paths.
- Push back when a simpler or safer path better serves the goal.
- Stop and name confusion before building on it.

### 2. Simplicity First

Build the minimum thing that solves the actual problem well.

- No speculative features.
- No abstractions for single-use code.
- No configurability that was not requested.
- No framework churn unless the current stack blocks the goal.
- If a simpler implementation would be easier to verify and maintain, choose it.

### 3. Surgical Changes

Touch only what the task requires.

- Do not reformat, rename, or refactor adjacent code for taste.
- Match existing style even if you would design it differently from scratch.
- Preserve user-authored comments and docs unless the task asks to edit them.
- Clean up imports, variables, and files made obsolete by your own change.
- Mention unrelated issues instead of fixing them silently.

### 4. Goal-Driven Execution

Turn vague tasks into verifiable outcomes.

- Bug fix: reproduce or identify the failing behavior, then fix it.
- Feature: define the user-visible behavior and acceptance checks.
- Refactor: preserve behavior before and after.
- UI change: verify the actual screen when practical.
- Docs change: verify links, filenames, and instructions are coherent.

### 5. Vibe Coding Quality Bar

Every product decision should support the intended feeling of the game.

- The first screen must be playable, not a menu pretending a game exists.
- Protect the playfield: HUD, modals, and decorative UI must never block the core interaction.
- Input must feel responsive; investigate any perceptible lag before adding features.
- The core loop (input -> objective -> success/failure -> restart) comes before breadth of content.
- Loading, pause, and failure states need the same intentional design as the happy path.
- Copy should be clear, specific, and free of generic filler.
- Polish is not decoration; it is part of whether the game works.

## Commands

Update these as soon as the stack is known.

```bash
# Install dependencies
TODO

# Run development server
TODO

# Run tests
TODO

# Run lint/type checks
TODO

# Build
TODO
```

## Game Defaults

Until the brief says otherwise, assume:

- Phaser + TypeScript + Vite for 2D games.
- Three.js or React Three Fiber only when the core experience is genuinely 3D.
- DOM overlay only for HUD, menus, settings, and non-playfield UI; the playfield renders in canvas/WebGL.
- Keyboard-first controls with the mapping documented in `Templates/INPUT_CONTROL_MAP.md`.
- Assets follow `docs/ASSET_PIPELINE.md`; placeholder art is fine, broken references are not.
- First milestone is a playable vertical slice: player input, visible objective, success/failure state, restart loop, basic HUD.
- Use one of `profiles/` for a runnable starter rather than recreating the same boot, state, input, and verification plumbing.
- Keep simulation and serializable state independent from rendering objects. Input maps to named actions in one place.
- Use `Templates/ASSET_MANIFEST.json` as the stable runtime key and source-of-truth for replaceable assets.
- Use `docs/DISTRIBUTION.md` and the `games-hub` addon when the game will be embedded or copied into a hub.

## Code Style

- Language/framework: `TODO`
- Package manager: `TODO`
- Formatting: `TODO`
- Test framework: `TODO`
- Naming conventions: follow surrounding code unless documented here.
- Dependency policy: prefer existing dependencies; add new ones only when they clearly reduce risk or complexity.

## Verification Policy

Before finishing a code change, run the narrowest useful verification:

- Unit or integration tests for changed logic.
- Type check or lint for typed/frontend projects.
- Build for packaging or deployment-sensitive changes.
- Browser/manual smoke test for UI changes.
- Script output check for automation changes.
- A playtest pass using `Templates/PLAYTEST_CHECKLIST.md` for gameplay, input, or core-loop changes.
- A `Templates/PLAYTEST_REPORT.md` with evidence before promoting a game stage or calling a milestone complete.

If verification cannot be run, say exactly why and describe the residual risk.

## Documentation Rules

- Durable project context lives in `docs/PROJECT_BRIEF.md`.
- The playtest gate lives in `Templates/PLAYTEST_CHECKLIST.md`.
- The control mapping lives in `Templates/INPUT_CONTROL_MAP.md`.
- Asset conventions live in `docs/ASSET_PIPELINE.md`.
- Architecture boundaries live in `docs/ARCHITECTURE.md`.
- Distribution and hub integration conventions live in `docs/DISTRIBUTION.md`.
- Save-state and lifecycle conventions live in `docs/SAVE_AND_STATE.md`.
- Gameplay tuning conventions live in `docs/GAMEPLAY_TUNING.md`.
- Agent principles live in `docs/AGENT_OPERATING_PRINCIPLES.md`.
- Agent sync rules live in `docs/AGENT_ALIGNMENT.md`.
- Session logging rules live in `docs/SESSION_LOGGING.md`.
- Upcoming work lives in `TODO.md`.
- Medium-term direction lives in `ROADMAP.md`.
- Reusable role prompts live in `personas/`.
- Session logs live in `Session Logs/` and use `Templates/SESSION_LOG_TEMPLATE.md`.

## Agent Coordination

When multiple agents are involved:

- Avoid editing the same files at the same time.
- State which files or areas you changed.
- Do not overwrite another agent's reasoning without cause.
- Use `TODO.md` for unresolved follow-ups instead of burying them in chat.
- Create or append a session log for meaningful multi-file, architectural, debugging, or handoff-heavy sessions.
- Run `./scripts/check-agent-docs.ps1` after changing agent instruction files.

When multiple personas are involved, use `personas/agent-council-protocol.md` to route the work, resolve conflicts, and produce one synthesized report instead of separate persona reports.

## Git Hygiene

- Do not revert work you did not make.
- Do not use destructive git commands unless explicitly requested.
- Keep commits focused when asked to commit.
- Mention changed files and verification in handoff notes.

## Handoff Standard

When finishing, report:

- What changed.
- What was verified.
- Any remaining risk or useful next action.
