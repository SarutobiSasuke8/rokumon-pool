// Optional platform adapter. Standalone play never needs the hub SDK.
function call(method, ...args) {
  try {
    const sdk = globalThis.window?.Hub;
    if (typeof sdk?.[method] === "function") sdk[method](...args);
  } catch { /* Platform failures must not affect the puzzle. */ }
}

let lastScore = null;
export const hub = {
  ready() { call("ready"); },
  score(value) {
    if (!Number.isFinite(value) || value === lastScore) return;
    lastScore = value;
    call("score", value);
  },
  gameOver(score, durationMs) { call("gameOver", score, durationMs); },
  event(name, data) { call("event", name, data); },
};
