import Phaser from "phaser";
export class MenuScene extends Phaser.Scene {
  constructor() { super("Menu"); }
  create() {
    this.add.text(480, 220, "BROWSER GAME", { fontFamily: "sans-serif", fontSize: "48px", color: "#e7efff" }).setOrigin(0.5);
    this.add.text(480, 292, "Press Space or tap to play", { fontFamily: "sans-serif", fontSize: "22px", color: "#93c5fd" }).setOrigin(0.5);
    const start = () => this.scene.start("Game"); this.input.keyboard.once("keydown-SPACE", start); this.input.once("pointerdown", start);
  }
}
