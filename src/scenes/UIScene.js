import Phaser from "phaser";
import { audio } from "../systems/audio.js";
import { loadSettings, saveSettings } from "../systems/settings.js";
import { turnLabel } from "../game/labels.js";
import { ballTextureKey } from "../game/balls.js";
import { playerPanels, trayBalls } from "../game/hud.js";
import { ART_SCALE, ensureBallTextures } from "../systems/ballArt.js";
import { FONT, UI, VIEW, addButton, addText, addTitle, setupCamera } from "../ui/theme.js";

// HUD layout on the 960x540 logical canvas. The table's outer frame spans
// x 40-920 and y 40-500, so the player cards use the band above it, the turn
// line and message the band below it, the pocketed-ball tray the right
// margin and the power bar (drawn by the Game scene) the left margin.
const MINI_R = 9;
const CARDS = [
  { x: 40, y: 4, w: 396, h: 32 },
  { x: 524, y: 4, w: 396, h: 32 },
];
const TRAY = { x: 925, y: 96, w: 30, h: 348 };
const SPIN = { x: 938, y: 520, r: 14 };
const DIAL = { x: 480, y: 262, r: 66 };
const HINT = "Drag on the table to aim. Pull the power bar down and let go to shoot.";

export class UIScene extends Phaser.Scene {
  constructor() { super("UI"); }

