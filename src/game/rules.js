import { COINS_TO_WIN, ballKind, isCoin } from "./state.js";

// Pure shot resolution for every variant. Takes the match state as it was
// when the shot was taken plus what happened during the shot, and returns
// the next state with a description of the outcome. No Phaser, no physics,
// so it can be exercised from the debug harness or a unit test.
//
// Every result carries:
//   match        the next match state
//   winner       1, 2 or null
//   foulReason   short reason, or null
//   placement    where the incoming player puts the cue ball:
//                "none" (it stays where it lies), "kitchen" (behind the
//                head string) or "anywhere"
//   ballInHand   placement !== "none"
//   shots        shots the player now at the table has this visit
//   continueTurn the shooter potted and stays
//   respot       balls to put back on the table
//   message      player-facing text in "Player N" terms

const WORDS = Object.freeze({
  eightball: Object.freeze({ solid: "solid", stripe: "stripe", eight: "the 8-ball" }),
  blackball: Object.freeze({ solid: "red", stripe: "yellow", eight: "the black" }),
});

function words(match) {
  return WORDS[match.variant] || WORDS.eightball;
}

export function lowestBall(match) {
  return match.balls && match.balls.length ? Math.min(...match.balls) : null;
}

// Six Coins: what is on for the shooter. With no reds left, gold is always on.
export function coinTarget(match) {
  if (match.lastCoin || match.reds.length === 0) return "gold";
  return match.on === "gold" && match.golds.length ? "gold" : "red";
}

export function legalFirstTarget(match, player) {
  if (match.variant === "sixcoins") return coinTarget(match);
  if (match.variant === "nineball") return "lowest";
  const suit = match.assigned[player];
  if (!suit) return "open";
  if (match.remaining[suit].length === 0) return "eight";
  return suit;
}

export function isLegalFirstContact(match, player, ballId) {
  if (ballId == null) return false;
  if (match.variant === "nineball") return Number(ballId) === lowestBall(match);
  if (match.variant === "sixcoins") return isCoin(ballId) === (coinTarget(match) === "gold");
  const target = legalFirstTarget(match, player);
  const kind = ballKind(ballId);
  if (target === "open") return kind !== "eight";
  if (target === "eight") return kind === "eight";
  return kind === target;
}

function describeBall(match, id) {
  const w = words(match);
  const kind = ballKind(id);
  if (kind === "eight") return w.eight;
  return match.variant === "blackball" ? `a ${w[kind]}` : `a ${w[kind]} (${id})`;
}

export function resolveShot(match, shot = {}) {
  if (match.variant === "nineball") return resolveNineBall(match, shot);
  if (match.variant === "sixcoins") return resolveSixCoins(match, shot);
  return resolveEightBall(match, shot);
}

// Six Coins. Six gold coin balls and nine reds; first to four coins wins.
//   - A visit starts on red. Pot a red and gold is on: the next shot must hit
//     a coin first. Pot the coin to bank it, and you are back on red.
//   - A coin only counts when gold was on and the shot was legal. Any other
//     coin that drops is put back on the table.
//   - A foul (scratch, no ball hit, wrong ball first) gives the opponent two
//     shots; the cue ball goes behind the line after a scratch.
//   - With every red gone, gold is always on.
//   - At three coins each, one coin goes back on the spot and decides it.
function resolveSixCoins(match, { pocketed = [], firstContact = null } = {}) {
  const next = JSON.parse(JSON.stringify(match));
  const player = next.turn;
  const other = player === 1 ? 2 : 1;
  const shotsBefore = match.shots ?? 1;
  const target = coinTarget(match);
  const scratched = pocketed.includes("cue");
  const balls = pocketed.filter((id) => id !== "cue");
  const coinsDown = balls.filter((id) => isCoin(id));
  const redsDown = balls.filter((id) => !isCoin(id));

  let foulReason = null;
  if (scratched) foulReason = "scratch";
  else if (firstContact == null) foulReason = "no ball hit";
  else if (isCoin(firstContact) !== (target === "gold")) foulReason = target === "gold" ? "hit a red first, gold was on" : "hit a coin first, red was on";

  next.reds = next.reds.filter((n) => !redsDown.includes(n));
  const earned = !foulReason && target === "gold" ? coinsDown : [];
  const respot = coinsDown.filter((id) => !earned.includes(id));
  next.golds = next.golds.filter((n) => !earned.includes(n));
  next.coins[player] += earned.length;

  const done = (extra) => ({ match: next, winner: null, foulReason, placement: "none", ballInHand: false, shots: next.shots, continueTurn: false, respot, respotEight: false, message: "", ...extra });
  const back = respot.length ? ` ${respot.length > 1 ? "The coins go" : "The coin goes"} back on the table.` : "";

  if (next.coins[player] >= COINS_TO_WIN || (match.lastCoin && earned.length)) {
    next.gameOver = true;
    next.winner = player;
    next.shots = 1;
    return done({ winner: player, respot: [], message: match.lastCoin ? `Player ${player} potted the last coin!` : `Player ${player} banked ${COINS_TO_WIN} coins!` });
  }

  // Level at three each with every coin banked: one goes back to decide it.
  let decider = "";
  if (!next.lastCoin && next.golds.length === 0 && respot.length === 0) {
    next.lastCoin = true;
    next.golds = [earned[earned.length - 1]];
    respot.push(next.golds[0]);
    decider = " Three coins each: the last coin decides it.";
  }

  let message = "";
  let placement = "none";
  let continueTurn = false;
  if (foulReason) {
    next.turn = other;
    next.shots = 2;
    next.on = "red";
    placement = scratched ? "kitchen" : "none";
    message = `Foul: ${foulReason}. Player ${other} has two shots${scratched ? ", cue ball behind the line" : ""}.${back}`;
  } else if (earned.length) {
    continueTurn = true;
    next.shots = shotsBefore;
    next.on = "red";
    const tally = `${next.coins[player]} of ${COINS_TO_WIN}`;
    message = `Player ${player} banks ${earned.length > 1 ? `${earned.length} coins` : "a coin"}: ${tally}.${decider}`;
  } else if (target === "red" && redsDown.length) {
    continueTurn = true;
    next.shots = shotsBefore;
    next.on = "gold";
    message = `Player ${player} pots a red. Gold is on.${back}`;
  } else if (shotsBefore > 1) {
    next.shots = shotsBefore - 1;
    message = `Player ${player} has one shot left.${back}`;
  } else {
    next.turn = other;
    next.shots = 1;
    next.on = "red";
    message = back.trim();
  }
  if (decider && !earned.length) message = `${message}${decider}`.trim();

  return done({ placement, ballInHand: placement !== "none", shots: next.shots, continueTurn, respot, message });
}

