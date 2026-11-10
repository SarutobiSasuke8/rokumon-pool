import { test } from "vitest";
import assert from "node:assert/strict";
import { InvalidMove, advanceOnlineTable, rackOnlineTable } from "./online-table.mjs";

test("one authoritative rack advances turns and preserves the prior snapshot", () => {
  const rack = rackOnlineTable();
  const miss = { type: "shot", angle: Math.PI, power: 0.12 };
  assert.equal(rack.balls.length, 16);
  assert.throws(() => advanceOnlineTable(rack, 2, miss), InvalidMove);
  const { state, replay } = advanceOnlineTable(rack, 1, miss);
  assert.equal(rack.match.turn, 1);
  assert.equal(state.match.turn, 2);
  assert.equal(state.match.shots, 2);
  assert.equal(state.shots, 1);
  assert.ok(replay.length > 1);
  assert.throws(() => advanceOnlineTable(state, 1, miss), InvalidMove);
  assert.equal(advanceOnlineTable(state, 2, miss).state.match.turn, 1);
});

test("a scratch requires a clear cue placement behind the line", () => {
  const rack = rackOnlineTable();
  rack.balls = [["cue", 125, 125], [1, 510, 270]];
  const { state } = advanceOnlineTable(rack, 1, { type: "shot", angle: -3 * Math.PI / 4, power: 0.7 });
  assert.equal(state.placement, "kitchen");
  assert.equal(state.balls.some(([id]) => id === "cue"), false);
  assert.throws(() => advanceOnlineTable(state, 2, { type: "place", x: 440, y: 270 }), InvalidMove);
  const placed = advanceOnlineTable(state, 2, { type: "place", x: 260, y: 270 }).state;
  assert.equal(placed.placement, "none");
  assert.deepEqual(placed.balls.find(([id]) => id === "cue"), ["cue", 260, 270]);
});