  create() {
    setupCamera(this);
    ensureBallTextures(this, MINI_R);
    this.overlayMode = null;

    this.cardGfx = this.add.graphics();
    this.cards = CARDS.map((box) => ({
      box,
      name: addText(this, box.x + 12, box.y + box.h / 2, "", { fontFamily: FONT.display, fontStyle: "700", fontSize: "18px" }).setOrigin(0, 0.5),
      group: addText(this, 0, box.y + box.h / 2, "", { fontFamily: FONT.display, fontStyle: "700", fontSize: "12px", color: UI.css.ink, padding: { x: 6, y: 2 } }).setOrigin(0, 0.5),
      balls: [],
    }));
    this.turnText = addText(this, 46, 504, "", { fontFamily: FONT.display, fontStyle: "700", fontSize: "18px", color: UI.css.brass });
    this.msgText = addText(this, 46, 524, "", { fontSize: "13px", color: UI.css.sky, wordWrap: { width: 760 } });

    const tray = this.add.graphics();
    tray.fillStyle(0x05070b, 0.82);
    tray.fillRoundedRect(TRAY.x, TRAY.y, TRAY.w, TRAY.h, 10);
    tray.lineStyle(1, UI.brassDark, 0.8);
    tray.strokeRoundedRect(TRAY.x, TRAY.y, TRAY.w, TRAY.h, 10);
    addText(this, TRAY.x + TRAY.w / 2, TRAY.y - 5, "POTTED", { fontFamily: FONT.display, fontStyle: "600", fontSize: "10px", color: UI.css.dim }).setOrigin(0.5, 1);
    this.trayBalls = [];

    this.pauseButton = addButton(this, 480, 20, 60, 28, "II", () => this.openPause(), { fontSize: 15 });
    this.buildSpinButton();
    this.buildPauseOverlay();
    this.buildSpinOverlay();

    // The Game scene pauses when the tab is hidden, the window loses focus
    // or the rotate-phone prompt covers the table, so a rolling shot or the
    // computer's turn never plays out unseen. A paused scene takes no input,
    // so this scene owns resume.
    const rotatePrompt = document.getElementById("rotate");
    this.rotatePrompt = rotatePrompt;
    const autoPause = () => this.openPause();
    this.game.events.on(Phaser.Core.Events.HIDDEN, autoPause);
    this.game.events.on(Phaser.Core.Events.BLUR, autoPause);
    // The portrait prompt covers the whole table without hiding the tab.
    // Observe the actual prompt so the pause follows the same layout rule.
    const rotation = new ResizeObserver(() => { if (rotatePrompt?.offsetWidth) this.openPause(); });
    if (rotatePrompt) rotation.observe(rotatePrompt);

    const toggle = () => (this.overlayMode ? this.closeOverlay() : this.openPause());
    this.input.keyboard.on("keydown-SPACE", () => { if (this.overlayMode) this.closeOverlay(); });
    this.input.keyboard.on("keydown-P", toggle);
    this.input.keyboard.on("keydown-ESC", toggle);
    this.input.keyboard.on("keydown-M", () => { audio.toggleMuted(); this.refreshPauseLabels(); });

    const onUpdate = (data) => {
      const names = data.names || { 1: "Player 1", 2: "Player 2" };
      const suit = data.assigned[data.turn];
      this.hud = data;
      this.turnText.setText(data.gameOver ? "" : turnLabel(names, data.turn, suit).toUpperCase());
      this.msgText.setText(data.message || (data.aiTurn || data.phase !== "aim" ? "" : HINT)).setColor(data.message ? UI.css.sky : UI.css.dim);
      this.drawCards(data);
      this.drawTray(data.pocketed || []);
      this.drawSpinButton();
      if (this.overlayMode === "spin" && !this.canSpin()) this.closeOverlay();
    };
    const onSpin = () => { this.drawSpinButton(); this.drawDial(); };
    const initial = this.game.registry.get("matchHud");
    if (initial) onUpdate(initial);
    this.game.events.on("match-update", onUpdate);
    this.registry.events.on("changedata-spin", onSpin);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      rotation.disconnect();
      this.game.events.off(Phaser.Core.Events.HIDDEN, autoPause);
      this.game.events.off(Phaser.Core.Events.BLUR, autoPause);
      this.game.events.off("match-update", onUpdate);
      this.registry.events.off("changedata-spin", onSpin);
    });
  }

  gameScene() { return this.scene.get("Game"); }

  canSpin() {
    const d = this.hud;
    return Boolean(d) && d.phase === "aim" && !d.aiTurn && !d.gameOver;
  }

  spin() { return this.registry.get("spin") || { x: 0, y: 0 }; }

  // ---- overlays -------------------------------------------------------------

  pauseGame() {
    const game = this.gameScene();
    if (!this.scene.isActive("Game") || game.match?.gameOver || game.phase === "over") return false;
    game.cancelDrag?.();
    this.scene.pause("Game");
    return true;
  }

  openPause() {
    if (this.overlayMode === "pause") return;
    if (this.overlayMode === "spin") this.spinOverlay.setVisible(false);
    else if (!this.pauseGame()) return;
    this.overlayMode = "pause";
    this.refreshPauseLabels();
    this.setPauseVisible(true);
  }

  openSpin() {
    if (this.overlayMode || !this.canSpin() || !this.pauseGame()) return;
    this.overlayMode = "spin";
    this.spinOverlay.setVisible(true);
    this.spinButtons.forEach((b) => b.setVisible(true));
    this.drawDial();
  }

  closeOverlay() {
    if (!this.overlayMode) return;
    // The table must be visible before play resumes.
    if (this.rotatePrompt?.offsetWidth) return;
    audio.unlock(); // Mobile browsers can suspend the AudioContext while the tab is hidden.
    this.setPauseVisible(false);
    this.spinOverlay.setVisible(false);
    this.spinButtons.forEach((b) => b.setVisible(false));
    this.overlayMode = null;
    this.scene.resume("Game");
  }

  setPauseVisible(v) {
    this.pauseOverlay.setVisible(v);
    this.pauseButtons.forEach((b) => b.setVisible(v));
  }

  buildPauseOverlay() {
    const shade = this.add.rectangle(VIEW.w / 2, VIEW.h / 2, VIEW.w, VIEW.h, 0x05070b, 0.8).setInteractive();
    const panel = this.add.graphics();
    panel.fillStyle(UI.panel, 0.98);
    panel.fillRoundedRect(330, 86, 300, 372, 14);
    panel.lineStyle(1.5, UI.brassDark, 1);
    panel.strokeRoundedRect(330, 86, 300, 372, 14);
    const title = addTitle(this, 480, 122, "PAUSED", { fontSize: "34px", color: UI.css.brass }).setOrigin(0.5);
    this.pauseOverlay = this.add.container(0, 0, [shade, panel, title]).setDepth(100).setVisible(false);

    const row = (i) => 176 + i * 50;
    const opts = { depth: 101, fontSize: 18 };
    const game = () => this.gameScene();
    this.soundButton = addButton(this, 480, row(2), 240, 38, "", () => { audio.toggleMuted(); this.refreshPauseLabels(); }, opts);
    this.guideButton = addButton(this, 480, row(3), 240, 38, "", () => {
      const next = saveSettings({ guide: !loadSettings().guide });
      const g = game();
      if (g.settings) g.settings.guide = next.guide;
      this.refreshPauseLabels();
    }, opts);
    this.pauseButtons = [
      addButton(this, 480, row(0), 240, 38, "RESUME", () => this.closeOverlay(), { ...opts, primary: true }),
      addButton(this, 480, row(1), 240, 38, "RESTART MATCH", () => {
        const g = game();
        this.scene.resume("Game");
        g.scene.restart(g.restartData());
      }, opts),
      this.soundButton,
      this.guideButton,
      addButton(this, 480, row(4), 240, 38, "QUIT TO MENU", () => {
        this.scene.stop("Game");
        this.scene.start("Menu");
      }, opts),
    ];
    this.pauseButtons.forEach((b) => b.setVisible(false));
  }

  refreshPauseLabels() {
    this.soundButton?.setLabel(audio.muted ? "SOUND: OFF" : "SOUND: ON");
    this.guideButton?.setLabel(loadSettings().guide ? "AIM GUIDE: ON" : "AIM GUIDE: OFF");
  }

  // ---- spin -----------------------------------------------------------------

  buildSpinButton() {
    this.spinGfx = this.add.graphics();
    addText(this, SPIN.x - SPIN.r - 6, SPIN.y, "SPIN", { fontFamily: FONT.display, fontStyle: "600", fontSize: "11px", color: UI.css.dim }).setOrigin(1, 0.5);
    this.add.zone(SPIN.x - 14, SPIN.y, 76, 36).setInteractive({ useHandCursor: true })
      .on("pointerdown", (p, x, y, event) => { event?.stopPropagation?.(); this.openSpin(); });
    this.drawSpinButton();
  }

  drawSpinButton() {
    const g = this.spinGfx.clear();
    const s = this.spin();
    const alpha = this.canSpin() ? 1 : 0.4;
    g.fillStyle(0x000000, 0.4 * alpha);
    g.fillCircle(SPIN.x + 1, SPIN.y + 2, SPIN.r);
    g.fillStyle(0xf3ead7, alpha);
    g.fillCircle(SPIN.x, SPIN.y, SPIN.r);
    g.lineStyle(1, 0x6b6250, alpha);
    g.strokeCircle(SPIN.x, SPIN.y, SPIN.r);
    g.fillStyle(UI.red, alpha);
    g.fillCircle(SPIN.x + s.x * SPIN.r * 0.7, SPIN.y - s.y * SPIN.r * 0.7, 3.2);
  }

  buildSpinOverlay() {
    const shade = this.add.rectangle(VIEW.w / 2, VIEW.h / 2, VIEW.w, VIEW.h, 0x05070b, 0.72).setInteractive();
    const panel = this.add.graphics();
    panel.fillStyle(UI.panel, 0.98);
    panel.fillRoundedRect(340, 92, 280, 356, 14);
    panel.lineStyle(1.5, UI.brassDark, 1);
    panel.strokeRoundedRect(340, 92, 280, 356, 14);
    const title = addTitle(this, 480, 120, "CUE-BALL SPIN", { fontSize: "24px", color: UI.css.brass }).setOrigin(0.5);
    const small = { fontFamily: FONT.display, fontStyle: "600", fontSize: "12px", color: UI.css.dim };
    const labels = [
      addText(this, DIAL.x, DIAL.y - DIAL.r - 12, "FOLLOW", small).setOrigin(0.5),
      addText(this, DIAL.x, DIAL.y + DIAL.r + 12, "DRAW", small).setOrigin(0.5),
      addText(this, DIAL.x - DIAL.r - 10, DIAL.y, "LEFT", small).setOrigin(1, 0.5),
      addText(this, DIAL.x + DIAL.r + 10, DIAL.y, "RIGHT", small).setOrigin(0, 0.5),
      addText(this, 480, 366, "Touch the ball where the cue should strike it.", { fontSize: "12px", color: UI.css.dim }).setOrigin(0.5),
    ];
    this.dialGfx = this.add.graphics();
    const dial = this.add.zone(DIAL.x, DIAL.y, DIAL.r * 2 + 20, DIAL.r * 2 + 20).setInteractive({ useHandCursor: true });
    const set = (p) => {
      let x = (p.worldX - DIAL.x) / (DIAL.r * 0.8);
      let y = -(p.worldY - DIAL.y) / (DIAL.r * 0.8);
      const len = Math.hypot(x, y);
      if (len > 1) { x /= len; y /= len; }
      if (len < 0.12) { x = 0; y = 0; }
      this.registry.set("spin", { x, y });
    };
    dial.on("pointerdown", (p) => { this.dialDown = true; set(p); });
    dial.on("pointermove", (p) => { if (this.dialDown && p.isDown) set(p); });
    this.input.on("pointerup", () => { this.dialDown = false; });
    this.spinOverlay = this.add.container(0, 0, [shade, panel, title, ...labels, this.dialGfx, dial]).setDepth(100).setVisible(false);
    this.spinButtons = [
      addButton(this, 418, 412, 110, 36, "CENTRE", () => this.registry.set("spin", { x: 0, y: 0 }), { depth: 101, fontSize: 17 }),
      addButton(this, 542, 412, 110, 36, "DONE", () => this.closeOverlay(), { depth: 101, fontSize: 17, primary: true }),
    ];
    this.spinButtons.forEach((b) => b.setVisible(false));
  }

  drawDial() {
    if (!this.dialGfx) return;
    const g = this.dialGfx.clear();
    const s = this.spin();
    g.fillStyle(0x000000, 0.5);
    g.fillCircle(DIAL.x + 3, DIAL.y + 5, DIAL.r);
    g.fillStyle(0xf3ead7, 1);
    g.fillCircle(DIAL.x, DIAL.y, DIAL.r);
    g.fillStyle(0xffffff, 0.7);
    g.fillCircle(DIAL.x - DIAL.r * 0.3, DIAL.y - DIAL.r * 0.34, DIAL.r * 0.3);
    g.lineStyle(1, 0x8a8068, 0.6);
    g.strokeCircle(DIAL.x, DIAL.y, DIAL.r * 0.8);
    g.lineBetween(DIAL.x - DIAL.r * 0.8, DIAL.y, DIAL.x + DIAL.r * 0.8, DIAL.y);
    g.lineBetween(DIAL.x, DIAL.y - DIAL.r * 0.8, DIAL.x, DIAL.y + DIAL.r * 0.8);
    g.fillStyle(UI.red, 1);
    g.fillCircle(DIAL.x + s.x * DIAL.r * 0.8, DIAL.y - s.y * DIAL.r * 0.8, 9);
    g.lineStyle(1.5, 0x5c1410, 1);
    g.strokeCircle(DIAL.x + s.x * DIAL.r * 0.8, DIAL.y - s.y * DIAL.r * 0.8, 9);
  }

  // ---- HUD ------------------------------------------------------------------

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
      g.fillStyle(0x000000, 0.4);
      g.fillRoundedRect(box.x, box.y + 2, box.w, box.h, 8);
      g.fillStyle(panel.active ? UI.panelLit : UI.panel, panel.active ? 0.98 : 0.88);
      g.fillRoundedRect(box.x, box.y, box.w, box.h, 8);
      g.lineStyle(panel.active ? 2 : 1, panel.active ? UI.brass : UI.line, 1);
      g.strokeRoundedRect(box.x, box.y, box.w, box.h, 8);
      if (panel.active) {
        g.fillStyle(UI.brass, 1);
        g.fillRoundedRect(box.x, box.y + 6, 4, box.h - 12, 2);
      }

      card.name.setText(panel.name.toUpperCase()).setColor(panel.active ? UI.css.brass : UI.css.dim);
      const chip = panel.onEight ? { bg: "#f3ead7", fg: UI.css.ink }
        : panel.group === "solid" ? { bg: "#e3b458", fg: UI.css.ink }
          : panel.group === "stripe" ? { bg: "#cfe6f2", fg: UI.css.ink }
            : { bg: "#2e3a48", fg: "#d5dde6" };
      card.group.setText(panel.label).setStyle({ backgroundColor: chip.bg, color: chip.fg });
      card.group.setX(card.name.x + card.name.width + 10);

      card.balls.forEach((b) => b.destroy());
      card.balls = [];
      let x = card.group.x + card.group.width + 10 + MINI_R;
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
    this.trayBalls = trayBalls(pocketed).map((id, i) => this.ballImage(id, TRAY.x + TRAY.w / 2, TRAY.y + 15 + i * 22.5));
  }
}
