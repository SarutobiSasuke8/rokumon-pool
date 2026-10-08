import Phaser from "phaser";
import { AI_DIFFICULTY, resolveDifficulty } from "../game/constants.js";
export class GameOverScene extends Phaser.Scene {
  constructor() { super("GameOver"); }
  init(data) {
    this.winner = data?.winner ?? 1;
    this.message = data?.message ?? "";
    this.mode = data?.mode ?? "pvp";
    this.difficulty = resolveDifficulty(data?.difficulty);
    this.names = data?.names ?? { 1: "Player 1", 2: "Player 2" };
  }
  create() {
    this.add.rectangle(480, 270, 960, 540, 0x080b14, 0.88);
    const title = this.mode === "ai" ? (this.winner === 1 ? "YOU WIN" : "COMPUTER WINS") : `${this.names[this.winner].toUpperCase()} WINS`;
    this.add.text(480, 200, title, { fontFamily: "sans-serif", fontSize: "40px", color: "#ffffff" }).setOrigin(0.5);
    if (this.mode === "ai") this.add.text(480, 166, `Computer: ${AI_DIFFICULTY[this.difficulty].label}`, { fontFamily: "sans-serif", fontSize: "16px", color: "#fde68a" }).setOrigin(0.5);
    this.add.text(480, 258, this.message, { fontFamily: "sans-serif", fontSize: "17px", color: "#a5f3fc", align: "center", wordWrap: { width: 700 } }).setOrigin(0.5);
    this.add.text(480, 324, "Space / tap to play again", { fontFamily: "sans-serif", fontSize: "18px", color: "#93c5fd" }).setOrigin(0.5);
    this.add.text(480, 354, "Esc for the menu", { fontFamily: "sans-serif", fontSize: "14px", color: "#7dd3fc" }).setOrigin(0.5);
    const restart = () => this.scene.start("Game", this.mode === "ai" ? { mode: this.mode, difficulty: this.difficulty } : { mode: this.mode });
    this.input.keyboard.once("keydown-SPACE", restart);
    this.input.keyboard.once("keydown-ESC", () => this.scene.start("Menu"));
    this.time.delayedCall(400, () => this.input.once("pointerdown", restart));
  }
}
