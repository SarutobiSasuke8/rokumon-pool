import Phaser from "phaser";
import { TABLE, BALL, PHYSICS, INPUT, COLORS, RACK_ORDER, AI_DIFFICULTY, resolveDifficulty } from "../game/constants.js";
import { createMatchState, snapshotMatch } from "../game/state.js";
import { resolveShot, isLegalFirstContact } from "../game/rules.js";
import { withNames as formatNames } from "../game/labels.js";
import { projectCuePath } from "../game/aim.js";
import { ballTextureKey } from "../game/balls.js";
import { ART_SCALE, ensureBallTextures, shadowTextureKey } from "../systems/ballArt.js";
import { planShot, planPlacement } from "../game/ai.js";
import { createRestartKey } from "../systems/input.js";
import { installDebug } from "../systems/debug.js";
import { audio } from "../systems/audio.js";
import { hub } from "../integrations/hub.js";

const { Sleeping } = Phaser.Physics.Matter.Matter;

export const PHASE = Object.freeze({
  AIM: "aim",           // waiting for the player to drag and release
  SHOOTING: "shooting", // balls in motion, waiting for rest
  PLACING: "placing",   // ball in hand: player positions the cue ball
  OVER: "over",
});

const CUE_START = Object.freeze({ x: TABLE.left + (TABLE.right - TABLE.left) * 0.25, y: TABLE.midY });

// Strength (skill, shot choice, placement) comes from AI_DIFFICULTY.
const AI = Object.freeze({ player: 2, thinkMs: 800, previewMs: 700 });

export class GameScene extends Phaser.Scene {
  constructor() { super("Game"); }

  init(data) {
    this.mode = data?.mode === "ai" ? "ai" : "pvp";
    this.difficulty = resolveDifficulty(data?.difficulty);
    this.names = this.mode === "ai" ? { 1: "You", 2: "Computer" } : { 1: "Player 1", 2: "Player 2" };
  }

  create() {
    this.match = createMatchState();
    this.aiPending = false;
    this.aiPreview = null;
    this.shotIndex = 0;
    this.currentShotIsBreak = false;
    this.balls = new Map();
    this.pocketedThisTurn = [];
    // Every object ball pocketed this match, in order, for the HUD tray.
    this.pocketedOrder = [];
    this.firstContact = null;
    this.phase = PHASE.AIM;
    this.isDragging = false;
    this.dragStart = null;
    this.dragCurrent = null;
    this.placementValid = false;
    this.shotFrames = 0;
    this.isBreak = true;

    this.drawTable();
    this.createCushions();
    this.createPockets();
    ensureBallTextures(this, BALL.radius);
    this.createBalls();

    this.aimGfx = this.add.graphics().setDepth(5);
    this.placeGfx = this.add.graphics().setDepth(6);
    this.setupInput();

    this.restartKey = createRestartKey(this);
    this.matter.world.on("collisionstart", (event) => this.handleCollisions(event));

    this.scene.launch("UI");
    hub.ready();
    hub.score(0);
    this.hubStartedAt = performance.now();
    this.updateHud(`${this.names[1]} break${this.mode === "ai" ? "" : "s"}. Drag anywhere on the table to aim, release to shoot.`);
    installDebug(this, () => snapshotMatch(this.match));
  }

  isAiTurn() {
    return this.mode === "ai" && this.match.turn === AI.player && !this.match.gameOver;
  }

  // Player-facing text. The rules module speaks in "Player N"; the scene
  // swaps in the mode's names ("You", "Computer").
  withNames(text) {
    return formatNames(text, this.names);
  }

  aiContext() {
    return {
      match: this.match,
      player: AI.player,
      balls: [...this.balls.values()].filter((e) => e.active).map((e) => ({ id: e.id, x: e.body.position.x, y: e.body.position.y })),
      pockets: this.pocketPositions(),
      bounds: TABLE,
      radius: BALL.radius,
      maxShotSpeed: PHYSICS.maxShotSpeed,
      ...this.aiTuning(),
      headSpot: CUE_START,
    };
  }

  aiTuning() {
    const { skill, weakShotChance, loosePlacement } = AI_DIFFICULTY[this.difficulty];
    return { skill, weakShotChance, loosePlacement };
  }

