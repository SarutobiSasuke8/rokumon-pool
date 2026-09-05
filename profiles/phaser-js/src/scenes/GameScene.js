import Phaser from "phaser";
import { GAME } from "../game/constants.js";
import { createRunState, snapshotRun } from "../game/state.js";
import { createActions } from "../systems/input.js";
import { installDebug } from "../systems/debug.js";
import { hub } from "../integrations/hub.js";
export class GameScene extends Phaser.Scene {
  constructor() { super("Game"); }
  create() { this.state = createRunState(this.registry.get("seed") ?? GAME.seed); this.actions = createActions(this); this.player = this.add.rectangle(480, 420, 44, 44, 0x67e8f9); this.goal = this.add.circle(Phaser.Math.Between(100, 860), 150, 18, 0xfbbf24).setInteractive(); this.goal.on("pointerdown", () => this.collectGoal()); this.add.text(480, 72, "Move with ← →. Tap the gold objective.", { fontSize: "20px", color: "#cbd5e1" }).setOrigin(0.5); this.scene.launch("UI"); hub.ready(); installDebug(this, () => snapshotRun(this.state)); }
  update(_time, delta) { if (this.state.status !== "playing") return; this.state.elapsedMs += delta; this.player.x = Phaser.Math.Clamp(this.player.x + this.actions.move() * GAME.moveSpeed * (delta / 1000), 24, GAME.width - 24); if (this.actions.confirmPressed()) this.collectGoal(); }
  collectGoal() { if (this.state.status !== "playing") return; this.state.score += 1; this.goal.setPosition(Phaser.Math.Between(100, 860), Phaser.Math.Between(130, 280)); this.game.events.emit("score-changed", this.state.score); hub.score(this.state.score); if (this.state.score >= GAME.targetScore) { this.state.status = "complete"; this.scene.stop("UI"); hub.gameOver(this.state.score); this.scene.start("GameOver", { score: this.state.score }); } }
}
