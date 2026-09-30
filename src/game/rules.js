import { ballKind } from "./state.js";

// Pure 8-ball shot resolution. Takes the match state as it was when the shot
// was taken plus what happened during the shot, and returns the next state
// with a description of the outcome. No Phaser, no physics, so it can be
// exercised from the debug harness or a unit test.

export function legalFirstTarget(match, player) {
  const suit = match.assigned[player];
  if (!suit) return "open";
  if (match.remaining[suit].length === 0) return "eight";
  return suit;
}

export function isLegalFirstContact(match, player, ballId) {
  if (ballId == null) return false;
  const target = legalFirstTarget(match, player);
  const kind = ballKind(ballId);
  if (target === "open") return kind !== "eight";
  if (target === "eight") return kind === "eight";
  return kind === target;
}

function describeBall(id) {
  const kind = ballKind(id);
  if (kind === "eight") return "the 8-ball";
  return `a ${kind} (${id})`;
}

export function resolveShot(match, { pocketed = [], firstContact = null, isBreak = false } = {}) {
  const next = JSON.parse(JSON.stringify(match));
  const player = next.turn;
  const other = player === 1 ? 2 : 1;
  const scratched = pocketed.includes("cue");
  // The 8 dropping on the break is not a loss: it is respotted and the shot
  // otherwise resolves normally (a scratch alongside it is still a foul).
  const respotEight = isBreak && pocketed.includes(8);
  const eightPocketed = pocketed.includes(8) && !respotEight;
  const objectBalls = pocketed.filter((id) => id !== "cue" && id !== 8);

  // Whether the 8-ball was the legal object ball is judged from the state
  // before this shot: potting your last suit ball and the 8 together loses.
  const suitBefore = match.assigned[player];
  const clearedBefore = Boolean(suitBefore) && match.remaining[suitBefore].length === 0;

  let foulReason = null;
  if (scratched) foulReason = "scratch";
  else if (firstContact == null) foulReason = "no ball hit";
  else if (!isLegalFirstContact(match, player, firstContact)) foulReason = `hit ${describeBall(firstContact)} first`;

  objectBalls.forEach((num) => {
    const kind = ballKind(num);
    next.remaining[kind] = next.remaining[kind].filter((n) => n !== num);
  });

  if (eightPocketed) {
    next.gameOver = true;
    if (clearedBefore && !foulReason) {
      next.winner = player;
      return { match: next, winner: player, foulReason: null, ballInHand: false, continueTurn: false, message: `Player ${player} cleared the table and sank the 8-ball!` };
    }
    next.winner = other;
    const why = clearedBefore ? "on a foul" : "early";
    return { match: next, winner: other, foulReason, ballInHand: false, continueTurn: false, message: `Player ${player} pocketed the 8-ball ${why}. Player ${other} wins!` };
  }

  let continueTurn = false;
  if (!foulReason && objectBalls.length) {
    if (!next.assigned[player]) {
      const firstKind = ballKind(objectBalls[0]);
      next.assigned[player] = firstKind;
      next.assigned[other] = firstKind === "solid" ? "stripe" : "solid";
    }
    const suit = next.assigned[player];
    continueTurn = objectBalls.some((num) => ballKind(num) === suit);
  }

  let message = "";
  if (foulReason) {
    next.turn = other;
    message = `Foul: ${foulReason}. Player ${other} has ball in hand.`;
  } else if (continueTurn) {
    message = `Player ${player} pots and stays at the table.`;
  } else {
    next.turn = other;
  }

  if (respotEight) message = `${message ? `${message} ` : ""}The 8-ball dropped on the break and is respotted.`.trim();

  return { match: next, winner: null, foulReason, ballInHand: Boolean(foulReason), continueTurn, respotEight, message };
}
