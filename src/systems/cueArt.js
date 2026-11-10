// The cue stick, painted once into a canvas texture: rubber bumper, dark
// butt with brass rings and red points, linen wrap, stained forearm, pale
// maple shaft, white ferrule and a chalked leather tip. It tapers from butt
// to tip like a real cue. The tip is at the right-hand end of the texture.

export const CUE_ART_SCALE = 4;
export const CUE_KEY = "cue-stick";
export const CUE_SHADOW_KEY = "cue-stick-shadow";
const HEIGHT = 14; // logical px of texture height
const BUTT_HALF = 4.6;
const TIP_HALF = 2.1;

function halfWidth(t) {
  return BUTT_HALF + (TIP_HALF - BUTT_HALF) * t;
}

function outline(ctx, L, S, grow = 0) {
  const mid = (HEIGHT * S) / 2;
  ctx.beginPath();
  ctx.moveTo(1.5 * S, mid - (BUTT_HALF - 1 + grow) * S);
  ctx.lineTo(0, mid);
  ctx.lineTo(1.5 * S, mid + (BUTT_HALF - 1 + grow) * S);
  ctx.lineTo(3 * S, mid + (BUTT_HALF + grow) * S);
  ctx.lineTo(L * S, mid + (TIP_HALF + grow) * S);
  ctx.lineTo(L * S, mid - (TIP_HALF + grow) * S);
  ctx.lineTo(3 * S, mid - (BUTT_HALF + grow) * S);
  ctx.closePath();
}

export function paintCue(ctx, length, S = CUE_ART_SCALE) {
  const L = length;
  const H = HEIGHT * S;
  const mid = H / 2;
  const x = (logical) => logical * S;
  ctx.save();
  outline(ctx, L, S);
  ctx.clip();

  const band = (from, to, fill) => { ctx.fillStyle = fill; ctx.fillRect(x(from), 0, x(to - from) + 1, H); };
  const wrapStart = L * 0.2;
  const wrapEnd = L * 0.4;
  const forearmEnd = L * 0.58;
  const ferrule = L - 9;
  const tip = L - 3;

  band(0, 5, "#17171a");                    // bumper
  band(5, wrapStart, "#20130d");            // butt sleeve
  band(wrapStart, wrapEnd, "#e6dfd0");      // linen wrap
  const stain = ctx.createLinearGradient(x(wrapEnd), 0, x(forearmEnd), 0);
  stain.addColorStop(0, "#4a1f12");
  stain.addColorStop(1, "#7a3a1c");
  band(wrapEnd, forearmEnd, stain);         // forearm
  const maple = ctx.createLinearGradient(x(forearmEnd), 0, x(ferrule), 0);
  maple.addColorStop(0, "#e2c08a");
  maple.addColorStop(1, "#efd9ab");
  band(forearmEnd, ferrule, maple);         // shaft
  band(ferrule, tip, "#f6f3ea");            // ferrule
  band(tip, L, "#3f74ad");                  // chalked tip

  // Linen wrap: fine dark threads.
  ctx.strokeStyle = "rgba(60,50,40,0.35)";
  ctx.lineWidth = Math.max(1, S * 0.3);
  for (let i = wrapStart; i < wrapEnd; i += 1.1) {
    ctx.beginPath();
    ctx.moveTo(x(i), 0);
    ctx.lineTo(x(i + 0.6), H);
    ctx.stroke();
  }

  // Points: four pale maple spears running back into the stained forearm,
  // each edged in red.
  const spear = (inset, colour) => {
    ctx.fillStyle = colour;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(x(forearmEnd), mid + side * S * 0.2);
      ctx.lineTo(x(forearmEnd), mid + side * S * (3.6 - inset));
      ctx.lineTo(x(wrapEnd + 10 + inset * 6), mid + side * S * (2 - inset * 0.3));
      ctx.closePath();
      ctx.fill();
    }
  };
  spear(0, "#b3261e");
  spear(0.8, "#ecd3a0");

  // Brass rings either side of the wrap and at the joint, and a red band
  // on the butt.
  const ring = (at, w, colour) => band(at, at + w, colour);
  ring(5, 1.4, "#d9a441");
  ring(wrapStart - 2.4, 1.2, "#d9a441");
  ring(wrapStart - 5.2, 1.6, "#b3261e");
  ring(wrapEnd, 1.2, "#d9a441");
  ring(forearmEnd - 0.6, 1.2, "#d9a441");

  // Round the stick: light along the top, shade underneath.
  const round = ctx.createLinearGradient(0, mid - BUTT_HALF * S, 0, mid + BUTT_HALF * S);
  round.addColorStop(0, "rgba(0,0,0,0.25)");
  round.addColorStop(0.28, "rgba(255,255,255,0.38)");
  round.addColorStop(0.5, "rgba(255,255,255,0)");
  round.addColorStop(1, "rgba(0,0,0,0.5)");
  ctx.fillStyle = round;
  ctx.fillRect(0, 0, x(L), H);
  ctx.restore();

  outline(ctx, L, S);
  ctx.lineWidth = S * 0.35;
  ctx.strokeStyle = "rgba(10,8,6,0.75)";
  ctx.stroke();
}

function paintCueShadow(ctx, length, S = CUE_ART_SCALE) {
  ctx.save();
  ctx.filter = `blur(${S * 1.2}px)`;
  outline(ctx, length, S, 0.4);
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.fill();
  ctx.restore();
}

export function ensureCueTextures(scene, length) {
  const w = Math.ceil(length * CUE_ART_SCALE);
  const h = HEIGHT * CUE_ART_SCALE;
  if (!scene.textures.exists(CUE_KEY)) {
    const tex = scene.textures.createCanvas(CUE_KEY, w, h);
    paintCue(tex.getContext(), length);
    tex.refresh();
  }
  if (!scene.textures.exists(CUE_SHADOW_KEY)) {
    const tex = scene.textures.createCanvas(CUE_SHADOW_KEY, w, h);
    paintCueShadow(tex.getContext(), length);
    tex.refresh();
  }
}
