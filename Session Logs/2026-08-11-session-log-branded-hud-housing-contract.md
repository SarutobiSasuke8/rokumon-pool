---
title: Session Log - Branded HUD Housing Contract
date: 2026-08-11
created: 2026-08-11
status: active
type: session-log
mutability: append-only
owner: browser-game-template
project: vibe-coding-browser-game-template
agent: Codex
related:
  - docs/UI_HOUSING.md
  - profiles/phaser-js/src/ui/UIHousing.js
tags:
  - session-log
  - hud
  - phaser
---

# Session Log - Branded HUD Housing Contract

## Executive Summary

Promoted a project-proven HUD alignment pattern into the browser-game template:
decorative raster wrappers now have a documented safe-area contract, a reusable
Phaser containment/debug helper, and explicit screenshot-based playtest gates.

## Trigger

Generated HUD wrappers repeatedly required subjective pixel nudging because the
full PNG bounds included ornament and transparent padding. A reusable template
guard was requested after the pattern was validated in Shadowstep.

## Work Completed

- Added a generic `UIHousing` Phaser helper with normalized safe insets,
  aspect-preserved frame sizing, child tracking, overflow auditing, and guides.
- Added `docs/UI_HOUSING.md` with implementation and acceptance guidance.
- Extended asset and playtest contracts to require safe-area metadata,
  worst-case values, desktop/mobile captures, and screenshot review.
- Added the helper and guide to structural template verification and README.

## Decisions

| Decision | Reason | Revisit When |
|---|---|---|
| Port the mechanism, not Shadowstep inset values | Safe areas are authored per asset and cannot be universal | A common starter UI asset is introduced |
| Keep DOM-first guidance | The helper is for deliberately in-canvas themed HUDs, not dense accessible UI | The default frontend architecture changes |
| Require geometry plus screenshot review | Containment cannot detect an incorrectly measured safe rectangle | Reliable visual-diff baselines are added |

## Verification

- `scripts/verify-template.ps1`: agent docs aligned; template structure valid.
- `node --check profiles/phaser-js/src/ui/UIHousing.js`: passed.

## Open Threads

| Thread | Owner | Blocking / Next Step |
|---|---|---|
| Browser automation starter | Template maintainer | Add only when a dependency and browser-install policy is agreed |

## What Worked

- The generic helper fits the JS profile and is inherited by the TypeScript
  initializer, which layers TS-specific files over the JS profile.

## What To Do Differently

- Encode wrapper content bounds before tuning labels or icons in future games.

## Connected

- `Templates/PLAYTEST_CHECKLIST.md`
- `docs/ASSET_PIPELINE.md`
