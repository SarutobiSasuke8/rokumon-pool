import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { BALL, INPUT, PHYSICS, TABLE, rackFor } from "../src/game/constants.js";
import { resolveShot } from "../src/game/rules.js";
import { createMatchState } from "../src/game/state.js";

// Use the same Matter build as the game, without loading Phaser's browser runtime.
const require = createRequire(import.meta.url);
const matter = join(dirname(require.resolve("phaser/package.json")), "src/physics/matter-js/lib");
const Bodies = require(join(matter, "factory/Bodies.js"));
const Body = require(join(matter, "body/Body.js"));
const Composite = require(join(matter, "body/Composite.js"));
const Engine = require(join(matter, "core/Engine.js"));
const Events = require(join(matter, "core/Events.js"));

const HEAD = TABLE.left + (TABLE.right - TABLE.left) * 0.25;
const FOOT = TABLE.left + (TABLE.right - TABLE.left) * 0.62;
const STEP_MS = 1000 / 240;
const POCKETS = [TABLE.top, TABLE.bottom].flatMap((y) => [TABLE.left, TABLE.midX, TABLE.right].map((x) => ({ x, y })));
const R = BALL.radius;
const quantise = (n) => Math.round(n * 100) / 100;
const point = (id, x, y) => [id, quantise(x), quantise(y)];
const free = (balls, x, y) => balls.every(([id, bx, by]) => id === "cue" || Math.hypot(x - bx, y - by) >= R * 2 + 1);

export class InvalidMove extends Error {}

export function rackOnlineTable() {
  const balls = [point("cue", HEAD, TABLE.midY)];
  const pitch = R * 2 + PHYSICS.rackGap;
  const jitter = () => (Math.random() - 0.5) * PHYSICS.rackJitter * 2;
  rackFor("eightball").forEach((row, col) => {
    row.forEach((id, i) => {
      balls.push(point(id, FOOT + col * pitch * Math.cos(Math.PI / 6) + jitter(),
        TABLE.midY + (i - (row.length - 1) / 2) * pitch + jitter()));
    });
  });
  return { match: createMatchState("eightball"), balls, shots: 0, placement: "none", message: "Host to break." };
}

function createWorld() {
  const engine = Engine.create({ gravity: { x: 0, y: 0, scale: 0 }, positionIterations: 8, velocityIterations: 6 });
  const { left, right, top, bottom, midX, midY, pocketRadius: pr, cushionThickness: t } = TABLE;
  const wall = (x, y, w, h, restitution = PHYSICS.restitutionCushion) =>
    Bodies.rectangle(x, y, w, h, { isStatic: true, restitution, friction: 0.02 });
  const rails = [top - t / 2, bottom + t / 2].flatMap((y) =>
    [[left, midX], [midX, right]].map(([a, b]) => wall((a + b) / 2, y, b - a - pr * 2, t)));
  rails.push(wall(left - t / 2, midY, t, bottom - top - pr * 2), wall(right + t / 2, midY, t, bottom - top - pr * 2));
  const m = t + 12;
  rails.push(wall(midX, top - m - 10, right - left + m * 2, 20, 0.2),
    wall(midX, bottom + m + 10, right - left + m * 2, 20, 0.2),
    wall(left - m - 10, midY, 20, bottom - top + m * 2, 0.2),
    wall(right + m + 10, midY, 20, bottom - top + m * 2, 0.2));
  const pockets = POCKETS.map(({ x, y }) => Bodies.circle(x, y, pr * 0.85, { isStatic: true, isSensor: true }));
  Composite.add(engine.world, [...rails, ...pockets]);
  return { engine, pockets: new Set(pockets) };
}

function respot(balls, id) {
  for (let d = 0; d <= 320; d += R) {
    for (const x of [FOOT - d, FOOT + d]) {
      if (free(balls, x, TABLE.midY)) { balls.push(point(id, x, TABLE.midY)); return; }
    }
  }
  throw new Error("No free spot for the respotted ball.");
}

