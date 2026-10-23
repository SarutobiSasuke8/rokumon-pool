import { BALL_IDS, NUMBER_DISC, STRIPE_BAND, ballIdentity, ballTextureKey, toCss } from "../game/balls.js";

// Ball art is painted once per ball and size into canvas textures, at twice
// the display size so the numbers stay sharp when the canvas is scaled.
export const ART_SCALE = 2;

const WHITE = "#f8f6ee";
const INK = "#111111";
const OUTLINE = "rgba(6, 8, 12, 0.9)";

export function ballTextureSize(radius, scale = ART_SCALE) {
  return Math.ceil((radius + 2) * 2 * scale);
}

function circle(ctx, r) {
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
}

// Paints one ball centred in a square canvas of ballTextureSize(radius).
// Order: body, stripe band, shading, number disc and number, outline. The
// number goes on after the shading so the highlight never washes it out.
export function paintBall(ctx, id, radius, scale = ART_SCALE) {
  const ball = ballIdentity(id);
  const size = ballTextureSize(radius, scale);
  const R = radius * scale;
  ctx.save();
  ctx.translate(size / 2, size / 2);

  circle(ctx, R);
  ctx.fillStyle = ball.striped ? WHITE : toCss(ball.color);
  ctx.fill();

  if (ball.striped) {
    ctx.save();
    circle(ctx, R);
    ctx.clip();
    ctx.fillStyle = toCss(ball.color);
    ctx.fillRect(-R, -R * STRIPE_BAND, R * 2, R * 2 * STRIPE_BAND);
    ctx.restore();
  }

  const shade = ctx.createRadialGradient(-R * 0.38, -R * 0.42, 0, 0, 0, R);
  shade.addColorStop(0, "rgba(255,255,255,0.5)");
  shade.addColorStop(0.28, "rgba(255,255,255,0.06)");
  shade.addColorStop(0.72, "rgba(0,0,0,0)");
  shade.addColorStop(1, "rgba(0,0,0,0.32)");
  circle(ctx, R);
  ctx.fillStyle = shade;
  ctx.fill();

  if (ball.numbered) {
    circle(ctx, R * NUMBER_DISC);
    ctx.fillStyle = WHITE;
    ctx.fill();
    const text = String(ball.number);
    const px = R * (text.length > 1 ? 0.8 : 0.92);
    ctx.font = `bold ${px.toFixed(1)}px Arial, "Helvetica Neue", Roboto, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = INK;
    ctx.fillText(text, 0, R * 0.05);
  }

  // A dark rim keeps every ball, including the green 6 and 14, crisp against
  // the cloth.
  circle(ctx, R - 0.6 * scale);
  ctx.lineWidth = 1.3 * scale;
  ctx.strokeStyle = OUTLINE;
  ctx.stroke();

  ctx.restore();
  return ball;
}

export function shadowTextureKey(radius) {
  return `ball-shadow-r${radius}`;
}

// Soft contact shadow, drawn on its own layer under every ball so it never
// darkens a neighbour in the rack.
function paintShadow(ctx, radius, scale = ART_SCALE) {
  const size = ballTextureSize(radius, scale);
  const R = radius * scale;
  const g = ctx.createRadialGradient(size / 2, size / 2, R * 0.5, size / 2, size / 2, R * 1.1);
  g.addColorStop(0, "rgba(0,0,0,0.45)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
}

// Creates the textures for every ball at one radius. Safe to call from any
// scene and more than once: existing textures are kept.
export function ensureBallTextures(scene, radius) {
  const size = ballTextureSize(radius);
  BALL_IDS.forEach((id) => {
    const key = ballTextureKey(id, radius);
    if (scene.textures.exists(key)) return;
    const tex = scene.textures.createCanvas(key, size, size);
    paintBall(tex.getContext(), id, radius);
    tex.refresh();
  });
  const shadowKey = shadowTextureKey(radius);
  if (!scene.textures.exists(shadowKey)) {
    const tex = scene.textures.createCanvas(shadowKey, size, size);
    paintShadow(tex.getContext(), radius);
    tex.refresh();
  }
}
