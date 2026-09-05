# Playtest Checklist

Run this after gameplay, input, or core-loop changes, and before calling any milestone done. Copy the checklist into the session log or QA note and mark each item.

## Core Loop

- [ ] The game starts into something playable, not a menu or blank screen.
- [ ] The objective is understandable within the first few seconds without instructions.
- [ ] The core action works with every supported input method.
- [ ] Success state triggers correctly and is clearly communicated.
- [ ] Failure state triggers correctly and is clearly communicated.
- [ ] Restart returns to a clean, correct starting state (no leaked state from the previous run).

## Input and Feel

- [ ] Input responds without perceptible lag.
- [ ] Held keys, rapid presses, and simultaneous inputs behave sensibly.
- [ ] Controls match `Templates/INPUT_CONTROL_MAP.md`.
- [ ] Nothing important depends on an input the map does not document.

## Playfield and UI

- [ ] HUD, modals, and overlays never block the core interaction.
- [ ] The playfield stays legible at the smallest supported window size.
- [ ] Pause (if present) stops the game cleanly and resumes without glitches.
- [ ] No UI element traps focus or clicks in a way that breaks play.
- [ ] Branded HUD/menu contents stay inside their authored safe rectangles at
      ordinary and worst-case values (score, timer, labels, localization).
- [ ] The UI housing debug guide confirms tracked child bounds fit the declared
      safe area; screenshot review confirms the safe area itself excludes ornament.

## Stability

- [ ] No console errors during a full loop (start -> play -> win/lose -> restart).
- [ ] Frame rate stays playable during the busiest expected moment.
- [ ] Losing window focus and returning does not break the game state.
- [ ] Resizing the window mid-play does not break rendering or input.

## Evidence and Device Coverage

- [ ] The deterministic smoke path was run, or the reason it cannot exist is documented.
- [ ] Screenshots or a short capture show menu, active play, pause, success/failure, and restart states.
- [ ] Both clean and debug-guide HUD screenshots are captured when themed raster
      wrappers are used.
- [ ] Desktop keyboard/pointer behavior was checked at the target viewport.
- [ ] Touch controls, safe areas, and orientation were checked on a physical device when mobile is supported.
- [ ] Reduced-motion, muted audio, and focus-loss behavior were checked where relevant.
- [ ] Known verification limits are stated rather than inferred away.

## Result

- Date:
- Build/commit:
- Tester:
- Verdict: `pass | pass with issues | fail`
- Issues found (file follow-ups in `TODO.md`):
- Evidence location:
