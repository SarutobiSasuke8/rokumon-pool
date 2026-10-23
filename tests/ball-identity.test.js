import { describe, expect, it } from "vitest";
import { COLORS, RACK_ORDER } from "../src/game/constants.js";
import { BALL_IDS, STRIPE_BAND, ballIdentity, ballTextureKey } from "../src/game/balls.js";
import { ballTextureSize, paintBall } from "../src/systems/ballArt.js";

// CIE76 colour difference in Lab space: about 2.3 is just noticeable, above
// 40 two colours read as clearly different at a glance.
function lab(hex) {
  const lin = (c) => { const v = c / 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  const r = lin((hex >> 16) & 255); const g = lin((hex >> 8) & 255); const b = lin(hex & 255);
  const x = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047;
  const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883;
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
}
const deltaE = (a, b) => { const p = lab(a); const q = lab(b); return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]); };
const hex = (css) => parseInt(css.slice(1), 16);

// Records what paintBall draws, with the fill style in force at each call.
function recordingContext() {
  const calls = [];
  const ctx = {
    calls,
    fillStyle: null, strokeStyle: null, lineWidth: 1, font: "", textAlign: "", textBaseline: "",
    save() {}, restore() {}, translate() {}, beginPath() {}, clip() { calls.push({ op: "clip" }); },
    arc(x, y, r) { this.lastArc = { x, y, r }; },
    fill() { calls.push({ op: "fill", style: this.fillStyle, arc: this.lastArc }); },
    stroke() { calls.push({ op: "stroke", style: this.strokeStyle, arc: this.lastArc }); },
    fillRect(x, y, w, h) { calls.push({ op: "fillRect", style: this.fillStyle, rect: { x, y, w, h } }); },
    fillText(text, x, y) { calls.push({ op: "fillText", style: this.fillStyle, text, x, y, font: this.font }); },
    createRadialGradient() { return { addColorStop() {} }; },
  };
  return ctx;
}

describe("ball identity", () => {
  it("covers the cue ball and object balls 1 to 15 exactly once", () => {
    expect(BALL_IDS).toEqual(["cue", ...Array.from({ length: 15 }, (_, i) => i + 1)]);
    expect(new Set(BALL_IDS.map((id) => ballTextureKey(id, 11))).size).toBe(16);
  });

  it("marks 1-7 as solids, 9-15 as stripes, 8 as the black 8-ball", () => {
    for (let n = 1; n <= 7; n += 1) expect(ballIdentity(n)).toMatchObject({ kind: "solid", striped: false, numbered: true, number: n });
    for (let n = 9; n <= 15; n += 1) expect(ballIdentity(n)).toMatchObject({ kind: "stripe", striped: true, numbered: true, number: n });
    expect(ballIdentity(8)).toMatchObject({ kind: "eight", striped: false, numbered: true, number: 8, color: COLORS.eight });
    expect(ballIdentity("cue")).toMatchObject({ kind: "cue", striped: false, numbered: false, number: null });
  });

  it("uses the standard colour order and repeats it on the stripes", () => {
    const families = ["yellow", "blue", "red", "purple", "orange", "green", "maroon"];
    const expected = [0xf5c518, 0x2563eb, 0xdc2626, 0x7c3aed, 0xf97316, 0x22c55e, 0x8b1e1e];
    families.forEach((_, i) => {
      expect(ballIdentity(i + 1).color).toBe(expected[i]);
      expect(ballIdentity(i + 9).color).toBe(expected[i]);
    });
  });

  it("gives every ball a unique look: colour, pattern and number together", () => {
    const looks = BALL_IDS.map((id) => { const b = ballIdentity(id); return `${b.color}|${b.striped}|${b.number}`; });
    expect(new Set(looks).size).toBe(16);
  });

  it("keeps the seven group colours clearly apart from each other", () => {
    for (let a = 1; a <= 8; a += 1) {
      for (let b = a + 1; b <= 8; b += 1) {
        expect(deltaE(ballIdentity(a).color, ballIdentity(b).color), `${a} vs ${b}`).toBeGreaterThan(25);
      }
    }
  });

  it("makes every ball stand out from the cloth", () => {
    BALL_IDS.forEach((id) => {
      expect(deltaE(ballIdentity(id).color, COLORS.cloth), `ball ${id}`).toBeGreaterThan(40);
    });
  });

  it("rejects ids that are not balls", () => {
    expect(() => ballIdentity(0)).toThrow(RangeError);
    expect(() => ballIdentity(16)).toThrow(RangeError);
    expect(() => ballIdentity("x")).toThrow(RangeError);
  });
});

describe("ball painting", () => {
  const R = 11;
  const scale = 2;
  const paint = (id) => { const ctx = recordingContext(); paintBall(ctx, id, R, scale); return ctx.calls; };

  it("prints the ball's number, dark on a white disc, on every object ball", () => {
    for (let n = 1; n <= 15; n += 1) {
      const texts = paint(n).filter((c) => c.op === "fillText");
      expect(texts, `ball ${n}`).toHaveLength(1);
      expect(texts[0].text).toBe(String(n));
      expect(texts[0].style).toBe("#111111");
      expect(texts[0].font).toMatch(/^bold /);
      expect(Math.abs(texts[0].x)).toBe(0);
      const disc = paint(n).filter((c) => c.op === "fill" && c.style === "#f8f6ee" && c.arc.r < R * scale * 0.6);
      expect(disc, `number disc on ${n}`).toHaveLength(1);
    }
  });

  it("draws no number on the cue ball", () => {
    expect(paint("cue").filter((c) => c.op === "fillText")).toHaveLength(0);
  });

  it("paints solids and the 8 in their colour with no band", () => {
    for (const n of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const calls = paint(n);
      expect(hex(calls.find((c) => c.op === "fill").style)).toBe(ballIdentity(n).color);
      expect(calls.filter((c) => c.op === "fillRect")).toHaveLength(0);
    }
  });

  it("paints stripes white with one clipped coloured band across the middle", () => {
    for (let n = 9; n <= 15; n += 1) {
      const calls = paint(n);
      expect(calls.find((c) => c.op === "fill").style).toBe("#f8f6ee");
      expect(calls.some((c) => c.op === "clip")).toBe(true);
      const bands = calls.filter((c) => c.op === "fillRect");
      expect(bands).toHaveLength(1);
      expect(hex(bands[0].style)).toBe(ballIdentity(n - 8).color);
      expect(bands[0].rect.y).toBeCloseTo(-R * scale * STRIPE_BAND);
      expect(bands[0].rect.h).toBeCloseTo(R * scale * STRIPE_BAND * 2);
      // White caps above and below the band are what make it a stripe.
      expect(STRIPE_BAND).toBeLessThan(0.7);
    }
  });

  it("outlines every ball in a dark rim", () => {
    BALL_IDS.forEach((id) => {
      const rims = paint(id).filter((c) => c.op === "stroke");
      expect(rims, `ball ${id}`).toHaveLength(1);
      expect(rims[0].style).toMatch(/^rgba\(6, 8, 12/);
    });
  });

  it("sizes textures to hold the ball and its rim", () => {
    expect(ballTextureSize(R, scale)).toBeGreaterThanOrEqual(R * 2 * scale);
  });

  it("racks every painted ball", () => {
    expect(RACK_ORDER.flat().every((id) => BALL_IDS.includes(id))).toBe(true);
  });
});
