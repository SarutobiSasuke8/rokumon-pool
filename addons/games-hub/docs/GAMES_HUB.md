# Games Hub Addon

This addon replaces the no-op hub integration with the versioned Rokumon Games Event API v1. It does not affect standalone play.

## Contract

- `hub.ready()` reports that the playable runtime is available.
- `hub.score(value)` reports meaningful score changes and suppresses duplicates.
- `hub.gameOver(score, durationMs)` reports terminal state.
- `hub.event(name, data)` reports a durable, game-owned accomplishment. Event names are kebab-case and values are flat strings, finite numbers or booleans.

The host owns catalogue, quests, trophies, and future platform features. The game remains the owner of its own simulation, persistence, and restart loop. Declare every event and its exact data shape in the hub manifest. See Rokumon Games `docs/GAME_EVENT_API.md`.

Before intake, build with relative paths, serve the final output from its intended subpath, and record the entry path, orientation, and mobile support in the hub manifest.
