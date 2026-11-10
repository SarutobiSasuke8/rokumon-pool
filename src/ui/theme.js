import { audio } from "../systems/audio.js";

// Shared look: sizes, typefaces, colours and the small widgets every scene
// uses. Scenes lay out on a 960x540 logical canvas; the game renders at
// RENDER_SCALE times that so text and art stay sharp on phone screens.

export const VIEW = Object.freeze({ w: 960, h: 540 });
export const RENDER_SCALE = 2;

export const FONT = Object.freeze({
  display: '"Barlow Condensed", "Arial Narrow", sans-serif',
  body: 'Barlow, "Helvetica Neue", Arial, sans-serif',
});

// Pool hall at night: near-black room, warm brass, cream text, Sanada red.
export const UI = Object.freeze({
  bg: 0x0a0d12,
  panel: 0x141a22,
  panelLit: 0x1d2530,
  line: 0x2e3a48,
  brass: 0xd9a441,
  brassDark: 0x8a6520,
  red: 0xb3261e,
  cream: 0xf3ead7,
  css: Object.freeze({
    cream: "#f3ead7",
    dim: "#9aa7b5",
    brass: "#e3b458",
    ink: "#0a0d12",
    red: "#e0564d",
    green: "#6fdc9a",
    sky: "#9fd3ee",
  }),
});

// Every scene draws in logical units; the camera does the upscaling.
export function setupCamera(scene) {
  scene.cameras.main.setOrigin(0, 0).setZoom(RENDER_SCALE);
}

export function addText(scene, x, y, str, style = {}) {
  return scene.add.text(x, y, str, { fontFamily: FONT.body, fontSize: "16px", color: UI.css.cream, ...style, resolution: RENDER_SCALE });
}

export function addTitle(scene, x, y, str, style = {}) {
  return addText(scene, x, y, str, { fontFamily: FONT.display, fontStyle: "700", fontSize: "40px", ...style });
}

// Rounded button: a graphics plate with a label, one hit area, hover and
// press states. `primary` buttons are brass; the rest are dark panels.
export function addButton(scene, x, y, w, h, label, onPress, { primary = false, fontSize = 20, depth = 0 } = {}) {
  const plate = scene.add.graphics().setDepth(depth);
  const text = addText(scene, x, y, label, {
    fontFamily: FONT.display, fontStyle: "600", fontSize: `${fontSize}px`,
    color: primary ? UI.css.ink : UI.css.cream,
  }).setOrigin(0.5).setDepth(depth + 0.1);
  text.setLetterSpacing?.(1);
  const zone = scene.add.zone(x, y, w, h).setInteractive({ useHandCursor: true }).setDepth(depth + 0.2);
  let state = "idle";
  const draw = () => {
    plate.clear();
    const lift = state === "down" ? 1 : 0;
    const fill = primary
      ? (state === "over" ? 0xeab759 : UI.brass)
      : (state === "over" ? UI.panelLit : UI.panel);
    plate.fillStyle(0x000000, 0.45);
    plate.fillRoundedRect(x - w / 2, y - h / 2 + 3, w, h, 8);
    plate.fillStyle(fill, 1);
    plate.fillRoundedRect(x - w / 2, y - h / 2 + lift, w, h, 8);
    plate.lineStyle(1.5, primary ? 0xf6d98e : UI.brassDark, primary ? 0.9 : 0.8);
    plate.strokeRoundedRect(x - w / 2, y - h / 2 + lift, w, h, 8);
    text.setY(y + lift);
  };
  zone.on("pointerover", () => { state = "over"; draw(); });
  zone.on("pointerout", () => { state = "idle"; draw(); });
  zone.on("pointerdown", (p, lx, ly, event) => { state = "down"; draw(); event?.stopPropagation?.(); });
  zone.on("pointerup", (p, lx, ly, event) => { state = "over"; draw(); event?.stopPropagation?.(); audio.unlock(); audio.ui(); onPress(); });
  draw();
  const all = [plate, text, zone];
  return {
    plate, text, zone,
    setVisible(v) { all.forEach((o) => o.setVisible(v)); if (v) zone.setInteractive({ useHandCursor: true }); else zone.disableInteractive(); return this; },
    setLabel(s) { text.setText(s); return this; },
    destroy() { all.forEach((o) => o.destroy()); },
  };
}

// The Sanada six-coin crest (rokumon): two rows of three ringed coins.
export function drawRokumon(g, cx, cy, coin, color = UI.brass, alpha = 1) {
  const gap = coin * 2.5;
  for (let row = 0; row < 2; row += 1) {
    for (let col = 0; col < 3; col += 1) {
      const x = cx + (col - 1) * gap;
      const y = cy + (row - 0.5) * gap;
      g.lineStyle(coin * 0.42, color, alpha);
      g.strokeCircle(x, y, coin * 0.72);
    }
  }
}