  // Data that restarts this match in the same mode and difficulty.
  restartData() {
    return this.mode === "ai" ? { mode: this.mode, difficulty: this.difficulty } : { mode: this.mode };
  }

  // Called from update() while it is the computer's turn. Placement is
  // immediate; the shot is shown as an aim preview for a moment, then taken.
  aiAct() {
    if (this.aiPending) return;
    if (this.phase === PHASE.PLACING) {
      const spot = planPlacement(this.aiContext());
      this.moveCueForPlacement(spot.x, spot.y);
      if (this.placementValid) this.confirmPlacement();
      return;
    }
    if (this.phase !== PHASE.AIM) return;
    this.aiPending = true;
    this.updateHud(`${this.names[AI.player]} is lining up a shot.`);
    this.time.delayedCall(AI.thinkMs, () => {
      if (this.phase !== PHASE.AIM || !this.isAiTurn()) { this.aiPending = false; return; }
      const plan = planShot(this.aiContext());
      if (!plan) { this.aiPending = false; return; }
      this.aiPreview = { angle: plan.angle, power: plan.power, dist: plan.power * PHYSICS.maxPullback, raw: 999, cancelled: false };
      this.time.delayedCall(AI.previewMs, () => {
        this.aiPreview = null;
        this.aiPending = false;
        if (this.phase === PHASE.AIM && this.isAiTurn()) this.takeShot(plan.angle, plan.power);
      });
    });
  }

  // Drop a half-finished aim when the match pauses: the release may never
  // arrive, and a stale drag would block the next one.
  cancelDrag() {
    this.isDragging = false;
    this.dragStart = null;
    this.dragCurrent = null;
  }

  // Kept for the debug harness and older callers.
  get waitingForRest() { return this.phase === PHASE.SHOOTING; }

  update() {
    this.balls.forEach((entry) => {
      if (!entry.active) return;
      entry.view.setPosition(entry.body.position.x, entry.body.position.y);
      entry.shadow.setPosition(entry.body.position.x + BALL.radius * 0.22, entry.body.position.y + BALL.radius * 0.3);
    });

    if (this.restartKey.restartPressed()) {
      this.scene.restart(this.restartData());
      return;
    }

    if (this.isAiTurn() && (this.phase === PHASE.AIM || this.phase === PHASE.PLACING)) this.aiAct();

    if (this.phase === PHASE.SHOOTING) {
      this.applyRollingResistance();
      // Count simulated frames, not wall-clock time: a throttled or hidden
      // tab must not force-stop a shot that has barely been simulated.
      this.shotFrames += 1;
      const timedOut = this.shotFrames > PHYSICS.maxShotWaitFrames;
      if (timedOut || this.allAtRest()) {
        if (timedOut) this.forceStop();
        this.finishShot();
      }
    }

    this.drawAim();
    this.drawPlacement();
  }

  // ---- table construction ----------------------------------------------

  pocketPositions() {
    return [
      { x: TABLE.left, y: TABLE.top },
      { x: TABLE.midX, y: TABLE.top },
      { x: TABLE.right, y: TABLE.top },
      { x: TABLE.left, y: TABLE.bottom },
      { x: TABLE.midX, y: TABLE.bottom },
      { x: TABLE.right, y: TABLE.bottom },
    ];
  }

