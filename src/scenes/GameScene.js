import Phaser from "phaser";
import { TABLE, BALL, PHYSICS, COLORS, RACK_ORDER } from "../game/constants.js";
import { createMatchState, snapshotMatch } from "../game/state.js";
import { createRestartKey } from "../systems/input.js";
import { installDebug } from "../systems/debug.js";
import { hub } from "../integrations/hub.js";

export class GameScene extends Phaser.Scene {
  constructor() { super("Game"); }

  create() {
    this.match = createMatchState();
    this.balls = new Map();
    this.pocketedThisTurn = [];
    this.isDragging = false;
    this.waitingForRest = false;
    this.dragCurrent = { x: 0, y: 0 };

    this.drawTable();
    this.createCushions();
    this.createPockets();
    this.createBalls();
    this.setupInput();

    this.restartKey = createRestartKey(this);
    this.matter.world.on("collisionstart", (event) => this.handleCollisions(event));

    this.scene.launch("UI");
    hub.ready();
    this.updateHud("Player 1 breaks");
    installDebug(this, () => snapshotMatch(this.match));
  }

  update() {
    this.balls.forEach((entry) => {
      if (!entry.active) return;
      entry.view.x = entry.body.position.x;
      entry.view.y = entry.body.position.y;
    });

    if (this.restartKey.restartPressed()) {
      this.scene.restart();
      return;
    }

    if (this.waitingForRest) {
      const timedOut = this.time.now - this.shotStartedAt > PHYSICS.maxShotWaitMs;
      if (timedOut || this.allAtRest()) {
        if (timedOut) this.forceStop();
        this.waitingForRest = false;
        this.resolveShot();
      }
    }

    this.drawAim();
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
    g.fillStyle(COLORS.railDark, 1);
    g.fillRoundedRect(TABLE.left - t - 16, TABLE.top - t - 16, (TABLE.right - TABLE.left) + (t + 16) * 2, (TABLE.bottom - TABLE.top) + (t + 16) * 2, 18);
    g.fillStyle(COLORS.rail, 1);
    g.fillRect(TABLE.left - t, TABLE.top - t, (TABLE.right - TABLE.left) + t * 2, (TABLE.bottom - TABLE.top) + t * 2);
    g.fillStyle(COLORS.cloth, 1);
    g.fillRect(TABLE.left, TABLE.top, TABLE.right - TABLE.left, TABLE.bottom - TABLE.top);
    g.fillStyle(COLORS.pocket, 1);
    this.pocketPositions().forEach((p) => g.fillCircle(p.x, p.y, TABLE.pocketRadius));
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
  }

  createPockets() {
    this.pocketPositions().forEach((p) => {
      const body = this.matter.bodies.circle(p.x, p.y, TABLE.pocketRadius * 0.85, { isStatic: true, isSensor: true, label: "pocket" });
      this.matter.world.add(body);
    });
  }

  createBalls() {
    const r = BALL.radius;
    this.addBall("cue", TABLE.left + (TABLE.right - TABLE.left) * 0.25, TABLE.midY, COLORS.cue, false, null, true);

    const apexX = TABLE.left + (TABLE.right - TABLE.left) * 0.62;
    const rowDX = r * 2 * Math.cos(Math.PI / 6) + 0.6;
    RACK_ORDER.forEach((row, rowIndex) => {
      const x = apexX + rowIndex * rowDX;
      row.forEach((num, i) => {
        const y = TABLE.midY + (i - rowIndex / 2) * (r * 2 + 0.6);
        const isStripe = num > 8;
        const color = num === 8 ? COLORS.eight : (isStripe ? COLORS.stripes[num] : COLORS.solids[num]);
        this.addBall(num, x, y, color, isStripe, num, false);
      });
    });
  }

  addBall(id, x, y, color, isStripe, numberLabel, isCue) {
    const r = BALL.radius;
    const body = this.matter.bodies.circle(x, y, r, {
      restitution: PHYSICS.restitutionBall,
      friction: 0.02,
      frictionAir: PHYSICS.frictionAir,
      label: `ball:${id}`,
    });
    this.matter.world.add(body);

    const view = this.add.container(x, y);
    view.add(this.add.circle(0, 0, r, color));
    if (isStripe) view.add(this.add.circle(0, 0, r * 0.55, 0xffffff));
    if (!isCue) {
      if (!isStripe) view.add(this.add.circle(0, 0, r * 0.42, 0xffffff));
      view.add(this.add.text(0, 0, String(numberLabel), { fontFamily: "sans-serif", fontSize: `${Math.round(r * 0.85)}px`, color: "#111111" }).setOrigin(0.5));
    }
    this.balls.set(String(id), { id, body, view, active: true });
  }

