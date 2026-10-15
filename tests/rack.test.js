import { describe, expect, it } from "vitest";
import { RACK_ORDER } from "../src/game/constants.js";
import { ballKind, createMatchState } from "../src/game/state.js";

describe("initial rack and match", () => {
  it("uses five triangular rows and every object ball exactly once", () => {
    expect(RACK_ORDER.map(row => row.length)).toEqual([1, 2, 3, 4, 5]);
    expect(RACK_ORDER.flat().slice().sort((a, b) => a - b)).toEqual(Array.from({ length: 15 }, (_, i) => i + 1));
  });
  it("puts the 8-ball in the centre of the third row", () => {
    expect(RACK_ORDER[2][1]).toBe(8);
  });
  it("contains seven solids, seven stripes and one 8-ball", () => {
    const kinds = RACK_ORDER.flat().map(ballKind);
    expect(kinds.filter(kind => kind === "solid")).toHaveLength(7);
    expect(kinds.filter(kind => kind === "stripe")).toHaveLength(7);
    expect(kinds.filter(kind => kind === "eight")).toHaveLength(1);
  });
  it("tracks every racked suit ball as remaining at the start", () => {
    const match = createMatchState();
    for (const suit of ["solid", "stripe"]) {
      expect(match.remaining[suit]).toEqual(RACK_ORDER.flat().filter(id => ballKind(id) === suit).sort((a, b) => a - b));
    }
    expect(match.assigned).toEqual({ 1: null, 2: null });
    expect(match.turn).toBe(1);
    expect(match.gameOver).toBe(false);
    expect(match.winner).toBeNull();
  });
});
