import Phaser from "phaser";
import { AI_DIFFICULTY, DIFFICULTY_ORDER } from "../game/constants.js";
import { VARIANTS, VARIANT_INFO, resolveVariant } from "../game/state.js";
import { audio } from "../systems/audio.js";
import { CHARACTERS, loadCampaign, trophyCount } from "../systems/campaign.js";
import { loadDifficulty, saveDifficulty } from "../systems/difficulty.js";
import { loadSettings, saveSettings } from "../systems/settings.js";
import { loadRecord } from "../systems/stats.js";
import { FONT, UI, VIEW, addButton, addText, addTitle, drawRokumon, setupCamera } from "../ui/theme.js";

// Title screen. The key art (src/art/keyart) fills the view when it exists;
// the menu sits in a column on the left over a dark fade so it stays legible.
const COL = 232;
const CHIP_W = 88;

export class MenuScene extends Phaser.Scene {
  constructor() { super("Menu"); }

  create() {
    setupCamera(this);
    // A plain DOM marker so tests (and the hub) can tell which screen is up.
    document.body.dataset.screen = "menu";
    this.drawBackdrop();

    const crest = this.add.graphics();
    drawRokumon(crest, COL, 40, 6, UI.brass, 0.95);
    addText(this, COL, 72, "R O K U M O N", { fontFamily: FONT.display, fontStyle: "600", fontSize: "18px", color: UI.css.brass }).setOrigin(0.5);
    addTitle(this, COL, 114, "POOL", { fontSize: "76px", color: UI.css.cream }).setOrigin(0.5);
    const rule = this.add.graphics();
    rule.lineStyle(1.5, UI.brass, 0.8);
    rule.lineBetween(COL - 140, 158, COL - 96, 158);
    rule.lineBetween(COL + 96, 158, COL + 140, 158);
    addText(this, COL, 158, "8-BALL · 9-BALL · BLACKBALL", { fontFamily: FONT.display, fontStyle: "600", fontSize: "13px", color: UI.css.dim }).setOrigin(0.5);

    this.difficulty = loadDifficulty();
    this.variant = resolveVariant(loadSettings().variant);
    const start = (mode) => {
      audio.unlock();
      const base = { mode, variant: this.variant };
      this.scene.start("Game", mode === "ai" ? { ...base, difficulty: this.difficulty } : base);
    };
    const campaign = () => { audio.unlock(); this.scene.start("Campaign"); };

    addButton(this, COL, 200, 280, 44, "CAMPAIGN", campaign, { primary: true, fontSize: 22 });
    const won = trophyCount(loadCampaign());
    addText(this, COL, 232, won ? `${won} of ${CHARACTERS.length} trophies won` : "Ten opponents. Ten trophies.", { fontSize: "12px", color: UI.css.dim }).setOrigin(0.5);

    addText(this, COL, 258, "QUICK MATCH", { fontFamily: FONT.display, fontStyle: "600", fontSize: "12px", color: UI.css.brass }).setOrigin(0.5);
    this.chipGfx = this.add.graphics();

    // Which game: tap a chip.
    this.variantChips = VARIANTS.map((key, i) => this.chip(COL + (i - 1) * (CHIP_W + 6), 284, VARIANT_INFO[key].short, () => this.selectVariant(key), key));
    this.blurb = addText(this, COL, 308, "", { fontSize: "12px", color: UI.css.dim }).setOrigin(0.5);

    addButton(this, COL, 340, 280, 38, "PLAY VS COMPUTER", () => start("ai"), { fontSize: 19 });
    // Difficulty: tap a chip, or use the arrow keys.
    this.chips = DIFFICULTY_ORDER.map((key, i) => this.chip(COL + (i - 1) * (CHIP_W + 6), 380, AI_DIFFICULTY[key].label.toUpperCase(), () => this.select(key), key));
    this.recordText = addText(this, COL, 403, "", { fontSize: "12px", color: UI.css.dim }).setOrigin(0.5);

    addButton(this, COL, 432, 280, 36, "TWO PLAYERS", () => start("pvp"), { fontSize: 19 });

    addButton(this, COL - 96, 474, 88, 30, "HOW TO", () => this.scene.start("HowTo"), { fontSize: 14 });
    const sound = addButton(this, COL, 474, 88, 30, "", () => { audio.unlock(); audio.toggleMuted(); labels(); }, { fontSize: 14 });
    const music = addButton(this, COL + 96, 474, 88, 30, "", () => { audio.unlock(); if (audio.hasMusic) audio.toggleMusic(); labels(); }, { fontSize: 14 });
    const labels = () => {
      sound.setLabel(audio.muted ? "SOUND OFF" : "SOUND ON");
      music.setLabel(!audio.hasMusic ? "NO MUSIC" : audio.musicOn ? "MUSIC ON" : "MUSIC OFF");
    };
    labels();
    addText(this, COL, 506, "Keys: C campaign, 1 computer, 2 two players, arrows difficulty, M sound", { fontSize: "10px", color: UI.css.dim }).setOrigin(0.5);
    this.refresh();

    const step = (delta) => {
      const i = DIFFICULTY_ORDER.indexOf(this.difficulty);
      this.select(DIFFICULTY_ORDER[Math.max(0, Math.min(DIFFICULTY_ORDER.length - 1, i + delta))]);
    };
    const keys = this.input.keyboard;
    keys.on("keydown-ONE", () => start("ai"));
    keys.on("keydown-TWO", () => start("pvp"));
    keys.on("keydown-C", campaign);
    keys.once("keydown-SPACE", () => start("ai"));
    keys.on("keydown-LEFT", () => step(-1));
    keys.on("keydown-RIGHT", () => step(1));
    keys.on("keydown-M", () => { audio.toggleMuted(); labels(); });
    keys.on("keydown-H", () => this.scene.start("HowTo"));
    // Any touch starts the audio, so the music can begin on the title screen.
    this.input.once("pointerdown", () => audio.unlock());
  }

