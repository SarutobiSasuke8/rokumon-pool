// Node check for the computer opponent. Run with: node scripts/test-ai.mjs
import assert from "node:assert/strict";
import { createMatchState } from "../src/game/state.js";
import { TABLE, BALL, PHYSICS, AI_DIFFICULTY, DIFFICULTY_ORDER, resolveDifficulty } from "../src/game/constants.js";
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

// Seeded generator (mulberry32) so difficulty comparisons are deterministic.
function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Fixed open-table positions, each with at least one clean pot.
const POSITIONS = [
  [{ id: "cue", x: 500, y: 270 }, { id: 3, x: 700, y: 170 }],
  [{ id: "cue", x: 300, y: 300 }, { id: 5, x: 200, y: 380 }, { id: 12, x: 640, y: 160 }],
  [{ id: "cue", x: 420, y: 200 }, { id: 2, x: 600, y: 360 }, { id: 9, x: 300, y: 140 }],
  [{ id: "cue", x: 700, y: 300 }, { id: 6, x: 800, y: 400 }, { id: 14, x: 480, y: 160 }],
  [{ id: "cue", x: 250, y: 220 }, { id: 1, x: 420, y: 300 }, { id: 10, x: 150, y: 140 }, { id: 4, x: 700, y: 420 }],
];

// Mean absolute angle error, measured against the noise-free aim of the
// shot actually chosen (Easy may choose a weaker pot than the others).
function meanAngleError(key, samples = 40) {
  const random = seeded(2026);
  const tuning = AI_DIFFICULTY[key];
  let total = 0;
  let n = 0;
  for (const balls of POSITIONS) {
    for (let i = 0; i < samples; i += 1) {
      const plan = planShot({ ...base, match: createMatchState(), player: 1, balls, ...tuning, random });
      assert.equal(plan.kind, "pot");
      const clean = evaluatePot({ cue: balls[0], target: balls.find((b) => b.id === plan.targetId), pocket: plan.pocket, balls, bounds: TABLE, radius: BALL.radius });
      total += Math.abs(plan.angle - clean.angle);
      n += 1;
    }
  }
  return total / n;
}

test("difficulty table: three levels, Normal is the original tuning", () => {
  assert.deepEqual([...DIFFICULTY_ORDER], ["easy", "normal", "hard"]);
  assert.equal(AI_DIFFICULTY.normal.skill, 0.62);
  assert.equal(AI_DIFFICULTY.normal.weakShotChance, 0);
  assert.equal(AI_DIFFICULTY.normal.loosePlacement, 0);
  assert.ok(AI_DIFFICULTY.easy.skill < AI_DIFFICULTY.normal.skill && AI_DIFFICULTY.normal.skill < AI_DIFFICULTY.hard.skill);
  assert.equal(resolveDifficulty("hard"), "hard");
  assert.equal(resolveDifficulty("bogus"), "normal");
  assert.equal(resolveDifficulty(null), "normal");
  assert.equal(resolveDifficulty("toString"), "normal");
});

test("seeded: Hard has a smaller mean angle error than Normal, and Normal than Easy", () => {
  const err = Object.fromEntries(DIFFICULTY_ORDER.map((k) => [k, meanAngleError(k)]));
  console.log(`    mean |angle error| (rad): easy ${err.easy.toFixed(5)}, normal ${err.normal.toFixed(5)}, hard ${err.hard.toFixed(5)}`);
  assert.ok(err.hard < err.normal, "hard < normal");
  assert.ok(err.normal < err.easy, "normal < easy");
});

test("Normal plays exactly as the original planner (skill 0.62 only)", () => {
  for (const balls of POSITIONS) {
    const a = planShot({ ...base, match: createMatchState(), player: 1, balls, ...AI_DIFFICULTY.normal, random: seeded(7) });
    const b = planShot({ ...base, match: createMatchState(), player: 1, balls, skill: 0.62, random: seeded(7) });
    assert.deepEqual(a, b);
  }
  const m = createMatchState(); m.assigned = { 1: "solid", 2: "stripe" };
  const balls = [{ id: 3, x: 700, y: 170 }, { id: 12, x: 300, y: 300 }, { id: 5, x: 260, y: 420 }];
  assert.deepEqual(
    planPlacement({ ...base, match: m, player: 1, balls, ...AI_DIFFICULTY.normal, random: seeded(7) }),
    planPlacement({ ...base, match: m, player: 1, balls }),
  );
});

test("Hard always takes the best pot; Easy sometimes takes a weaker legal one", () => {
  const balls = POSITIONS[4];
  const best = planShot({ ...base, match: createMatchState(), player: 1, balls, skill: 1 });
  const legal = new Set(legalTargetIds(createMatchState(), 1, balls));
  const hardRandom = seeded(11);
  const easyRandom = seeded(11);
  let easyWeaker = 0;
  for (let i = 0; i < 40; i += 1) {
    const hard = planShot({ ...base, match: createMatchState(), player: 1, balls, ...AI_DIFFICULTY.hard, random: hardRandom });
    assert.equal(hard.score, best.score);
    const easy = planShot({ ...base, match: createMatchState(), player: 1, balls, ...AI_DIFFICULTY.easy, random: easyRandom });
    assert.equal(easy.kind, "pot");
    assert.ok(legal.has(easy.targetId));
    if (easy.score < best.score) easyWeaker += 1;
  }
  console.log(`    Easy took a weaker pot on ${easyWeaker} of 40 seeded turns`);
  assert.ok(easyWeaker > 0 && easyWeaker < 40);
});

test("Easy ball in hand: sometimes not the best spot, always a free spot with a pot", () => {
  const m = createMatchState(); m.assigned = { 1: "solid", 2: "stripe" };
  const balls = [{ id: 3, x: 700, y: 170 }, { id: 12, x: 300, y: 300 }, { id: 5, x: 260, y: 420 }];
  const best = planPlacement({ ...base, match: m, player: 1, balls });
  const random = seeded(5);
  let loose = 0;
  for (let i = 0; i < 30; i += 1) {
    const spot = planPlacement({ ...base, match: m, player: 1, balls, ...AI_DIFFICULTY.easy, random });
    assert.ok(balls.every((b) => Math.hypot(b.x - spot.x, b.y - spot.y) >= BALL.radius * 2 + 2));
    const shot = planShot({ ...base, match: m, player: 1, balls: [{ id: "cue", x: spot.x, y: spot.y }, ...balls] });
    assert.equal(shot.kind, "pot");
    if (spot.x !== best.x || spot.y !== best.y) loose += 1;
  }
  console.log(`    Easy placed away from the best spot on ${loose} of 30 seeded turns`);
  assert.ok(loose > 0 && loose < 30);
});

console.log(`\n${passed} AI checks passed`);
