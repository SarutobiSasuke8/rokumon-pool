export const TABLE = Object.freeze({
  left: 80,
  right: 880,
  top: 80,
  bottom: 460,
  midX: 480,
  midY: 270,
  cushionThickness: 24,
  pocketRadius: 20,
});

export const BALL = Object.freeze({
  radius: 11,
});

export const PHYSICS = Object.freeze({
  restitutionBall: 0.92,
  restitutionCushion: 0.7,
  ballSurfaceFriction: 0.005,
  // Rolling resistance is modelled as a constant per-frame speed loss plus a
  // little drag: a full-power shot travels about two table lengths in three
  // seconds, a soft shot settles in about one. (Pure exponential drag either
  // kills breaks or leaves balls crawling for many seconds.)
  frictionAir: 0.008,
  rollingDecel: 0.06,
  // Gap between racked balls. Touching bodies form one damped cluster in
  // Matter and swallow the break; a small gap keeps the collisions discrete.
  rackGap: 1,
  // Max random offset (px) applied to each racked ball on both axes.
  rackJitter: 0.8,
  // Arcade break: on the break's first contact every racked ball gets a
  // random kick of up to this fraction of the cue ball's impact speed. A
  // physically pure rack sends the wing balls to the corners and leaves the
  // middle standing, which reads as a dud break in a casual game.
  // Measured 2026-11-10 over four full-power breaks each: at 0.28 only two
  // or three balls travelled more than 90 px; at 0.6 six to eight did.
  breakScatter: 0.6,
  maxPullback: 160,
  maxShotSpeed: 32,
  restThreshold: 0.08,
  // Safety net measured in simulated frames (600 = 10 s at 60 fps).
  maxShotWaitFrames: 600,
});

export const INPUT = Object.freeze({
  // A press that moves less than this is a tap: the cue turns to point at it.
  tapSlop: 6,
  // Releasing the power bar below this cancels the shot.
  minPower: 0.05,
  // How far the cue visibly draws back at full power.
  cuePull: 64,
  cueLength: 330,
  // Fine aim, radians: per frame for a held arrow key, per wheel notch unit.
  keyTurn: 0.012,
  keyTurnFine: 0.0025,
  wheelTurn: 0.0007,
});

// Power bar in the left margin. The touch zone is wider than the drawn bar
// and runs over the left rail, so a thumb does not have to be exact.
export const POWER_BAR = Object.freeze({ x: 9, y: 104, w: 22, h: 332, zoneRight: 58 });

// The rectangle where a press aims or places the cue ball: the table and its
// rails, but not the HUD bands or the power bar.
export const PLAY_ZONE = Object.freeze({ left: 58, right: 921, top: 40, bottom: 500 });

// Cue-ball spin. Values are fractions of the cue ball's speed at contact.
//   followDraw: speed added along (follow) or against (draw) the shot line
//               after the first object-ball contact, at full spin
//   side:       speed added along the cushion on a rebound, at full side spin
//   sideKeep:   share of side spin left after each cushion
export const SPIN = Object.freeze({ followDraw: 0.5, side: 0.28, sideKeep: 0.45 });

// Computer opponent strength, chosen on the menu. One table so tuning lives
// in one place.
//   skill:          0..1, scales aim and power error (higher is tighter)
//   weakShotChance: chance of taking a weaker legal pot instead of the best
//   loosePlacement: chance of ball in hand going to a workable spot that is
//                   not the best one found
// Normal is the original single-strength opponent (skill 0.62, best shot,
// best placement) and must stay that way.
export const AI_DIFFICULTY = Object.freeze({
  easy: Object.freeze({ label: "Easy", skill: 0.35, weakShotChance: 0.45, loosePlacement: 0.6 }),
  normal: Object.freeze({ label: "Normal", skill: 0.62, weakShotChance: 0, loosePlacement: 0 }),
  hard: Object.freeze({ label: "Hard", skill: 0.85, weakShotChance: 0, loosePlacement: 0 }),
});
export const DIFFICULTY_ORDER = Object.freeze(["easy", "normal", "hard"]);
export const DEFAULT_DIFFICULTY = "normal";

export function resolveDifficulty(key) {
  return Object.hasOwn(AI_DIFFICULTY, key) ? key : DEFAULT_DIFFICULTY;
}

export const COLORS = Object.freeze({
  cloth: 0x0e6b3a,
  clothEdge: 0x0a5a30,
  rail: 0x5b3a22,
  railDark: 0x2c1b10,
  pocket: 0x0b0b0b,
  cue: 0xf8f6ee,
  eight: 0x111111,
  stick: 0xc8956b,
  stickTip: 0x4aa3ff,
  // Standard pool-ball colours (1 yellow, 2 blue, 3 red, 4 purple, 5 orange,
  // 6 green, 7 maroon; 9-15 repeat them as stripes), tuned so each one stands
  // out from the green cloth. The 6 is a lighter green than a real ball: a
  // true dark green all but vanished into the felt. tests/ball-identity.test.js
  // checks the contrast.
  solids: { 1: 0xf5c518, 2: 0x2563eb, 3: 0xdc2626, 4: 0x7c3aed, 5: 0xf97316, 6: 0x22c55e, 7: 0x8b1e1e },
  stripes: { 9: 0xf5c518, 10: 0x2563eb, 11: 0xdc2626, 12: 0x7c3aed, 13: 0xf97316, 14: 0x22c55e, 15: 0x8b1e1e },
});

export function ballColor(id) {
  if (id === "cue") return COLORS.cue;
  if (id === 8) return COLORS.eight;
  return id < 8 ? COLORS.solids[id] : COLORS.stripes[id];
}

// Rows of the standard 8-ball rack triangle. The 8-ball sits in the middle
// of the third row; suits otherwise alternate so the rack reads clearly.
// 9-ball: a diamond with the 1 at the front and the 9 in the middle.
export const NINE_RACK = [
  [1],
  [2, 3],
  [4, 9, 5],
  [6, 7],
  [8],
];

// Six Coins: the six gold balls (1-6) sit in the heart of the triangle,
// guarded by the nine reds along the front and both edges.
export const SIX_COINS_RACK = [
  [7],
  [8, 9],
  [10, 1, 11],
  [12, 2, 3, 13],
  [14, 4, 5, 6, 15],
];

export function rackFor(variant) {
  if (variant === "nineball") return NINE_RACK;
  if (variant === "sixcoins") return SIX_COINS_RACK;
  return RACK_ORDER;
}

export const RACK_ORDER = [
  [1],
  [9, 2],
  [10, 8, 3],
  [11, 4, 12, 5],
  [13, 6, 14, 7, 15],
];
