import { BALL_IDS, NUMBER_DISC, STRIPE_BAND, ballIdentity } from "../game/balls.js";

// Table balls are small shaded spheres drawn pixel by pixel, each with its
// own orientation, so a moving ball visibly rolls: the stripe tumbles and the
// number comes round. The HUD minis keep the flat painter in ballArt.js.

export const BALL_RENDER_SCALE = 3;
const PAD = 2; // logical px of transparent margin for the soft edge
const GLYPH = 48;
let seq = 0;

// Light from the upper left, above the table.
const LIGHT = normalize([-0.38, -0.5, 0.78]);
const HALF = normalize([LIGHT[0], LIGHT[1], LIGHT[2] + 1]);
const DISC_COS = Math.sqrt(1 - NUMBER_DISC * NUMBER_DISC);
const DOT_COS = Math.cos(0.2);
const WHITE = [248, 246, 238];
const INK = [17, 17, 17];
const DOT = [200, 38, 38];

function normalize(v) {
  const len = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / len, v[1] / len, v[2] / len];
}

function rgb(color) {
  return [(color >> 16) & 255, (color >> 8) & 255, color & 255];
}

export function identityMatrix() {
  return [1, 0, 0, 0, 1, 0, 0, 0, 1];
}

// Rotate orientation `m` (row-major 3x3, columns are the ball's own axes in
// view space) about the unit axis (ax, ay, az) by `angle` radians.
export function rotateMatrix(m, ax, ay, az, angle) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const t = 1 - c;
  const r = [
    t * ax * ax + c, t * ax * ay - s * az, t * ax * az + s * ay,
    t * ax * ay + s * az, t * ay * ay + c, t * ay * az - s * ax,
    t * ax * az - s * ay, t * ay * az + s * ax, t * az * az + c,
  ];
  const out = new Array(9);
  for (let i = 0; i < 3; i += 1) {
    for (let j = 0; j < 3; j += 1) {
      out[i * 3 + j] = r[i * 3] * m[j] + r[i * 3 + 1] * m[3 + j] + r[i * 3 + 2] * m[6 + j];
    }
  }
  return out;
}

// A ball rolling without slipping over (dx, dy) turns about the horizontal
// axis at right angles to its travel, by distance / radius.
export function rollMatrix(m, dx, dy, radius) {
  const dist = Math.hypot(dx, dy);
  if (dist < 1e-4) return m;
  return rotateMatrix(m, -dy / dist, dx / dist, 0, dist / radius);
}

// Which of the two number discs is nearer the camera, and how far it is from
// facing straight up (0 = dead centre).
export function facing(m) {
  const z = m[8];
  return { sign: z >= 0 ? 1 : -1, tilt: Math.acos(Math.min(1, Math.abs(z))) };
}

// One step of easing the nearer number disc back to face the camera, so a
// ball at rest can always be read. Returns the same matrix when settled.
export function settleMatrix(m, rate = 0.25) {
  const { sign, tilt } = facing(m);
  if (tilt < 0.01) {
    // Facing up: now turn the number the right way round. The glyph's
    // left-to-right axis is the ball's own x axis (reversed on the far disc).
    const twist = Math.atan2(m[3] * sign, m[0] * sign);
    if (Math.abs(twist) < 0.01) return m;
    return rotateMatrix(m, 0, 0, 1, -twist * rate);
  }
  // The disc's axis in view space is the third column, times `sign`.
  const vx = m[2] * sign;
  const vy = m[5] * sign;
  const len = Math.hypot(vx, vy);
  if (len < 1e-6) return m;
  // Rotate about the horizontal axis that swings that axis towards +z.
  return rotateMatrix(m, vy / len, -vx / len, 0, tilt * rate);
}

