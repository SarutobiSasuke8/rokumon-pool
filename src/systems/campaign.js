// The campaign: a ladder of ten opponents named for the Sanada Ten Braves of
// Japanese folklore. Each plays a different way (accuracy, shot choice, how
// hard they hit, how long they think) and some prefer a different game. Beat
// one to win their trophy and unlock the next; win without a foul for gold.
//
// Tuning fields match the computer opponent's:
//   skill, weakShotChance, loosePlacement  see AI_DIFFICULTY in constants.js
//   powerBias  multiplies the power of every shot (above 1 hits harder)
//   thinkMs    how long they study the table before shooting

const KEY = "rokumon-pool:campaign";
const LEGACY_OWNER = KEY + ":legacy-owner";
let scope = null;
let cloud = null;
let syncing = null;
let syncAgain = false;

export const CHARACTERS = Object.freeze([
  { id: "anayama", name: "Anayama Kosuke", epithet: "The Understudy", variant: "eightball", color: 0x6b8e5a, trophy: "Bamboo Cup",
    blurb: "Keen, loud and not very good. Takes the first shot he sees.",
    tuning: { skill: 0.28, weakShotChance: 0.55, loosePlacement: 0.7, powerBias: 1.1, thinkMs: 600 } },
  { id: "isa", name: "Miyoshi Isa", epithet: "The Younger Monk", variant: "eightball", color: 0x8a6d3b, trophy: "Temple Bell",
    blurb: "Hits everything far too hard and trusts in luck.",
    tuning: { skill: 0.36, weakShotChance: 0.4, loosePlacement: 0.6, powerBias: 1.4, thinkMs: 700 } },
  { id: "seikai", name: "Miyoshi Seikai", epithet: "The Iron Staff", variant: "blackball", color: 0x9c3d2e, trophy: "Iron Staff",
    blurb: "The elder monk. Stronger, straighter, still no touch. Plays blackball.",
    tuning: { skill: 0.45, weakShotChance: 0.3, loosePlacement: 0.45, powerBias: 1.45, thinkMs: 800 } },
  { id: "unno", name: "Unno Rokuro", epithet: "The Steward", variant: "sixcoins", color: 0x4f6d8f, trophy: "Steward's Seal",
    blurb: "Careful and slow. Keeps the house accounts, so he plays Six Coins.",
    tuning: { skill: 0.54, weakShotChance: 0.2, loosePlacement: 0.3, powerBias: 0.85, thinkMs: 1400 } },
  { id: "mochizuki", name: "Mochizuki Rokuro", epithet: "The Powder Master", variant: "nineball", color: 0xc2702a, trophy: "Powder Flask",
    blurb: "Likes a bang. Challenges you at 9-ball, where one shot can end it.",
    tuning: { skill: 0.6, weakShotChance: 0.15, loosePlacement: 0.25, powerBias: 1.25, thinkMs: 700 } },
  { id: "nezu", name: "Nezu Jinpachi", epithet: "The Sea Captain", variant: "blackball", color: 0x2f7f86, trophy: "Captain's Compass",
    blurb: "Steady hands from a life at sea. Rarely gives a shot away.",
    tuning: { skill: 0.66, weakShotChance: 0.08, loosePlacement: 0.15, powerBias: 1.0, thinkMs: 900 } },
  { id: "kakei", name: "Kakei Juzo", epithet: "The Marksman", variant: "eightball", color: 0x5a5f9c, trophy: "Marksman's Sight",
    blurb: "Takes his time and does not miss the straight ones.",
    tuning: { skill: 0.74, weakShotChance: 0, loosePlacement: 0.05, powerBias: 0.95, thinkMs: 1300 } },
  { id: "yuri", name: "Yuri Kamanosuke", epithet: "The Chain and Sickle", variant: "nineball", color: 0x8c4a8f, trophy: "Silver Chain",
    blurb: "Quick, sharp and impatient. 9-ball at speed.",
    tuning: { skill: 0.8, weakShotChance: 0, loosePlacement: 0, powerBias: 1.1, thinkMs: 450 } },
  { id: "saizo", name: "Kirigakure Saizo", epithet: "The Mist", variant: "eightball", color: 0x7a8794, trophy: "Mist Blade",
    blurb: "You will not see how he got position. He will have it anyway.",
    tuning: { skill: 0.87, weakShotChance: 0, loosePlacement: 0, powerBias: 1.0, thinkMs: 900 } },
  { id: "sasuke", name: "Sarutobi Sasuke", epithet: "The Monkey Jump", variant: "sixcoins", color: 0xb3261e, trophy: "The Six Coins",
    blurb: "First of the Ten, at the house game. Give him one red and the coins are gone.",
    tuning: { skill: 0.94, weakShotChance: 0, loosePlacement: 0, powerBias: 1.0, thinkMs: 550 } },
].map((c, index) => Object.freeze({ ...c, rank: index + 1, tuning: Object.freeze(c.tuning) })));

export function characterById(id) {
  return CHARACTERS.find((c) => c.id === id) || null;
}

// What the Game scene needs to run a match against a character.
export function opponentData(character) {
  return { id: character.id, name: character.name, tuning: character.tuning };
}

// Quick matches borrow a character's identity, not their campaign tuning.
export function randomRival(random = Math.random) {
  return CHARACTERS[Math.floor(random() * CHARACTERS.length)].id;
}

function blank() {
  return { beaten: {} };
}

// How many rungs are open: every beaten opponent plus the first unbeaten one.
export function unlockedCount(progress) {
  let n = 0;
  while (n < CHARACTERS.length && progress.beaten[CHARACTERS[n].id]) n += 1;
  return Math.min(CHARACTERS.length, n + 1);
}

