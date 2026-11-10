/// <reference types="vite/client" />
import Phaser from "phaser";
import "./fonts.css";
import { BootScene } from "./scenes/BootScene.js"; import { MenuScene } from "./scenes/MenuScene.js"; import { GameScene } from "./scenes/GameScene.js"; import { UIScene } from "./scenes/UIScene.js"; import { GameOverScene } from "./scenes/GameOverScene.js"; import { HowToScene } from "./scenes/HowToScene.js"; import { CampaignScene } from "./scenes/CampaignScene.js";
import { VIEW, RENDER_SCALE } from "./ui/theme.js";
import { OnlineScene } from "./scenes/OnlineScene.js";

// Phaser draws text to a canvas, so the typefaces must be ready before the
// first scene lays anything out. A failed or slow font never blocks the game.
async function loadFonts() {
  const faces = ['400 16px Barlow', '600 16px "Barlow Condensed"', '700 16px "Barlow Condensed"'];
  const all = Promise.all(faces.map((f) => document.fonts.load(f))).catch(() => {});
  await Promise.race([all, new Promise((resolve) => setTimeout(resolve, 2500))]);
}

async function start() {
  await loadFonts();
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: "app",
    // Scenes lay out in 960x540 logical units; each camera zooms by
    // RENDER_SCALE so the backing canvas is sharp on high-density screens.
    width: VIEW.w * RENDER_SCALE,
    height: VIEW.h * RENDER_SCALE,
    backgroundColor: "#0a0d12",
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    physics: {
      default: "matter",
      matter: {
        gravity: { x: 0, y: 0 },
        enableSleeping: true,
        // Matter has no continuous collision detection. A full-power cue ball
        // covers more than a ball diameter per 60 Hz step and buries itself in
        // the rack before contact is seen, so the engine runs four substeps per
        // frame. Matter 0.20 normalises velocity and air friction to 60 Hz, so
        // the tuning constants keep their meaning.
        runner: { fps: 240 },
        positionIterations: 8,
        velocityIterations: 6,
      },
    },
    scene: [BootScene, MenuScene, HowToScene, CampaignScene, GameScene, UIScene, GameOverScene, OnlineScene],
  });

  // Drop the static loading line once Phaser has booted.
  game.events.once(Phaser.Core.Events.READY, () => document.getElementById("loading")?.remove());

  // Dev-only handle so automated checks can drive the game loop (game.step)
  // even when the tab is hidden and requestAnimationFrame is paused.
  if (import.meta.env.DEV) (window as unknown as { __PHASER_GAME__: Phaser.Game }).__PHASER_GAME__ = game;
}

start();
