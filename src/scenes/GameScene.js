import Phaser from "phaser";
import { TABLE, BALL, PHYSICS, INPUT, COLORS, AI_DIFFICULTY, POWER_BAR, PLAY_ZONE, SPIN, rackFor, resolveDifficulty } from "../game/constants.js";
import { createMatchState, pottedCount, resolveVariant, snapshotMatch } from "../game/state.js";
import { skinFor } from "../game/balls.js";
import { recordCampaignResult } from "../systems/campaign.js";
import { resolveShot, isLegalFirstContact } from "../game/rules.js";
import { withNames as formatNames } from "../game/labels.js";
import { projectCuePath } from "../game/aim.js";
import { ART_SCALE, ensureBallTextures, shadowTextureKey } from "../systems/ballArt.js";
import { BallView } from "../systems/ballRender.js";
import { CUE_ART_SCALE, CUE_KEY, CUE_SHADOW_KEY, ensureCueTextures } from "../systems/cueArt.js";
import { planShot, planPlacement } from "../game/ai.js";
import { createRestartKey } from "../systems/input.js";
import { installDebug } from "../systems/debug.js";
import { audio } from "../systems/audio.js";
import { recordResult } from "../systems/stats.js";
import { loadSettings } from "../systems/settings.js";
import { hub } from "../integrations/hub.js";
import { FONT, UI, VIEW, addText, setupCamera } from "../ui/theme.js";

const { Sleeping } = Phaser.Physics.Matter.Matter;

export const PHASE = Object.freeze({
  AIM: "aim",           // the shooter turns the cue and sets power
  SHOOTING: "shooting", // balls in motion, waiting for rest
  PLACING: "placing",   // ball in hand: the cue ball is being positioned
  OVER: "over",
});

const CUE_START = Object.freeze({ x: TABLE.left + (TABLE.right - TABLE.left) * 0.25, y: TABLE.midY });
const FOOT_X = TABLE.left + (TABLE.right - TABLE.left) * 0.62;

// Strength (skill, shot choice, placement) comes from AI_DIFFICULTY.
const AI = Object.freeze({ player: 2, thinkMs: 800, previewMs: 700 });

// Frames for the cue to travel from its drawn-back position to the ball,
// and for it to fade out afterwards.
const STRIKE_FRAMES = 5;
const FADE_FRAMES = 16;

const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));

export class GameScene extends Phaser.Scene {
  constructor() { super("Game"); }

  init(data) {
    this.mode = data?.mode === "ai" ? "ai" : "pvp";
    this.difficulty = resolveDifficulty(data?.difficulty);
    this.variant = resolveVariant(data?.variant);
    // A campaign opponent: a named character with their own way of playing.
    this.opponent = this.mode === "ai" && data?.opponent ? data.opponent : null;
    this.names = this.mode === "ai" ? { 1: "You", 2: this.opponent ? this.opponent.name : "Computer" } : { 1: "Player 1", 2: "Player 2" };
  }

  create() {
    setupCamera(this);
    // A plain DOM marker so tests (and the hub) can tell which screen is up.
    document.body.dataset.screen = "game";
    this.settings = loadSettings();
    this.match = createMatchState(this.variant);
    this.skin = skinFor(this.variant);
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
    this.aimAngle = 0;
    this.power = 0;
    this.aimDrag = null;
    this.powerDrag = false;
    this.placeDrag = false;
    this.strike = null;
    this.cueFade = null;
    this.canReplace = false;
    this.kitchenOnly = false;
    this.placementValid = false;
    this.shotFrames = 0;
    this.isBreak = true;
    this.shotSpin = { x: 0, y: 0 };
    this.shotDir = { x: 1, y: 0 };
    this.pendingFollow = null;
    this.pendingSide = null;
    this.stats = { 1: { shots: 0, pots: 0, fouls: 0, run: 0, bestRun: 0 }, 2: { shots: 0, pots: 0, fouls: 0, run: 0, bestRun: 0 } };
    this.registry.set("spin", { x: 0, y: 0 });

    this.drawTable();
    this.createCushions();
    this.createPockets();
    ensureBallTextures(this, BALL.radius);
    ensureCueTextures(this, INPUT.cueLength);
    this.createBalls();

    this.aimGfx = this.add.graphics().setDepth(5);
    this.cueShadow = this.add.image(0, 0, CUE_SHADOW_KEY).setOrigin(1, 0.5).setScale(1 / CUE_ART_SCALE).setDepth(5.5).setVisible(false);
    this.cueView = this.add.image(0, 0, CUE_KEY).setOrigin(1, 0.5).setScale(1 / CUE_ART_SCALE).setDepth(6).setVisible(false);
    this.placeGfx = this.add.graphics().setDepth(6.5);
    this.powerGfx = this.add.graphics().setDepth(7);
    this.powerLabel = addText(this, POWER_BAR.x + POWER_BAR.w / 2, POWER_BAR.y - 9, "POWER", { fontFamily: FONT.display, fontStyle: "600", fontSize: "11px", color: UI.css.dim }).setOrigin(0.5, 1).setDepth(7);
    this.powerValue = addText(this, POWER_BAR.x + POWER_BAR.w / 2, POWER_BAR.y + POWER_BAR.h + 8, "", { fontFamily: FONT.display, fontStyle: "700", fontSize: "13px", color: UI.css.brass }).setOrigin(0.5, 0).setDepth(7);
    this.setupInput();

    this.restartKey = createRestartKey(this);
    this.cursors = this.input.keyboard.createCursorKeys();
    this.matter.world.on("collisionstart", (event) => this.handleCollisions(event));

    // Live ball textures belong to this match: free them when it ends.
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.balls.forEach((entry) => entry.ball.destroy()));