export function revealedCount(progress) {
  return Math.min(CHARACTERS.length, unlockedCount(progress) + 1);
}

export function trophyCount(progress) {
  return CHARACTERS.filter((c) => progress.beaten[c.id]).length;
}

export function goldCount(progress) {
  return CHARACTERS.filter((c) => progress.beaten[c.id]?.gold).length;
}

// Pure: the progress after a match, and what the result screen should say.
export function applyResult(progress, id, { won, fouls = 0, shots = 0 } = {}) {
  const next = { beaten: { ...progress.beaten } };
  const character = characterById(id);
  const index = CHARACTERS.findIndex((c) => c.id === id);
  if (!character || index >= unlockedCount(progress)) return { progress: next, won: false, firstWin: false, gold: false, newGold: false, trophy: null, nextId: null, completed: false };
  const before = progress.beaten[id] || null;
  const gold = Boolean(won) && fouls === 0;
  if (won) {
    next.beaten[id] = {
      wins: (before?.wins || 0) + 1,
      gold: Boolean(before?.gold) || gold,
      bestShots: before?.bestShots ? Math.min(before.bestShots, shots || before.bestShots) : shots,
    };
  }
  const upcoming = CHARACTERS[index + 1] || null;
  return {
    progress: next,
    won: Boolean(won),
    firstWin: Boolean(won) && !before,
    gold,
    newGold: gold && !before?.gold,
    trophy: character.trophy,
    nextId: won && upcoming ? upcoming.id : null,
    completed: Boolean(won) && !before && trophyCount(next) === CHARACTERS.length,
  };
}

function normaliseCampaign(raw) {
  const out = blank();
  CHARACTERS.forEach((c) => {
    const row = raw?.beaten?.[c.id];
    if (row && typeof row === "object") out.beaten[c.id] = {
      wins: Math.max(1, Math.min(100000, row.wins | 0)),
      gold: row.gold === true,
      bestShots: Math.max(0, Math.min(100000, row.bestShots | 0)),
    };
  });
  return out;
}

export function mergeCampaign(left, right) {
  const merged = normaliseCampaign(left);
  for (const [id, next] of Object.entries(normaliseCampaign(right).beaten)) {
    const before = merged.beaten[id];
    const best = Math.min(before?.bestShots || Infinity, next.bestShots || Infinity);
    merged.beaten[id] = before ? {
      wins: Math.max(before.wins, next.wins),
      gold: before.gold || next.gold,
      bestShots: Number.isFinite(best) ? best : 0,
    } : next;
  }
  return merged;
}

function readCampaign(key) {
  try {
    return normaliseCampaign(JSON.parse(localStorage.getItem(key) || "{}"));
  } catch { return blank(); }
}

function writeCampaign(key, progress) {
  try { localStorage.setItem(key, JSON.stringify(progress)); } catch { /* Optional device cache. */ }
}

export function loadCampaign() {
  return scope ? mergeCampaign(readCampaign(KEY + ":" + scope), cloud) : readCampaign(KEY);
}

function campaignEndpoint() {
  try {
    if (window.parent !== window && window.parent.location.origin === window.location.origin
      && window.location.pathname.startsWith("/games/pool/")) return "/api/pool/campaign";
  } catch { /* Standalone and cross-origin embeds keep local progress. */ }
  return null;
}

async function sync(endpoint) {
  const old = JSON.stringify(loadCampaign());
  const request = await fetch(endpoint, { cache: "no-store", signal: AbortSignal.timeout(1800) });
  const notify = () => window.dispatchEvent(new Event("pool-campaign-updated"));
  if (request.status === 401) {
    scope = null;
    cloud = null;
    if (old !== JSON.stringify(loadCampaign())) notify();
    return;
  }
  if (!request.ok) return;
  const account = await request.json();
  if (!/^[a-f0-9]{64}$/.test(account.scope)) return;
  const key = KEY + ":" + account.scope;
  let legacyOwner;
  try { legacyOwner = localStorage.getItem(LEGACY_OWNER); } catch { /* Storage unavailable. */ }
  const incoming = mergeCampaign(readCampaign(key), legacyOwner ? null : readCampaign(KEY));
  cloud = mergeCampaign(scope === account.scope ? cloud : null, account.progress);
  scope = account.scope;
  const merged = mergeCampaign(incoming, cloud);
  writeCampaign(key, merged);
  if (!legacyOwner) {
    try { localStorage.setItem(LEGACY_OWNER, scope); } catch { /* Optional device marker. */ }
  }
  if (old !== JSON.stringify(merged)) notify();
  if (JSON.stringify(merged) !== JSON.stringify(normaliseCampaign(account.progress))) {
    const saved = await fetch(endpoint, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scope, progress: merged }), signal: AbortSignal.timeout(1800),
    });
    if (!saved.ok) return;
    const result = await saved.json();
    if (result.scope !== scope) return;
    const latest = mergeCampaign(loadCampaign(), result.progress);
    cloud = latest;
    writeCampaign(key, latest);
    if (JSON.stringify(latest) !== JSON.stringify(merged)) notify();
  }
}

export function syncCampaign() {
  const endpoint = campaignEndpoint();
  if (!endpoint) return Promise.resolve();
  if (syncing) { syncAgain = true; return syncing; }
  syncing = sync(endpoint).catch(() => {}).finally(() => {
    syncing = null;
    if (syncAgain) { syncAgain = false; void syncCampaign(); }
  });
  return syncing;
}

export function recordCampaignResult(id, result) {
  const outcome = applyResult(loadCampaign(), id, result);
  if (scope) cloud = outcome.progress;
  writeCampaign(scope ? KEY + ":" + scope : KEY, outcome.progress);
  if (outcome.won) void syncCampaign();
  return outcome;
}