  drawTable() {
    const g = this.add.graphics();
    const t = TABLE.cushionThickness;
    const w = TABLE.right - TABLE.left;
    const h = TABLE.bottom - TABLE.top;
    g.fillStyle(COLORS.railDark, 1);
    g.fillRoundedRect(TABLE.left - t - 16, TABLE.top - t - 16, w + (t + 16) * 2, h + (t + 16) * 2, 18);
    g.fillStyle(COLORS.rail, 1);
    g.fillRect(TABLE.left - t, TABLE.top - t, w + t * 2, h + t * 2);
    g.fillStyle(COLORS.clothEdge, 1);
    g.fillRect(TABLE.left, TABLE.top, w, h);
    g.fillStyle(COLORS.cloth, 1);
    g.fillRect(TABLE.left + 6, TABLE.top + 6, w - 12, h - 12);

    // Head string marker so ball-in-hand placement has a visual anchor.
    g.lineStyle(1, 0xffffff, 0.12);
    g.lineBetween(CUE_START.x, TABLE.top + 6, CUE_START.x, TABLE.bottom - 6);
    g.fillStyle(0xffffff, 0.18);
    g.fillCircle(CUE_START.x, CUE_START.y, 3);
    g.fillCircle(TABLE.left + w * 0.62, CUE_START.y, 3);

    // Rail diamonds.
    g.fillStyle(0xe8d9b5, 0.7);
    for (let i = 1; i < 8; i += 1) {
      if (i === 4) continue;
      const x = TABLE.left + (w * i) / 8;
      g.fillCircle(x, TABLE.top - t / 2, 2.5);
      g.fillCircle(x, TABLE.bottom + t / 2, 2.5);
    }
    for (let i = 1; i < 4; i += 1) {
      const y = TABLE.top + (h * i) / 4;
      g.fillCircle(TABLE.left - t / 2, y, 2.5);
      g.fillCircle(TABLE.right + t / 2, y, 2.5);
    }

    this.pocketPositions().forEach((p) => {
      g.fillStyle(0x1a1a1a, 1);
      g.fillCircle(p.x, p.y, TABLE.pocketRadius + 3);
      g.fillStyle(COLORS.pocket, 1);
      g.fillCircle(p.x, p.y, TABLE.pocketRadius);
    });
  }

  createCushions() {
    const t = TABLE.cushionThickness;
    const pr = TABLE.pocketRadius;
    const segs = [
      { x: (TABLE.left + pr + TABLE.midX - pr) / 2, y: TABLE.top - t / 2, w: (TABLE.midX - pr) - (TABLE.left + pr), h: t },
      { x: (TABLE.midX + pr + TABLE.right - pr) / 2, y: TABLE.top - t / 2, w: (TABLE.right - pr) - (TABLE.midX + pr), h: t },
      { x: (TABLE.left + pr + TABLE.midX - pr) / 2, y: TABLE.bottom + t / 2, w: (TABLE.midX - pr) - (TABLE.left + pr), h: t },
      { x: (TABLE.midX + pr + TABLE.right - pr) / 2, y: TABLE.bottom + t / 2, w: (TABLE.right - pr) - (TABLE.midX + pr), h: t },
      { x: TABLE.left - t / 2, y: (TABLE.top + pr + TABLE.bottom - pr) / 2, w: t, h: (TABLE.bottom - pr) - (TABLE.top + pr) },
      { x: TABLE.right + t / 2, y: (TABLE.top + pr + TABLE.bottom - pr) / 2, w: t, h: (TABLE.bottom - pr) - (TABLE.top + pr) },
    ];
    segs.forEach((s) => {
      const body = this.matter.bodies.rectangle(s.x, s.y, s.w, s.h, { isStatic: true, restitution: PHYSICS.restitutionCushion, friction: 0.02, label: "cushion" });
      this.matter.world.add(body);
    });

    // Outer frame behind the pocket gaps: anything that slips past a pocket
    // sensor still cannot leave the table.
    const m = t + 12;
    const outer = [
      { x: TABLE.midX, y: TABLE.top - m - 10, w: (TABLE.right - TABLE.left) + m * 2, h: 20 },
      { x: TABLE.midX, y: TABLE.bottom + m + 10, w: (TABLE.right - TABLE.left) + m * 2, h: 20 },
      { x: TABLE.left - m - 10, y: TABLE.midY, w: 20, h: (TABLE.bottom - TABLE.top) + m * 2 },
      { x: TABLE.right + m + 10, y: TABLE.midY, w: 20, h: (TABLE.bottom - TABLE.top) + m * 2 },
    ];
    outer.forEach((s) => {
      this.matter.world.add(this.matter.bodies.rectangle(s.x, s.y, s.w, s.h, { isStatic: true, restitution: 0.2, label: "frame" }));
    });
  }

  createPockets() {
    this.pocketPositions().forEach((p) => {
      const body = this.matter.bodies.circle(p.x, p.y, TABLE.pocketRadius * 0.85, { isStatic: true, isSensor: true, label: "pocket" });
      this.matter.world.add(body);
    });
  }

