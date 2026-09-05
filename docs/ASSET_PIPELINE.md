# Asset Pipeline

Conventions for game assets. Placeholder art is fine; broken references, inconsistent naming, and untracked licensing are not.

## Folder Layout

```text
assets/
+-- sprites/        # characters, objects, effects
+-- tiles/          # tilesets and tilemaps
+-- audio/
|   +-- music/
|   `-- sfx/
+-- fonts/
`-- ui/             # HUD, icons, menu art
```

Keep `Templates/ASSET_MANIFEST.json` copied to `assets/asset-manifest.json` or another documented runtime location. The manifest owns stable keys, source, licence, dimensions, fallback behavior, and validation status; filenames are implementation details.

Adapt to the engine's expectations (for example Phaser's `public/assets/`), but keep the categories.

## Naming

- Lowercase kebab-case: `player-idle.png`, `hit-flash.wav`.
- Suffix animation sheets with frame info when relevant: `player-run-8f.png`.
- Suffix resolution variants only when they exist: `logo@2x.png`.

## Rules

- Every asset referenced in code must exist in the repo or load from a documented source; no dead paths.
- Record the source and license of every third-party asset in `assets/CREDITS.md` at the moment it is added, not later.
- Prefer a small number of consistent placeholder assets over mixed-style borrowed art; visual coherence is part of the vibe even at placeholder stage.
- Compress before committing when file size is meaningful (audio especially); keep originals out of the repo unless needed.
- Sprite dimensions and tile size are project constants; document them here once chosen:
  - Tile size: `TODO`
  - Base sprite resolution: `TODO`
  - Target aspect ratio / virtual resolution: `TODO`

## Loading

- Centralize asset keys/paths in one manifest or loader module; no string literals scattered through gameplay code.
- Show a loading state for anything that takes perceptible time.
- Fail loudly in development when an asset is missing; never silently render nothing.
- Procedural placeholders may be used during a vertical slice, but every placeholder must have a stable manifest key so art can be swapped without changing gameplay code.

## Shipping Rules

- Record generated-art prompts or source references alongside the manifest entry when they are useful for regeneration.
- Validate image dimensions, alpha behavior, and file size before replacing gameplay-facing assets.
- Record audio duration, codec, bitrate, loop point, and mix owner where relevant.
- For 3D projects, ship GLB or glTF 2.0, normalize units/pivots, document collision proxies and LOD policy, and use deliberate texture compression.

## Branded UI Frames

- A decorative wrapper's PNG bounds are not its content bounds. Record
  normalized safe insets that exclude ornament and transparent padding.
- Position labels and icons inside the safe rectangle, not with independent
  pixel nudges against the full image.
- Re-measure safe insets whenever a UI frame is replaced or recropped.
- In Phaser canvas HUDs, use `profiles/phaser-js/src/ui/UIHousing.js` and follow
  `docs/UI_HOUSING.md`. DOM HUDs should express the same contract in CSS.
- Browser QA must combine containment checks with desktop/mobile screenshots;
  geometry alone cannot identify incorrectly declared safe areas.
