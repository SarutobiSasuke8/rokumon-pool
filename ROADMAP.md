# Roadmap

Use this file for game direction, milestones, and tradeoffs. Keep tactical tasks in `TODO.md`.

## Now

- Define the core loop and player fantasy.
- Choose engine and input model.
- Build the smallest playable vertical slice.
- Establish install, run, test, and build commands.

## Next

- Add juice, feedback, and HUD polish.
- Add first playtest checklist.
- Add asset pipeline notes.
- Add restart, pause, and failure handling.

## Later

- Add content, levels, progression, or additional mechanics.
- Add save/persistence only after the core loop is fun.
- Add deployment and sharing path.
- Promote only with an evidence-backed stage gate and a logged playtest report.

## Decisions

| Date | Decision | Reason | Revisit When |
|---|---|---|---|
| YYYY-MM-DD | Choose engine | Match core gameplay and team familiarity | When prototype constraints change |

## Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Menus arrive before gameplay | Project looks polished but is not playable | Build core loop first |
| Asset needs block progress | Prototype stalls | Use placeholder or procedural art |
| HUD blocks playfield | Game feels cramped or unfair | Protect play area in layout rules |
