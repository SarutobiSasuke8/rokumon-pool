import Phaser from "phaser";
import { AI_DIFFICULTY, resolveDifficulty } from "../game/constants.js";
import { VARIANT_INFO, resolveVariant } from "../game/state.js";
import { audio } from "../systems/audio.js";
import { CHARACTERS, characterById, opponentData } from "../systems/campaign.js";
import { addTrophy } from "../ui/collectibles.js";
import { FONT, UI, VIEW, addButton, addText, addTitle, drawRokumon, setupCamera } from "../ui/theme.js";

function clock(ms) {
  const s = Math.max(0, Math.round((ms || 0) / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

// Results: who won and why, each player's match figures, and either the
// running record against the computer or the campaign trophy.
export class GameOverScene extends Phaser.Scene {
  constructor() { super("GameOver"); }

  init(data) {
    this.winner = data?.winner ?? 1;
    this.message = data?.message ?? "";
    this.mode = data?.mode ?? "pvp";
    this.variant = resolveVariant(data?.variant);
    this.difficulty = resolveDifficulty(data?.difficulty);
    this.opponent = data?.opponent ?? null;
    this.rivalId = data?.rivalId ?? null;
    this.names = data?.names ?? { 1: "Player 1", 2: "Player 2" };
    this.stats = data?.stats ?? null;
    this.durationMs = data?.durationMs ?? 0;
    this.record = data?.record ?? null;
    this.campaign = data?.campaign ?? null;
  }

  create() {
    setupCamera(this);
    // A plain DOM marker so tests (and the hub) can tell which screen is up.
    document.body.dataset.screen = "gameover";
    if (this.textures.exists("table")) this.add.image(VIEW.w / 2, VIEW.h / 2, "table").setDisplaySize(VIEW.w, VIEW.h);
    this.add.rectangle(VIEW.w / 2, VIEW.h / 2, VIEW.w, VIEW.h, 0x05070b, 0.84);

    const g = this.add.graphics();
    g.fillStyle(UI.panel, 0.97);
    g.fillRoundedRect(250, 32, 460, 476, 16);
    g.lineStyle(1.5, UI.brassDark, 1);
    g.strokeRoundedRect(250, 32, 460, 476, 16);
    drawRokumon(g, 480, 60, 5, UI.brass, 0.9);

    const won = this.mode === "ai" ? this.winner === 1 : true;
    const title = this.mode === "ai" ? (won ? "YOU WIN" : `${this.names[2].toUpperCase()} WINS`) : `${this.names[this.winner].toUpperCase()} WINS`;
    const size = title.length > 18 ? 34 : title.length > 13 ? 42 : 52;
    addTitle(this, 480, 108, title, { fontSize: `${size}px`, color: won ? UI.css.brass : UI.css.cream }).setOrigin(0.5);
    addText(this, 480, 150, this.message, { fontSize: "14px", color: UI.css.sky, align: "center", wordWrap: { width: 400 } }).setOrigin(0.5);

    if (this.stats) this.drawStats(g);
    this.drawFooter();

    const restart = () => {
      const base = { mode: this.mode, variant: this.variant };
      this.scene.start("Game", this.mode !== "ai" ? base : this.opponent ? { ...base, opponent: this.opponent } : { ...base, difficulty: this.difficulty, rivalId: this.rivalId });
    };
    const leave = () => this.scene.start(this.opponent ? "Campaign" : "Menu");
    const next = this.campaign?.nextId ? characterById(this.campaign.nextId) : null;
    const onward = next ? () => this.scene.start("Game", { mode: "ai", variant: next.variant, opponent: opponentData(next) }) : null;
    // A short delay so the tap that ended the match cannot also start one.
    this.time.delayedCall(350, () => {
      if (onward) {
        addButton(this, 372, 462, 200, 44, "NEXT OPPONENT", onward, { primary: true, fontSize: 19 });
        addButton(this, 532, 462, 100, 44, "REMATCH", restart, { fontSize: 16 });
        addButton(this, 642, 462, 100, 44, "LADDER", leave, { fontSize: 16 });
      } else {
        addButton(this, 398, 462, 180, 44, this.opponent && !won ? "TRY AGAIN" : "PLAY AGAIN", restart, { primary: true, fontSize: 20 });
        addButton(this, 574, 462, 150, 44, this.opponent ? "LADDER" : "MENU", leave, { fontSize: 20 });
      }
    });
    this.input.keyboard.once("keydown-SPACE", onward || restart);
    this.input.keyboard.once("keydown-ESC", leave);
  }

  drawStats(g) {
    const rows = [
      ["SHOTS", (s) => s.shots],
      ["BALLS POTTED", (s) => s.pots],
      ["BEST RUN", (s) => s.bestRun],
      ["FOULS", (s) => s.fouls],
    ];
    const top = 192;
    const head = { fontFamily: FONT.display, fontStyle: "700", fontSize: "15px" };
    addText(this, 380, top, this.names[1].toUpperCase(), { ...head, color: this.winner === 1 ? UI.css.brass : UI.css.dim }).setOrigin(0.5);
    addText(this, 580, top, this.names[2].toUpperCase(), { ...head, color: this.winner === 2 ? UI.css.brass : UI.css.dim }).setOrigin(0.5);
    g.lineStyle(1, UI.line, 1);
    g.lineBetween(290, top + 15, 670, top + 15);
    rows.forEach(([label, pick], i) => {
      const y = top + 38 + i * 28;
      addText(this, 480, y, label, { fontFamily: FONT.display, fontStyle: "600", fontSize: "13px", color: UI.css.dim }).setOrigin(0.5);
      addText(this, 380, y, String(pick(this.stats[1])), { fontFamily: FONT.display, fontStyle: "700", fontSize: "21px" }).setOrigin(0.5);
      addText(this, 580, y, String(pick(this.stats[2])), { fontFamily: FONT.display, fontStyle: "700", fontSize: "21px" }).setOrigin(0.5);
    });
  }

  // Below the figures: the trophy for a campaign match, the record for a
  // quick match against the computer.
  drawFooter() {
    const time = `${VARIANT_INFO[this.variant].label}  ·  Match time ${clock(this.durationMs)}`;
    const c = this.campaign;
    if (c && c.won) {
      addTrophy(this, 315, 389, 62, c.gold);
      const kind = c.gold ? "GOLD" : "BRONZE";
      addTitle(this, 352, 376, `${kind} TROPHY: ${String(c.trophy).toUpperCase()}`, { fontSize: "20px", color: c.gold ? "#f2c33d" : "#d99a5b" }).setOrigin(0, 0.5);
      const note = c.completed ? `All ${CHARACTERS.length} braves beaten. The ladder is yours.`
        : c.gold ? "Won without a foul."
          : "Win without a foul to turn it gold.";
      addText(this, 352, 398, note, { fontSize: "12px", color: UI.css.dim }).setOrigin(0, 0.5);
      addText(this, 480, 426, time, { fontSize: "12px", color: UI.css.dim }).setOrigin(0.5);
      if (c.firstWin || c.newGold) audio.trophy();
      return;
    }
    const lines = [time];
    if (this.mode === "ai" && this.record) {
      const row = this.record[this.difficulty];
      lines.push(`Record on ${AI_DIFFICULTY[this.difficulty].label}: ${row.won} won, ${row.lost} lost`);
    }
    if (c && !c.won) lines.push("Beat them to win the trophy and move up the ladder.");
    addText(this, 480, 392, lines.join("\n"), { fontSize: "13px", color: UI.css.dim, align: "center", lineSpacing: 4 }).setOrigin(0.5);
  }
}
