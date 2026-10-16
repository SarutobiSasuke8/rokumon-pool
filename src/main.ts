/// <reference types="vite/client" />
import Phaser from "phaser";
import { BootScene } from "./scenes/BootScene.js"; import { MenuScene } from "./scenes/MenuScene.js"; import { GameScene } from "./scenes/GameScene.js"; import { UIScene } from "./scenes/UIScene.js"; import { GameOverScene } from "./scenes/GameOverScene.js";
const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: "app",
  width: 960,
  height: 540,
  backgroundColor: "#0b1020",
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
  scene: [BootScene, MenuScene, GameScene, UIScene, GameOverScene],
});

// Drop the static loading line once Phaser has booted.
game.events.once(Phaser.Core.Events.READY, () => document.getElementById("loading")?.remove());

// Dev-only handle so automated checks can drive the game loop (game.step)
// even when the tab is hidden and requestAnimationFrame is paused.
if (import.meta.env.DEV) (window as unknown as { __PHASER_GAME__: Phaser.Game }).__PHASER_GAME__ = game;
