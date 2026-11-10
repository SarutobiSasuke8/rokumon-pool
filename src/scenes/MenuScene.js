import Phaser from "phaser";
import { AI_DIFFICULTY, DIFFICULTY_ORDER } from "../game/constants.js";
import { audio } from "../systems/audio.js";
import { loadDifficulty, saveDifficulty } from "../systems/difficulty.js";
import { loadRecord } from "../systems/stats.js";
import { FONT, UI, VIEW, addButton, addText, addTitle, drawRokumon, setupCamera } from "../ui/theme.js";

// Title screen. The key art (src/art/keyart) fills the view when it exists;
// the menu sits in a column on the left over a dark fade so it stays legible.
const COL = 232;

export class MenuScene extends Phaser.Scene {
  constructor() { super("Menu"); }

  create() {
    setupCamera(this);
    // A plain DOM marker so tests (and the hub) can tell which screen is up.
    document.body.dataset.screen = "menu";
    this.drawBackdrop();

    const crest = this.add.graphics();
    drawRokumon(crest, COL, 66, 7, UI.brass, 0.95);
    addText(this, COL, 104, "R O K U M O N", { fontFamily: FONT.display, fontStyle: "600", fontSize: "20px", color: UI.css.brass }).setOrigin(0.5);
    addTitle(this, COL, 150, "POOL", { fontSize: "84px", color: UI.css.cream }).setOrigin(0.5);
    const rule = this.add.graphics();
    rule.lineStyle(1.5, UI.brass, 0.8);
    rule.lineBetween(COL - 110, 196, COL - 34, 196);
    rule.lineBetween(COL + 34, 196, COL + 110, 196);
    addText(this, COL, 196, "8-BALL", { fontFamily: FONT.display, fontStyle: "600", fontSize: "15px", color: UI.css.dim }).setOrigin(0.5);

    this.difficulty = loadDifficulty();
    const start = (mode) => {
      audio.unlock();
      this.scene.start("Game", mode === "ai" ? { mode, difficulty: this.difficulty } : { mode });
    };

    addButton(this, COL, 244, 280, 46, "PLAY VS COMPUTER", () => start("ai"), { primary: true, fontSize: 22 });

    // Difficulty row: tap a chip, or use the arrow keys.
    this.chipGfx = this.add.graphics();
    this.chips = DIFFICULTY_ORDER.map((key, i) => {
      const x = COL - 94 + i * 94;
      const label = addText(this, x, 294, AI_DIFFICULTY[key].label.toUpperCase(), { fontFamily: FONT.display, fontStyle: "600", fontSize: "15px" }).setOrigin(0.5);
      this.add.zone(x, 294, 88, 34).setInteractive({ useHandCursor: true }).on("pointerdown", () => this.select(key));
      return { key, x, label };
    });
    this.recordText = addText(this, COL, 322, "", { fontSize: "12px", color: UI.css.dim }).setOrigin(0.5);
    this.refresh();

    addButton(this, COL, 366, 280, 42, "TWO PLAYERS", () => start("pvp"), { fontSize: 20 });
    addButton(this, COL - 72, 416, 136, 36, "HOW TO PLAY", () => this.scene.start("HowTo"), { fontSize: 16 });
    const sound = addButton(this, COL + 72, 416, 136, 36, "", () => { audio.unlock(); audio.toggleMuted(); label(); }, { fontSize: 16 });
    const label = () => sound.setLabel(audio.muted ? "SOUND: OFF" : "SOUND: ON");
    label();

    addText(this, COL, 470, "Keys: 1 computer, 2 two players, arrows difficulty, M sound", { fontSize: "11px", color: UI.css.dim }).setOrigin(0.5);

    const step = (delta) => {
      const i = DIFFICULTY_ORDER.indexOf(this.difficulty);
      this.select(DIFFICULTY_ORDER[Math.max(0, Math.min(DIFFICULTY_ORDER.length - 1, i + delta))]);
    };
    const keys = this.input.keyboard;
    keys.on("keydown-ONE", () => start("ai"));
    keys.on("keydown-TWO", () => start("pvp"));
    keys.once("keydown-SPACE", () => start("ai"));
    keys.on("keydown-LEFT", () => step(-1));
    keys.on("keydown-RIGHT", () => step(1));
    keys.on("keydown-M", () => { audio.toggleMuted(); label(); });
    keys.on("keydown-H", () => this.scene.start("HowTo"));
  }

  drawBackdrop() {
    const art = ["keyart", "table"].find((key) => this.textures.exists(key));
    if (art) {
      const img = this.add.image(VIEW.w / 2, VIEW.h / 2, art);
      const scale = Math.max(VIEW.w / img.width, VIEW.h / img.height);
      img.setScale(scale);
      if (art === "table") img.setAlpha(0.5);
    }
    // Dark fade from the left so the menu column reads over any art: two
    // gradient panels, strong across the column and gone by mid-screen.
    const fade = this.add.graphics();
    const base = art ? 0 : 0.25;
    const split = VIEW.w * 0.42;
    const end = VIEW.w * 0.74;
    fade.fillGradientStyle(UI.bg, UI.bg, UI.bg, UI.bg, 0.94, 0.7 + base, 0.94, 0.7 + base);
    fade.fillRect(0, 0, split, VIEW.h);
    fade.fillGradientStyle(UI.bg, UI.bg, UI.bg, UI.bg, 0.7 + base, base, 0.7 + base, base);
    fade.fillRect(split, 0, end - split, VIEW.h);
    if (base) { fade.fillStyle(UI.bg, base); fade.fillRect(end, 0, VIEW.w - end, VIEW.h); }
    if (!art) drawRokumon(fade, 700, 270, 44, UI.brassDark, 0.35);
  }

  select(key) {
    this.difficulty = saveDifficulty(key);
    this.refresh();
  }

  refresh() {
    const g = this.chipGfx.clear();
    this.chips.forEach(({ key, x, label }) => {
      const on = key === this.difficulty;
      g.fillStyle(on ? UI.cream : UI.panel, on ? 1 : 0.9);
      g.fillRoundedRect(x - 43, 279, 86, 30, 15);
      g.lineStyle(1, on ? UI.cream : UI.line, 1);
      g.strokeRoundedRect(x - 43, 279, 86, 30, 15);
      label.setColor(on ? UI.css.ink : UI.css.dim);
    });
    const row = loadRecord()[this.difficulty];
    const name = AI_DIFFICULTY[this.difficulty].label;
    this.recordText.setText(row.won + row.lost > 0 ? `Your record on ${name}: ${row.won} won, ${row.lost} lost` : `No matches on ${name} yet`);
  }
}
