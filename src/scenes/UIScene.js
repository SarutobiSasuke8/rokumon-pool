import Phaser from "phaser";
export class UIScene extends Phaser.Scene {
  constructor() { super("UI"); }
  create() {
    this.turnText = this.add.text(24, 14, "", { fontFamily: "sans-serif", fontSize: "20px", color: "#f8fafc" });
    this.msgText = this.add.text(24, 42, "", { fontFamily: "sans-serif", fontSize: "15px", color: "#a5f3fc" });
    this.add.text(936, 524, "Drag from cue ball, release to shoot · R restarts", { fontFamily: "sans-serif", fontSize: "13px", color: "#7dd3fc" }).setOrigin(1, 1);

    const onUpdate = (data) => {
      const p1 = data.assigned[1] ? ` — P1: ${data.assigned[1]}s` : "";
      const p2 = data.assigned[2] ? ` — P2: ${data.assigned[2]}s` : "";
      this.turnText.setText(`Player ${data.turn}'s turn${p1}${p2}`);
      this.msgText.setText(data.message || "");
    };
    const initial = this.game.registry.get("matchHud");
    if (initial) onUpdate(initial);
    this.game.events.on("match-update", onUpdate);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.game.events.off("match-update", onUpdate));
  }
}
