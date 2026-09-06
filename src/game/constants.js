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
  restitutionBall: 0.8,
  restitutionCushion: 0.7,
  frictionAir: 0.045,
  maxPullback: 160,
  maxShotSpeed: 22,
  restThreshold: 0.08,
  maxShotWaitMs: 6000,
});

export const COLORS = Object.freeze({
  cloth: 0x0e6b3a,
  rail: 0x5b3a22,
  railDark: 0x2c1b10,
  pocket: 0x0b0b0b,
  cue: 0xffffff,
  eight: 0x161616,
  solids: { 1: 0xe4b100, 2: 0x1c5ad1, 3: 0xd42f2f, 4: 0x5a2a86, 5: 0xdd6b18, 6: 0x1f7a3d, 7: 0x7a1f1f },
  stripes: { 9: 0xe4b100, 10: 0x1c5ad1, 11: 0xd42f2f, 12: 0x5a2a86, 13: 0xdd6b18, 14: 0x1f7a3d, 15: 0x7a1f1f },
});

// Rows of the standard 8-ball rack triangle. The 8-ball sits in the middle
// of the third row; suits otherwise alternate so the rack reads clearly.
export const RACK_ORDER = [
  [1],
  [9, 2],
  [10, 8, 3],
  [11, 4, 12, 5],
  [13, 6, 14, 7, 15],
];
