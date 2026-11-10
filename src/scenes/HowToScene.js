import Phaser from "phaser";
import { FONT, UI, VIEW, addButton, addText, addTitle, setupCamera } from "../ui/theme.js";

const CARDS = [
  {
    title: "AIM",
    lines: [
      "Drag anywhere on the table to turn the cue.",
      "Tap a spot to point the cue straight at it.",
      "Desktop: arrow keys or the mouse wheel for fine aim. Hold Shift for finer.",
      "The white line shows the cue ball's path. Green means a legal hit, red a foul.",
    ],
  },
  {
    title: "POWER AND SPIN",
    lines: [
      "Pull the brass handle on the power bar down and let go to shoot.",
      "Slide it back to the top and let go to cancel.",
      "Tap the SPIN ball, then touch where the cue should strike: high to follow, low to draw back, left or right to change the rebound.",
    ],
  },
  {
    title: "8-BALL AND BLACKBALL",
    lines: [
      "The first ball you pot decides your group. Pot one of yours and you shoot again.",
      "Clear your group, then pot the 8 (the black) to win. Pot it early and you lose.",
      "A foul gives your opponent TWO SHOTS: a scratch, missing every ball, or hitting the wrong group first.",
      "After a scratch the cue ball goes behind the line. Otherwise it stays where it lies.",
    ],
  },
  {
    title: "9-BALL",
    lines: [
      "Always hit the lowest numbered ball on the table first.",
      "Pot any ball on a legal shot and you shoot again.",
      "Pot the 9 on a legal shot, at any time, and you win.",
      "A foul gives your opponent the cue ball in hand, anywhere on the table.",
    ],
  },
];

export class HowToScene extends Phaser.Scene {
  constructor() { super("HowTo"); }

  create() {
    setupCamera(this);
    // A plain DOM marker so tests (and the hub) can tell which screen is up.
    document.body.dataset.screen = "howto";
    if (this.textures.exists("table")) this.add.image(VIEW.w / 2, VIEW.h / 2, "table").setDisplaySize(VIEW.w, VIEW.h);
    this.add.rectangle(VIEW.w / 2, VIEW.h / 2, VIEW.w, VIEW.h, 0x05070b, 0.88);
    addTitle(this, 480, 40, "HOW TO PLAY", { fontSize: "36px", color: UI.css.brass }).setOrigin(0.5);

    const g = this.add.graphics();
    CARDS.forEach((card, i) => {
      const x = 40 + (i % 2) * 446;
      const y = 76 + Math.floor(i / 2) * 196;
      g.fillStyle(UI.panel, 0.96);
      g.fillRoundedRect(x, y, 434, 184, 12);
      g.lineStyle(1, UI.brassDark, 0.9);
      g.strokeRoundedRect(x, y, 434, 184, 12);
      addText(this, x + 18, y + 14, card.title, { fontFamily: FONT.display, fontStyle: "700", fontSize: "20px", color: UI.css.brass });
      let ty = y + 46;
      card.lines.forEach((line) => {
        g.fillStyle(UI.brass, 0.9);
        g.fillCircle(x + 23, ty + 8, 2);
        const t = addText(this, x + 34, ty, line, { fontSize: "13px", color: UI.css.cream, wordWrap: { width: 384 }, lineSpacing: 2 });
        ty += t.height + 7;
      });
    });

    const back = () => this.scene.start("Menu");
    addButton(this, 480, 502, 180, 40, "BACK", back, { primary: true, fontSize: 19 });
    this.input.keyboard.once("keydown-ESC", back);
    this.input.keyboard.once("keydown-SPACE", back);
  }
}
