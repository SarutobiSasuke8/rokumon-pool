import { projectCuePath } from "./aim.js";
import { legalFirstTarget } from "./rules.js";
import { ballKind } from "./state.js";

// Pure computer opponent. Everything is geometry over plain objects so it
// can be exercised from Node or the debug harness.
//
// balls:   [{ id, x, y }] every active ball including "cue"
// pockets: [{ x, y }]
// bounds:  { left, right, top, bottom, midX, midY, pocketRadius }
// radius:  ball radius
// skill:   0..1, higher is more accurate
// weakShotChance, loosePlacement: 0..1, see AI_DIFFICULTY in constants.js
// random:  () => [0, 1), defaults to Math.random; tests pass a seeded one

const MAX_CUT_DEG = 78;
const TWO_PI = Math.PI * 2;

function normalize(x, y) {
  const len = Math.hypot(x, y) || 1;
  return { x: x / len, y: y / len };
}

function gaussian(random) {
  let u = 0;
  let v = 0;
  while (u === 0) u = random();
  while (v === 0) v = random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(TWO_PI * v);
}

export function legalTargetIds(match, player, balls) {
  const target = legalFirstTarget(match, player);
  return balls
    .filter((b) => b.id !== "cue")
    .filter((b) => {
      const kind = ballKind(Number(b.id));
      if (target === "open") return kind !== "eight";
      if (target === "eight") return kind === "eight";
      return kind === target;
    })
    .map((b) => b.id);
}

// Direction a ball must travel to drop cleanly: corners want a diagonal
// approach, side pockets want a steep one.
function pocketInward(pocket, bounds) {
  const isSide = Math.abs(pocket.x - bounds.midX) < 1;
  if (isSide) return { x: 0, y: pocket.y < bounds.midY ? -1 : 1, maxDeg: 48 };
  const dx = pocket.x < bounds.midX ? -1 : 1;
  const dy = pocket.y < bounds.midY ? -1 : 1;
  return { x: dx / Math.SQRT2, y: dy / Math.SQRT2, maxDeg: 58 };
}

// Speed needed at the start of a roll to cover `distance` under the game's
// rolling resistance (fitted to measured travel: v12 ≈ 600 px, v26 ≈ 1800 px).
function speedForDistance(distance) {
  return Math.sqrt(Math.max(0, distance) * 0.25);
}

export function evaluatePot({ cue, target, pocket, balls, bounds, radius }) {
  const dObj = Math.hypot(pocket.x - target.x, pocket.y - target.y);
  if (dObj < 1) return null;
  const objDir = normalize(pocket.x - target.x, pocket.y - target.y);

  const inward = pocketInward(pocket, bounds);
  const approachDeg = (Math.acos(Math.max(-1, Math.min(1, objDir.x * inward.x + objDir.y * inward.y))) * 180) / Math.PI;
  if (approachDeg > inward.maxDeg) return null;

  const ghost = { x: target.x - objDir.x * radius * 2, y: target.y - objDir.y * radius * 2 };
  const dCue = Math.hypot(ghost.x - cue.x, ghost.y - cue.y);
  if (dCue < radius) return null;
  const cueDir = normalize(ghost.x - cue.x, ghost.y - cue.y);

  const cutDeg = (Math.acos(Math.max(-1, Math.min(1, cueDir.x * objDir.x + cueDir.y * objDir.y))) * 180) / Math.PI;
  if (cutDeg > MAX_CUT_DEG) return null;

  const others = balls.filter((b) => b.id !== "cue");
  const cuePath = projectCuePath(cue, cueDir, others, bounds, radius);
  if (!cuePath.hit || String(cuePath.hit.id) !== String(target.id) || Math.abs(cuePath.t - dCue) > radius) return null;

  const objPath = projectCuePath(target, objDir, others.filter((b) => String(b.id) !== String(target.id)), bounds, radius);
  if (objPath.hit && objPath.t < dObj - bounds.pocketRadius) return null;

  const score = (1 - cutDeg / MAX_CUT_DEG) * 0.55 + (1 - Math.min(dCue, 800) / 800) * 0.2 + (1 - Math.min(dObj, 800) / 800) * 0.15 + (1 - approachDeg / inward.maxDeg) * 0.1;

  const vObj = speedForDistance(dObj + 40);
  const vImpact = vObj / Math.max(Math.cos((cutDeg * Math.PI) / 180), 0.35);
  const vStart = Math.sqrt(vImpact * vImpact + 0.25 * dCue) * 1.15;

  return { kind: "pot", targetId: target.id, pocket, angle: Math.atan2(cueDir.y, cueDir.x), speed: vStart, cutDeg, dCue, dObj, score };
}

