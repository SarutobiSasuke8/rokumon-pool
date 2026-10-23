import { describe, expect, it } from "vitest";
import { createMatchState } from "../src/game/state.js";
import { resolveShot } from "../src/game/rules.js";
import { GROUP_BALLS, groupLabel, playerPanels, trayBalls } from "../src/game/hud.js";

const AI_NAMES = { 1: "You", 2: "Computer" };
// The same shape GameScene.updateHud emits.
const hud = (match, extra = {}) => ({
  turn: match.turn,
  assigned: { ...match.assigned },
  remaining: { solid: [...match.remaining.solid], stripe: [...match.remaining.stripe] },
  names: AI_NAMES,
  difficultyLabel: "Hard",
  gameOver: match.gameOver,
  ...extra,
});

describe("group assignment on the HUD cards", () => {
  it("shows an open table for both players before any legal pot", () => {
    const [p1, p2] = playerPanels(hud(createMatchState()));
    expect(p1).toMatchObject({ name: "You", group: null, label: "OPEN TABLE", balls: [], active: true, onEight: false });
    expect(p2).toMatchObject({ name: "Computer (Hard)", group: null, label: "OPEN TABLE", active: false });
  });

  it("gives the shooter solids and the opponent stripes after a legal solid pot", () => {
    const { match } = resolveShot(createMatchState(), { pocketed: [3], firstContact: 3 });
    const [p1, p2] = playerPanels(hud(match));
    expect(p1).toMatchObject({ group: "solid", label: "SOLIDS", remaining: [1, 2, 4, 5, 6, 7], active: true });
    expect(p2).toMatchObject({ group: "stripe", label: "STRIPES", remaining: [9, 10, 11, 12, 13, 14, 15], active: false });
    expect(p1.balls.map((b) => b.id)).toEqual([...GROUP_BALLS.solid]);
    expect(p1.balls.find((b) => b.id === 3).onTable).toBe(false);
    expect(p1.balls.filter((b) => b.onTable)).toHaveLength(6);
  });

  it("gives the shooter stripes after a legal stripe pot", () => {
    const { match } = resolveShot(createMatchState(), { pocketed: [12], firstContact: 12 });
    const [p1, p2] = playerPanels(hud(match));
    expect(p1.group).toBe("stripe");
    expect(p2.group).toBe("solid");
    expect(p1.balls.find((b) => b.id === 12).onTable).toBe(false);
  });

  it("keeps the table open after a foul pot and lights the other player's card", () => {
    const { match } = resolveShot(createMatchState(), { pocketed: [5, "cue"], firstContact: 5 });
    const [p1, p2] = playerPanels(hud(match));
    expect(p1.group).toBeNull();
    expect(p2.group).toBeNull();
    expect(p1.active).toBe(false);
    expect(p2.active).toBe(true);
  });

  it("drops a pocketed ball from the owner's remaining row even on the opponent's shot", () => {
    let { match } = resolveShot(createMatchState(), { pocketed: [3], firstContact: 3 });
    match.turn = 2;
    ({ match } = resolveShot(match, { pocketed: [4], firstContact: 9 }));
    const [p1] = playerPanels(hud(match));
    expect(p1.remaining).toEqual([1, 2, 5, 6, 7]);
  });

  it("switches a cleared group to ON THE 8", () => {
    const match = createMatchState();
    match.assigned = { 1: "solid", 2: "stripe" };
    match.remaining.solid = [];
    const [p1, p2] = playerPanels(hud(match));
    expect(p1).toMatchObject({ onEight: true, label: "ON THE 8", remaining: [] });
    expect(p2).toMatchObject({ onEight: false, label: "STRIPES" });
  });

  it("lights no card once the game is over", () => {
    const match = createMatchState();
    match.gameOver = true;
    expect(playerPanels(hud(match)).some((p) => p.active)).toBe(false);
  });

  it("labels the groups plainly", () => {
    expect(groupLabel("solid")).toBe("SOLIDS");
    expect(groupLabel("stripe")).toBe("STRIPES");
    expect(groupLabel(null)).toBe("OPEN TABLE");
  });
});

describe("pocketed-ball tray", () => {
  it("lists object balls in the order they dropped", () => {
    expect(trayBalls([3, 12, 5])).toEqual([3, 12, 5]);
  });

  it("never shows the cue ball and never repeats a ball", () => {
    expect(trayBalls(["cue", 3, "cue", 3, 9])).toEqual([3, 9]);
    expect(trayBalls()).toEqual([]);
  });
});
