// Player preferences, remembered per browser. Storage can be missing or
// throw (private mode, blocked site data); defaults apply and play carries on.
const KEY = "rokumon-pool:settings";
const DEFAULTS = Object.freeze({ guide: true, variant: "eightball", hideRulesPrompt: false });

export function loadSettings() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "{}");
    return { ...DEFAULTS, ...(raw && typeof raw === "object" ? raw : {}) };
  } catch { return { ...DEFAULTS }; }
}

export function saveSettings(patch) {
  const next = { ...loadSettings(), ...patch };
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* per-viewer convenience only */ }
  return next;
}
