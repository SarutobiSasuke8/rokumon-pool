export function createMatchState() {
  return {
    turn: 1,
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

export function snapshotMatch(state) {
  return JSON.parse(JSON.stringify(state));
}