  createBalls() {
    const r = BALL.radius;
    this.addBall("cue", CUE_START.x, CUE_START.y);

    const apexX = TABLE.left + (TABLE.right - TABLE.left) * 0.62;
    const pitch = r * 2 + PHYSICS.rackGap;
    const rowDX = pitch * Math.cos(Math.PI / 6);
    // A perfectly aligned rack behaves like a Newton's cradle: the impulse
    // runs straight through and only the back-corner balls fly. A sub-pixel
    // jitter, as in any real rack, scatters the wave across the whole pack.
    const jitter = () => (Math.random() - 0.5) * PHYSICS.rackJitter * 2;
    RACK_ORDER.forEach((row, rowIndex) => {
      const x = apexX + rowIndex * rowDX;
      row.forEach((num, i) => {
        const y = TABLE.midY + (i - rowIndex / 2) * pitch;
        this.addBall(num, x + jitter(), y + jitter());
      });
    });
  }

  addBall(id, x, y) {
    const r = BALL.radius;
    const body = this.matter.bodies.circle(x, y, r, {
      restitution: PHYSICS.restitutionBall,
      friction: PHYSICS.ballSurfaceFriction,
      frictionAir: PHYSICS.frictionAir,
      label: `ball:${id}`,
    });
    this.matter.world.add(body);

    // Painted textures (src/systems/ballArt.js): numbers on every object
    // ball, white caps on the stripes, a dark rim against the cloth.
    const shadow = this.add.image(x + r * 0.22, y + r * 0.3, shadowTextureKey(r)).setScale(1 / ART_SCALE).setDepth(1.5);
    const view = this.add.image(x, y, ballTextureKey(id, r)).setScale(1 / ART_SCALE).setDepth(2);
    this.balls.set(String(id), { id, body, view, shadow, active: true });
    return this.balls.get(String(id));
  }

  activeTargets(excludeId = "cue") {
    const out = [];
    this.balls.forEach((entry, key) => {
      if (!entry.active || key === excludeId) return;
      out.push({ id: entry.id, x: entry.body.position.x, y: entry.body.position.y });
    });
    return out;
  }

  // ---- input / aiming -----------------------------------------------------

  setupInput() {
    this.input.on("pointerdown", (p) => {
      audio.unlock();
      if (this.isAiTurn()) return;
      if (this.phase === PHASE.PLACING) {
        this.moveCueForPlacement(p.worldX, p.worldY);
        return;
      }
      if (this.phase !== PHASE.AIM || this.isDragging) return;
      this.isDragging = true;
      this.dragStart = { x: p.worldX, y: p.worldY };
      this.dragCurrent = { x: p.worldX, y: p.worldY };
    });

    this.input.on("pointermove", (p) => {
      if (this.isAiTurn()) return;
      if (this.phase === PHASE.PLACING) {
        this.moveCueForPlacement(p.worldX, p.worldY);
        return;
      }
      if (!this.isDragging) return;
      this.dragCurrent = { x: p.worldX, y: p.worldY };
    });

    const release = (p) => {
      if (this.isAiTurn()) { this.isDragging = false; return; }
      if (this.phase === PHASE.PLACING) {
        this.moveCueForPlacement(p.worldX, p.worldY);
        if (this.placementValid) this.confirmPlacement();
        return;
      }
      if (!this.isDragging) return;
      this.isDragging = false;
      this.dragCurrent = { x: p.worldX, y: p.worldY };
      const shot = this.shotFromDrag();
      this.dragStart = null;
      if (shot && !shot.cancelled) this.takeShot(shot.angle, shot.power);
    };
    this.input.on("pointerup", release);
    this.input.on("pointerupoutside", release);
  }

  // The shot is the vector from where the drag is now back to where it
  // started: pull back and release, like drawing a catapult. It does not
  // matter where on the table the drag happens, so a finger never has to
  // cover the cue ball, and a plain tap (below minDrag) never fires.
  shotFromDrag() {
    if (!this.dragStart || !this.dragCurrent) return null;
    const dx = this.dragStart.x - this.dragCurrent.x;
    const dy = this.dragStart.y - this.dragCurrent.y;
    const raw = Math.hypot(dx, dy);
    const dist = Math.min(raw, PHYSICS.maxPullback);
    const angle = Math.atan2(dy, dx);
    const power = dist / PHYSICS.maxPullback;
    return { angle, power, raw, dist, cancelled: raw < INPUT.minDrag };
  }

