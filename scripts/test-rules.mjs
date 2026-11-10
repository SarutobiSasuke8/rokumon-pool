// Node check for the pure rules (8-ball, blackball, 9-ball). Run with: node scripts/test-rules.mjs
import assert from "node:assert/strict";
import { createMatchState } from "../src/game/state.js";
import { resolveShot, legalFirstTarget, lowestBall, isLegalFirstContact, coinTarget } from "../src/game/rules.js";

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

test("scratch is a foul: two shots, cue ball behind the line, table stays open", () => {
  const r = resolveShot(fresh(), { pocketed: [5, "cue"], firstContact: 5 });
  assert.equal(r.foulReason, "scratch");
  assert.equal(r.ballInHand, true);
  assert.equal(r.placement, "kitchen");
  assert.equal(r.match.shots, 2);
  assert.match(r.message, /Player 2 has two shots, cue ball behind the line\./);
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
  // The cue ball was not pocketed, so it stays where it lies.
  assert.equal(r.ballInHand, false);
  assert.equal(r.placement, "none");
  assert.equal(r.match.shots, 2);
  assert.match(r.message, /^Foul: hit a stripe \(12\) first\. Player 2 has two shots\.$/);
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

// ---- terminal states and restart ------------------------------------------

test("8-ball early ends the game as a loss for the shooter (player 1 shooting)", () => {
  const m = withSuits("solid");
  const r = resolveShot(m, { pocketed: [8], firstContact: 1 });
  assert.equal(r.match.gameOver, true);
  assert.equal(r.winner, 2);
  assert.equal(r.match.winner, 2);
  assert.equal(r.continueTurn, false);
  assert.equal(r.ballInHand, false);
  assert.match(r.message, /^Player 1 pocketed the 8-ball early\. Player 2 wins!$/);
});

test("8-ball early ends the game as a loss for the shooter (player 2 shooting)", () => {
  const m = withSuits("solid");
  m.turn = 2;
  const r = resolveShot(m, { pocketed: [8], firstContact: 9 });
  assert.equal(r.match.gameOver, true);
  assert.equal(r.winner, 1);
  assert.equal(r.match.winner, 1);
});

test("8-ball early on an open table (after the break) loses", () => {
  const r = resolveShot(fresh(), { pocketed: [8, 4], firstContact: 4 });
  assert.equal(r.match.gameOver, true);
  assert.equal(r.winner, 2);
});

test("8-ball early loses even when an own ball drops legally on the same shot", () => {
  const r = resolveShot(withSuits("solid"), { pocketed: [2, 8], firstContact: 2 });
  assert.equal(r.winner, 2);
  assert.equal(r.continueTurn, false, "no stay-at-table after the game is over");
});

test("8-ball early with a scratch is still a loss, not a ball-in-hand foul", () => {
  const r = resolveShot(withSuits("solid"), { pocketed: [8, "cue"], firstContact: 1 });
  assert.equal(r.winner, 2);
  assert.equal(r.match.gameOver, true);
  assert.equal(r.ballInHand, false);
});

test("scratching while legally potting the 8 loses, with game over and a foul message", () => {
  const m = withSuits("stripe");
  m.remaining.stripe = [];
  const r = resolveShot(m, { pocketed: ["cue", 8], firstContact: 8 });
  assert.equal(r.match.gameOver, true);
  assert.equal(r.winner, 2);
  assert.equal(r.foulReason, "scratch");
  assert.equal(r.ballInHand, false);
  assert.match(r.message, /on a foul/);
});

test("8-ball on the break with no other pot: respotted, turn passes, table stays open", () => {
  const r = resolveShot(fresh(), { pocketed: [8], firstContact: 1, isBreak: true });
  assert.equal(r.winner, null);
  assert.equal(r.match.gameOver, false);
  assert.equal(r.respotEight, true);
  assert.equal(r.foulReason, null);
  assert.equal(r.match.turn, 2);
  assert.deepEqual(r.match.assigned, { 1: null, 2: null });
});

test("restart from a terminal state gives a fresh, independent, legal match", () => {
  const initial = JSON.stringify(fresh());
  const lost = resolveShot(withSuits("solid"), { pocketed: [8, 1, "cue"], firstContact: 1 }).match;
  assert.equal(lost.gameOver, true);

  // GameScene.create() (R key, or play again from GameOver) calls createMatchState().
  const restarted = createMatchState();
  assert.equal(JSON.stringify(restarted), initial);
  assert.equal(restarted.gameOver, false);
  assert.equal(restarted.winner, null);
  assert.equal(restarted.turn, 1);
  assert.equal(legalFirstTarget(restarted, 1), "open");

  // Not sharing arrays with the finished match or with any other match.
  lost.remaining.solid.length = 0;
  restarted.remaining.stripe.pop();
  assert.equal(JSON.stringify(createMatchState()), initial);

  // The first shot of the new match is a break again: the 8 is respotted, not a loss.
  const brk = resolveShot(restarted, { pocketed: [8], firstContact: 1, isBreak: true });
  assert.equal(brk.match.gameOver, false);
  assert.equal(brk.respotEight, true);
});

// ---- two shots after a foul ---------------------------------------------

const afterFoul = () => resolveShot(withSuits("solid"), { pocketed: [], firstContact: null }).match;

test("two shots: a miss on the first uses one and the same player shoots again", () => {
  const m = afterFoul();
  assert.equal(m.turn, 2);
  assert.equal(m.shots, 2);
  const r = resolveShot(m, { pocketed: [], firstContact: 9 });
  assert.equal(r.foulReason, null);
  assert.equal(r.match.turn, 2, "still at the table");
  assert.equal(r.match.shots, 1);
  assert.equal(r.message, "Player 2 has one shot left.");
});

test("two shots: a miss on the second passes the turn with one shot", () => {
  const first = resolveShot(afterFoul(), { pocketed: [], firstContact: 9 }).match;
  const r = resolveShot(first, { pocketed: [], firstContact: 9 });
  assert.equal(r.match.turn, 1);
  assert.equal(r.match.shots, 1);
});

test("two shots: a pot does not use one up", () => {
  const r = resolveShot(afterFoul(), { pocketed: [9], firstContact: 9 });
  assert.equal(r.continueTurn, true);
  assert.equal(r.match.turn, 2);
  assert.equal(r.match.shots, 2);
  assert.equal(r.message, "Player 2 pots and still has two shots.");
});

test("two shots: fouling with two shots in hand hands two to the other player", () => {
  const r = resolveShot(afterFoul(), { pocketed: [], firstContact: 1 });
  assert.match(r.foulReason, /solid/);
  assert.equal(r.match.turn, 1);
  assert.equal(r.match.shots, 2);
});

test("a normal visit is one shot", () => {
  assert.equal(fresh().shots, 1);
  const r = resolveShot(fresh(), { pocketed: [], firstContact: 1 });
  assert.equal(r.match.shots, 1);
});

// ---- blackball: same rules, reds and yellows ------------------------------

test("blackball: fouls and wins are worded in reds, yellows and the black", () => {
  const m = createMatchState("blackball");
  m.assigned = { 1: "solid", 2: "stripe" };
  const foul = resolveShot(m, { pocketed: [], firstContact: 12 });
  assert.equal(foul.message, "Foul: hit a yellow first. Player 2 has two shots.");
  const early = resolveShot(m, { pocketed: [8], firstContact: 1 });
  assert.equal(early.message, "Player 1 pocketed the black early. Player 2 wins!");
  m.remaining.solid = [];
  const win = resolveShot(m, { pocketed: [8], firstContact: 8 });
  assert.equal(win.winner, 1);
  assert.equal(win.message, "Player 1 cleared the table and sank the black!");
});

// ---- 9-ball ----------------------------------------------------------------

const nine = () => createMatchState("nineball");

test("9-ball: the lowest ball must be hit first", () => {
  assert.equal(lowestBall(nine()), 1);
  assert.equal(isLegalFirstContact(nine(), 1, 1), true);
  assert.equal(isLegalFirstContact(nine(), 1, 2), false);
  const r = resolveShot(nine(), { pocketed: [], firstContact: 3 });
  assert.match(r.foulReason, /hit the 3 first, the 1 was on/);
  assert.equal(r.placement, "anywhere");
  assert.equal(r.ballInHand, true);
  assert.equal(r.match.turn, 2);
  assert.equal(r.match.shots, 1, "9-ball gives ball in hand, not two shots");
});

test("9-ball: any ball potted on a legal shot keeps the turn", () => {
  const r = resolveShot(nine(), { pocketed: [5], firstContact: 1 });
  assert.equal(r.foulReason, null);
  assert.equal(r.continueTurn, true);
  assert.equal(r.match.turn, 1);
  assert.deepEqual(r.match.balls, [1, 2, 3, 4, 6, 7, 8, 9]);
});

test("9-ball: the lowest ball moves on as balls go down", () => {
  const r = resolveShot(nine(), { pocketed: [1, 2], firstContact: 1 });
  assert.equal(lowestBall(r.match), 3);
});

test("9-ball: potting the 9 on a legal shot wins at any time", () => {
  const r = resolveShot(nine(), { pocketed: [9], firstContact: 1 });
  assert.equal(r.winner, 1);
  assert.equal(r.match.gameOver, true);
  assert.equal(r.message, "Player 1 potted the 9-ball!");
});

test("9-ball: the 9 down on a foul is respotted and the game goes on", () => {
  const r = resolveShot(nine(), { pocketed: [9, "cue"], firstContact: 1 });
  assert.equal(r.winner, null);
  assert.equal(r.match.gameOver, false);
  assert.deepEqual(r.respot, [9]);
  assert.ok(r.match.balls.includes(9));
  assert.equal(r.match.turn, 2);
  assert.match(r.message, /The 9-ball is respotted\./);
});

test("9-ball: a miss with no foul passes the turn", () => {
  const r = resolveShot(nine(), { pocketed: [], firstContact: 1 });
  assert.equal(r.foulReason, null);
  assert.equal(r.match.turn, 2);
  assert.equal(r.ballInHand, false);
});

// ---- Six Coins ---------------------------------------------------------------

const six = () => createMatchState("sixcoins");
const RED = 7;
const COIN = 1;

test("six coins: a visit starts on red, and hitting a coin first is a foul", () => {
  assert.equal(coinTarget(six()), "red");
  assert.equal(isLegalFirstContact(six(), 1, RED), true);
  assert.equal(isLegalFirstContact(six(), 1, COIN), false);
  const r = resolveShot(six(), { pocketed: [], firstContact: COIN });
  assert.match(r.foulReason, /hit a coin first, red was on/);
  assert.equal(r.match.turn, 2);
  assert.equal(r.match.shots, 2);
});

test("six coins: potting a red puts gold on and keeps the turn", () => {
  const r = resolveShot(six(), { pocketed: [RED], firstContact: RED });
  assert.equal(r.continueTurn, true);
  assert.equal(r.match.turn, 1);
  assert.equal(r.match.on, "gold");
  assert.equal(r.message, "Player 1 pots a red. Gold is on.");
  assert.equal(isLegalFirstContact(r.match, 1, COIN), true);
  assert.equal(isLegalFirstContact(r.match, 1, 8), false);
});

test("six coins: a coin potted with gold on is banked, then it is back to red", () => {
  const onGold = resolveShot(six(), { pocketed: [RED], firstContact: RED }).match;
  const r = resolveShot(onGold, { pocketed: [COIN], firstContact: COIN });
  assert.equal(r.match.coins[1], 1);
  assert.equal(r.match.on, "red");
  assert.equal(r.match.turn, 1);
  assert.deepEqual(r.respot, []);
  assert.ok(!r.match.golds.includes(COIN));
  assert.equal(r.message, "Player 1 banks a coin: 1 of 4.");
});

test("six coins: a coin that drops while red is on goes back, with no foul", () => {
  const r = resolveShot(six(), { pocketed: [RED, COIN], firstContact: RED });
  assert.equal(r.foulReason, null);
  assert.deepEqual(r.respot, [COIN]);
  assert.equal(r.match.coins[1], 0);
  assert.ok(r.match.golds.includes(COIN));
  assert.equal(r.match.on, "gold", "the red still earns the shot at gold");
});

test("six coins: a coin potted on a foul goes back and gives two shots", () => {
  const onGold = resolveShot(six(), { pocketed: [RED], firstContact: RED }).match;
  const r = resolveShot(onGold, { pocketed: [COIN, "cue"], firstContact: COIN });
  assert.equal(r.foulReason, "scratch");
  assert.deepEqual(r.respot, [COIN]);
  assert.equal(r.match.coins[1], 0);
  assert.equal(r.match.turn, 2);
  assert.equal(r.match.shots, 2);
  assert.equal(r.placement, "kitchen");
  assert.equal(r.match.on, "red");
});

test("six coins: missing the coin ends the visit and the next player starts on red", () => {
  const onGold = resolveShot(six(), { pocketed: [RED], firstContact: RED }).match;
  const r = resolveShot(onGold, { pocketed: [], firstContact: COIN });
  assert.equal(r.foulReason, null);
  assert.equal(r.match.turn, 2);
  assert.equal(r.match.on, "red");
});

test("six coins: the fourth coin wins", () => {
  const m = six();
  m.coins = { 1: 3, 2: 1 };
  m.golds = [5, 6];
  m.on = "gold";
  const r = resolveShot(m, { pocketed: [5], firstContact: 5 });
  assert.equal(r.winner, 1);
  assert.equal(r.match.gameOver, true);
  assert.equal(r.message, "Player 1 banked 4 coins!");
});

test("six coins: three each puts one coin back to decide it, and potting it wins", () => {
  const m = six();
  m.coins = { 1: 2, 2: 3 };
  m.golds = [6];
  m.on = "gold";
  const level = resolveShot(m, { pocketed: [6], firstContact: 6 });
  assert.equal(level.winner, null);
  assert.equal(level.match.lastCoin, true);
  assert.deepEqual(level.respot, [6]);
  assert.deepEqual(level.match.golds, [6]);
  assert.match(level.message, /Three coins each: the last coin decides it\./);
  assert.equal(coinTarget(level.match), "gold", "no red is needed for the last coin");
  const end = resolveShot(level.match, { pocketed: [6], firstContact: 6 });
  assert.equal(end.winner, 1);
  assert.equal(end.message, "Player 1 potted the last coin!");
});

test("six coins: with no reds left, gold is always on", () => {
  const m = six();
  m.reds = [];
  assert.equal(coinTarget(m), "gold");
  const r = resolveShot(m, { pocketed: [COIN], firstContact: COIN });
  assert.equal(r.match.coins[1], 1);
});

test("six coins: two shots carry as in 8-ball", () => {
  const fouled = resolveShot(six(), { pocketed: [], firstContact: null }).match;
  assert.equal(fouled.shots, 2);
  const miss = resolveShot(fouled, { pocketed: [], firstContact: RED });
  assert.equal(miss.match.turn, 2);
  assert.equal(miss.match.shots, 1);
});

console.log(`\n${passed} rules checks passed`);
