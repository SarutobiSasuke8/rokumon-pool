import Phaser from "phaser";
import { syncCampaign } from "../systems/campaign.js";

// Rendered art is optional: whatever exists in src/art is bundled and
// loaded, and the scenes fall back to drawing in code for anything missing.
const ART = import.meta.glob("../art/*.{webp,png,jpg}", { eager: true, query: "?url", import: "default" });

export class BootScene extends Phaser.Scene {
  constructor() { super("Boot"); }
  preload() {
    Object.entries(ART).forEach(([path, url]) => {
      const key = path.split("/").pop().replace(/\.[a-z]+$/, "");
      if (key === "braves") this.load.spritesheet(key, url, { frameWidth: 224, frameHeight: 224 });
      else this.load.image(key, url);
    });
  }
  create() {
    const room = new URLSearchParams(window.location.search).get("room");
    if (room && /^[a-f0-9-]{36}$/i.test(room) && window.parent !== window && window.location.pathname.startsWith("/games/pool/")) {
      this.scene.start("Online", { room });
      return;
    }
    void Promise.race([syncCampaign(), new Promise((resolve) => setTimeout(resolve, 650))])
      .then(() => this.scene.start("Menu"));
  }
}