  takeShot(angle, power) {
    const cue = this.balls.get("cue");
    if (!cue || !cue.active || this.phase !== PHASE.AIM) return;
    const speed = Phaser.Math.Clamp(power, 0, 1) * PHYSICS.maxShotSpeed;
    this.launchCue(cue, angle, speed);
    audio.strike(power);
  }

  launchCue(cue, angle, speed) {
    // Matter never wakes a body just because its velocity changed, so a cue
    // ball that fell asleep between turns would otherwise ignore the shot.
    Sleeping.set(cue.body, false);
    this.matter.body.setVelocity(cue.body, { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed });
    this.beginShot();
  }

  // Matter's resolver skips impulses on sleeping bodies and only wakes one
  // body per contact pair per step, so a cue ball hitting a sleeping rack
  // loses most of its energy one layer at a time. Wake everything before the
  // shot so the whole rack responds in the same step.
  wakeAll() {
    this.balls.forEach((entry) => {
      if (entry.active && entry.body.isSleeping) Sleeping.set(entry.body, false);
    });
  }

  beginShot() {
    this.wakeAll();
    this.pocketedThisTurn = [];
    this.firstContact = null;
    this.phase = PHASE.SHOOTING;
    this.shotFrames = 0;
    this.currentShotIsBreak = this.shotIndex === 0;
    this.shotIndex += 1;
    this.aimGfx.clear();
    this.updateHud("");
  }

  debugTeleportToPocket(id, pocketIndex = 0) {
    const entry = this.balls.get(String(id));
    if (!entry || !entry.active) return;
    const p = this.pocketPositions()[pocketIndex];
    Sleeping.set(entry.body, false);
    this.matter.body.setPosition(entry.body, { x: p.x, y: p.y });
    this.matter.body.setVelocity(entry.body, { x: 0, y: 0 });
    if (this.phase !== PHASE.SHOOTING) this.beginShot();
  }

  debugShoot(angleDeg, power = 1) {
    const cue = this.balls.get("cue");
    if (!cue || !cue.active) return;
    if (this.phase === PHASE.PLACING) this.confirmPlacement();
    const angle = Phaser.Math.DegToRad(angleDeg);
    this.launchCue(cue, angle, Phaser.Math.Clamp(power, 0, 1) * PHYSICS.maxShotSpeed);
  }

