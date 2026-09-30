// Node check for the computer opponent. Run with: node scripts/test-ai.mjs
import assert from "node:assert/strict";
import { createMatchState } from "../src/game/state.js";
import { TABLE, BALL, PHYSICS } from "../src/game/constants.js";
import { planShot, planPlacement, legalTargetIds, evaluatePot } from "../src/game/ai.js";

const pockets = [
  { x: TABLE.left, y: TABLE.top }, { x: TABLE.midX, y: TABLE.top }, { x: TABLE.right, y: TABLE.top },
  { x: TABLE.left, y: TABLE.bottom }, { x: TABLE.midX, y: TABLE.bottom }, { x: TABLE.right, y: TABLE.bottom },
];
const base = { pockets, bounds: TABLE, radius: BALL.radius, maxShotSpeed: PHYSICS.maxShotSpeed, skill: 1, headSpot: { x: 280, y: 270 } };
let passed = 0;
const test = (name, fn) => { fn(); passed += 1; console.log("ok -", name); };

test("open table: legal targets exclude the 8", () => {
  const balls = [{ id: "cue", x: 300, y: 270 }, { id: 8, x: 500, y: 270 }, { id: 3, x: 600, y: 200 }, { id: 12, x: 650, y: 300 }];
  assert.deepEqual(legalTargetIds(createMatchState(), 1, balls).sort(), [12, 3].sort());
});

test("straight pot into the top-right corner is found", () => {
  const balls = [{ id: "cue", x: 500, y: 270 }, { id: 3, x: 700, y: 170 }];
  const plan = planShot({ ...base, match: createMatchState(), player: 1, balls });
  assert.equal(plan.kind, "pot");
  assert.equal(plan.targetId, 3);
  assert.equal(plan.pocket.x, TABLE.right);
  assert.equal(plan.pocket.y, TABLE.top);
  assert.ok(plan.power > 0.1 && plan.power <= 1);
});

test("a blocked cue path falls back to a safety, not a foul", () => {
  const m = createMatchState(); m.assigned = { 1: "solid", 2: "stripe" };
  // 9 (stripe) sits between the cue and 3; there is nowhere legal to pot.
  const balls = [{ id: "cue", x: 200, y: 270 }, { id: 9, x: 400, y: 270 }, { id: 3, x: 600, y: 270 }];
  const plan = planShot({ ...base, match: m, player: 1, balls });
  assert.equal(plan.kind, "safety");
  assert.equal(plan.targetId, 3);
});

test("evaluatePot rejects a thin cut and an object path through another ball", () => {
  const cue = { id: "cue", x: 300, y: 200 };
  const target = { id: 5, x: 480, y: 200 };
  // Cue level with the target, pocket straight above it: cut angle near 90 degrees.
  const thin = evaluatePot({ cue, target, pocket: { x: TABLE.midX, y: TABLE.top }, balls: [cue, target], bounds: TABLE, radius: BALL.radius });
  assert.equal(thin, null);
  const cue2 = { id: "cue", x: 500, y: 270 };
  const blocker = { id: 11, x: 790, y: 125 };
  const blocked = evaluatePot({ cue: cue2, target: { id: 3, x: 700, y: 170 }, pocket: { x: TABLE.right, y: TABLE.top }, balls: [cue2, { id: 3, x: 700, y: 170 }, blocker], bounds: TABLE, radius: BALL.radius });
  assert.equal(blocked, null);
});

test("ball in hand picks a free spot with a pot available", () => {
  const m = createMatchState(); m.assigned = { 1: "solid", 2: "stripe" };
  const balls = [{ id: 3, x: 700, y: 170 }, { id: 12, x: 300, y: 300 }];
  const spot = planPlacement({ ...base, match: m, player: 1, balls });
  assert.ok(spot.x > TABLE.left && spot.x < TABLE.right && spot.y > TABLE.top && spot.y < TABLE.bottom);
  const shot = planShot({ ...base, match: m, player: 1, balls: [{ id: "cue", ...spot }, ...balls] });
  assert.equal(shot.kind, "pot");
});

test("skill below 1 perturbs the angle", () => {
  const balls = [{ id: "cue", x: 500, y: 270 }, { id: 3, x: 700, y: 170 }];
  const exact = planShot({ ...base, match: createMatchState(), player: 1, balls, skill: 1 });
  const angles = new Set();
  for (let i = 0; i < 12; i += 1) angles.add(planShot({ ...base, match: createMatchState(), player: 1, balls, skill: 0.3 }).angle.toFixed(4));
  assert.ok(angles.size > 1);
  assert.ok([...angles].every((a) => Math.abs(Number(a) - exact.angle) < 0.3));
});

console.log(`\n${passed} AI checks passed`);
