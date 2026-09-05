# Game Brief

This is the project context agents should read before game design, architecture, UI, roadmap, or implementation work.

## Summary

Rokumon Pool (working title) is a top-down 8-ball style pool/billiards game for browser and mobile. Single camera, physics-driven ball simulation, drag-to-aim-and-shoot controls. Core loop: aim shot, set power, strike cue ball, pot balls in turn order, win by clearing your suit then the 8-ball.

## Vibe

- Desired feeling: satisfying physical weight, tactile aiming, quick to pick up
- Reference games / experiences: 8 Ball Pool (Miniclip), Pool Break
- Anti-vibe: floaty physics, aiming that fights the player, cluttered HUD
- First impression target: player can aim and pot a ball within seconds of load

## User

- Primary player: casual mobile/browser player, quick sessions
- Secondary players: local pass-and-play two-player
- Player skill level: no pool knowledge assumed; rules taught by play
- Context of play: short sessions, portrait or landscape mobile, also desktop browser

## Problem

Explores a physics-accurate but forgiving pool table on canvas/WebGL that works with touch drag-aim on mobile and mouse drag-aim on desktop, without a native app.

## Product Promise

Within the first minute a player can rack, aim with a visible guide line, set shot power, and take a shot that behaves like real pool physics (collision, friction, pocketing).

## Core Workflows

1. Player starts a run or level and understands the objective.
2. Player performs the core action loop.
3. Player reaches a success, failure, or restart state.

## Success Criteria

- The first screen is playable.
- The core loop is understandable without heavy instruction.
- Input feels responsive.
- HUD does not block the playfield.
- Win/loss/restart flow exists.

## Non-Goals

- No elaborate menus before the core loop works.
- No large content pipeline before one room/level works.
- No multiplayer unless it is the core concept.
- No account system in the prototype.

## Constraints

- Time: solo vibe-coded build, no fixed deadline
- Budget: none (procedural/placeholder art and audio, no paid assets)
- Stack: Phaser 4 + TypeScript + Vite (phaser-ts profile)
- Deployment target: browser first, mobile via responsive canvas + touch input; native wrap deferred
- Data sensitivity: none (no accounts, no real-money mode)
- Performance expectations: stable 60fps ball physics on mid-range mobile
- Accessibility expectations: colourblind-safe suit markers (stripes/solids pattern, not colour-only), scalable UI text

## Platform and Distribution

- Engine / profile: Phaser 4, phaser-ts profile, games-hub addon applied
- Orientation and virtual resolution: landscape primary, responsive scale to fit portrait mobile
- Supported inputs: mouse drag-aim (desktop), touch drag-aim (mobile)
- Target browsers / devices: modern evergreen browsers, iOS/Android mobile browsers
- Distribution: standalone now, candidate for [[Rokumon Games]] hub later
- Offline requirement: no
- Performance budget (load time, frame rate, bundle size): <3s load on 4G, 60fps target, <5MB initial bundle

## Quality Gates

- Core workflow works end-to-end.
- Loading, empty, and error states exist where relevant.
- UI is responsive across target screen sizes.
- Project commands in `AGENTS.md` are accurate.
- Tests/checks cover the most important changed behavior.
- A playtest checklist has been run before calling the prototype done.

## Technical Notes

- Architecture: Phaser scene per screen (Boot, Menu, Table); table physics driven by Phaser Arcade or Matter (Matter preferred for circle-circle restitution and friction)
- Game engine: Phaser 4 + TypeScript + Vite
- Input model: pointerdown/drag on cue ball to set aim angle and power, release to shoot
- Asset model: procedural placeholder art (canvas-drawn table/balls) first, real art pass later
- Save/persistence: local high scores / win streak in localStorage only
- Observability/logging: console-level dev logging only
- Simulation / renderer boundary: physics settle before pocketing/turn resolution reads state
- Deterministic debug or smoke-test path: TBD, follow sibling games' headless smoke pattern
- Asset manifest and fallback policy: TBD once first playable exists
- Save schema version: v1

## Open Questions

- [ ] #task Confirm rule variant: 8-ball vs 9-ball vs simplified arcade pool. [project:: Rokumon Pool]
- [ ] #task Pick physics engine: Phaser Arcade vs Matter for ball-on-ball collision quality. [project:: Rokumon Pool]
- [ ] #task Decide first playable milestone: single-player vs local two-player pass-and-play first. [project:: Rokumon Pool]
- [ ] #task Confirm final name (Rokumon Pool is a working title). [project:: Rokumon Pool]

## References

- Add inspiration, sketches, asset references, or prototype links.