  drawAim() {
    this.aimGfx.clear();
    if (this.phase !== PHASE.AIM) return;
    const shot = this.aiPreview || (this.isDragging ? this.shotFromDrag() : null);
    if (!shot || shot.raw < 3) return;
    const cue = this.balls.get("cue");
    if (!cue || !cue.active) return;

    const cx = cue.body.position.x;
    const cy = cue.body.position.y;
    const dir = { x: Math.cos(shot.angle), y: Math.sin(shot.angle) };
    const r = BALL.radius;
    const alpha = shot.cancelled ? 0.25 : 1;

    // Projected cue-ball path to the first object ball or cushion: a solid
    // white line on a dark underlay so it reads on the cloth at phone size.
    const g = this.aimGfx;
    const path = projectCuePath({ x: cx, y: cy }, dir, this.activeTargets(), TABLE, r);
    const sx = cx + dir.x * r;
    const sy = cy + dir.y * r;
    if (path.t > r) {
      g.lineStyle(5, 0x000000, 0.35 * alpha);
      g.lineBetween(sx, sy, path.end.x, path.end.y);
      g.lineStyle(2, 0xffffff, 0.9 * alpha);
      g.lineBetween(sx, sy, path.end.x, path.end.y);
    }
    // Ghost ball where the cue ball will be at contact.
    g.fillStyle(0xffffff, 0.18 * alpha);
    g.fillCircle(path.end.x, path.end.y, r);
    g.lineStyle(2, 0xffffff, 0.9 * alpha);
    g.strokeCircle(path.end.x, path.end.y, r);
    if (path.hit) {
      // The target ring and the object ball's path are green when the ball
      // is a legal first contact for the shooter, red when it would foul.
      const legal = isLegalFirstContact(this.match, this.match.turn, Number(path.hit.id));
      const tint = legal ? 0x4ade80 : 0xf87171;
      const c = path.hit.center;
      const len = 90;
      const tx = c.x + path.hit.dir.x * len;
      const ty = c.y + path.hit.dir.y * len;
      g.lineStyle(3, tint, 0.95 * alpha);
      g.strokeCircle(c.x, c.y, r + 3);
      g.lineStyle(5, 0x000000, 0.35 * alpha);
      g.lineBetween(c.x + path.hit.dir.x * (r + 3), c.y + path.hit.dir.y * (r + 3), tx, ty);
      g.lineStyle(3, tint, 0.95 * alpha);
      g.lineBetween(c.x + path.hit.dir.x * (r + 3), c.y + path.hit.dir.y * (r + 3), tx, ty);
      const nx = -path.hit.dir.y;
      const ny = path.hit.dir.x;
      g.fillStyle(tint, 0.95 * alpha);
      g.fillTriangle(
        tx + path.hit.dir.x * 9, ty + path.hit.dir.y * 9,
        tx + nx * 6, ty + ny * 6,
        tx - nx * 6, ty - ny * 6,
      );
    }

    // Cue stick, pulled back with the drag.
    const gap = r + 6 + shot.dist * 0.6;
    const bx = cx - dir.x * gap;
    const by = cy - dir.y * gap;
    const ex = bx - dir.x * INPUT.cueLength;
    const ey = by - dir.y * INPUT.cueLength;
    g.lineStyle(7, 0x2b1a0e, 0.9 * alpha);
    g.lineBetween(bx, by, ex, ey);
    g.lineStyle(5, COLORS.stick, 1 * alpha);
    g.lineBetween(bx - dir.x * 8, by - dir.y * 8, ex, ey);
    g.lineStyle(5, COLORS.stickTip, 1 * alpha);
    g.lineBetween(bx, by, bx - dir.x * 8, by - dir.y * 8);

    // Power meter in the left margin, filling upwards, so it never sits on
    // the HUD text under the table.
    const meter = { x: 12, y: 110, w: 14, h: 320 };
    const fill = Math.max(4, meter.h * shot.power);
    const col = Phaser.Display.Color.GetColor(80 + shot.power * 175, 210 - shot.power * 130, 255 - shot.power * 175);
    g.fillStyle(0x000000, 0.55 * alpha);
    g.fillRoundedRect(meter.x - 2, meter.y - 2, meter.w + 4, meter.h + 4, 5);
    g.fillStyle(col, 1 * alpha);
    g.fillRoundedRect(meter.x, meter.y + meter.h - fill, meter.w, fill, 4);
  }

  // ---- ball in hand ---------------------------------------------------------

  beginPlacement() {
    let cue = this.balls.get("cue");
    if (!cue || !cue.active) {
      if (cue) this.balls.delete("cue");
      cue = this.addBall("cue", CUE_START.x, CUE_START.y);
    }
    // Lift the cue ball out of the simulation while it is being positioned so
    // it cannot shove other balls around.
    this.matter.world.remove(cue.body);
    cue.view.setAlpha(0.75);
    cue.shadow.setAlpha(0.4);
    this.phase = PHASE.PLACING;
    this.isDragging = false;
    this.moveCueForPlacement(cue.body.position.x, cue.body.position.y);
  }

  moveCueForPlacement(x, y) {
    if (this.phase !== PHASE.PLACING) return;
    const cue = this.balls.get("cue");
    if (!cue) return;
    const r = BALL.radius;
    const px = Phaser.Math.Clamp(x, TABLE.left + r + 1, TABLE.right - r - 1);
    const py = Phaser.Math.Clamp(y, TABLE.top + r + 1, TABLE.bottom - r - 1);
    this.matter.body.setPosition(cue.body, { x: px, y: py });
    this.matter.body.setVelocity(cue.body, { x: 0, y: 0 });
    cue.view.setPosition(px, py);
    cue.shadow.setPosition(px + r * 0.22, py + r * 0.3);
    const minGap = r * 2 + 1;
    this.placementValid = this.activeTargets().every((t) => Math.hypot(t.x - px, t.y - py) >= minGap)
      && this.pocketPositions().every((p) => Math.hypot(p.x - px, p.y - py) >= TABLE.pocketRadius + r);
  }

