import { describe, expect, it } from "vitest";
import { addResult } from "../src/systems/stats.js";

describe("win/loss record", () => {
  it("counts a win and a loss on the right difficulty", () => {
    let record = addResult({}, "hard", true);
    record = addResult(record, "hard", false);
    record = addResult(record, "easy", true);
    expect(record.hard).toEqual({ won: 1, lost: 1 });
    expect(record.easy).toEqual({ won: 1, lost: 0 });
    expect(record.normal).toEqual({ won: 0, lost: 0 });
  });

  it("files an unknown difficulty under Normal", () => {
    expect(addResult({}, "impossible", true).normal).toEqual({ won: 1, lost: 0 });
  });

  it("does not change the record it was given", () => {
    const before = { normal: { won: 2, lost: 3 } };
    addResult(before, "normal", true);
    expect(before.normal).toEqual({ won: 2, lost: 3 });
  });
});
