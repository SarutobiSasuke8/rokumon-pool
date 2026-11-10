// The games on offer. Blackball is 8-ball with reds and yellows; it shares
// the 8-ball rules and differs in how the balls look and are named.
export const VARIANTS = Object.freeze(["eightball", "nineball", "blackball"]);
export const DEFAULT_VARIANT = "eightball";

export const VARIANT_INFO = Object.freeze({
  eightball: Object.freeze({ label: "8-Ball", short: "8-BALL", blurb: "Pot your seven, then the 8." }),
  nineball: Object.freeze({ label: "9-Ball", short: "9-BALL", blurb: "Hit the lowest ball first. Pot the 9 to win." }),
  blackball: Object.freeze({ label: "Blackball", short: "BLACKBALL", blurb: "Reds and yellows, then the black." }),
});

export function resolveVariant(key) {
  return VARIANTS.includes(key) ? key : DEFAULT_VARIANT;
}

// `shots` is how many shots the player at the table has left this visit: 1
// normally, 2 after the opponent fouls (8-ball and blackball).
export function createMatchState(variant = DEFAULT_VARIANT) {
  const v = resolveVariant(variant);
  if (v === "nineball") {
    return {
      variant: v,
      turn: 1,
      shots: 1,
      assigned: { 1: null, 2: null },
      remaining: { solid: [], stripe: [] },
      balls: [1, 2, 3, 4, 5, 6, 7, 8, 9],
      gameOver: false,
      winner: null,
    };
  }
  return {
    variant: v,
    turn: 1,
    shots: 1,
    assigned: { 1: null, 2: null },
    remaining: {
      solid: [1, 2, 3, 4, 5, 6, 7],
      stripe: [9, 10, 11, 12, 13, 14, 15],
    },
    gameOver: false,
    winner: null,
  };
}

export function ballKind(number) {
  if (number === 8) return "eight";
  return number < 8 ? "solid" : "stripe";
}

// Object balls on the table at the start of a match, and how many of them
// have gone down so far (the hub score).
export function totalObjectBalls(variant) {
  return resolveVariant(variant) === "nineball" ? 9 : 14;
}

export function pottedCount(match) {
  if (match.variant === "nineball") return 9 - match.balls.length;
  return 14 - match.remaining.solid.length - match.remaining.stripe.length;
}

export function snapshotMatch(state) {
  return JSON.parse(JSON.stringify(state));
}
