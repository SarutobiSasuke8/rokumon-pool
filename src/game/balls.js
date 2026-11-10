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

// Blackball: seven plain reds, seven plain yellows and the black.
export const BLACKBALL_RED = 0xd42a2a;
export const BLACKBALL_YELLOW = 0xf2c318;

// Six Coins: six gold coin balls (1-6) and nine deep reds (7-15).
export const COIN_GOLD = 0xe2aa33;
export const COIN_RED = 0xa81c1c;

export function ballIdentity(id, skin = "standard") {
  if (skin === "sixcoins" && id !== "cue") {
    const number = Number(id);
    if (!Number.isInteger(number) || number < 1 || number > 15) throw new RangeError(`Unknown ball: ${id}`);
    const coin = number <= 6;
    return { id: number, kind: coin ? "gold" : "red", number, color: coin ? COIN_GOLD : COIN_RED, striped: false, numbered: false, metallic: coin, emblem: coin ? "coin" : null, label: coin ? "gold coin" : "red" };
  }
  if (skin === "blackball" && id !== "cue" && Number(id) !== 8) {
    const number = Number(id);
    if (!Number.isInteger(number) || number < 1 || number > 15) throw new RangeError(`Unknown ball: ${id}`);
    const red = number < 8;
    return { id: number, kind: red ? "solid" : "stripe", number, color: red ? BLACKBALL_RED : BLACKBALL_YELLOW, striped: false, numbered: false, label: red ? "red" : "yellow" };
  }
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

export function ballTextureKey(id, radius, skin = "standard") {
  return skin === "standard" ? `ball-${id}-r${radius}` : `ball-${skin}-${id}-r${radius}`;
}

// Which look a variant's balls take.
export function skinFor(variant) {
  return variant === "blackball" ? "blackball" : variant === "sixcoins" ? "sixcoins" : "standard";
}

export function toCss(color) {
  return `#${color.toString(16).padStart(6, "0")}`;
}
