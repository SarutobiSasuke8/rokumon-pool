import Phaser from "phaser";
import { FONT, UI, VIEW, addButton, addText, addTitle, setupCamera } from "../ui/theme.js";

// Six cards in two rows of three: the controls, then one card per game.
const CARDS = [
  {
    title: "AIM",
    lines: [
      "Drag on the table to turn the cue. Tap to point it at a spot.",
      "Desktop: arrow keys or the mouse wheel for fine aim.",
      "Green guide: a legal hit. Red: a foul.",
    ],
  },
  {
    title: "POWER AND SPIN",
    lines: [
      "Pull the brass power handle down and let go to shoot.",
      "Let go at the top to cancel.",
      "Tap SPIN, then touch where the cue strikes: high follows, low draws back.",
    ],
  },
  {
    title: "FOULS",
    lines: [
      "A scratch, missing every ball, or hitting the wrong ball first.",
      "Your opponent gets TWO SHOTS. A pot does not use one up.",
      "After a scratch the cue ball goes behind the line.",
    ],
  },
  {
    title: "8-BALL AND BLACKBALL",
    lines: [
      "Your first pot decides your group. Pot yours to shoot again.",
      "Clear your group, then pot the 8 (the black) to win.",
      "Pot it early and you lose.",
    ],
  },
  {
    title: "9-BALL",
    lines: [
      "Hit the lowest numbered ball first.",
      "Pot any ball on a legal shot to shoot again.",
      "Pot the 9 at any time to win. A foul gives ball in hand.",
    ],
  },
  {
    title: "SIX COINS",
    gold: true,
    lines: [
      "Six gold coins, nine reds. First to four coins wins.",
      "Pot a red and gold is on: pot a coin to bank it, then back to red.",
      "A coin potted out of turn goes back. At three each, one coin decides it.",
    ],
  },
];

const W = 288;
const H = 196;

export class HowToScene extends Phaser.Scene {
  constructor() { super("HowTo"); }

  create() {
    setupCamera(this);
    // A plain DOM marker so tests (and the hub) can tell which screen is up.
    document.body.dataset.screen = "howto";
    if (this.textures.exists("table")) this.add.image(VIEW.w / 2, VIEW.h / 2, "table").setDisplaySize(VIEW.w, VIEW.h);
    this.add.rectangle(VIEW.w / 2, VIEW.h / 2, VIEW.w, VIEW.h, 0x05070b, 0.88);
    addTitle(this, 480, 36, "HOW TO PLAY", { fontSize: "32px", color: UI.css.brass }).setOrigin(0.5);

    const g = this.add.graphics();
    CARDS.forEach((card, i) => {
      const x = 40 + (i % 3) * (W + 8);
      const y = 66 + Math.floor(i / 3) * (H + 8);
      g.fillStyle(UI.panel, 0.96);
      g.fillRoundedRect(x, y, W, H, 12);
      g.lineStyle(card.gold ? 1.5 : 1, card.gold ? UI.brass : UI.brassDark, 0.9);
      g.strokeRoundedRect(x, y, W, H, 12);
      addText(this, x + 16, y + 12, card.title, { fontFamily: FONT.display, fontStyle: "700", fontSize: "18px", color: UI.css.brass });
      let ty = y + 44;
      card.lines.forEach((line) => {
        g.fillStyle(UI.brass, 0.9);
        g.fillCircle(x + 20, ty + 8, 2);
        const t = addText(this, x + 30, ty, line, { fontSize: "12.5px", color: UI.css.cream, wordWrap: { width: W - 46 }, lineSpacing: 2 });
        ty += t.height + 8;
      });
    });

    const back = () => this.scene.start("Menu");
    addButton(this, 480, 506, 180, 38, "BACK", back, { primary: true, fontSize: 19 });
    this.input.keyboard.once("keydown-ESC", back);
    this.input.keyboard.once("keydown-SPACE", back);
  }
}
