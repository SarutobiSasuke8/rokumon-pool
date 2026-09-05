import Phaser from "phaser";
export class UIScene extends Phaser.Scene {
  constructor() { super("UI"); }
  create() { this.label = this.add.text(24, 20, "Score: 0", { fontFamily: "monospace", fontSize: "24px", color: "#ffffff" }); this.game.events.on("score-changed", (score) => this.label.setText(`Score: ${score}`)); this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.game.events.off("score-changed")); }
}
