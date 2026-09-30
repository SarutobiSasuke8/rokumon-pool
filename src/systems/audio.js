// Tiny Web Audio synth for table sounds. No asset files: everything is
// generated from noise bursts and short tones, so the game stays a single
// self-contained bundle. The context is created lazily on the first pointer
// gesture so browsers' autoplay rules are respected.

let ctx = null;
let noiseBuffer = null;
let recent = [];

function ensure() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
}

function throttled() {
  const now = performance.now();
  recent = recent.filter((t) => now - t < 60);
  if (recent.length >= 6) return true;
  recent.push(now);
  return false;
}

function getNoise(c) {
  if (noiseBuffer) return noiseBuffer;
  const length = Math.floor(c.sampleRate * 0.2);
  noiseBuffer = c.createBuffer(1, length, c.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
  return noiseBuffer;
}

function burst({ duration, gain, cutoff, q = 1 }) {
  const c = ensure();
  if (!c || muted || throttled()) return;
  const src = c.createBufferSource();
  src.buffer = getNoise(c);
  const filter = c.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = cutoff;
  filter.Q.value = q;
  const env = c.createGain();
  const t = c.currentTime;
  env.gain.setValueAtTime(gain, t);
  env.gain.exponentialRampToValueAtTime(0.0005, t + duration);
  src.connect(filter).connect(env).connect(c.destination);
  src.start(t);
  src.stop(t + duration + 0.02);
}

function tone({ from, to, duration, gain, type = "sine" }) {
  const c = ensure();
  if (!c || muted || throttled()) return;
  const osc = c.createOscillator();
  osc.type = type;
  const env = c.createGain();
  const t = c.currentTime;
  osc.frequency.setValueAtTime(from, t);
  osc.frequency.exponentialRampToValueAtTime(to, t + duration);
  env.gain.setValueAtTime(gain, t);
  env.gain.exponentialRampToValueAtTime(0.0005, t + duration);
  osc.connect(env).connect(c.destination);
  osc.start(t);
  osc.stop(t + duration + 0.02);
}

const clamp01 = (v) => Math.max(0, Math.min(1, v));

const MUTE_KEY = "rokumon-pool:muted";
let muted = false;
try { muted = localStorage.getItem(MUTE_KEY) === "1"; } catch { muted = false; }

export const audio = {
  unlock() { ensure(); },
  get muted() { return muted; },
  setMuted(value) {
    muted = Boolean(value);
    try { localStorage.setItem(MUTE_KEY, muted ? "1" : "0"); } catch { /* per-viewer convenience only */ }
    return muted;
  },
  toggleMuted() { return audio.setMuted(!muted); },
  // Ball on ball: a bright short click scaled by impact speed.
  click(intensity) {
    const v = clamp01(intensity);
    if (v < 0.04) return;
    burst({ duration: 0.035 + v * 0.03, gain: 0.05 + v * 0.35, cutoff: 2600 + v * 3000, q: 1.2 });
  },
  // Ball on cushion: a duller thud.
  thud(intensity) {
    const v = clamp01(intensity);
    if (v < 0.06) return;
    burst({ duration: 0.05 + v * 0.04, gain: 0.03 + v * 0.18, cutoff: 380 + v * 300, q: 0.8 });
  },
  // Cue strike: a firm knock scaled by power.
  strike(power) {
    const v = clamp01(power);
    burst({ duration: 0.05, gain: 0.08 + v * 0.25, cutoff: 1400 + v * 800, q: 0.9 });
  },
  // Ball dropping into a pocket: a falling tone plus a rattle.
  pocket() {
    tone({ from: 320, to: 90, duration: 0.22, gain: 0.18, type: "triangle" });
    burst({ duration: 0.16, gain: 0.12, cutoff: 900, q: 0.6 });
  },
};
