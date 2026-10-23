---
title: Session Log - Ball readability
date: 2026-10-23
type: session-log
mutability: append-only
owner: Alexei Udall
project: Rokumon Pool
agent: claude-code
status: complete
---

# Ball readability

## Executive Summary

Issue #11 from Alexei's playtest (23 October): you could not tell which balls were which. Balls now have the standard numbered look (stripes white with a band, solids coloured all over, dark rim), a lighter 6/14 green, HUD player cards with group and remaining balls, a pocketed-ball tray and a clearer aim guide. Version 0.3.0.

## Cause

Stripes and solids were drawn the same way (a coloured disc with a white centre), so the only difference was the size of the white centre. The 6 and 14 were a dark green with a colour difference of about 8 (CIE76) from the cloth.

## Verification

`npm run verify` (build, 28 Vitest checks, 24 rules, 11 AI, 7 label and SDK checks) and `node scripts/hub-smoke.mjs` (now also the readability smoke on 1280x800 desktop and 667x375 phone) pass locally.

## Open Threads

- Real-phone playtest. The canvas still renders at 960x540 and is scaled up on high-DPI phones.
- Alexei reviews and merges the PR. No merge, release or deployment performed.
