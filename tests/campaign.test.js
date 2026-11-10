import { describe, expect, it } from "vitest";
import { CHARACTERS, applyResult, characterById, goldCount, opponentData, trophyCount, unlockedCount } from "../src/systems/campaign.js";
import { VARIANTS } from "../src/game/state.js";
import { NINE_RACK, RACK_ORDER, rackFor } from "../src/game/constants.js";

const fresh = () => ({ beaten: {} });
const win = (progress, id, extra = {}) => applyResult(progress, id, { won: true, fouls: 1, shots: 20, ...extra });

describe("the campaign ladder", () => {
  it("has ten opponents with unique ids, a known game and tuning in range", () => {
    expect(CHARACTERS).toHaveLength(10);
    expect(new Set(CHARACTERS.map((c) => c.id)).size).toBe(10);
    CHARACTERS.forEach((c, i) => {
      expect(c.rank).toBe(i + 1);
      expect(VARIANTS).toContain(c.variant);
      expect(c.tuning.skill).toBeGreaterThan(0);
      expect(c.tuning.skill).toBeLessThanOrEqual(1);
      expect(c.tuning.powerBias).toBeGreaterThan(0.5);
      expect(c.trophy.length).toBeGreaterThan(0);
    });
  });

  it("gets harder as it goes up", () => {
    for (let i = 1; i < CHARACTERS.length; i += 1) {
      expect(CHARACTERS[i].tuning.skill).toBeGreaterThan(CHARACTERS[i - 1].tuning.skill);
    }
  });

  it("opens only the first opponent to begin with", () => {
    expect(unlockedCount(fresh())).toBe(1);
    expect(trophyCount(fresh())).toBe(0);
  });

  it("a win gives the trophy and opens the next opponent", () => {
    const out = win(fresh(), CHARACTERS[0].id);
    expect(out).toMatchObject({ won: true, firstWin: true, gold: false, trophy: CHARACTERS[0].trophy, nextId: CHARACTERS[1].id, completed: false });
    expect(unlockedCount(out.progress)).toBe(2);
    expect(trophyCount(out.progress)).toBe(1);
  });

  it("a loss changes nothing", () => {
    const out = applyResult(fresh(), CHARACTERS[0].id, { won: false, fouls: 0, shots: 12 });
    expect(out).toMatchObject({ won: false, firstWin: false, nextId: null });
    expect(unlockedCount(out.progress)).toBe(1);
  });

  it("a win without a foul is gold, and gold is kept after a scrappier rematch", () => {
    const clean = win(fresh(), CHARACTERS[0].id, { fouls: 0 });
    expect(clean).toMatchObject({ gold: true, newGold: true });
    expect(goldCount(clean.progress)).toBe(1);
    const again = win(clean.progress, CHARACTERS[0].id, { fouls: 3 });
    expect(again).toMatchObject({ firstWin: false, gold: false, newGold: false });
    expect(again.progress.beaten[CHARACTERS[0].id]).toMatchObject({ gold: true, wins: 2 });
  });

  it("keeps the fewest shots taken to win", () => {
    let p = win(fresh(), CHARACTERS[0].id, { shots: 30 }).progress;
    p = win(p, CHARACTERS[0].id, { shots: 18 }).progress;
    p = win(p, CHARACTERS[0].id, { shots: 25 }).progress;
    expect(p.beaten[CHARACTERS[0].id].bestShots).toBe(18);
  });

  it("ignores a result against a locked opponent", () => {
    const out = win(fresh(), CHARACTERS[4].id);
    expect(out.won).toBe(false);
    expect(trophyCount(out.progress)).toBe(0);
  });

  it("is completed once every opponent is beaten", () => {
    let p = fresh();
    let last = null;
    CHARACTERS.forEach((c) => { last = win(p, c.id); p = last.progress; });
    expect(last).toMatchObject({ completed: true, nextId: null });
    expect(trophyCount(p)).toBe(10);
    expect(unlockedCount(p)).toBe(10);
  });

  it("does not change the progress it was given", () => {
    const before = fresh();
    win(before, CHARACTERS[0].id);
    expect(before).toEqual({ beaten: {} });
  });

  it("hands the Game scene a name, an id and the tuning", () => {
    const c = characterById("kakei");
    expect(opponentData(c)).toEqual({ id: "kakei", name: "Kakei Juzo", tuning: c.tuning });
    expect(characterById("nobody")).toBeNull();
  });
});

describe("racks", () => {
  it("9-ball racks nine balls in a diamond with the 1 in front and the 9 in the middle", () => {
    expect(NINE_RACK.map((row) => row.length)).toEqual([1, 2, 3, 2, 1]);
    expect(NINE_RACK[0]).toEqual([1]);
    expect(NINE_RACK[2][1]).toBe(9);
    expect(NINE_RACK.flat().sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it("8-ball and blackball share the fifteen-ball triangle", () => {
    expect(rackFor("nineball")).toBe(NINE_RACK);
    expect(rackFor("eightball")).toBe(RACK_ORDER);
    expect(rackFor("blackball")).toBe(RACK_ORDER);
  });
});
