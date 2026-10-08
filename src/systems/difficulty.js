import { resolveDifficulty } from "../game/constants.js";

// Last chosen computer difficulty, remembered per browser like mute. Storage
// can be missing or throw (private mode, blocked site data); fall back to
// Normal and carry on.
const DIFFICULTY_KEY = "rokumon-pool:difficulty";

export function loadDifficulty() {
  try { return resolveDifficulty(localStorage.getItem(DIFFICULTY_KEY)); } catch { return resolveDifficulty(null); }
}

export function saveDifficulty(key) {
  const value = resolveDifficulty(key);
  try { localStorage.setItem(DIFFICULTY_KEY, value); } catch { /* per-viewer convenience only */ }
  return value;
}