// Every makeable pot, best first. Ties keep discovery order, so the head of
// the list is the same shot the original best-only search returned.
function allPots({ cue, targets, balls, pockets, bounds, radius }) {
  const pots = [];
  for (const target of targets) {
    for (const pocket of pockets) {
      const shot = evaluatePot({ cue, target, pocket, balls, bounds, radius });
      if (shot) pots.push(shot);
    }
  }
  return pots.sort((a, b) => b.score - a.score);
}

function bestPot(args) {
  return allPots(args)[0] || null;
}

// A weaker option from a best-first list: any entry except the first.
function pickWeaker(list, random) {
  return list[1 + Math.floor(random() * (list.length - 1))];
}

function safetyShot({ cue, targets, balls, bounds, radius }) {
  const others = balls.filter((b) => b.id !== "cue");
  let best = null;
  for (const target of targets) {
    const dir = normalize(target.x - cue.x, target.y - cue.y);
    const path = projectCuePath(cue, dir, others, bounds, radius);
    const direct = path.hit && String(path.hit.id) === String(target.id);
    const dist = Math.hypot(target.x - cue.x, target.y - cue.y);
    const score = (direct ? 1 : 0) - dist / 2000;
    if (!best || score > best.score) {
      best = { kind: "safety", targetId: target.id, angle: Math.atan2(dir.y, dir.x), speed: speedForDistance(dist) * 0.9 + 2, score, direct };
    }
  }
  return best;
}

// Returns { angle, power, kind, targetId, ... } or null if there is nothing to hit.
export function planShot({ match, player, balls, pockets, bounds, radius, maxShotSpeed, skill = 0.6, weakShotChance = 0, random = Math.random }) {
  const cue = balls.find((b) => b.id === "cue");
  if (!cue) return null;
  const ids = new Set(legalTargetIds(match, player, balls));
  const targets = balls.filter((b) => ids.has(b.id));
  if (!targets.length) return null;

  const pots = allPots({ cue, targets, balls, pockets, bounds, radius });
  let shot = pots[0] || null;
  if (pots.length > 1 && weakShotChance > 0 && random() < weakShotChance) shot = pickWeaker(pots, random);
  if (!shot) shot = safetyShot({ cue, targets, balls, bounds, radius });
  if (!shot) return null;

  const angleError = gaussian(random) * (1 - skill) * 0.045;
  const powerError = 1 + gaussian(random) * (1 - skill) * 0.12;
  const power = Math.max(0.12, Math.min(1, (shot.speed / maxShotSpeed) * powerError));
  return { ...shot, angle: shot.angle + angleError, power };
}

// Ball in hand: pick the spot with the best available pot. Falls back to the
// free spot nearest the head spot. With loosePlacement the computer sometimes
// settles for another spot that still has a pot, just not the best one.
export function planPlacement({ match, player, balls, pockets, bounds, radius, headSpot, loosePlacement = 0, random = Math.random }) {
  const others = balls.filter((b) => b.id !== "cue");
  const ids = new Set(legalTargetIds(match, player, balls));
  const targets = others.filter((b) => ids.has(b.id));
  const free = (x, y) => others.every((b) => Math.hypot(b.x - x, b.y - y) >= radius * 2 + 2)
    && pockets.every((p) => Math.hypot(p.x - x, p.y - y) >= bounds.pocketRadius + radius + 4);

  const spots = [];
  let fallback = null;
  const stepX = (bounds.right - bounds.left) / 16;
  const stepY = (bounds.bottom - bounds.top) / 8;
  for (let gx = 1; gx < 16; gx += 1) {
    for (let gy = 1; gy < 8; gy += 1) {
      const x = bounds.left + gx * stepX;
      const y = bounds.top + gy * stepY;
      if (!free(x, y)) continue;
      const dHead = Math.hypot(x - headSpot.x, y - headSpot.y);
      if (!fallback || dHead < fallback.dHead) fallback = { x, y, dHead };
      const cue = { id: "cue", x, y };
      const shot = bestPot({ cue, targets, balls: [cue, ...others], pockets, bounds, radius });
      if (shot) spots.push({ x, y, score: shot.score });
    }
  }
  spots.sort((a, b) => b.score - a.score);
  if (spots.length > 1 && loosePlacement > 0 && random() < loosePlacement) {
    // "Workable" means the top half of the spots with a pot, so Easy still
    // leaves itself something sensible rather than a random corner.
    const workable = spots.slice(0, Math.max(2, Math.ceil(spots.length / 2)));
    const pick = pickWeaker(workable, random);
    return { x: pick.x, y: pick.y, score: pick.score };
  }
  return spots[0] || fallback || { x: headSpot.x, y: headSpot.y };
}
