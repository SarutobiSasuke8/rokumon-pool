import Phaser from "phaser";
export class GameOverScene extends Phaser.Scene {
  constructor() { super("GameOver"); }
  init(data) { this.winner = data?.winner ?? 1; this.message = data?.message ?? ""; }
  create() {
    this.add.rectangle(480, 270, 960, 540, 0x080b14, 0.88);
    this.add.text(480, 210, `PLAYER ${this.winner} WINS`, { fontFamily: "sans-serif", fontSize: "40px", color: "#ffffff" }).setOrigin(0.5);
    this.add.text(480, 264, this.message, { fontFamily: "sans-serif", fontSize: "17px", color: "#a5f3fc", align: "center", wordWrap: { width: 700 } }).setOrigin(0.5);
    this.add.text(480, 330, "Space / tap to play again", { fontFamily: "sans-serif", fontSize: "18px", color: "#93c5fd" }).setOrigin(0.5);
    const restart = () => this.scene.start("Game");
    this.input.keyboard.once("keydown-SPACE", restart);
    this.input.once("pointerdown", restart);
  }
}
