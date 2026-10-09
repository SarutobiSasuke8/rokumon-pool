// Node check for the player-facing name formatting. Run with: node scripts/test-labels.mjs
import assert from "node:assert/strict";
import { possessive, turnLabel, withNames } from "../src/game/labels.js";

const AI_NAMES = { 1: "You", 2: "Computer" };
const PVP_NAMES = { 1: "Player 1", 2: "Player 2" };
let passed = 0;
const test = (name, fn) => { fn(); passed += 1; console.log("ok -", name); };

test("possessive: You takes Your, other names take 's", () => {
  assert.equal(possessive("You"), "Your");
  assert.equal(possessive("Computer"), "Computer's");
  assert.equal(possessive("Player 2"), "Player 2's");
});

test("HUD turn label in solo mode reads Your turn, never You's turn", () => {
  assert.equal(turnLabel(AI_NAMES, 1, null), "Your turn");
  assert.equal(turnLabel(AI_NAMES, 1, "solid"), "Your turn · solids");
  assert.equal(turnLabel(AI_NAMES, 2, "stripe"), "Computer's turn · stripes");
});

test("HUD turn label in two-player mode", () => {
  assert.equal(turnLabel(PVP_NAMES, 1, null), "Player 1's turn");
  assert.equal(turnLabel(PVP_NAMES, 2, "solid"), "Player 2's turn · solids");
});

test("default HUD message (with suit suffix) uses Your", () => {
  assert.equal(withNames("Player 1's turn (solids)", AI_NAMES), "Your turn (solids)");
  assert.equal(withNames("Player 2's turn (stripes)", AI_NAMES), "Computer's turn (stripes)");
  assert.equal(withNames("Player 1's turn", PVP_NAMES), "Player 1's turn");
});

test("rules messages read naturally for You", () => {
  assert.equal(withNames("Player 1 pots and stays at the table.", AI_NAMES), "You pot and stay at the table.");
  assert.equal(withNames("Foul: scratch. Player 1 has ball in hand.", AI_NAMES), "Foul: scratch. You have ball in hand.");
  assert.equal(withNames("Player 2 pocketed the 8-ball early. Player 1 wins!", AI_NAMES), "Computer pocketed the 8-ball early. You win!");
  assert.equal(withNames("Player 1 pocketed the 8-ball early. Player 2 wins!", AI_NAMES), "You pocketed the 8-ball early. Computer wins!");
  assert.equal(withNames("Player 1 cleared the table and sank the 8-ball!", AI_NAMES), "You cleared the table and sank the 8-ball!");
});

test("no output ever contains You's or Player N in solo mode", () => {
  const samples = [
    "Player 1's turn", "Player 1's turn (solids)", "Player 2's turn (stripes)",
    "Foul: hit a stripe (9) first. Player 2 has ball in hand.", "Player 2 pots and stays at the table.",
    "Player 1 pocketed the 8-ball on a foul. Player 2 wins!",
  ];
  samples.forEach((s) => {
    const out = withNames(s, AI_NAMES);
    assert.doesNotMatch(out, /You's/);
    assert.doesNotMatch(out, /Player [12]/);
  });
});

test("empty or missing text is safe", () => {
  assert.equal(withNames("", AI_NAMES), "");
  assert.equal(withNames(undefined, AI_NAMES), "");
});

console.log(`\n${passed} label checks passed`);