export function advanceOnlineTable(state, seat, move) {
  if (!state || state.match.gameOver || state.match.turn !== seat) throw new InvalidMove("It is not your turn.");
  if (move.type === "place") {
    const { x, y } = move;
    if (state.placement !== "kitchen" || !Number.isFinite(x) || !Number.isFinite(y)
      || x < TABLE.left + R + 1 || x > HEAD || y < TABLE.top + R + 1 || y > TABLE.bottom - R - 1
      || !free(state.balls, x, y)) throw new InvalidMove("Place the cue ball in a clear spot behind the line.");
    return { state: { ...state, balls: [...state.balls, point("cue", x, y)], placement: "none", message: "Cue ball placed." }, replay: [] };
  }
  if (move.type !== "shot" || state.placement !== "none" || !Number.isFinite(move.angle) || Math.abs(move.angle) > Math.PI
    || !Number.isFinite(move.power) || move.power < INPUT.minPower || move.power > 1) throw new InvalidMove("That shot is unavailable.");
  return simulateShot(state, move);
}

function simulateShot(state, { angle, power }) {
  const { engine, pockets } = createWorld();
  const byBody = new Map();
  let cue;
  for (const [id, x, y] of state.balls) {
    const body = Bodies.circle(x, y, R, {
      restitution: PHYSICS.restitutionBall, friction: PHYSICS.ballSurfaceFriction, frictionAir: PHYSICS.frictionAir,
    });
    byBody.set(body, id);
    if (id === "cue") cue = body;
    Composite.add(engine.world, body);
  }
  if (!cue) throw new InvalidMove("Place the cue ball first.");
  const pocketed = [];
  let firstContact = null;
  let scatter = 0;
  const pocketBall = (body) => {
    if (!byBody.has(body)) return;
    pocketed.push(byBody.get(body));
    byBody.delete(body);
    Composite.remove(engine.world, body);
  };
  Events.on(engine, "collisionStart", ({ pairs }) => {
    for (const { bodyA: a, bodyB: b } of pairs) {
      if (pockets.has(a)) pocketBall(b);
      else if (pockets.has(b)) pocketBall(a);
      else if (firstContact === null && (a === cue || b === cue)) {
        const target = byBody.get(a === cue ? b : a);
        if (typeof target === "number") {
          firstContact = target;
          if (!state.shots) scatter = cue.speed;
        }
      }
    }
  });
  const snapshot = () => [...byBody].map(([body, id]) => point(id, body.position.x, body.position.y));
  const replay = [];
  const speed = power * PHYSICS.maxShotSpeed;
  Body.setVelocity(cue, { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed });
  const margin = TABLE.cushionThickness + 8;
  for (let tick = 0; tick < PHYSICS.maxShotWaitFrames * 4; tick += 1) {
    Engine.update(engine, STEP_MS);
    let moving = false;
    for (const body of byBody.keys()) {
      const { x, y } = body.position;
      if (x < TABLE.left - margin || x > TABLE.right + margin || y < TABLE.top - margin || y > TABLE.bottom + margin) {
        pocketBall(body);
        continue;
      }
      if (scatter && body !== cue) {
        const direction = Math.random() * Math.PI * 2;
        const kick = scatter * PHYSICS.breakScatter * (0.4 + Math.random() * 0.6);
        Body.setVelocity(body, { x: body.velocity.x + Math.cos(direction) * kick, y: body.velocity.y + Math.sin(direction) * kick });
      }
      const v = body.speed;
      const next = Math.max(0, v - PHYSICS.rollingDecel / 4);
      moving ||= next >= PHYSICS.restThreshold;
      const k = v && next >= PHYSICS.restThreshold ? next / v : 0;
      Body.setVelocity(body, { x: body.velocity.x * k, y: body.velocity.y * k });
    }
    scatter = 0;
    if (tick % 12 === 0) replay.push(snapshot());
    if (!moving) break;
  }
  const result = resolveShot(state.match, { pocketed, firstContact, isBreak: state.shots === 0 });
  const balls = snapshot();
  for (const id of result.respot ?? []) respot(balls, id);
  return {
    state: { match: result.match, balls, shots: state.shots + 1, placement: result.placement, message: result.message },
    replay,
  };
}
