import Phaser from "phaser";
export class MenuScene extends Phaser.Scene {
  constructor() { super("Menu"); }
  create() {
    this.add.text(480, 180, "ROKUMON POOL", { fontFamily: "sans-serif", fontSize: "46px", color: "#e7efff" }).setOrigin(0.5);
    this.add.text(480, 236, "Local 2-player 8-ball", { fontFamily: "sans-serif", fontSize: "18px", color: "#93c5fd" }).setOrigin(0.5);
    this.add.text(480, 286, "Drag away from the cue ball, release to shoot.", { fontFamily: "sans-serif", fontSize: "16px", color: "#cbd5e1" }).setOrigin(0.5);
    this.add.text(480, 312, "Pot your suit, then the 8-ball, to win.", { fontFamily: "sans-serif", fontSize: "16px", color: "#cbd5e1" }).setOrigin(0.5);
    this.add.text(480, 362, "Press Space or tap to start", { fontFamily: "sans-serif", fontSize: "18px", color: "#7dd3fc" }).setOrigin(0.5);
    const start = () => this.scene.start("Game");
    this.input.keyboard.once("keydown-SPACE", start);
    this.input.once("pointerdown", start);
  }
}
