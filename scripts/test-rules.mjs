// Node check for the pure 8-ball rules. Run with: node scripts/test-rules.mjs
import assert from "node:assert/strict";
import { createMatchState } from "../src/game/state.js";
import { resolveShot, legalFirstTarget } from "../src/game/rules.js";

const fresh = () => createMatchState();
const withSuits = (p1 = "solid") => {
  const m = fresh();
  m.assigned = { 1: p1, 2: p1 === "solid" ? "stripe" : "solid" };
  return m;
};
let passed = 0;
const test = (name, fn) => { fn(); passed += 1; console.log("ok -", name); };

test("open table: potting a solid assigns suits and keeps the turn", () => {
  const r = resolveShot(fresh(), { pocketed: [3], firstContact: 3 });
  assert.equal(r.match.assigned[1], "solid");
  assert.equal(r.match.assigned[2], "stripe");
  assert.equal(r.match.turn, 1);
  assert.equal(r.continueTurn, true);
  assert.deepEqual(r.match.remaining.solid, [1, 2, 4, 5, 6, 7]);
});

test("open table: no pot passes the turn without a foul", () => {
  const r = resolveShot(fresh(), { pocketed: [], firstContact: 1 });
  assert.equal(r.foulReason, null);
  assert.equal(r.ballInHand, false);
  assert.equal(r.match.turn, 2);
});

test("scratch is a foul: ball in hand, turn passes, table stays open", () => {
  const r = resolveShot(fresh(), { pocketed: [5, "cue"], firstContact: 5 });
  assert.equal(r.foulReason, "scratch");
  assert.equal(r.ballInHand, true);
  assert.equal(r.match.turn, 2);
  assert.equal(r.match.assigned[1], null);
  assert.deepEqual(r.match.remaining.solid, [1, 2, 3, 4, 6, 7], "potted ball stays down");
});

test("no contact is a foul", () => {
  const r = resolveShot(withSuits(), { pocketed: [], firstContact: null });
  assert.equal(r.foulReason, "no ball hit");
  assert.equal(r.match.turn, 2);
});

test("hitting the opponent's suit first is a foul even if you pot your own", () => {
  const r = resolveShot(withSuits("solid"), { pocketed: [2], firstContact: 12 });
  assert.match(r.foulReason, /stripe/);
  assert.equal(r.ballInHand, true);
  assert.equal(r.match.turn, 2);
  assert.equal(r.continueTurn, false);
});

test("hitting the 8 first on an open table is a foul", () => {
  const r = resolveShot(fresh(), { pocketed: [], firstContact: 8 });
  assert.match(r.foulReason, /8-ball/);
});

test("potting only the opponent's ball passes the turn, no foul", () => {
  const r = resolveShot(withSuits("solid"), { pocketed: [10], firstContact: 1 });
  assert.equal(r.foulReason, null);
  assert.equal(r.match.turn, 2);
  assert.deepEqual(r.match.remaining.stripe, [9, 11, 12, 13, 14, 15]);
});

test("8-ball early is a loss", () => {
  const r = resolveShot(withSuits("solid"), { pocketed: [8], firstContact: 1 });
  assert.equal(r.winner, 2);
  assert.equal(r.match.gameOver, true);
});

test("clearing your suit then potting the 8 legally wins", () => {
  const m = withSuits("solid");
  m.remaining.solid = [];
  assert.equal(legalFirstTarget(m, 1), "eight");
  const r = resolveShot(m, { pocketed: [8], firstContact: 8 });
  assert.equal(r.winner, 1);
});

test("potting the 8 on a scratch after clearing loses", () => {
  const m = withSuits("solid");
  m.remaining.solid = [];
  const r = resolveShot(m, { pocketed: [8, "cue"], firstContact: 8 });
  assert.equal(r.winner, 2);
});

test("potting the 8 after hitting a stripe first, when on the 8, loses", () => {
  const m = withSuits("solid");
  m.remaining.solid = [];
  const r = resolveShot(m, { pocketed: [8], firstContact: 9 });
  assert.equal(r.winner, 2);
});

test("last suit ball and the 8 in the same shot is a loss", () => {
  const m = withSuits("solid");
  m.remaining.solid = [7];
  const r = resolveShot(m, { pocketed: [7, 8], firstContact: 7 });
  assert.equal(r.winner, 2);
});

test("8-ball on the break is respotted, not a loss", () => {
  const r = resolveShot(fresh(), { pocketed: [8, 3], firstContact: 1, isBreak: true });
  assert.equal(r.winner, null);
  assert.equal(r.respotEight, true);
  assert.equal(r.match.gameOver, false);
  assert.equal(r.match.assigned[1], "solid");
  assert.equal(r.match.turn, 1);
  assert.match(r.message, /respotted/);
});

test("8-ball plus scratch on the break: respot and foul, no loss", () => {
  const r = resolveShot(fresh(), { pocketed: [8, "cue"], firstContact: 1, isBreak: true });
  assert.equal(r.winner, null);
  assert.equal(r.respotEight, true);
  assert.equal(r.foulReason, "scratch");
  assert.equal(r.match.turn, 2);
});

test("8-ball on a non-break shot is still a loss", () => {
  const r = resolveShot(fresh(), { pocketed: [8], firstContact: 1, isBreak: false });
  assert.equal(r.winner, 2);
});

test("input state is never mutated", () => {
  const m = withSuits("solid");
  const before = JSON.stringify(m);
  resolveShot(m, { pocketed: [1, "cue"], firstContact: 1 });
  assert.equal(JSON.stringify(m), before);
});

console.log(`\n${passed} rules checks passed`);