    this.scene.launch("UI");
    hub.ready();
    hub.score(0);
    this.hubStartedAt = performance.now();
    this.resetAim();
    audio.rack();
    this.updateHud(`${this.names[1]} break${this.mode === "ai" ? "" : "s"}.`);
    installDebug(this, () => snapshotMatch(this.match));
  }

  isAiTurn() {
    return this.mode === "ai" && this.match.turn === AI.player && !this.match.gameOver;
  }

  humanCanAct() {
    return this.phase === PHASE.AIM && !this.isAiTurn() && !this.strike && !this.match.gameOver;
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
      bounds: this.kitchenOnly ? { ...TABLE, right: CUE_START.x } : TABLE,
      radius: BALL.radius,
      maxShotSpeed: PHYSICS.maxShotSpeed,
      ...this.aiTuning(),
      headSpot: CUE_START,
    };
  }

  aiTuning() {
    const { skill, weakShotChance, loosePlacement } = this.opponent?.tuning ?? AI_DIFFICULTY[this.difficulty];
    return { skill, weakShotChance, loosePlacement };
  }

  // Data that restarts this match in the same game, mode and difficulty.
  restartData() {
    const base = { mode: this.mode, variant: this.variant };
    if (this.mode !== "ai") return base;
    return this.opponent ? { ...base, opponent: this.opponent } : { ...base, difficulty: this.difficulty };
  }

  // Called from update() while it is the computer's turn. Placement is
  // immediate; the shot is shown as an aim preview for a moment, then taken.
  aiAct() {
    if (this.aiPending || this.strike) return;
    if (this.phase === PHASE.PLACING) {
      const spot = planPlacement(this.aiContext());
      this.moveCueForPlacement(spot.x, spot.y);
      if (this.placementValid) this.confirmPlacement();
      return;
    }
    if (this.phase !== PHASE.AIM) return;
    this.aiPending = true;
    this.updateHud(`${this.names[AI.player]} is lining up a shot.`);
    this.time.delayedCall(this.opponent?.tuning?.thinkMs ?? AI.thinkMs, () => {
      if (this.phase !== PHASE.AIM || !this.isAiTurn()) { this.aiPending = false; return; }
      const plan = planShot(this.aiContext());
      if (!plan) { this.aiPending = false; return; }
      // Some characters hit everything harder, or softer, than they need to.
      plan.power = Phaser.Math.Clamp(plan.power * (this.opponent?.tuning?.powerBias ?? 1), 0.12, 1);
      this.aiPreview = { angle: plan.angle, power: plan.power };
      this.time.delayedCall(AI.previewMs, () => {
        this.aiPreview = null;
        this.aiPending = false;
        if (this.phase === PHASE.AIM && this.isAiTurn()) this.strikeCue(plan.angle, plan.power);
      });
    });
  }

  // Drop a half-finished aim or power pull when the match pauses or the OS
  // cancels a touch: the release may never arrive.
  cancelDrag() {
    this.aimDrag = null;
    this.powerDrag = false;
    this.placeDrag = false;
    this.power = 0;
  }

  // Kept for the debug harness and older callers.
  get waitingForRest() { return this.phase === PHASE.SHOOTING; }
  get isDragging() { return Boolean(this.aimDrag) || this.powerDrag; }

  update() {
    this.balls.forEach((entry) => {
      if (!entry.active) return;
      const { x, y } = entry.body.position;
      entry.view.setPosition(x, y);
      entry.shadow.setPosition(x + BALL.radius * 0.28, y + BALL.radius * 0.36);
      if (this.phase === PHASE.SHOOTING) {
        entry.ball.roll(x - entry.last.x, y - entry.last.y);
        if (entry.id === "cue" && this.shotSpin.x) entry.ball.twist(this.shotSpin.x * 0.22);
      } else {
        entry.ball.settle();
      }
      entry.last.x = x;
      entry.last.y = y;
      entry.ball.redraw();
    });

    if (this.restartKey.restartPressed()) {
      this.scene.restart(this.restartData());
      return;
    }

    if (this.isAiTurn() && (this.phase === PHASE.AIM || this.phase === PHASE.PLACING)) this.aiAct();
    if (this.humanCanAct()) this.keyboardAim();
    if (this.strike) this.advanceStrike();

    if (this.phase === PHASE.SHOOTING) {
      this.applySpin();
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
    this.drawPower();
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
    // The rendered table (art/blender) covers the whole view: room, rails,
    // cloth and pockets, lit from above. If it is missing the game falls
    // back to a table drawn in code.
    if (this.textures.exists("table")) {
      this.add.image(VIEW.w / 2, VIEW.h / 2, "table").setDisplaySize(VIEW.w, VIEW.h).setDepth(0);
    } else {
      this.drawTableFallback();
    }

    // Head string and spots, so ball-in-hand placement has a visual anchor.
    const g = this.add.graphics().setDepth(0.5);
    g.lineStyle(1, 0xffffff, 0.1);
    g.lineBetween(CUE_START.x, TABLE.top + 2, CUE_START.x, TABLE.bottom - 2);
    g.fillStyle(0xffffff, 0.22);
    g.fillCircle(CUE_START.x, CUE_START.y, 2.2);
    g.fillCircle(FOOT_X, CUE_START.y, 2.2);
  }

  drawTableFallback() {
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

    const pitch = r * 2 + PHYSICS.rackGap;
    const rowDX = pitch * Math.cos(Math.PI / 6);
    // A perfectly aligned rack behaves like a Newton's cradle: the impulse
    // runs straight through and only the back-corner balls fly. A sub-pixel
    // jitter, as in any real rack, scatters the wave across the whole pack.
    const jitter = () => (Math.random() - 0.5) * PHYSICS.rackJitter * 2;
    rackFor(this.variant).forEach((row, rowIndex) => {
      const x = FOOT_X + rowIndex * rowDX;
      row.forEach((num, i) => {
        const y = TABLE.midY + (i - (row.length - 1) / 2) * pitch;
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

    // A live shaded sphere (src/systems/ballRender.js) over a soft contact
    // shadow on its own layer, so it never darkens a neighbour in the rack.
    const shadow = this.add.image(x + r * 0.28, y + r * 0.36, shadowTextureKey(r)).setScale(1.12 / ART_SCALE).setDepth(1.5);
    const ball = new BallView(this, id, r, x, y, this.skin);
    ball.image.setDepth(2);
    this.balls.set(String(id), { id, body, ball, view: ball.image, shadow, active: true, last: { x, y } });
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

  inPowerZone(p) {
    return p.worldX <= POWER_BAR.zoneRight && p.worldY >= POWER_BAR.y - 30 && p.worldY <= POWER_BAR.y + POWER_BAR.h + 30;
  }

  inPlayZone(p) {
    return p.worldX > PLAY_ZONE.left && p.worldX < PLAY_ZONE.right && p.worldY > PLAY_ZONE.top && p.worldY < PLAY_ZONE.bottom;
  }

  powerFromY(y) {
    return Phaser.Math.Clamp((y - POWER_BAR.y) / POWER_BAR.h, 0, 1);
  }

  angleFromCue(x, y) {
    const cue = this.balls.get("cue");
    if (!cue) return this.aimAngle;
    return Math.atan2(y - cue.body.position.y, x - cue.body.position.x);
  }

  // Aim and power are separate. A drag on the table turns the cue by the
  // angle the pointer sweeps around the cue ball, so the finger never has to
  // sit on the shot line; a tap points the cue at the tapped spot. Power is
  // set on the bar in the left margin and the shot goes on release, so full
  // power is available wherever the cue ball lies.
  setupInput() {
    this.input.on("pointerdown", (p) => {
      audio.unlock();
      if (this.isAiTurn() || this.strike) return;
      if (this.phase === PHASE.PLACING) {
        if (!this.inPlayZone(p)) return;
        this.placeDrag = true;
        this.moveCueForPlacement(p.worldX, p.worldY);
        return;
      }
      if (this.phase !== PHASE.AIM) return;
      if (this.inPowerZone(p)) {
        this.powerDrag = true;
        this.power = this.powerFromY(p.worldY);
        return;
      }
      if (!this.inPlayZone(p)) return;
      const cue = this.balls.get("cue");
      // With ball in hand, pressing on the cue ball picks it up again.
      if (this.canReplace && cue?.active && Math.hypot(p.worldX - cue.body.position.x, p.worldY - cue.body.position.y) < BALL.radius * 2.2) {
        this.beginPlacement();
        this.placeDrag = true;
        return;
      }
      this.aimDrag = { last: this.angleFromCue(p.worldX, p.worldY), x: p.worldX, y: p.worldY, moved: false };
    });

    this.input.on("pointermove", (p) => {
      if (this.isAiTurn()) return;
      if (this.phase === PHASE.PLACING) {
        // A mouse can position by hovering; a finger drags.
        if (this.placeDrag || !p.wasTouch) this.moveCueForPlacement(p.worldX, p.worldY);
        return;
      }
      if (this.powerDrag) {
        this.power = this.powerFromY(p.worldY);
        return;
      }
      const d = this.aimDrag;
      if (!d) return;
      if (!d.moved && Math.hypot(p.worldX - d.x, p.worldY - d.y) < INPUT.tapSlop) return;
      const now = this.angleFromCue(p.worldX, p.worldY);
      if (d.moved) this.aimAngle = wrapAngle(this.aimAngle + wrapAngle(now - d.last));
      d.moved = true;
      d.last = now;
    });

    const release = (p) => {
      // Phaser also delivers an OS-cancelled touch as pointerup.
      if (p.wasCanceled) { this.cancelDrag(); return; }
      if (this.isAiTurn()) { this.cancelDrag(); return; }
      if (this.phase === PHASE.PLACING) {
        if (!this.placeDrag) return;
        this.placeDrag = false;
        this.moveCueForPlacement(p.worldX, p.worldY);
        if (this.placementValid) this.confirmPlacement();
        return;
      }
      if (this.powerDrag) {
        this.powerDrag = false;
        const power = this.power;
        if (power >= INPUT.minPower && this.humanCanAct()) this.strikeCue(this.aimAngle, power);
        else this.power = 0;
        return;
      }
      const d = this.aimDrag;
      this.aimDrag = null;
      if (d && !d.moved && this.humanCanAct()) this.aimAngle = this.angleFromCue(p.worldX, p.worldY);
    };
    this.input.on("pointerup", release);
    this.input.on("pointerupoutside", release);

    this.input.on("wheel", (p, over, dx, dy) => {
      if (this.humanCanAct()) this.aimAngle = wrapAngle(this.aimAngle + dy * INPUT.wheelTurn);
    });
  }

  // Arrow keys nudge the aim; Shift makes the nudge finer.
  keyboardAim() {
    const step = this.cursors.shift.isDown ? INPUT.keyTurnFine : INPUT.keyTurn;
    if (this.cursors.left.isDown) this.aimAngle = wrapAngle(this.aimAngle - step);
    if (this.cursors.right.isDown) this.aimAngle = wrapAngle(this.aimAngle + step);
  }

  // Point the cue somewhere sensible at the start of a turn: down the table
  // on the break, otherwise at the nearest ball the shooter may hit first.
  resetAim() {
    this.power = 0;
    const cue = this.balls.get("cue");
    if (!cue || !cue.active) return;
    if (this.shotIndex === 0) { this.aimAngle = 0; return; }
    const { x, y } = cue.body.position;
    let best = null;
    this.activeTargets().forEach((t) => {
      if (!isLegalFirstContact(this.match, this.match.turn, Number(t.id))) return;
      const d = Math.hypot(t.x - x, t.y - y);
      if (!best || d < best.d) best = { d, t };
    });
    if (best) this.aimAngle = Math.atan2(best.t.y - y, best.t.x - x);
  }

  // The cue drives forward from its drawn-back position over a few frames,
  // and the ball leaves at the moment of contact.
  strikeCue(angle, power) {
    if (this.phase !== PHASE.AIM || this.strike) return;
    this.strike = { angle, power: Phaser.Math.Clamp(power, 0, 1), frame: 0 };
    this.aimDrag = null;
    this.powerDrag = false;
  }

  advanceStrike() {
    const s = this.strike;
    s.frame += 1;
    if (s.frame < STRIKE_FRAMES) return;
    this.strike = null;
    this.power = 0;
    this.takeShot(s.angle, s.power);
  }

  takeShot(angle, power) {
    const cue = this.balls.get("cue");
    if (!cue || !cue.active || this.phase !== PHASE.AIM) return;
    const p = Phaser.Math.Clamp(power, 0, 1);
    const spin = this.isAiTurn() ? { x: 0, y: 0 } : (this.registry.get("spin") || { x: 0, y: 0 });
    this.shotSpin = { x: spin.x, y: spin.y };
    this.stats[this.match.turn].shots += 1;
    this.cueFade = { frame: 0, angle, x: cue.body.position.x, y: cue.body.position.y };
    this.launchCue(cue, angle, p * PHYSICS.maxShotSpeed);
    audio.strike(p);
  }

  launchCue(cue, angle, speed) {
    // Matter never wakes a body just because its velocity changed, so a cue
    // ball that fell asleep between turns would otherwise ignore the shot.
    Sleeping.set(cue.body, false);
    this.shotDir = { x: Math.cos(angle), y: Math.sin(angle) };
    this.matter.body.setVelocity(cue.body, { x: this.shotDir.x * speed, y: this.shotDir.y * speed });
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
    this.pendingFollow = null;
    this.pendingSide = null;
    this.canReplace = false;
    this.kitchenOnly = false;
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
    entry.last = { x: p.x, y: p.y };
    if (this.phase !== PHASE.SHOOTING) this.beginShot();
  }

  debugShoot(angleDeg, power = 1) {
    const cue = this.balls.get("cue");
    if (!cue || !cue.active) return;
    if (this.phase === PHASE.PLACING) this.confirmPlacement();
    const angle = Phaser.Math.DegToRad(angleDeg);
    this.shotSpin = { x: 0, y: 0 };
    this.stats[this.match.turn].shots += 1;
    this.launchCue(cue, angle, Phaser.Math.Clamp(power, 0, 1) * PHYSICS.maxShotSpeed);
  }

  // What to draw for the cue this frame: the angle and how far it is drawn
  // back.
  cuePose() {
    if (this.strike) {
      const t = this.strike.frame / STRIKE_FRAMES;
      return { angle: this.strike.angle, pull: this.strike.power * INPUT.cuePull * (1 - t) ** 2 };
    }
    if (this.phase === PHASE.AIM && this.aiPreview) return { angle: this.aiPreview.angle, pull: this.aiPreview.power * INPUT.cuePull };
    if (this.humanCanAct()) return { angle: this.aimAngle, pull: this.power * INPUT.cuePull };
    return null;
  }

  drawAim() {
    const g = this.aimGfx.clear();
    const r = BALL.radius;

    // Follow-through: the cue rests where it struck and fades away.
    if (this.cueFade) {
      const f = this.cueFade;
      f.frame += 1;
      const alpha = 1 - f.frame / FADE_FRAMES;
      if (alpha <= 0) { this.cueFade = null; this.showCue(null); } else this.showCue({ x: f.x, y: f.y, angle: f.angle, gap: r - 3, alpha });
      return;
    }

    const pose = this.cuePose();
    const cue = this.balls.get("cue");
    if (!pose || !cue || !cue.active) { this.showCue(null); return; }

    const cx = cue.body.position.x;
    const cy = cue.body.position.y;
    const dir = { x: Math.cos(pose.angle), y: Math.sin(pose.angle) };
    this.showCue({ x: cx, y: cy, angle: pose.angle, gap: r + 4 + pose.pull, alpha: 1 });
    if (!this.settings.guide && !this.aiPreview) return;

    // Projected cue-ball path to the first object ball or cushion: a white
    // line on a dark underlay so it reads on the cloth at phone size.
    const path = projectCuePath({ x: cx, y: cy }, dir, this.activeTargets(), TABLE, r);
    const sx = cx + dir.x * (r + 2);
    const sy = cy + dir.y * (r + 2);
    if (path.t > r + 2) {
      g.lineStyle(3.5, 0x000000, 0.28);
      g.lineBetween(sx, sy, path.end.x, path.end.y);
      g.lineStyle(1.5, 0xffffff, 0.92);
      g.lineBetween(sx, sy, path.end.x, path.end.y);
    }
    // Ghost ball where the cue ball will be at contact.
    g.fillStyle(0xffffff, 0.14);
    g.fillCircle(path.end.x, path.end.y, r);
    g.lineStyle(1.5, 0xffffff, 0.92);
    g.strokeCircle(path.end.x, path.end.y, r - 0.5);
    if (!path.hit) return;

    // The target ring and the object ball's path are green when the ball is
    // a legal first contact for the shooter, red when it would foul.
    const legal = isLegalFirstContact(this.match, this.match.turn, Number(path.hit.id));
    const tint = legal ? 0x6fdc9a : 0xf0655c;
    const c = path.hit.center;
    const od = path.hit.dir;
    const len = 78;
    const ox = c.x + od.x * (r + 3);
    const oy = c.y + od.y * (r + 3);
    const tx = c.x + od.x * len;
    const ty = c.y + od.y * len;
    g.lineStyle(2, tint, 0.95);
    g.strokeCircle(c.x, c.y, r + 2.5);
    g.lineStyle(4, 0x000000, 0.28);
    g.lineBetween(ox, oy, tx, ty);
    g.lineStyle(2, tint, 0.95);
    g.lineBetween(ox, oy, tx, ty);
    g.fillStyle(tint, 0.95);
    g.fillTriangle(tx + od.x * 8, ty + od.y * 8, tx - od.y * 5, ty + od.x * 5, tx + od.y * 5, ty - od.x * 5);

    // Where the cue ball heads after the contact (the tangent line).
    const along = dir.x * od.x + dir.y * od.y;
    const kx = dir.x - od.x * along;
    const ky = dir.y - od.y * along;
    const klen = Math.hypot(kx, ky);
    if (klen > 0.08) {
      const reach = 22 + 30 * klen;
      g.lineStyle(1.5, 0xffffff, 0.45);
      g.lineBetween(path.end.x + (kx / klen) * r, path.end.y + (ky / klen) * r, path.end.x + (kx / klen) * (r + reach), path.end.y + (ky / klen) * (r + reach));
    }
  }

  showCue(pose) {
    if (!pose) {
      this.cueView.setVisible(false);
      this.cueShadow.setVisible(false);
      return;
    }
    const x = pose.x - Math.cos(pose.angle) * pose.gap;
    const y = pose.y - Math.sin(pose.angle) * pose.gap;
    this.cueView.setVisible(true).setPosition(x, y).setRotation(pose.angle).setAlpha(pose.alpha);
    this.cueShadow.setVisible(true).setPosition(x + 5, y + 7).setRotation(pose.angle).setAlpha(pose.alpha * 0.55);
  }

  // Power bar in the left margin: pull the handle down and let go to shoot.
  drawPower() {
    const g = this.powerGfx.clear();
    const { x, y, w, h } = POWER_BAR;
    const mine = this.humanCanAct() || Boolean(this.strike && !this.isAiTurn());
    const dim = mine ? 1 : 0.35;
    const power = this.strike ? this.strike.power : (this.aiPreview ? this.aiPreview.power : this.power);

    g.fillStyle(0x000000, 0.5 * dim);
    g.fillRoundedRect(x - 3, y - 3, w + 6, h + 6, 9);
    g.fillStyle(UI.panel, dim);
    g.fillRoundedRect(x, y, w, h, 7);
    g.lineStyle(1, UI.brassDark, 0.9 * dim);
    g.strokeRoundedRect(x - 0.5, y - 0.5, w + 1, h + 1, 7);

    // Tick marks every quarter.
    g.lineStyle(1, 0xffffff, 0.16 * dim);
    for (let i = 1; i < 4; i += 1) g.lineBetween(x + 4, y + (h * i) / 4, x + w - 4, y + (h * i) / 4);

    const fill = h * power;
    if (fill > 1) {
      const col = Phaser.Display.Color.GetColor(90 + power * 150, 205 - power * 135, 110 - power * 70);
      g.fillStyle(col, 0.92 * dim);
      g.fillRoundedRect(x + 3, y + 3, w - 6, Math.max(6, fill - 3), 4);
    }

    // Handle: a brass grip that sits at the current power.
    const hy = y + fill;
    g.fillStyle(0x000000, 0.45 * dim);
    g.fillRoundedRect(x - 5, hy - 6 + 2, w + 10, 14, 5);
    g.fillStyle(this.powerDrag ? 0xf2c869 : UI.brass, dim);
    g.fillRoundedRect(x - 5, hy - 7, w + 10, 14, 5);
    g.lineStyle(1, 0x5c4312, 0.9 * dim);
    g.lineBetween(x + 2, hy - 2, x + w - 2, hy - 2);
    g.lineBetween(x + 2, hy + 2, x + w - 2, hy + 2);

    this.powerLabel.setAlpha(dim);
    this.powerValue.setAlpha(dim).setText(power > 0.01 ? `${Math.round(power * 100)}` : "");
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
    cue.view.setAlpha(0.8);
    cue.shadow.setAlpha(0.4);
    this.phase = PHASE.PLACING;
    this.aimDrag = null;
    this.powerDrag = false;
    this.power = 0;
    this.moveCueForPlacement(cue.body.position.x, cue.body.position.y);
  }

  moveCueForPlacement(x, y) {
    if (this.phase !== PHASE.PLACING) return;
    const cue = this.balls.get("cue");
    if (!cue) return;
    const r = BALL.radius;
    const maxX = this.kitchenOnly ? CUE_START.x : TABLE.right - r - 1;
    const px = Phaser.Math.Clamp(x, TABLE.left + r + 1, maxX);
    const py = Phaser.Math.Clamp(y, TABLE.top + r + 1, TABLE.bottom - r - 1);
    this.matter.body.setPosition(cue.body, { x: px, y: py });
    this.matter.body.setVelocity(cue.body, { x: 0, y: 0 });
    cue.view.setPosition(px, py);
    cue.shadow.setPosition(px + r * 0.28, py + r * 0.36);
    cue.last = { x: px, y: py };
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
    this.placeDrag = false;
    this.phase = PHASE.AIM;
    this.canReplace = true;
    this.resetAim();
    this.updateHud(this.isAiTurn() ? "" : "Cue ball placed. Drag it to move it again, or take the shot.");
  }

  drawPlacement() {
    const g = this.placeGfx.clear();
    if (this.phase !== PHASE.PLACING) return;
    const cue = this.balls.get("cue");
    if (!cue) return;
    if (this.kitchenOnly) {
      g.fillStyle(0xffffff, 0.06);
      g.fillRect(TABLE.left, TABLE.top, CUE_START.x - TABLE.left, TABLE.bottom - TABLE.top);
    }
    const { x, y } = cue.body.position;
    const pulse = 0.5 + 0.5 * Math.sin(this.time.now / 180);
    g.lineStyle(2, this.placementValid ? 0x6fdc9a : 0xf0655c, 0.6 + pulse * 0.4);
    g.strokeCircle(x, y, BALL.radius + 5 + pulse * 2);
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

  // Spin is applied the frame after the contact that triggers it, once the
  // physics engine has resolved the collision itself. Follow and draw push
  // the cue ball along or against the shot line after it meets the object
  // ball; side spin slides it along a cushion on the rebound.
  applySpin() {
    const cue = this.balls.get("cue");
    if (!cue || !cue.active) { this.pendingFollow = null; this.pendingSide = null; return; }
    if (this.pendingFollow) {
      const { dir, speed, amount } = this.pendingFollow;
      this.pendingFollow = null;
      const k = amount * SPIN.followDraw * speed;
      this.matter.body.setVelocity(cue.body, { x: cue.body.velocity.x + dir.x * k, y: cue.body.velocity.y + dir.y * k });
    }
    if (this.pendingSide) {
      const { n, speed, amount } = this.pendingSide;
      this.pendingSide = null;
      const k = amount * SPIN.side * speed;
      this.matter.body.setVelocity(cue.body, { x: cue.body.velocity.x + n.y * k, y: cue.body.velocity.y - n.x * k });
    }
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

  nearestPocket(x, y) {
    let best = null;
    this.pocketPositions().forEach((p, index) => {
      const d = Math.hypot(p.x - x, p.y - y);
      if (!best || d < best.d) best = { d, index, x: p.x, y: p.y };
    });
    return best;
  }

  pocketBall(entry) {
    if (!entry.active) return;
    if (this.phase !== PHASE.SHOOTING) this.beginShot();
    entry.active = false;
    const { x, y } = entry.body.position;
    const pocket = this.nearestPocket(x, y);
    this.matter.world.remove(entry.body);
    // The ball drops: it slides to the middle of the pocket, shrinks and
    // fades out of sight.
    entry.shadow.destroy();
    this.tweens.add({
      targets: entry.view,
      x: pocket.x, y: pocket.y, scale: entry.view.scale * 0.62, alpha: 0,
      duration: 190, ease: "Quad.easeIn",
      onComplete: () => entry.ball.destroy(),
    });
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
            const cueBody = idA === "cue" ? a : b;
            this.firstContact = Number(other);
            if (this.shotSpin.y && cueBody.speed > 0.2) {
              this.pendingFollow = { dir: { x: cueBody.velocity.x / cueBody.speed, y: cueBody.velocity.y / cueBody.speed }, speed: cueBody.speed, amount: this.shotSpin.y };
              this.shotSpin.y = 0;
            }
            if (this.isBreak) this.scatterRack(cueBody);
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
        if (wall.label === "cushion" && ball.label === "ball:cue" && Math.abs(this.shotSpin.x) > 0.02 && this.phase === PHASE.SHOOTING) {
          // Cushions are axis-aligned strips: the normal points from the
          // strip to the ball across its thin side.
          const wide = wall.bounds.max.x - wall.bounds.min.x > wall.bounds.max.y - wall.bounds.min.y;
          const n = wide ? { x: 0, y: Math.sign(ball.position.y - wall.position.y) } : { x: Math.sign(ball.position.x - wall.position.x), y: 0 };
          this.pendingSide = { n, speed: ball.speed, amount: this.shotSpin.x };
          this.shotSpin.x *= SPIN.sideKeep;
        }
      }
    });
  }

  finishShot() {
    if (this.phase !== PHASE.SHOOTING) return;
    this.phase = PHASE.AIM;
    this.shotSpin = { x: 0, y: 0 };
    this.registry.set("spin", { x: 0, y: 0 });
    const shooter = this.match.turn;
    const pocketed = this.pocketedThisTurn.splice(0);
    const result = resolveShot(this.match, { pocketed, firstContact: this.firstContact, isBreak: this.currentShotIsBreak });
    this.match = result.match;
    hub.score(pottedCount(this.match));
    this.firstContact = null;

    const st = this.stats[shooter];
    const potted = pocketed.filter((id) => id !== "cue").length;
    st.pots += potted;
    if (result.foulReason) st.fouls += 1;
    st.run = result.continueTurn ? st.run + potted : 0;
    st.bestRun = Math.max(st.bestRun, result.continueTurn ? st.run : potted);

    if (result.winner) {
      this.endGame(result.winner, result.message);
      return;
    }
    (result.respot || []).forEach((id) => this.respotBall(id));
    if (result.foulReason) this.announceFoul(result);
    if (result.ballInHand) {
      // 8-ball and blackball bring a pocketed cue ball back behind the head
      // string; 9-ball gives it anywhere.
      this.kitchenOnly = result.placement === "kitchen";
      this.beginPlacement();
      const where = this.kitchenOnly ? " behind the line" : "";
      this.updateHud(this.isAiTurn() ? result.message : `${result.message} Tap or drag to place the cue ball${where}.`);
      return;
    }
    this.resetAim();
    this.updateHud(result.message);
  }

  // A foul is announced in the middle of the table: what went wrong and what
  // the other player gets for it.
  announceFoul(result) {
    const other = this.match.turn;
    const reason = result.foulReason[0].toUpperCase() + result.foulReason.slice(1);
    let award = `Player ${other} has two shots`;
    if (this.variant === "nineball") award = `Player ${other} has ball in hand`;
    const detail = result.placement === "kitchen" ? "Cue ball behind the line" : result.placement === "anywhere" ? "Place the cue ball anywhere" : "Cue ball stays where it lies";
    audio.foul();
    this.game.events.emit("match-banner", {
      title: "FOUL",
      lines: [reason, this.withNames(award).toUpperCase()],
      detail: this.isAiTurn() && result.placement !== "none" ? "" : detail,
      shots: this.match.shots,
      tone: "foul",
    });
  }

  endGame(winner, message) {
    if (this.phase === PHASE.OVER) return;
    this.phase = PHASE.OVER;
    this.cancelDrag();
    this.aimGfx.clear();
    this.placeGfx.clear();
    this.cueFade = null;
    this.showCue(null);
    this.updateHud(message);
    const durationMs = Math.round(performance.now() - this.hubStartedAt);
    const score = pottedCount(this.match);
    hub.gameOver(score, durationMs);
    hub.event("match-won", { winner, mode: this.mode, seconds: Math.round(durationMs / 1000) });
    // Campaign matches go on the ladder; quick matches on the difficulty record.
    let record = null;
    let campaign = null;
    if (this.opponent) campaign = recordCampaignResult(this.opponent.id, { won: winner === 1, fouls: this.stats[1].fouls, shots: this.stats[1].shots });
    else if (this.mode === "ai") record = recordResult(this.difficulty, winner === 1);
    if (winner === 1 || this.mode !== "ai") audio.win(); else audio.lose();
    this.time.delayedCall(900, () => {
      this.scene.stop("UI");
      this.scene.start("GameOver", { winner, message: this.withNames(message), ...this.restartData(), names: this.names, stats: this.stats, durationMs, record, campaign });
    });
  }

  // Put a ball back on the foot spot (or the nearest free point along the
  // long axis): the 8 after it dropped on the break, the 9 after a foul.
  respotBall(id) {
    const key = String(id);
    const existing = this.balls.get(key);
    if (existing && existing.active) return;
    if (existing) this.balls.delete(key);
    this.pocketedOrder = this.pocketedOrder.filter((n) => n !== id);
    const r = BALL.radius;
    const free = (x, y) => this.activeTargets(key).every((t) => Math.hypot(t.x - x, t.y - y) >= r * 2 + 1);
    let x = FOOT_X;
    for (let d = 0; d < 320; d += r) {
      if (free(FOOT_X + d, TABLE.midY)) { x = FOOT_X + d; break; }
      if (free(FOOT_X - d, TABLE.midY)) { x = FOOT_X - d; break; }
    }
    this.addBall(id, x, TABLE.midY);
  }

  updateHud(message) {
    const payload = {
      turn: this.match.turn,
      assigned: { ...this.match.assigned },
      remaining: { solid: [...this.match.remaining.solid], stripe: [...this.match.remaining.stripe] },
      pocketed: [...this.pocketedOrder],
      variant: this.variant,
      shots: this.match.shots ?? 1,
      balls: this.match.balls ? [...this.match.balls] : null,
      coins: this.match.coins ? { ...this.match.coins } : null,
      on: this.match.on ?? null,
      lastCoin: Boolean(this.match.lastCoin),
      phase: this.phase,
      mode: this.mode,
      aiTurn: this.isAiTurn(),
      difficultyLabel: this.mode === "ai" && !this.opponent ? AI_DIFFICULTY[this.difficulty].label : null,
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
