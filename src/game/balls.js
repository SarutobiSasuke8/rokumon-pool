import { ballColor } from "./constants.js";
import { ballKind } from "./state.js";

// What a ball looks like, as data: one place that says which ball is striped,
// which carries a number and which colour it is. The painter in
// src/systems/ballArt.js draws from this, and the tests check it, so the table
// and the HUD can never disagree about which ball is which.

export const BALL_IDS = Object.freeze(["cue", 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);

// Half-height of a stripe's coloured band, as a fraction of the radius. The
// white caps above and below the band are what tell a stripe from a solid.
export const STRIPE_BAND = 0.56;

// Radius of the white number disc, as a fraction of the ball radius.
export const NUMBER_DISC = 0.54;

export function ballIdentity(id) {
  if (id === "cue") {
    return { id, kind: "cue", number: null, color: ballColor("cue"), striped: false, numbered: false, label: "cue ball" };
  }
  const number = Number(id);
  if (!Number.isInteger(number) || number < 1 || number > 15) throw new RangeError(`Unknown ball: ${id}`);
  const kind = ballKind(number);
  return {
    id: number,
    kind,
    number,
    color: ballColor(number),
    striped: kind === "stripe",
    numbered: true,
    label: kind === "eight" ? "8-ball" : `${number} ${kind}`,
  };
}

export function ballTextureKey(id, radius) {
  return `ball-${id}-r${radius}`;
}

export function toCss(color) {
  return `#${color.toString(16).padStart(6, "0")}`;
}
