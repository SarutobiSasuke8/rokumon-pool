import Phaser from "phaser";
import { AI_DIFFICULTY, resolveDifficulty } from "../game/constants.js";
import { FONT, UI, VIEW, addButton, addText, addTitle, drawRokumon, setupCamera } from "../ui/theme.js";

function clock(ms) {
  const s = Math.max(0, Math.round((ms || 0) / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

// Results: who won and why, each player's match figures, and the running
// record against the computer.
export class GameOverScene extends Phaser.Scene {
  constructor() { super("GameOver"); }

  init(data) {
    this.winner = data?.winner ?? 1;
    this.message = data?.message ?? "";
    this.mode = data?.mode ?? "pvp";
    this.difficulty = resolveDifficulty(data?.difficulty);
    this.names = data?.names ?? { 1: "Player 1", 2: "Player 2" };
    this.stats = data?.stats ?? null;
    this.durationMs = data?.durationMs ?? 0;
    this.record = data?.record ?? null;
  }

  create() {
    setupCamera(this);
    // A plain DOM marker so tests (and the hub) can tell which screen is up.
    document.body.dataset.screen = "gameover";
    if (this.textures.exists("table")) this.add.image(VIEW.w / 2, VIEW.h / 2, "table").setDisplaySize(VIEW.w, VIEW.h);
    this.add.rectangle(VIEW.w / 2, VIEW.h / 2, VIEW.w, VIEW.h, 0x05070b, 0.84);

    const g = this.add.graphics();
    g.fillStyle(UI.panel, 0.97);
    g.fillRoundedRect(250, 44, 460, 452, 16);
    g.lineStyle(1.5, UI.brassDark, 1);
    g.strokeRoundedRect(250, 44, 460, 452, 16);
    drawRokumon(g, 480, 76, 5, UI.brass, 0.9);

    const won = this.mode === "ai" ? this.winner === 1 : true;
    const title = this.mode === "ai" ? (won ? "YOU WIN" : "COMPUTER WINS") : `${this.names[this.winner].toUpperCase()} WINS`;
    addTitle(this, 480, 126, title, { fontSize: "52px", color: won ? UI.css.brass : UI.css.cream }).setOrigin(0.5);
    addText(this, 480, 170, this.message, { fontSize: "14px", color: UI.css.sky, align: "center", wordWrap: { width: 400 } }).setOrigin(0.5);

    if (this.stats) this.drawStats(g);

    const lines = [`Match time ${clock(this.durationMs)}`];
    if (this.mode === "ai" && this.record) {
      const row = this.record[this.difficulty];
      lines.push(`Record on ${AI_DIFFICULTY[this.difficulty].label}: ${row.won} won, ${row.lost} lost`);
    }
    addText(this, 480, 382, lines.join("   ·   "), { fontSize: "13px", color: UI.css.dim }).setOrigin(0.5);

    const restart = () => this.scene.start("Game", this.mode === "ai" ? { mode: this.mode, difficulty: this.difficulty } : { mode: this.mode });
    const menu = () => this.scene.start("Menu");
    // A short delay so the tap that ended the match cannot also start one.
    this.time.delayedCall(350, () => {
      addButton(this, 398, 436, 180, 44, "PLAY AGAIN", restart, { primary: true, fontSize: 20 });
      addButton(this, 574, 436, 150, 44, "MENU", menu, { fontSize: 20 });
    });
    this.input.keyboard.once("keydown-SPACE", restart);
    this.input.keyboard.once("keydown-ESC", menu);
  }

  drawStats(g) {
    const rows = [
      ["SHOTS", (s) => s.shots],
      ["BALLS POTTED", (s) => s.pots],
      ["BEST RUN", (s) => s.bestRun],
      ["FOULS", (s) => s.fouls],
    ];
    const top = 214;
    const head = { fontFamily: FONT.display, fontStyle: "700", fontSize: "16px" };
    addText(this, 380, top, this.names[1].toUpperCase(), { ...head, color: this.winner === 1 ? UI.css.brass : UI.css.dim }).setOrigin(0.5);
    addText(this, 580, top, this.names[2].toUpperCase(), { ...head, color: this.winner === 2 ? UI.css.brass : UI.css.dim }).setOrigin(0.5);
    g.lineStyle(1, UI.line, 1);
    g.lineBetween(290, top + 16, 670, top + 16);
    rows.forEach(([label, pick], i) => {
      const y = top + 40 + i * 30;
      addText(this, 480, y, label, { fontFamily: FONT.display, fontStyle: "600", fontSize: "13px", color: UI.css.dim }).setOrigin(0.5);
      addText(this, 380, y, String(pick(this.stats[1])), { fontFamily: FONT.display, fontStyle: "700", fontSize: "22px" }).setOrigin(0.5);
      addText(this, 580, y, String(pick(this.stats[2])), { fontFamily: FONT.display, fontStyle: "700", fontSize: "22px" }).setOrigin(0.5);
    });
  }
}