let glyphCache = null;
function glyphs() {
  if (glyphCache) return glyphCache;
  glyphCache = new Map();
  const canvas = document.createElement("canvas");
  canvas.width = GLYPH;
  canvas.height = GLYPH;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  for (let n = 1; n <= 15; n += 1) {
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, GLYPH, GLYPH);
    const text = String(n);
    ctx.fillStyle = "#000";
    ctx.font = `700 ${text.length > 1 ? 35 : 40}px "Barlow Condensed", Arial, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, GLYPH / 2, GLYPH / 2 + 2);
    // The 6 and the 9 carry an underline so they cannot be confused.
    if (n === 6 || n === 9) ctx.fillRect(GLYPH / 2 - 8, GLYPH - 9, 16, 3);
    const data = ctx.getImageData(0, 0, GLYPH, GLYPH).data;
    const ink = new Float32Array(GLYPH * GLYPH);
    for (let i = 0; i < ink.length; i += 1) ink[i] = 1 - data[i * 4] / 255;
    glyphCache.set(n, ink);
  }
  return glyphCache;
}

export function ballRenderSize(radius) {
  return Math.ceil((radius + PAD) * 2 * BALL_RENDER_SCALE);
}

// Draws one ball into `image` (an ImageData of ballRenderSize) at the given
// orientation.
export function renderBall(image, id, radius, m) {
  const ball = ballIdentity(id);
  const size = image.width;
  const R = radius * BALL_RENDER_SCALE;
  const c = size / 2;
  const data = image.data;
  const base = ball.kind === "cue" ? WHITE : rgb(ball.color);
  const glyph = ball.numbered ? glyphs().get(ball.number) : null;

  for (let py = 0; py < size; py += 1) {
    for (let px = 0; px < size; px += 1) {
      const o = (py * size + px) * 4;
      const x = (px + 0.5 - c) / R;
      const y = (py + 0.5 - c) / R;
      const d = Math.hypot(x, y);
      const alpha = Math.max(0, Math.min(1, (1 - d) * R + 0.5));
      if (alpha <= 0) { data[o + 3] = 0; continue; }
      const z = Math.sqrt(Math.max(0, 1 - d * d));
      // View-space normal into the ball's own axes.
      const lx = m[0] * x + m[3] * y + m[6] * z;
      const ly = m[1] * x + m[4] * y + m[7] * z;
      const lz = m[2] * x + m[5] * y + m[8] * z;

      let r = base[0];
      let g = base[1];
      let b = base[2];
      if (ball.striped && Math.abs(ly) > STRIPE_BAND * 0.92) { r = WHITE[0]; g = WHITE[1]; b = WHITE[2]; }
      if (ball.kind === "cue") {
        if (Math.max(Math.abs(lx), Math.abs(ly), Math.abs(lz)) > DOT_COS) { r = DOT[0]; g = DOT[1]; b = DOT[2]; }
      } else if (Math.abs(lz) > DISC_COS) {
        r = WHITE[0]; g = WHITE[1]; b = WHITE[2];
        const u = (lz > 0 ? lx : -lx) / NUMBER_DISC;
        const v = ly / NUMBER_DISC;
        const gx = Math.floor((u * 0.5 + 0.5) * GLYPH);
        const gy = Math.floor((v * 0.5 + 0.5) * GLYPH);
        if (gx >= 0 && gx < GLYPH && gy >= 0 && gy < GLYPH) {
          const ink = glyph[gy * GLYPH + gx];
          r += (INK[0] - r) * ink; g += (INK[1] - g) * ink; b += (INK[2] - b) * ink;
        }
      }

      const diffuse = Math.max(0, x * LIGHT[0] + y * LIGHT[1] + z * LIGHT[2]);
      const shade = 0.5 + 0.62 * diffuse;
      const spec = Math.pow(Math.max(0, x * HALF[0] + y * HALF[1] + z * HALF[2]), 70) * 235;
      // A dark rim keeps every ball crisp against the cloth.
      const rim = d > 0.86 ? 1 - Math.min(1, (d - 0.86) / 0.14) * 0.55 : 1;
      data[o] = Math.min(255, r * shade * rim + spec);
      data[o + 1] = Math.min(255, g * shade * rim + spec);
      data[o + 2] = Math.min(255, b * shade * rim + spec);
      data[o + 3] = alpha * 255;
    }
  }
}

// A live, rolling ball sprite for the table.
export class BallView {
  constructor(scene, id, radius, x, y) {
    this.id = id;
    this.radius = radius;
    this.matrix = identityMatrix();
    this.dirty = true;
    // A fresh key per sprite: a pocketed ball's texture is freed a moment
    // after it drops, by which time a respotted ball may already exist.
    seq += 1;
    this.key = `ball-live-${id}-${seq}`;
    this.textures = scene.textures;
    const size = ballRenderSize(radius);
    this.texture = scene.textures.createCanvas(this.key, size, size);
    this.pixels = this.texture.getContext().createImageData(size, size);
    this.image = scene.add.image(x, y, this.key).setScale(1 / BALL_RENDER_SCALE);
    this.redraw();
  }

  roll(dx, dy) {
    const next = rollMatrix(this.matrix, dx, dy, this.radius);
    if (next !== this.matrix) { this.matrix = next; this.dirty = true; }
  }

  // Spin about the vertical axis (side spin on the cue ball).
  twist(angle) {
    if (Math.abs(angle) < 1e-4) return;
    this.matrix = rotateMatrix(this.matrix, 0, 0, 1, angle);
    this.dirty = true;
  }

  settle() {
    const next = settleMatrix(this.matrix);
    if (next !== this.matrix) { this.matrix = next; this.dirty = true; }
  }

  redraw() {
    if (!this.dirty) return;
    renderBall(this.pixels, this.id, this.radius, this.matrix);
    this.texture.getContext().putImageData(this.pixels, 0, 0);
    this.texture.refresh();
    this.dirty = false;
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.image.destroy();
    if (this.textures.exists(this.key)) this.textures.remove(this.key);
  }
}

export { BALL_IDS };