  chip(x, y, label, onPress, key) {
    const text = addText(this, x, y, label, { fontFamily: FONT.display, fontStyle: "600", fontSize: "14px" }).setOrigin(0.5);
    this.add.zone(x, y, CHIP_W, 32).setInteractive({ useHandCursor: true }).on("pointerdown", () => { audio.unlock(); audio.ui(); onPress(); });
    return { key, x, y, label: text };
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
    fade.fillGradientStyle(UI.bg, UI.bg, UI.bg, UI.bg, 0.95, 0.72 + base, 0.95, 0.72 + base);
    fade.fillRect(0, 0, split, VIEW.h);
    fade.fillGradientStyle(UI.bg, UI.bg, UI.bg, UI.bg, 0.72 + base, base, 0.72 + base, base);
    fade.fillRect(split, 0, end - split, VIEW.h);
    if (base) { fade.fillStyle(UI.bg, base); fade.fillRect(end, 0, VIEW.w - end, VIEW.h); }
    if (!art) drawRokumon(fade, 700, 270, 44, UI.brassDark, 0.35);
  }

  select(key) {
    this.difficulty = saveDifficulty(key);
    this.refresh();
  }

  selectVariant(key) {
    this.variant = resolveVariant(saveSettings({ variant: key }).variant);
    this.refresh();
  }

  refresh() {
    const g = this.chipGfx.clear();
    const draw = (chips, current) => chips.forEach(({ key, x, y, label }) => {
      const on = key === current;
      g.fillStyle(on ? UI.cream : UI.panel, on ? 1 : 0.9);
      g.fillRoundedRect(x - CHIP_W / 2, y - 14, CHIP_W, 28, 14);
      g.lineStyle(1, on ? UI.cream : UI.line, 1);
      g.strokeRoundedRect(x - CHIP_W / 2, y - 14, CHIP_W, 28, 14);
      label.setColor(on ? UI.css.ink : UI.css.dim);
    });
    draw(this.variantChips, this.variant);
    draw(this.chips, this.difficulty);
    this.blurb.setText(VARIANT_INFO[this.variant].blurb);
    const row = loadRecord()[this.difficulty];
    const name = AI_DIFFICULTY[this.difficulty].label;
    this.recordText.setText(row.won + row.lost > 0 ? `Your record on ${name}: ${row.won} won, ${row.lost} lost` : `No matches on ${name} yet`);
  }
}
