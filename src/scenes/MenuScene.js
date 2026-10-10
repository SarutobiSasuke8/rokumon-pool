import Phaser from "phaser";
import { AI_DIFFICULTY, DIFFICULTY_ORDER } from "../game/constants.js";
import { audio } from "../systems/audio.js";
import { loadDifficulty, saveDifficulty } from "../systems/difficulty.js";

const BUTTON = { fontFamily: "sans-serif", fontSize: "22px", color: "#e7efff", backgroundColor: "#1e293b", padding: { x: 22, y: 10 } };
const CHIP = { fontFamily: "sans-serif", fontSize: "17px", color: "#cbd5e1", backgroundColor: "#1e293b", padding: { x: 16, y: 7 } };
const CHIP_ON = { color: "#0b1020", backgroundColor: "#fde68a" };
const CHIP_OFF = { color: "#cbd5e1", backgroundColor: "#1e293b" };

export class MenuScene extends Phaser.Scene {
  constructor() { super("Menu"); }

  create() {
    this.add.text(480, 120, "ROKUMON POOL", { fontFamily: "sans-serif", fontSize: "46px", color: "#e7efff" }).setOrigin(0.5);
    this.add.text(480, 170, "8-ball", { fontFamily: "sans-serif", fontSize: "18px", color: "#93c5fd" }).setOrigin(0.5);

    this.difficulty = loadDifficulty();
    const start = (mode) => {
      audio.unlock();
      this.scene.start("Game", mode === "ai" ? { mode, difficulty: this.difficulty } : { mode });
    };
    const button = (y, label, mode, key) => {
      const t = this.add.text(480, y, label, BUTTON).setOrigin(0.5).setInteractive({ useHandCursor: true });
      t.on("pointerover", () => t.setStyle({ backgroundColor: "#334155" }));
      t.on("pointerout", () => t.setStyle({ backgroundColor: "#1e293b" }));
      t.on("pointerdown", () => start(mode));
      this.input.keyboard.on(`keydown-${key}`, () => start(mode));
      return t;
    };
    button(232, "1  Play vs Computer", "ai", "ONE");

    // Difficulty row: tap or click a chip, or use the arrow keys.
    this.add.text(300, 284, "Computer", { fontFamily: "sans-serif", fontSize: "16px", color: "#93c5fd" }).setOrigin(0.5);
    const chips = DIFFICULTY_ORDER.map((key, i) => {
      const chip = this.add.text(400 + i * 100, 284, AI_DIFFICULTY[key].label, CHIP).setOrigin(0.5).setInteractive({ useHandCursor: true });
      chip.on("pointerdown", () => select(key));
      return chip;
    });
    const refresh = () => chips.forEach((chip, i) => chip.setStyle(DIFFICULTY_ORDER[i] === this.difficulty ? CHIP_ON : CHIP_OFF));
    const select = (key) => { this.difficulty = saveDifficulty(key); refresh(); };
    const step = (delta) => {
      const i = DIFFICULTY_ORDER.indexOf(this.difficulty);
      select(DIFFICULTY_ORDER[Math.max(0, Math.min(DIFFICULTY_ORDER.length - 1, i + delta))]);
    };
    this.input.keyboard.on("keydown-LEFT", () => step(-1));
    this.input.keyboard.on("keydown-RIGHT", () => step(1));
    refresh();

    button(340, "2  Two Players", "pvp", "TWO");
    this.input.keyboard.once("keydown-SPACE", () => start("ai"));

    this.add.text(480, 400, "Drag anywhere on the table to pull the cue back, release to shoot.", { fontFamily: "sans-serif", fontSize: "15px", color: "#cbd5e1" }).setOrigin(0.5);
    this.add.text(480, 424, "Pot your suit, then the 8-ball, to win. Fouls give your opponent ball in hand.", { fontFamily: "sans-serif", fontSize: "15px", color: "#cbd5e1" }).setOrigin(0.5);
    this.add.text(480, 448, "← → computer difficulty · R restarts · M mutes", { fontFamily: "sans-serif", fontSize: "14px", color: "#7dd3fc" }).setOrigin(0.5);
  }
}
