// Browser smoke for ball readability and the HUD, on a desktop and a phone
// viewport. Needs a build first (npm run build). Run with:
//   node scripts/readability-smoke.mjs
// It is also run at the end of scripts/hub-smoke.mjs so CI covers it.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import { resolve, extname } from "node:path";
import { chromium } from "playwright";

const root = resolve("dist");
const server = createServer(async (request, response) => {
  const pathname = new URL(request.url, "http://localhost").pathname;
  const file = resolve(root, pathname === "/" ? "index.html" : `.${pathname}`);
  if (!file.startsWith(root + "/") && !file.startsWith(root + "\\")) return response.writeHead(403).end();
  try {
    const bytes = await readFile(file);
    response.setHeader("content-type", ({ ".js": "text/javascript", ".html": "text/html" })[extname(file)] ?? "application/octet-stream");
    response.end(bytes);
  } catch { response.writeHead(404).end(); }
});
await new Promise((done) => server.listen(0, "127.0.0.1", done));
const origin = `http://127.0.0.1:${server.address().port}/`;

const VIEWPORTS = {
  desktop: { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 },
  // iPhone SE in landscape: the smallest phone the game targets.
  phone: { viewport: { width: 667, height: 375 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
};
// Seeded Math.random so the break, and so the screenshots, repeat.
const SEED = "(() => { let a = 7; Math.random = () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; })();";

// In the page: read the painted ball textures back and check each ball's
// pattern, then drive a short match through the debug harness.
function inspectTextures() {
  const scene = window.__GAME_DEBUG__.getScene();
  const out = [];
  for (const id of ["cue", 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]) {
    const key = `ball-${id}-r11`;
    if (!scene.textures.exists(key)) { out.push({ id, missing: true }); continue; }
    const canvas = scene.textures.get(key).getSourceImage();
    const ctx = canvas.getContext("2d");
    const c = canvas.width / 2;
    const R = 22; // radius 11 painted at 2x
    const px = (dx, dy) => [...ctx.getImageData(Math.round(c + dx * R), Math.round(c + dy * R), 1, 1).data];
    out.push({ id, disc: px(0, -0.46), cap: px(0.15, -0.8), band: px(-0.75, 0.05), edge: px(0, -0.97) });
  }
  return out;
}

function playShortMatch() {
  const d = window.__GAME_DEBUG__;
  const s = d.getScene();
  const settle = () => { for (let i = 0; i < 60 && s.phase === "shooting"; i += 1) d.stepFrames(30); };
  const free = () => {
    if (s.phase !== "placing") return;
    for (let x = 140; x < 420; x += 24) for (let y = 120; y < 440; y += 24) if (d.placeCue(x, y) === "aim") return;
  };
  const live = (ids) => ids.filter((id) => s.balls.get(String(id))?.active);
  const pot = (id, contact) => { free(); d.teleportToPocket(id, 1); s.firstContact = contact; settle(); };
  d.shootCue(0, 1); settle(); free();
  if (!s.match.assigned[1]) pot(live([3, 5, 1, 2, 4, 6, 7])[0], live([3, 5, 1, 2, 4, 6, 7])[0]);
  const shooterGroup = s.match.assigned[s.match.turn];
  const own = shooterGroup === "stripe" ? live([12, 10, 9, 11, 13, 14, 15]) : live([5, 1, 2, 4, 6, 7]);
  if (own[0]) pot(own[0], own[0]);
  free();
  // Show the aim guide at the nearest object ball for the screenshot.
  const cue = s.balls.get("cue").body.position;
  const target = [...s.balls.values()].find((b) => b.active && b.id !== "cue" && b.id !== 8);
  s.aiPreview = { angle: Math.atan2(target.body.position.y - cue.y, target.body.position.x - cue.x), power: 0.65, dist: 104, raw: 999, cancelled: false };
  d.stepFrames(2);
  const ui = s.scene.get("UI");
  const inspect = d.inspect();
  return {
    match: d.snapshotState(),
    pocketedObjects: inspect.balls.filter((b) => !b.active && b.id !== "cue").map((b) => Number(b.id)),
    views: [...s.balls.values()].filter((b) => b.active).map((b) => ({ id: String(b.id), key: b.view.texture.key, visible: b.view.visible, scale: b.view.scaleX })),
    cards: ui.cards.map((c) => ({ name: c.name.text, group: c.group.text, balls: c.balls.length })),
    tray: ui.trayBalls.map((b) => b.texture.key),
    message: ui.msgText.text,
  };
}

const near = (px, hex) => Math.hypot(px[0] - ((hex >> 16) & 255), px[1] - ((hex >> 8) & 255), px[2] - (hex & 255));
const COLOURS = { 1: 0xf5c518, 2: 0x2563eb, 3: 0xdc2626, 4: 0x7c3aed, 5: 0xf97316, 6: 0x22c55e, 7: 0x8b1e1e };
const isWhite = (px) => Math.min(px[0], px[1], px[2]) > 165;

const browser = await chromium.launch({ headless: true, ...(process.platform === "win32" ? { channel: "chrome" } : {}) });
await mkdir("tests/evidence", { recursive: true });
try {
  for (const [name, options] of Object.entries(VIEWPORTS)) {
    const context = await browser.newContext(options);
    await context.addInitScript(SEED);
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.route("**/*", (route) => (new URL(route.request().url()).origin === new URL(origin).origin ? route.continue() : route.abort()));
    await page.goto(origin);
    const canvas = page.locator("canvas");
    await canvas.waitFor();
    await page.waitForTimeout(300);

    // Start Two Players from the menu button: a tap on the phone, a click on desktop.
    const box = await canvas.boundingBox();
    const at = { x: box.x + (480 / 960) * box.width, y: box.y + (340 / 540) * box.height };
    if (options.hasTouch) await page.touchscreen.tap(at.x, at.y);
    else await page.mouse.click(at.x, at.y);
    await page.waitForFunction(() => window.__GAME_DEBUG__?.getScene?.()?.phase === "aim" && window.__GAME_DEBUG__.getScene().mode === "pvp");

    const textures = await page.evaluate(inspectTextures);
    for (const t of textures) {
      assert.ok(!t.missing, `${name}: texture for ball ${t.id}`);
      assert.ok(t.edge[3] > 0, `${name}: ball ${t.id} has an opaque rim`);
      if (t.id === "cue") { assert.ok(isWhite(t.cap), `${name}: cue ball is white`); continue; }
      assert.ok(isWhite(t.disc), `${name}: ball ${t.id} has a white number disc (${t.disc})`);
      if (t.id === 8) assert.ok(Math.max(...t.cap.slice(0, 3)) < 90, `${name}: 8-ball is black`);
      else if (t.id > 8) {
        assert.ok(isWhite(t.cap), `${name}: stripe ${t.id} has a white cap (${t.cap})`);
        assert.ok(near(t.band, COLOURS[t.id - 8]) < near(t.band, 0xf8f6ee), `${name}: stripe ${t.id} band is its colour (${t.band})`);
      } else {
        assert.ok(near(t.cap, COLOURS[t.id]) < near(t.cap, 0xf8f6ee), `${name}: solid ${t.id} is its colour all over (${t.cap})`);
      }
    }

    await page.screenshot({ path: `tests/evidence/2026-10-23-readability-${name}-rack.png` });
    const state = await page.evaluate(playShortMatch);
    await page.waitForTimeout(200);
    await page.screenshot({ path: `tests/evidence/2026-10-23-readability-${name}-midgame.png` });

    for (const v of state.views) {
      assert.equal(v.key, `ball-${v.id}-r11`, `${name}: ball ${v.id} shows its own texture`);
      assert.ok(v.visible);
      assert.equal(v.scale, 0.5);
    }
    const { assigned, remaining } = state.match;
    assert.ok(assigned[1] && assigned[2] && assigned[1] !== assigned[2], `${name}: groups assigned (${JSON.stringify(assigned)})`);
    [1, 2].forEach((p, i) => {
      const card = state.cards[i];
      const left = remaining[assigned[p]].length;
      assert.equal(card.group, left === 0 ? "ON THE 8" : assigned[p] === "solid" ? "SOLIDS" : "STRIPES", `${name}: card ${p} group`);
      assert.equal(card.balls, left === 0 ? 1 : 7, `${name}: card ${p} shows the group's balls`);
    });
    assert.ok(state.cards.some((c) => c.name.startsWith("▶ ")), `${name}: the shooter's card is marked`);
    assert.deepEqual(state.tray.map((k) => Number(k.split("-")[1])).sort((a, b) => a - b), state.pocketedObjects.sort((a, b) => a - b), `${name}: tray shows each pocketed ball`);
    assert.ok(state.pocketedObjects.length > 0, `${name}: something was pocketed`);

    // A real drag still shoots with the new HUD on screen: mouse on desktop,
    // touch events on the phone.
    await page.evaluate(() => { const s = window.__GAME_DEBUG__.getScene(); s.aiPreview = null; if (s.phase === "placing") window.__GAME_DEBUG__.placeCue(200, 270); });
    const shotsBefore = await page.evaluate(() => window.__GAME_DEBUG__.getScene().shotIndex);
    const from = { x: box.x + (480 / 960) * box.width, y: box.y + (300 / 540) * box.height };
    const to = { x: from.x - box.width * 0.08, y: from.y };
    if (options.hasTouch) {
      const cdp = await context.newCDPSession(page);
      await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [from] });
      for (let i = 1; i <= 5; i += 1) await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: from.x + ((to.x - from.x) * i) / 5, y: from.y }] });
      await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    } else {
      await page.mouse.move(from.x, from.y);
      await page.mouse.down();
      await page.mouse.move(to.x, to.y, { steps: 5 });
      await page.mouse.up();
    }
    await page.waitForFunction((n) => window.__GAME_DEBUG__.getScene().shotIndex > n, shotsBefore, { timeout: 5000 });
    assert.deepEqual(errors, [], `${name}: no page errors`);
    console.log(`ok - ${name}: 16 ball textures, groups ${assigned[1]}/${assigned[2]}, tray ${state.tray.length}, ${options.hasTouch ? "touch" : "mouse"} drag shoots`);
    await context.close();
  }
  console.log("Ball readability smoke passed on desktop and phone.");
} finally {
  await browser.close();
  await new Promise((done) => server.close(done));
}
