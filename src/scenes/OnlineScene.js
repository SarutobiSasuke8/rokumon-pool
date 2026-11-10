import Phaser from "phaser";
import { BALL, INPUT, POWER_BAR, TABLE } from "../game/constants.js";
import { BALL_IDS, ballTextureKey } from "../game/balls.js";
import { withNames } from "../game/labels.js";
import { ART_SCALE, ensureBallTextures } from "../systems/ballArt.js";
import { audio } from "../systems/audio.js";
import { UI, VIEW, addPoolLogo, addText, addTitle, setupCamera } from "../ui/theme.js";

const MATCH = "/api/pool/match";
const HEAD = TABLE.left + (TABLE.right - TABLE.left) * 0.25;

export class OnlineScene extends Phaser.Scene {
  constructor() { super("Online"); }

  create({ room }) {
    setupCamera(this);
    document.body.dataset.screen = "online";
    delete document.body.dataset.tableRevision;
    this.room = room;
    this.table = null;
    this.angle = 0;
    this.power = 0.5;
    this.pulling = false;
    this.busy = false;
    this.replaying = false;
    this.link = "Connecting to the table…";
    this.notice = "";
    this.controller = new AbortController();
    const cloth = this.add.rectangle(480, 270, 880, 460, 0x176743);
    if (this.textures.exists("table")) {
      cloth.setVisible(false);
      this.add.image(480, 270, "table").setDisplaySize(VIEW.w, VIEW.h);
    }
    ensureBallTextures(this, BALL.radius);
    this.guide = this.add.graphics();
    this.ballViews = new Map(BALL_IDS.map((id) => [id,
      this.add.image(0, 0, ballTextureKey(id, BALL.radius)).setScale(1 / ART_SCALE).setVisible(false)]));
    this.turn = addTitle(this, 480, 21, "", { fontSize: "24px", color: UI.css.brass }).setOrigin(0.5);
    this.home = addText(this, 52, 20, "", { fontSize: "16px", color: UI.css.cream }).setOrigin(0, 0.5);
    this.away = addText(this, 908, 20, "", { fontSize: "16px", color: UI.css.cream }).setOrigin(1, 0.5);
    this.status = addText(this, 52, 505, "", { fontSize: "14px", wordWrap: { width: 685 } });
    addPoolLogo(this, 837, 520);
    this.input.on("pointerdown", this.press, this);
    this.input.on("pointermove", this.movePointer, this);
    this.input.on("pointerup", this.release, this);
    this.input.on("pointerupoutside", this.cancelPull, this);
    const keys = this.input.keyboard;
    keys.on("keydown-LEFT", () => this.adjustAim(-0.018));
    keys.on("keydown-RIGHT", () => this.adjustAim(0.018));
    keys.on("keydown-UP", () => this.adjustPower(0.05));
    keys.on("keydown-DOWN", () => this.adjustPower(-0.05));
    keys.on("keydown-SPACE", () => this.shoot());
    this.events.once("shutdown", () => {
      this.controller.abort();
      clearTimeout(this.poll);
      this.input.off("pointerdown", this.press, this);
      this.input.off("pointermove", this.movePointer, this);
      this.input.off("pointerup", this.release, this);
      this.input.off("pointerupoutside", this.cancelPull, this);
    });
    this.draw();
    void this.refresh();
  }

  available() {
    const t = this.table;
    return t && !this.busy && !this.replaying && !this.link && !t.state.match.gameOver && t.state.match.turn === t.seat;
  }

  showBalls(balls) {
    this.ballViews.forEach((view) => view.setVisible(false));
    balls.forEach(([id, x, y]) => this.ballViews.get(id)?.setPosition(x, y).setVisible(true));
  }

  accept(table) {
    if (this.table && this.table.revision >= table.revision) return;
    const previous = this.table;
    this.table = table;
    document.body.dataset.tableRevision = String(table.revision);
    this.notice = "";
    this.replayTimer?.remove();
    this.replaying = Boolean(previous && table.replay.length);
    if (this.replaying) {
      let index = 0;
      this.replayTimer = this.time.addEvent({
        delay: 50, repeat: table.replay.length - 1,
        callback: () => {
          this.showBalls(table.replay[index++]);
          if (index === table.replay.length) this.settle();
        },
      });
    } else this.settle();
    this.draw();
  }

  settle() {
    this.replaying = false;
    this.showBalls(this.table.state.balls);
    const cue = this.table.state.balls.find(([id]) => id === "cue");
    const target = this.table.state.balls.find(([id]) => typeof id === "number" && id !== 8);
    if (cue && target) this.angle = Math.atan2(target[2] - cue[2], target[1] - cue[1]);
    this.draw();
  }

  async refresh() {
    if (this.controller.signal.aborted) return;
    const after = this.table ? `&after=${this.table.revision}` : "";
    try {
      const response = await fetch(`${MATCH}?id=${encodeURIComponent(this.room)}${after}`, {
        cache: "no-store", signal: AbortSignal.any([this.controller.signal, AbortSignal.timeout(3500)]),
      });
      if (this.controller.signal.aborted) return;
      if (response.status === 401 || response.status === 404) {
        this.link = response.status === 401 ? "Sign in again to rejoin." : "This table is closed.";
      } else {
        if (!response.ok) throw new Error("Network");
        const table = await response.json();
        if (this.controller.signal.aborted) return;
        this.link = "";
        if (!table.unchanged) this.accept(table);
      }
    } catch {
      if (this.controller.signal.aborted) return;
      this.link = "Connection lost. Reconnecting…";
    }
    this.draw();
    this.poll = setTimeout(() => void this.refresh(), 850);
  }