  confirmPlacement() {
    const cue = this.balls.get("cue");
    if (!cue || this.phase !== PHASE.PLACING) return;
    this.matter.world.add(cue.body);
    Sleeping.set(cue.body, false);
    this.matter.body.setVelocity(cue.body, { x: 0, y: 0 });
    cue.view.setAlpha(1);
    cue.shadow.setAlpha(1);
    this.placeGfx.clear();
    this.phase = PHASE.AIM;
    this.updateHud("");
  }

  drawPlacement() {
    this.placeGfx.clear();
    if (this.phase !== PHASE.PLACING) return;
    const cue = this.balls.get("cue");
    if (!cue) return;
    const { x, y } = cue.body.position;
    const pulse = 0.5 + 0.5 * Math.sin(this.time.now / 180);
    this.placeGfx.lineStyle(2, this.placementValid ? 0x4ade80 : 0xf87171, 0.6 + pulse * 0.4);
    this.placeGfx.strokeCircle(x, y, BALL.radius + 5 + pulse * 2);
  }

  // ---- physics / rules -----------------------------------------------------

  // Arcade break: give every racked ball a random kick proportional to the
  // cue ball's impact speed so the pack opens up instead of only the wing
  // balls leaving along the rack's straight edges.
  scatterRack(cueBody) {
    this.isBreak = false;
    const impact = cueBody.speed;
    this.balls.forEach((entry) => {
      if (!entry.active || entry.id === "cue") return;
      const angle = Math.random() * Math.PI * 2;
      const kick = impact * PHYSICS.breakScatter * (0.4 + Math.random() * 0.6);
      Sleeping.set(entry.body, false);
      this.matter.body.setVelocity(entry.body, {
        x: entry.body.velocity.x + Math.cos(angle) * kick,
        y: entry.body.velocity.y + Math.sin(angle) * kick,
      });
    });
  }

  // Constant per-frame speed loss on top of Matter's exponential air drag,
  // which is how rolling balls actually slow down on cloth.
  applyRollingResistance() {
    this.balls.forEach((entry) => {
      if (!entry.active || entry.body.isSleeping) return;
      const speed = entry.body.speed;
      if (speed <= 0) return;
      const next = Math.max(0, speed - PHYSICS.rollingDecel);
      const k = next / speed;
      this.matter.body.setVelocity(entry.body, { x: entry.body.velocity.x * k, y: entry.body.velocity.y * k });
    });
  }

  forceStop() {
    this.balls.forEach((entry) => {
      if (entry.active) this.matter.body.setVelocity(entry.body, { x: 0, y: 0 });
    });
  }

  allAtRest() {
    let rest = true;
    this.balls.forEach((entry) => {
      if (!entry.active) return;
      if (this.isOffTable(entry)) {
        this.pocketBall(entry);
        return;
      }
      if (entry.body.isSleeping || entry.body.speed < PHYSICS.restThreshold) {
        this.matter.body.setVelocity(entry.body, { x: 0, y: 0 });
      } else {
        rest = false;
      }
    });
    return rest;
  }

  isOffTable(entry) {
    const { x, y } = entry.body.position;
    const m = TABLE.cushionThickness + 8;
    return x < TABLE.left - m || x > TABLE.right + m || y < TABLE.top - m || y > TABLE.bottom + m;
  }

  pocketBall(entry) {
    if (!entry.active) return;
    if (this.phase !== PHASE.SHOOTING) this.beginShot();
    entry.active = false;
    this.matter.world.remove(entry.body);
    entry.view.destroy();
    entry.shadow.destroy();
    this.pocketedThisTurn.push(entry.id);
    if (entry.id !== "cue") this.pocketedOrder.push(entry.id);
    audio.pocket();
  }