  // ---- input / aiming -----------------------------------------------------

  setupInput() {
    this.aimGfx = this.add.graphics();

    this.input.on("pointerdown", (p) => {
      if (!this.canAim()) return;
      this.isDragging = true;
      this.dragCurrent = { x: p.worldX, y: p.worldY };
    });
    this.input.on("pointermove", (p) => {
      if (!this.isDragging) return;
      this.dragCurrent = { x: p.worldX, y: p.worldY };
    });
    this.input.on("pointerup", (p) => {
      if (!this.isDragging) return;
      this.isDragging = false;
      this.takeShot(p.worldX, p.worldY);
    });
  }

  canAim() {
    return !this.match.gameOver && !this.waitingForRest && !this.isDragging;
  }

  aimVector(px, py) {
    const cue = this.balls.get("cue");
    if (!cue || !cue.active) return null;
    const cx = cue.body.position.x;
    const cy = cue.body.position.y;
    const dx = cx - px;
    const dy = cy - py;
    const dist = Phaser.Math.Clamp(Math.hypot(dx, dy), 0, PHYSICS.maxPullback);
    return { cx, cy, angle: Math.atan2(dy, dx), dist };
  }

  takeShot(px, py) {
    const aim = this.aimVector(px, py);
    if (!aim || aim.dist < 6) return;
    const power = aim.dist / PHYSICS.maxPullback;
    const speed = power * PHYSICS.maxShotSpeed;
    const cue = this.balls.get("cue");
    this.matter.body.setVelocity(cue.body, { x: Math.cos(aim.angle) * speed, y: Math.sin(aim.angle) * speed });
    this.pocketedThisTurn = [];
    this.waitingForRest = true;
    this.shotStartedAt = this.time.now;
    this.updateHud("");
  }

  debugTeleportToPocket(id, pocketIndex = 0) {
    const entry = this.balls.get(String(id));
    if (!entry || !entry.active) return;
    const p = this.pocketPositions()[pocketIndex];
    entry.body.isSleeping = false;
    this.matter.body.setPosition(entry.body, { x: p.x, y: p.y });
    this.matter.body.setVelocity(entry.body, { x: 0, y: 0 });
    this.pocketedThisTurn = [];
    this.waitingForRest = true;
    this.shotStartedAt = this.time.now;
  }

  debugShoot(angleDeg, power = 1) {
    const cue = this.balls.get("cue");
    if (!cue || !cue.active) return;
    const angle = Phaser.Math.DegToRad(angleDeg);
    const speed = Phaser.Math.Clamp(power, 0, 1) * PHYSICS.maxShotSpeed;
    this.matter.body.setVelocity(cue.body, { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed });
    this.pocketedThisTurn = [];
    this.waitingForRest = true;
    this.shotStartedAt = this.time.now;
  }

  drawAim() {
    this.aimGfx.clear();
    if (!this.isDragging) return;
    const aim = this.aimVector(this.dragCurrent.x, this.dragCurrent.y);
    if (!aim || aim.dist < 4) return;
    const { cx, cy, angle, dist } = aim;
    const power = dist / PHYSICS.maxPullback;

    const ex = cx + Math.cos(angle) * 220;
    const ey = cy + Math.sin(angle) * 220;
    this.aimGfx.lineStyle(2, 0xffffff, 0.5);
    this.aimGfx.lineBetween(cx, cy, ex, ey);

    const pbx = cx - Math.cos(angle) * dist;
    const pby = cy - Math.sin(angle) * dist;
    const col = Phaser.Display.Color.GetColor(80 + power * 175, 210 - power * 130, 255 - power * 175);
    this.aimGfx.lineStyle(3, col, 0.9);
    this.aimGfx.lineBetween(cx, cy, pbx, pby);
    this.aimGfx.fillStyle(col, 1);
    this.aimGfx.fillCircle(pbx, pby, 5);
  }

