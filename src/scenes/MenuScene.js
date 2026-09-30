import Phaser from "phaser";
import { audio } from "../systems/audio.js";

const BUTTON = { fontFamily: "sans-serif", fontSize: "22px", color: "#e7efff", backgroundColor: "#1e293b", padding: { x: 22, y: 10 } };

export class MenuScene extends Phaser.Scene {
  constructor() { super("Menu"); }

  create() {
    this.add.text(480, 130, "ROKUMON POOL", { fontFamily: "sans-serif", fontSize: "46px", color: "#e7efff" }).setOrigin(0.5);
    this.add.text(480, 184, "8-ball", { fontFamily: "sans-serif", fontSize: "18px", color: "#93c5fd" }).setOrigin(0.5);

    const start = (mode) => { audio.unlock(); this.scene.start("Game", { mode }); };
    const button = (y, label, mode, key) => {
      const t = this.add.text(480, y, label, BUTTON).setOrigin(0.5).setInteractive({ useHandCursor: true });
      t.on("pointerover", () => t.setStyle({ backgroundColor: "#334155" }));
      t.on("pointerout", () => t.setStyle({ backgroundColor: "#1e293b" }));
      t.on("pointerdown", () => start(mode));
      this.input.keyboard.on(`keydown-${key}`, () => start(mode));
      return t;
    };
    button(256, "1  Play vs Computer", "ai", "ONE");
    button(316, "2  Two Players", "pvp", "TWO");
    this.input.keyboard.once("keydown-SPACE", () => start("ai"));

    this.add.text(480, 390, "Drag anywhere on the table to pull the cue back, release to shoot.", { fontFamily: "sans-serif", fontSize: "15px", color: "#cbd5e1" }).setOrigin(0.5);
    this.add.text(480, 414, "Pot your suit, then the 8-ball, to win. Fouls give your opponent ball in hand.", { fontFamily: "sans-serif", fontSize: "15px", color: "#cbd5e1" }).setOrigin(0.5);
    this.add.text(480, 438, "R restarts · M mutes", { fontFamily: "sans-serif", fontSize: "14px", color: "#7dd3fc" }).setOrigin(0.5);
  }
}
