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
  breakScatter: 0.28,
  maxPullback: 160,
  maxShotSpeed: 32,
  restThreshold: 0.08,
  // Safety net measured in simulated frames (600 = 10 s at 60 fps).
  maxShotWaitFrames: 600,
});

export const INPUT = Object.freeze({
  // A drag shorter than this is treated as a tap and never fires a shot.
  minDrag: 14,
  // Length of the projected cue-ball path when nothing is in the way.
  guideDash: 10,
  cueLength: 180,
});

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
  cue: 0xffffff,
  eight: 0x161616,
  stick: 0xc8956b,
  stickTip: 0x4aa3ff,
  solids: { 1: 0xe4b100, 2: 0x1c5ad1, 3: 0xd42f2f, 4: 0x5a2a86, 5: 0xdd6b18, 6: 0x1f7a3d, 7: 0x7a1f1f },
  stripes: { 9: 0xe4b100, 10: 0x1c5ad1, 11: 0xd42f2f, 12: 0x5a2a86, 13: 0xdd6b18, 14: 0x1f7a3d, 15: 0x7a1f1f },
});

export function ballColor(id) {
  if (id === "cue") return COLORS.cue;
  if (id === 8) return COLORS.eight;
  return id < 8 ? COLORS.solids[id] : COLORS.stripes[id];
}

// Rows of the standard 8-ball rack triangle. The 8-ball sits in the middle
// of the third row; suits otherwise alternate so the rack reads clearly.
export const RACK_ORDER = [
  [1],
  [9, 2],
  [10, 8, 3],
  [11, 4, 12, 5],
  [13, 6, 14, 7, 15],
];
