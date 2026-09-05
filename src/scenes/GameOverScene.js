import Phaser from "phaser";
export class GameOverScene extends Phaser.Scene {
  constructor() { super("GameOver"); }
  init(data) { this.score = data.score ?? 0; }
  create() { this.add.rectangle(480, 270, 960, 540, 0x080b14, 0.88); this.add.text(480, 220, "RUN COMPLETE", { fontSize: "44px", color: "#ffffff" }).setOrigin(0.5); this.add.text(480, 280, `Score: ${this.score}`, { fontSize: "26px", color: "#a5f3fc" }).setOrigin(0.5); this.add.text(480, 340, "Space / tap to restart", { fontSize: "20px", color: "#93c5fd" }).setOrigin(0.5); const restart = () => this.scene.start("Game"); this.input.keyboard.once("keydown-SPACE", restart); this.input.once("pointerdown", restart); }
}
