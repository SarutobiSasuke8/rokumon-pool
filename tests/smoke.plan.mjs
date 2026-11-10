/**
 * Rokumon Pool smoke plan: real key, mouse and touch input through a vs-Computer
 * match. It exists because the harness-driven checks (scripts/test-*.mjs and
 * debug shootCue) never touch the pointer path, and an earlier build was
 * unplayable with real input: Matter slept the idle balls and a drag-and-release
 * shot did nothing. It proves shots move the cue ball, the turn passes to the
 * computer and back, and restart is clean. It does not judge physics feel;
 * tune that by playing it on a phone.
 *
 * Run: npm run smoke:input (about two minutes: the balls roll in real time).
 * The existing `npm run smoke` is the separate hub-boot check.
 */
// Landscape: in portrait on a phone the game shows its rotate prompt on purpose.
export const phone = { width: 844, height: 390 };

// The dev server has no /hub-bridge.js (the hub injects it), so Vite serves HTML
// for that script tag (or a 404) and the browser reports it. Not a game bug.
export const ignore = [/Unexpected token '<'/, /hub-bridge\.js/];

export default async function plan(ctx) {
  const { check, expect, key, eval: ev, waitFor, delay, viewport, shot, drag, swipe, game } = ctx;
  // Scenes lay out on a 960x540 logical canvas rendered at twice that size,
  // and ctx.point works in the game's backing size.
  const point = (x, y) => ctx.point(x * 2, y * 2);

  const info = () => ev(`(() => {
    const dbg = window.__GAME_DEBUG__;
    const scene = dbg.getScene();
    const s = dbg.inspect();
    const cue = s.balls.find((b) => b.id === "cue");
    return { phase: s.phase, mode: s.mode, ai: scene.isAiTurn(), cue, active: s.balls.filter((b) => b.active).length };
  })()`);
  const humanAim = async () => { const s = await info(); return s.phase === "aim" && !s.ai; };

  // The cue starts aimed down the table at the rack. Pull the power bar in
  // the left margin down and let go to shoot.
  async function shootWith(method) {
    const before = (await info()).cue;
    const from = await point(20, 112);
    const to = await point(20, 330);
    await method(from, to);
    await waitFor(async () => (await info()).phase === "shooting", "phase shooting after the power pull", 3000);
    await delay(400);
    const after = (await info()).cue;
    expect(after.active, "cue ball left the table");
    const moved = Math.hypot(after.x - before.x, after.y - before.y);
    expect(moved > 10, `cue ball moved only ${moved.toFixed(1)}px; the shot did nothing (sleeping bodies?)`);
  }

  await check("boots to the menu", async () => {
    await waitFor(() => ev(`${game}.scene.isActive("Menu")`), "Menu scene");
    await shot("menu");
  });

  await check("key 1 starts a match against the computer (real key)", async () => {
    await ctx.key("1");
    await waitFor(() => ev(`Boolean(window.__GAME_DEBUG__?.getScene)`), "Game scene debug hook");
    await waitFor(async () => (await info()).phase === "aim", "phase aim");
    const s = await info();
    expect(s.mode === "ai", `mode is ${s.mode}, expected ai`);
    expect(s.active === 16, `${s.active} balls on the table, expected 16`);
    await shot("table");
  });

  await check("a real mouse pull on the power bar shoots the cue ball", async () => {
    await shootWith((from, to) => drag(from, to, { steps: 12, stepMs: 16 }));
    await shot("shot-1");
  });

  await check("the balls come to rest and the turn passes on", async () => {
    await waitFor(async () => (await info()).phase !== "shooting", "balls at rest", 60000);
    const s = await info();
    expect(["aim", "placing", "over"].includes(s.phase), `unexpected phase ${s.phase}`);
  });

  await check("the computer takes its turn and play returns to the human", async () => {
    // The computer shoots with thinking and preview delays, then the balls roll.
    // Ball in hand after a foul shows up as the "placing" phase.
    await waitFor(async () => { const s = await info(); return (s.phase === "aim" && !s.ai) || s.phase === "placing" || s.phase === "over"; }, "human turn again", 120000);
  });

  await check("a real click places the cue ball when ball in hand is awarded", async () => {
    const s = await info();
    if (s.phase !== "placing") return; // only applies after a foul; nothing to prove otherwise
    const spot = await point(300, 270);
    await ctx.click(spot.x, spot.y);
    await waitFor(async () => (await info()).phase === "aim", "phase aim after placement", 5000);
  });

  await check("R restarts to a clean rack (real key)", async () => {
    await key("r");
    await waitFor(async () => { const s = await info(); return s.phase === "aim" && s.active === 16; }, "clean rack after R", 5000);
    expect((await info()).ai === false, "restart should hand the break back to the human");
  });

  await check("a real touch pull on the power bar shoots the cue ball (phone viewport, touch from boot)", async () => {
    // Reload in the phone viewport so Phaser has touch listeners from boot, as on a
    // real phone, then start a match with a touch tap on the menu button.
    await viewport("phone", { reload: true });
    await waitFor(() => ev(`${game}.scene.isActive("Menu")`), "Menu scene after reload");
    const button = await point(232, 340); // "Play vs Computer"
    await ctx.tap(button.x, button.y);
    await waitFor(async () => (await info()).phase === "aim", "phase aim after the touch start");
    await shootWith((from, to) => swipe(from, to, { steps: 12, stepMs: 16 }));
    await shot("phone-shot");
    await viewport("desktop", { reload: true });
  });
}
