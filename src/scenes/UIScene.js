import Phaser from "phaser";
import { ballColor } from "../game/constants.js";
import { audio } from "../systems/audio.js";

const MINI_R = 6;

export class UIScene extends Phaser.Scene {
  constructor() { super("UI"); }

  create() {
    this.turnText = this.add.text(24, 12, "", { fontFamily: "sans-serif", fontSize: "20px", color: "#f8fafc" });
    this.msgText = this.add.text(24, 40, "", { fontFamily: "sans-serif", fontSize: "15px", color: "#a5f3fc" });
    this.hint = this.add.text(24, 524, "Drag anywhere to aim, release to shoot · R restarts · M mutes", { fontFamily: "sans-serif", fontSize: "13px", color: "#7dd3fc" }).setOrigin(0, 1);

    this.p1Label = this.add.text(600, 12, "", { fontFamily: "sans-serif", fontSize: "14px", color: "#cbd5e1" });
    this.p2Label = this.add.text(600, 36, "", { fontFamily: "sans-serif", fontSize: "14px", color: "#cbd5e1" });
    this.ballGfx = this.add.graphics();

    this.muteButton = this.add.text(936, 524, "", { fontFamily: "sans-serif", fontSize: "14px", color: "#7dd3fc", backgroundColor: "#111827", padding: { x: 10, y: 5 } })
      .setOrigin(1, 1).setInteractive({ useHandCursor: true });
    const refreshMute = () => this.muteButton.setText(audio.muted ? "🔇 Sound off" : "🔊 Sound on");
    this.muteButton.on("pointerdown", (p, x, y, event) => { audio.toggleMuted(); refreshMute(); event?.stopPropagation?.(); });
    this.input.keyboard.on("keydown-M", () => { audio.toggleMuted(); refreshMute(); });
    refreshMute();

    const onUpdate = (data) => {
      const names = data.names || { 1: "Player 1", 2: "Player 2" };
      const suit = data.assigned[data.turn];
      this.turnText.setText(`${names[data.turn]}'s turn${suit ? ` · ${suit}s` : ""}`);
      this.msgText.setText(data.message || "");
      this.drawRemaining(data, names);
    };
    const initial = this.game.registry.get("matchHud");
    if (initial) onUpdate(initial);
    this.game.events.on("match-update", onUpdate);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.game.events.off("match-update", onUpdate));
  }

  drawRemaining(data, names) {
    this.ballGfx.clear();
    [1, 2].forEach((player, row) => {
      const label = row === 0 ? this.p1Label : this.p2Label;
      const suit = data.assigned[player];
      const active = data.turn === player && !data.gameOver;
      label.setColor(active ? "#fde68a" : "#94a3b8");
      if (!suit) {
        label.setText(`${names[player]}  open table`);
        return;
      }
      const remaining = data.remaining[suit];
      label.setText(`${names[player]}  ${suit}s${remaining.length === 0 ? "  · on the 8-ball" : ""}`);
      const y = label.y + label.height / 2;
      let x = label.x + label.width + 12;
      remaining.forEach((num) => {
        this.ballGfx.fillStyle(ballColor(num), 1);
        this.ballGfx.fillCircle(x, y, MINI_R);
        if (num > 8) {
          this.ballGfx.fillStyle(0xffffff, 1);
          this.ballGfx.fillCircle(x, y, MINI_R * 0.5);
        }
        x += MINI_R * 2 + 4;
      });
    });
  }
}
