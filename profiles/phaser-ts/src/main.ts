import Phaser from "phaser";
import { BootScene } from "./scenes/BootScene.js"; import { MenuScene } from "./scenes/MenuScene.js"; import { GameScene } from "./scenes/GameScene.js"; import { UIScene } from "./scenes/UIScene.js"; import { GameOverScene } from "./scenes/GameOverScene.js";
new Phaser.Game({ type: Phaser.AUTO, parent: "app", width: 960, height: 540, backgroundColor: "#0b1020", scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH }, scene: [BootScene, MenuScene, GameScene, UIScene, GameOverScene] });
