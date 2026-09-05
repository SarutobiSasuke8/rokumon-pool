# Browser-Game Architecture

## Required Boundaries

- Simulation owns gameplay rules, progression, timers, collisions, serializable state, and deterministic random seeds.
- Rendering owns scenes, animation, camera, particles, and presentation.
- Input maps physical controls to named actions in one module; gameplay reads actions rather than browser events.
- UI is a separate layer. Use DOM overlays for text-heavy HUD, settings, and accessibility-sensitive surfaces unless the game has a clear canvas-only reason.
- Asset keys come from the manifest. Code must not make asset filenames its public API.

## Recommended Phaser Layout

```text
src/
  game/        # state, constants, deterministic rules
  scenes/      # boot, menu, game, UI, pause, game-over
  systems/     # input, audio, persistence, debug
  integrations/# optional hub or platform adapters
```

## Lifecycle Rules

- One system owns pause and mute transitions.
- Clear timers, listeners, tweens, and scene-local state on shutdown or restart.
- Keep persistent events above restartable scenes when they must survive them.
- Restore temporary physics changes explicitly after dash, stun, and similar effects.
- Save data, debug snapshots, and hub payloads must contain serializable state, never scene objects.
