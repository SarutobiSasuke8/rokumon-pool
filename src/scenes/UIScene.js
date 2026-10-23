import Phaser from "phaser";
import { audio } from "../systems/audio.js";
import { turnLabel } from "../game/labels.js";
import { ballTextureKey } from "../game/balls.js";
import { playerPanels, trayBalls } from "../game/hud.js";
import { ART_SCALE, ensureBallTextures } from "../systems/ballArt.js";

// HUD layout on the 960x540 canvas. The table's outer frame spans x 40-920
// and y 40-500, so the player cards use the band above it, the turn line and
// message the band below it, and the pocketed-ball tray the right margin.
const MINI_R = 9;
const CARDS = [
  { x: 40, y: 3, w: 400, h: 34 },
  { x: 520, y: 3, w: 400, h: 34 },
];
const TRAY = { x: 923, y: 92, w: 34, h: 352 };
const HINT = "Drag anywhere to aim, release to shoot · R restarts · M mutes";

export class UIScene extends Phaser.Scene {
  constructor() { super("UI"); }

  create() {
    ensureBallTextures(this, MINI_R);
    this.cardGfx = this.add.graphics();
    this.cards = CARDS.map((box) => ({
      box,
      name: this.add.text(box.x + 12, box.y + box.h / 2, "", { fontFamily: "sans-serif", fontSize: "16px", fontStyle: "bold", color: "#f8fafc" }).setOrigin(0, 0.5),
      group: this.add.text(0, box.y + box.h / 2, "", { fontFamily: "sans-serif", fontSize: "12px", fontStyle: "bold", color: "#0b1020", padding: { x: 6, y: 3 } }).setOrigin(0, 0.5),
      balls: [],
    }));
    this.turnText = this.add.text(40, 503, "", { fontFamily: "sans-serif", fontSize: "16px", fontStyle: "bold", color: "#fde68a" });
    this.msgText = this.add.text(40, 523, "", { fontFamily: "sans-serif", fontSize: "14px", color: "#a5f3fc", wordWrap: { width: 740 } });

    this.trayGfx = this.add.graphics();
    this.trayGfx.fillStyle(0x05070d, 0.9);
    this.trayGfx.fillRoundedRect(TRAY.x, TRAY.y, TRAY.w, TRAY.h, 10);
    this.trayGfx.lineStyle(1, 0x334155, 1);
    this.trayGfx.strokeRoundedRect(TRAY.x, TRAY.y, TRAY.w, TRAY.h, 10);
    this.add.text(TRAY.x + TRAY.w / 2, TRAY.y - 6, "POTTED", { fontFamily: "sans-serif", fontSize: "9px", fontStyle: "bold", color: "#94a3b8" }).setOrigin(0.5, 1);
    this.trayBalls = [];

    this.muteButton = this.add.text(920, 532, "", { fontFamily: "sans-serif", fontSize: "14px", color: "#7dd3fc", backgroundColor: "#111827", padding: { x: 10, y: 5 } })
      .setOrigin(1, 1).setInteractive({ useHandCursor: true });
    const refreshMute = () => this.muteButton.setText(audio.muted ? "🔇 Sound off" : "🔊 Sound on");
    this.muteButton.on("pointerdown", (p, x, y, event) => { audio.toggleMuted(); refreshMute(); event?.stopPropagation?.(); });
    this.input.keyboard.on("keydown-M", () => { audio.toggleMuted(); refreshMute(); });
    refreshMute();

    // Pause overlay: the Game scene pauses when the tab is hidden or the
    // window loses focus, so a rolling shot or the computer's turn never
    // plays out unseen. It cannot take input while paused, so this scene
    // owns resume.
    const overlay = this.add.container(0, 0, [
      this.add.rectangle(480, 270, 960, 540, 0x080b14, 0.78),
      this.add.text(480, 236, "PAUSED", { fontFamily: "sans-serif", fontSize: "44px", color: "#ffffff" }).setOrigin(0.5),
      this.add.text(480, 296, "Tap, click or press Space to resume", { fontFamily: "sans-serif", fontSize: "18px", color: "#93c5fd" }).setOrigin(0.5),
    ]).setDepth(100).setVisible(false);
    this.children.bringToTop(this.muteButton);
    const isPaused = () => this.scene.isPaused("Game");
    const pause = () => {
      const game = this.scene.get("Game");
      if (!this.scene.isActive("Game") || game.match?.gameOver || game.phase === "over") return;
      game.cancelDrag?.();
      this.scene.pause("Game");
      overlay.setVisible(true);
    };
    const resume = () => {
      if (!isPaused()) return;
      audio.unlock(); // Mobile browsers can suspend the AudioContext while the tab is hidden.
      overlay.setVisible(false);
      this.scene.resume("Game");
    };
    this.game.events.on(Phaser.Core.Events.HIDDEN, pause);
    this.game.events.on(Phaser.Core.Events.BLUR, pause);
    this.input.on("pointerdown", (p, over) => { if (isPaused() && !over.includes(this.muteButton)) resume(); });
    this.input.keyboard.on("keydown-SPACE", resume);
    this.input.keyboard.on("keydown-P", () => (isPaused() ? resume() : pause()));
    this.input.keyboard.on("keydown-ESC", () => (isPaused() ? resume() : pause()));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.game.events.off(Phaser.Core.Events.HIDDEN, pause);
      this.game.events.off(Phaser.Core.Events.BLUR, pause);
    });

    const onUpdate = (data) => {
      const names = data.names || { 1: "Player 1", 2: "Player 2" };
      const suit = data.assigned[data.turn];
      this.turnText.setText(data.gameOver ? "" : turnLabel(names, data.turn, suit));
      this.msgText.setText(data.message || HINT).setColor(data.message ? "#a5f3fc" : "#7dd3fc");
      this.drawCards(data);
      this.drawTray(data.pocketed || []);
    };
    const initial = this.game.registry.get("matchHud");
    if (initial) onUpdate(initial);
    this.game.events.on("match-update", onUpdate);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.game.events.off("match-update", onUpdate));
  }

  ballImage(id, x, y, alpha = 1) {
    return this.add.image(x, y, ballTextureKey(id, MINI_R)).setScale(1 / ART_SCALE).setAlpha(alpha);
  }

  // One card per player: name, group chip and the group's seven balls, with
  // the ones already pocketed shown as faint slots (just the 8-ball once the
  // group is cleared). The shooter's card is lit.
  drawCards(data) {
    const g = this.cardGfx.clear();
    playerPanels(data).forEach((panel, i) => {
      const card = this.cards[i];
      const { box } = card;
      g.fillStyle(panel.active ? 0x1e293b : 0x0f172a, panel.active ? 0.98 : 0.85);
      g.fillRoundedRect(box.x, box.y, box.w, box.h, 8);
      g.lineStyle(panel.active ? 2 : 1, panel.active ? 0xfde68a : 0x334155, 1);
      g.strokeRoundedRect(box.x, box.y, box.w, box.h, 8);

      card.name.setText(`${panel.active ? "▶ " : ""}${panel.name}`).setColor(panel.active ? "#fde68a" : "#cbd5e1");
      const chip = panel.onEight ? { bg: "#f8fafc", fg: "#0b1020" }
        : panel.group === "solid" ? { bg: "#fde68a", fg: "#0b1020" }
          : panel.group === "stripe" ? { bg: "#e0f2fe", fg: "#0b1020" }
            : { bg: "#334155", fg: "#e2e8f0" };
      card.group.setText(panel.label).setStyle({ backgroundColor: chip.bg, color: chip.fg });
      card.group.setX(card.name.x + card.name.width + 10);

      card.balls.forEach((b) => b.destroy());
      card.balls = [];
      let x = card.group.x + card.group.width + 8 + MINI_R;
      const y = box.y + box.h / 2;
      if (panel.onEight) {
        card.balls.push(this.ballImage(8, x, y));
        return;
      }
      panel.balls.forEach(({ id, onTable }) => {
        card.balls.push(this.ballImage(id, x, y, onTable ? 1 : 0.18));
        x += MINI_R * 2 + 3;
      });
    });
  }

  // Pocketed object balls, top to bottom in the order they dropped.
  drawTray(pocketed) {
    this.trayBalls.forEach((b) => b.destroy());
    this.trayBalls = trayBalls(pocketed).map((id, i) => this.ballImage(id, TRAY.x + TRAY.w / 2, TRAY.y + 14 + i * 22));
  }
}
