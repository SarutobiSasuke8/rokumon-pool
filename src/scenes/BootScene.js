import Phaser from "phaser";

// Rendered art is optional: whatever exists in src/art is bundled and
// loaded, and the scenes fall back to drawing in code for anything missing.
const ART = import.meta.glob("../art/*.{webp,png,jpg}", { eager: true, query: "?url", import: "default" });

export class BootScene extends Phaser.Scene {
  constructor() { super("Boot"); }
  preload() {
    Object.entries(ART).forEach(([path, url]) => {
      const key = path.split("/").pop().replace(/\.[a-z]+$/, "");
      this.load.image(key, url);
    });
  }
  create() { this.scene.start("Menu"); }
}