  handleCollisions(event) {
    event.pairs.forEach((pair) => {
      const a = pair.bodyA;
      const b = pair.bodyB;
      const aBall = typeof a.label === "string" && a.label.startsWith("ball:");
      const bBall = typeof b.label === "string" && b.label.startsWith("ball:");
      if (!aBall && !bBall) return;

      const pocketBody = a.label === "pocket" ? a : (b.label === "pocket" ? b : null);
      if (pocketBody) {
        const other = pocketBody === a ? b : a;
        const entry = this.balls.get(other.label.slice(5));
        if (entry && entry.active) this.pocketBall(entry);
        return;
      }

      if (aBall && bBall) {
        const idA = a.label.slice(5);
        const idB = b.label.slice(5);
        if (this.firstContact == null && this.phase === PHASE.SHOOTING && (idA === "cue" || idB === "cue")) {
          const other = idA === "cue" ? idB : idA;
          if (other !== "cue") {
            this.firstContact = Number(other);
            if (this.isBreak) this.scatterRack(idA === "cue" ? a : b);
          }
        }
        const rvx = a.velocity.x - b.velocity.x;
        const rvy = a.velocity.y - b.velocity.y;
        const n = pair.collision && pair.collision.normal ? pair.collision.normal : null;
        const impact = n ? Math.abs(rvx * n.x + rvy * n.y) : Math.hypot(rvx, rvy);
        audio.click(impact / PHYSICS.maxShotSpeed);
        return;
      }

      const wall = aBall ? b : a;
      if (wall.label === "cushion" || wall.label === "frame") {
        const ball = aBall ? a : b;
        audio.thud(ball.speed / PHYSICS.maxShotSpeed);
      }
    });
  }

  finishShot() {
    if (this.phase !== PHASE.SHOOTING) return;
    this.phase = PHASE.AIM;
    const pocketed = this.pocketedThisTurn.splice(0);
    const result = resolveShot(this.match, { pocketed, firstContact: this.firstContact, isBreak: this.currentShotIsBreak });
    this.match = result.match;
    hub.score(14 - this.match.remaining.solid.length - this.match.remaining.stripe.length);
    this.firstContact = null;

    if (result.winner) {
      this.endGame(result.winner, result.message);
      return;
    }
    if (result.respotEight) this.respotEight();
    if (result.ballInHand) {
      this.beginPlacement();
      this.updateHud(this.isAiTurn() ? result.message : `${result.message} Tap or drag to place the cue ball.`);
      return;
    }
    this.updateHud(result.message);
  }

  endGame(winner, message) {
    if (this.phase === PHASE.OVER) return;
    this.phase = PHASE.OVER;
    this.isDragging = false;
    this.aimGfx.clear();
    this.placeGfx.clear();
    this.updateHud(message);
    const durationMs = Math.round(performance.now() - this.hubStartedAt);
    const score = 14 - this.match.remaining.solid.length - this.match.remaining.stripe.length;
    hub.gameOver(score, durationMs);
    hub.event("match-won", { winner, mode: this.mode, seconds: Math.round(durationMs / 1000) });
    this.time.delayedCall(900, () => {
      this.scene.stop("UI");
      this.scene.start("GameOver", { winner, message: this.withNames(message), ...this.restartData(), names: this.names });
    });
  }

  // Put the 8-ball back on the foot spot (or the nearest free point along
  // the long axis) after it dropped on the break.
  respotEight() {
    const existing = this.balls.get("8");
    if (existing && existing.active) return;
    if (existing) this.balls.delete("8");
    this.pocketedOrder = this.pocketedOrder.filter((id) => id !== 8);
    const r = BALL.radius;
    const footX = TABLE.left + (TABLE.right - TABLE.left) * 0.62;
    const free = (x, y) => this.activeTargets("8").every((t) => Math.hypot(t.x - x, t.y - y) >= r * 2 + 1);
    let x = footX;
    for (let d = 0; d < 320; d += r) {
      if (free(footX + d, TABLE.midY)) { x = footX + d; break; }
      if (free(footX - d, TABLE.midY)) { x = footX - d; break; }
    }
    this.addBall(8, x, TABLE.midY);
  }

  updateHud(message) {
    const payload = {
      turn: this.match.turn,
      assigned: { ...this.match.assigned },
      remaining: { solid: [...this.match.remaining.solid], stripe: [...this.match.remaining.stripe] },
      pocketed: [...this.pocketedOrder],
      phase: this.phase,
      mode: this.mode,
      difficultyLabel: this.mode === "ai" ? AI_DIFFICULTY[this.difficulty].label : null,
      names: { ...this.names },
      // The turn and group are on the HUD cards; an empty message shows the
      // controls hint instead of repeating them.
      message: this.withNames(message || ""),
      gameOver: this.match.gameOver,
    };
    this.game.registry.set("matchHud", payload);
    this.game.events.emit("match-update", payload);
  }
}