  // ---- physics / rules -----------------------------------------------------

  forceStop() {
    this.balls.forEach((entry) => {
      if (entry.active) this.matter.body.setVelocity(entry.body, { x: 0, y: 0 });
    });
  }

  allAtRest() {
    let rest = true;
    this.balls.forEach((entry) => {
      if (!entry.active) return;
      if (entry.body.isSleeping || entry.body.speed < PHYSICS.restThreshold) {
        this.matter.body.setVelocity(entry.body, { x: 0, y: 0 });
      } else {
        rest = false;
      }
    });
    return rest;
  }

  handleCollisions(event) {
    event.pairs.forEach((pair) => {
      const pocketBody = pair.bodyA.label === "pocket" ? pair.bodyA : (pair.bodyB.label === "pocket" ? pair.bodyB : null);
      if (!pocketBody) return;
      const otherBody = pocketBody === pair.bodyA ? pair.bodyB : pair.bodyA;
      if (!otherBody.label || !otherBody.label.startsWith("ball:")) return;
      const idStr = otherBody.label.slice(5);
      const entry = this.balls.get(idStr);
      if (!entry || !entry.active) return;
      entry.active = false;
      this.matter.world.remove(entry.body);
      entry.view.destroy();
      this.pocketedThisTurn.push(idStr === "cue" ? "cue" : Number(idStr));
    });
  }

  resolveShot() {
    if (this.match.gameOver) return;
    const pocketed = this.pocketedThisTurn.splice(0);
    const player = this.match.turn;
    const scratched = pocketed.includes("cue");
    let continueTurn = false;

    if (pocketed.includes(8)) {
      const suit = this.match.assigned[player];
      const cleared = suit && this.match.remaining[suit].length === 0;
      if (suit && cleared && !scratched) {
        this.endGame(player, `Player ${player} cleared the table and sank the 8-ball!`);
      } else {
        const other = player === 1 ? 2 : 1;
        this.endGame(other, `Player ${player} pocketed the 8-ball early — Player ${other} wins!`);
      }
      return;
    }

    const objectBalls = pocketed.filter((id) => id !== "cue");
    if (objectBalls.length) {
      if (!this.match.assigned[player]) {
        const firstKind = objectBalls[0] < 8 ? "solid" : "stripe";
        const other = player === 1 ? 2 : 1;
        this.match.assigned[player] = firstKind;
        this.match.assigned[other] = firstKind === "solid" ? "stripe" : "solid";
      }
      const suit = this.match.assigned[player];
      objectBalls.forEach((num) => {
        const kind = num < 8 ? "solid" : "stripe";
        this.match.remaining[kind] = this.match.remaining[kind].filter((n) => n !== num);
        if (kind === suit) continueTurn = true;
      });
    }

    let message = "";
    if (scratched) {
      continueTurn = false;
      message = "Scratch — cue ball back in play.";
      this.respotCueBall();
    }

    if (!continueTurn) this.match.turn = player === 1 ? 2 : 1;
    this.updateHud(message);
  }

  respotCueBall() {
    const x = TABLE.left + (TABLE.right - TABLE.left) * 0.25;
    const y = TABLE.midY;
    const cue = this.balls.get("cue");
    if (cue && cue.active) {
      this.matter.body.setPosition(cue.body, { x, y });
      this.matter.body.setVelocity(cue.body, { x: 0, y: 0 });
      return;
    }
    this.addBall("cue", x, y, COLORS.cue, false, null, true);
  }

  endGame(winner, message) {
    this.match.gameOver = true;
    this.match.winner = winner;
    this.updateHud(message);
    hub.gameOver(winner);
    this.time.delayedCall(900, () => {
      this.scene.stop("UI");
      this.scene.start("GameOver", { winner, message });
    });
  }

  updateHud(message) {
    const suit = this.match.assigned[this.match.turn];
    const payload = {
      turn: this.match.turn,
      assigned: { ...this.match.assigned },
      message: message || `Player ${this.match.turn}'s turn${suit ? ` (${suit}s)` : ""}`,
      gameOver: this.match.gameOver,
    };
    this.game.registry.set("matchHud", payload);
    this.game.events.emit("match-update", payload);
  }
}