// 8-ball and blackball, pub rules: a foul gives the opponent two shots. The
// cue ball stays where it lies unless it was pocketed, when it comes back
// behind the head string. A pot does not use up a shot.
function resolveEightBall(match, { pocketed = [], firstContact = null, isBreak = false } = {}) {
  const next = JSON.parse(JSON.stringify(match));
  const w = words(match);
  const player = next.turn;
  const other = player === 1 ? 2 : 1;
  const shotsBefore = match.shots ?? 1;
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
  else if (!isLegalFirstContact(match, player, firstContact)) foulReason = `hit ${describeBall(match, firstContact)} first`;

  objectBalls.forEach((num) => {
    const kind = ballKind(num);
    next.remaining[kind] = next.remaining[kind].filter((n) => n !== num);
  });

  const done = (extra) => ({ match: next, winner: null, foulReason, placement: "none", ballInHand: false, shots: next.shots, continueTurn: false, respot: [], respotEight: false, message: "", ...extra });

  if (eightPocketed) {
    next.gameOver = true;
    next.shots = 1;
    if (clearedBefore && !foulReason) {
      next.winner = player;
      return done({ winner: player, foulReason: null, message: `Player ${player} cleared the table and sank ${w.eight}!` });
    }
    next.winner = other;
    const why = clearedBefore ? "on a foul" : "early";
    return done({ winner: other, message: `Player ${player} pocketed ${w.eight} ${why}. Player ${other} wins!` });
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
  let placement = "none";
  if (foulReason) {
    next.turn = other;
    next.shots = 2;
    placement = scratched ? "kitchen" : "none";
    message = `Foul: ${foulReason}. Player ${other} has two shots${scratched ? ", cue ball behind the line" : ""}.`;
  } else if (continueTurn) {
    next.shots = shotsBefore;
    message = shotsBefore > 1 ? `Player ${player} pots and still has two shots.` : `Player ${player} pots and stays at the table.`;
  } else if (shotsBefore > 1) {
    next.shots = shotsBefore - 1;
    message = `Player ${player} has one shot left.`;
  } else {
    next.turn = other;
    next.shots = 1;
  }

  if (respotEight) message = `${message ? `${message} ` : ""}${w.eight[0].toUpperCase()}${w.eight.slice(1)} dropped on the break and is respotted.`.trim();

  return done({ placement, ballInHand: placement !== "none", shots: next.shots, continueTurn, respot: respotEight ? [8] : [], respotEight, message });
}

// 9-ball: the cue ball must hit the lowest ball on the table first. Any ball
// potted on a legal shot keeps the shooter at the table, and the 9 going
// down on a legal shot wins at any time. A foul gives ball in hand anywhere.
function resolveNineBall(match, { pocketed = [], firstContact = null } = {}) {
  const next = JSON.parse(JSON.stringify(match));
  const player = next.turn;
  const other = player === 1 ? 2 : 1;
  const lowest = lowestBall(match);
  const scratched = pocketed.includes("cue");
  const objectBalls = pocketed.filter((id) => id !== "cue");

  let foulReason = null;
  if (scratched) foulReason = "scratch";
  else if (firstContact == null) foulReason = "no ball hit";
  else if (Number(firstContact) !== lowest) foulReason = `hit the ${firstContact} first, the ${lowest} was on`;

  next.balls = next.balls.filter((n) => !objectBalls.includes(n));
  next.shots = 1;
  const ninePotted = objectBalls.includes(9);
  const done = (extra) => ({ match: next, winner: null, foulReason, placement: "none", ballInHand: false, shots: 1, continueTurn: false, respot: [], respotEight: false, message: "", ...extra });

  if (ninePotted && !foulReason) {
    next.gameOver = true;
    next.winner = player;
    return done({ winner: player, message: `Player ${player} potted the 9-ball!` });
  }

  const respot = [];
  if (ninePotted) {
    // The 9 down on a foul comes back; the game goes on.
    next.balls = [...next.balls, 9].sort((a, b) => a - b);
    respot.push(9);
  }

  if (foulReason) {
    next.turn = other;
    const back = ninePotted ? " The 9-ball is respotted." : "";
    return done({ placement: "anywhere", ballInHand: true, respot, message: `Foul: ${foulReason}. Player ${other} has ball in hand.${back}` });
  }
  if (objectBalls.length) return done({ continueTurn: true, message: `Player ${player} pots and stays at the table.` });
  next.turn = other;
  return done({});
}
