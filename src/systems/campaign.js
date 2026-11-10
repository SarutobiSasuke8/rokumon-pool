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
  { id: "unno", name: "Unno Rokuro", epithet: "The Steward", variant: "eightball", color: 0x4f6d8f, trophy: "Steward's Seal",
    blurb: "Careful and slow. Rolls every ball in at walking pace.",
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
  { id: "sasuke", name: "Sarutobi Sasuke", epithet: "The Monkey Jump", variant: "eightball", color: 0xb3261e, trophy: "The Six Coins",
    blurb: "First of the Ten. Give him one open shot and the frame is over.",
    tuning: { skill: 0.94, weakShotChance: 0, loosePlacement: 0, powerBias: 1.0, thinkMs: 550 } },
].map((c, index) => Object.freeze({ ...c, rank: index + 1, tuning: Object.freeze(c.tuning) })));

export function characterById(id) {
  return CHARACTERS.find((c) => c.id === id) || null;
}

// What the Game scene needs to run a match against a character.
export function opponentData(character) {
  return { id: character.id, name: character.name, tuning: character.tuning };
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

export function loadCampaign() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "{}");
    const out = blank();
    CHARACTERS.forEach((c) => {
      const row = raw?.beaten?.[c.id];
      if (row && typeof row === "object") out.beaten[c.id] = { wins: Math.max(1, row.wins | 0), gold: Boolean(row.gold), bestShots: Math.max(0, row.bestShots | 0) };
    });
    return out;
  } catch { return blank(); }
}

export function recordCampaignResult(id, result) {
  const outcome = applyResult(loadCampaign(), id, result);
  try { localStorage.setItem(KEY, JSON.stringify(outcome.progress)); } catch { /* per-viewer convenience only */ }
  return outcome;
}