  async send(move) {
    if (!this.available()) return;
    this.busy = true;
    this.notice = "";
    this.draw();
    try {
      const response = await fetch(MATCH, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: this.room, revision: this.table.revision, move }),
        signal: AbortSignal.any([this.controller.signal, AbortSignal.timeout(5500)]),
      });
      const result = await response.json();
      if (this.controller.signal.aborted) return;
      if (response.ok) {
        this.accept(result);
        if (move.type === "shot") audio.strike(move.power);
      } else this.notice = result.error || "Move unavailable.";
    } catch {
      if (this.controller.signal.aborted) return;
      this.link = "Connection lost. Checking the table…";
    } finally {
      this.busy = false;
      if (!this.controller.signal.aborted) this.draw();
    }
  }

  position(pointer) { return this.cameras.main.getWorldPoint(pointer.x, pointer.y); }

  press(pointer) {
    if (!this.available()) return;
    audio.unlock();
    const { x, y } = this.position(pointer);
    if (this.table.state.placement === "kitchen") {
      if (x >= TABLE.left && x <= HEAD && y >= TABLE.top && y <= TABLE.bottom) void this.send({ type: "place", x, y });
      return;
    }
    if (x <= POWER_BAR.zoneRight && y >= POWER_BAR.y - 20 && y <= POWER_BAR.y + POWER_BAR.h + 20) {
      this.pulling = true;
      this.movePointer(pointer);
    } else if (x >= TABLE.left && x <= TABLE.right && y >= TABLE.top && y <= TABLE.bottom) this.aimAt(x, y);
  }

  movePointer(pointer) {
    if (!pointer.isDown || !this.available() || this.table.state.placement !== "none") return;
    const { x, y } = this.position(pointer);
    if (this.pulling) this.power = Phaser.Math.Clamp((y - POWER_BAR.y) / POWER_BAR.h, 0, 1);
    else if (x >= TABLE.left && x <= TABLE.right && y >= TABLE.top && y <= TABLE.bottom) this.aimAt(x, y);
    this.draw();
  }

  release() {
    if (!this.pulling) return;
    this.pulling = false;
    this.shoot();
  }
  cancelPull() { this.pulling = false; }
  aimAt(x, y) {
    const cue = this.table.state.balls.find(([id]) => id === "cue");
    if (cue) this.angle = Math.atan2(y - cue[2], x - cue[1]);
    this.draw();
  }
  adjustAim(delta) {
    if (!this.available()) return;
    this.angle = Math.atan2(Math.sin(this.angle + delta), Math.cos(this.angle + delta));
    this.draw();
  }
  adjustPower(delta) {
    if (!this.available()) return;
    this.power = Phaser.Math.Clamp(this.power + delta, INPUT.minPower, 1);
    this.draw();
  }
  shoot() {
    if (this.available() && this.table.state.placement === "none" && this.power >= INPUT.minPower) {
      void this.send({ type: "shot", angle: this.angle, power: this.power });
    }
  }

  draw() {
    const g = this.guide.clear();
    const t = this.table;
    if (!t) { this.turn.setText("PRIVATE 8-BALL"); this.status.setText(this.link); return; }
    const match = t.state.match;
    const name = (seat) => seat === t.seat ? "You" : t.names[seat];
    const names = { 1: name(1), 2: name(2) };
    const group = (seat) => match.assigned?.[seat] === "solid" ? "solids" : match.assigned?.[seat] === "stripe" ? "stripes" : "open";
    const player = (seat) => `${name(seat).slice(0, 19)} · ${group(seat)}`;
    this.home.setText(player(1));
    this.away.setText(player(2));
    const turn = match.turn === t.seat ? "YOUR TURN" : `${name(match.turn).slice(0, 19)} to shoot`;
    this.turn.setText(match.gameOver ? (match.winner === t.seat ? "YOU WIN" : `${name(match.winner).slice(0, 19)} wins`)
      : this.replaying ? "BALLS IN PLAY" : `${turn}${match.shots === 2 ? " · 2 SHOTS" : ""}`);
    const details = this.link || this.notice || (this.busy ? "Sending move…" : this.replaying ? "Watching the shot…" : "");
    const hint = this.available()
      ? (t.state.placement === "kitchen" ? "Tap behind the line to place the cue ball." : "Drag to aim. Pull and release the power bar to shoot.")
      : "";
    const message = withNames(t.state.message, names);
    this.status.setText(details || [message, hint].filter(Boolean).join("  "));
    if (match.gameOver || this.replaying) return;
    g.lineStyle(1, UI.brass, 0.75);
    g.strokeRoundedRect(10, POWER_BAR.y, 25, POWER_BAR.h, 8);
    if (!this.available()) return;
    if (t.state.placement === "kitchen") {
      g.fillStyle(UI.brass, 0.2);
      g.fillRect(TABLE.left + BALL.radius, TABLE.top + BALL.radius, HEAD - TABLE.left - BALL.radius, TABLE.bottom - TABLE.top - BALL.radius * 2);
      return;
    }
    g.fillStyle(UI.brass, 0.88);
    g.fillRoundedRect(12, POWER_BAR.y + 2, 21, Math.max(4, this.power * (POWER_BAR.h - 4)), 5);
    const cue = t.state.balls.find(([id]) => id === "cue");
    if (!cue) return;
    g.lineStyle(2, UI.cream, 0.7);
    g.lineBetween(cue[1], cue[2], cue[1] + Math.cos(this.angle) * 86, cue[2] + Math.sin(this.angle) * 86);
  }
}
