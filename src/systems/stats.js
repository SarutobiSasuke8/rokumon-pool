import { DIFFICULTY_ORDER, resolveDifficulty } from "../game/constants.js";

// Win/loss record against the computer, per difficulty, kept on this device.
const KEY = "rokumon-pool:record";

function blank() {
  return Object.fromEntries(DIFFICULTY_ORDER.map((k) => [k, { won: 0, lost: 0 }]));
}

// Pure merge so it can be checked without storage.
export function addResult(record, difficulty, won) {
  const key = resolveDifficulty(difficulty);
  const next = { ...blank(), ...record };
  const row = next[key] || { won: 0, lost: 0 };
  next[key] = { won: row.won + (won ? 1 : 0), lost: row.lost + (won ? 0 : 1) };
  return next;
}

export function loadRecord() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "{}");
    const out = blank();
    DIFFICULTY_ORDER.forEach((k) => {
      const row = raw?.[k];
      if (row && Number.isFinite(row.won) && Number.isFinite(row.lost)) out[k] = { won: Math.max(0, row.won | 0), lost: Math.max(0, row.lost | 0) };
    });
    return out;
  } catch { return blank(); }
}

export function recordResult(difficulty, won) {
  const next = addResult(loadRecord(), difficulty, won);
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* per-viewer convenience only */ }
  return next;
}
