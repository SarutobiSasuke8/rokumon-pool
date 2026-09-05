const EVENT_NAME = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const EVENT_KEY = /^[a-z][a-zA-Z0-9]*$/;

function send(payload) {
  if (window.parent === window) return;
  window.parent.postMessage(payload, window.location.origin);
}

let lastScore = null;

export const hub = {
  version: 1,
  ready() { send({ type: "hub:ready", version: 1 }); },
  score(value) {
    if (value === lastScore) return;
    lastScore = value;
    if (typeof value === "number" && Number.isFinite(value)) send({ type: "hub:score", score: value });
  },
  gameOver(score, durationMs) {
    if (typeof score !== "number" || !Number.isFinite(score)) return;
    send({ type: "hub:gameover", score, durationMs });
  },
  event(name, data) {
    if (!EVENT_NAME.test(name) || !data || typeof data !== "object" || Array.isArray(data)) return;
    const entries = Object.entries(data);
    if (entries.length > 16) return;
    if (!entries.every(([key, value]) => EVENT_KEY.test(key) && ((typeof value === "number" && Number.isFinite(value)) || typeof value === "string" || typeof value === "boolean"))) return;
    send({ type: "hub:event", version: 1, name, data });
  },
};
