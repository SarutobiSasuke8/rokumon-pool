import { describe, expect, it } from "vitest";
import { facing, identityMatrix, rollMatrix, rotateMatrix, settleMatrix } from "../src/systems/ballRender.js";

// Where the ball's own axis `col` (0 = x, 1 = y, 2 = z) points in view space.
const axis = (m, col) => [m[col], m[3 + col], m[6 + col]];
const close = (a, b) => a.forEach((v, i) => expect(v).toBeCloseTo(b[i], 6));

describe("rolling ball orientation", () => {
  it("a quarter roll to the right carries the top of the ball to the right", () => {
    const r = 11;
    const m = rollMatrix(identityMatrix(), (Math.PI / 2) * r, 0, r);
    close(axis(m, 2), [1, 0, 0]);
  });

  it("a quarter roll down the screen carries the top of the ball down", () => {
    const r = 11;
    const m = rollMatrix(identityMatrix(), 0, (Math.PI / 2) * r, r);
    close(axis(m, 2), [0, 1, 0]);
  });

  it("a full circumference returns the ball to where it started", () => {
    const r = 11;
    let m = identityMatrix();
    for (let i = 0; i < 100; i += 1) m = rollMatrix(m, (2 * Math.PI * r) / 100, 0, r);
    close(m, identityMatrix());
  });

  it("no movement leaves the orientation untouched", () => {
    const m = identityMatrix();
    expect(rollMatrix(m, 0, 0, 11)).toBe(m);
  });

  it("stays a rotation after many rolls in mixed directions", () => {
    let m = identityMatrix();
    for (let i = 0; i < 500; i += 1) m = rollMatrix(m, Math.sin(i) * 3, Math.cos(i * 1.7) * 3, 11);
    for (let c = 0; c < 3; c += 1) expect(Math.hypot(...axis(m, c))).toBeCloseTo(1, 5);
    const [x, y] = [axis(m, 0), axis(m, 1)];
    expect(x[0] * y[0] + x[1] * y[1] + x[2] * y[2]).toBeCloseTo(0, 5);
  });
});

describe("settling a ball at rest", () => {
  it("brings the nearer number disc to face the camera, upright", () => {
    // Start well off: tilted and twisted.
    let m = rotateMatrix(rotateMatrix(identityMatrix(), 1, 0, 0, 1.1), 0, 0, 1, 2.2);
    for (let i = 0; i < 200; i += 1) m = settleMatrix(m);
    expect(facing(m).tilt).toBeLessThan(0.02);
    // Upright: the glyph's left-to-right axis points along screen +x.
    const sign = facing(m).sign;
    expect(axis(m, 0)[0] * sign).toBeGreaterThan(0.999);
  });

  it("uses the far disc when it is the nearer one", () => {
    // Almost upside down: the -z disc is nearly facing the camera.
    let m = rotateMatrix(identityMatrix(), 1, 0, 0, Math.PI - 0.4);
    expect(facing(m).sign).toBe(-1);
    for (let i = 0; i < 200; i += 1) m = settleMatrix(m);
    expect(facing(m).sign).toBe(-1);
    expect(facing(m).tilt).toBeLessThan(0.02);
  });

  it("returns the same matrix once settled", () => {
    const m = identityMatrix();
    expect(settleMatrix(m)).toBe(m);
  });
});
