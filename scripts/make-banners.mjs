// Composes the banner and store imagery from the Blender key art, and takes
// clean in-game screenshots from the production build.
//
//   npm run build && node scripts/make-banners.mjs
//
// Inputs:  art/renders/keyart.png, keyart-wide.png, keyart-square.png
//          (from art/blender/build_scene.py -- hero ...)
// Outputs: art/banners/*.png
//
// The title lockup is set in the game's own typeface by a headless browser,
// so the banners always match the title screen.
import { createServer } from "node:http";
import { readFile, mkdir, access } from "node:fs/promises";
import { resolve, extname } from "node:path";
import { chromium } from "playwright";

const root = resolve(".");
const TYPES = { ".js": "text/javascript", ".css": "text/css", ".html": "text/html", ".png": "image/png", ".webp": "image/webp", ".woff2": "font/woff2", ".woff": "font/woff" };
const server = createServer(async (request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
  if (pathname === "/blank") { response.setHeader("content-type", "text/html"); return response.end("<!doctype html>"); }
  const file = resolve(root, `.${pathname === "/" ? "/dist/index.html" : pathname}`);
  if (!file.startsWith(root)) return response.writeHead(403).end();
  try {
    const bytes = await readFile(file);
    response.setHeader("content-type", TYPES[extname(file)] ?? "application/octet-stream");
    response.end(bytes);
  } catch { response.writeHead(404).end(); }
});
await new Promise((done) => server.listen(0, "127.0.0.1", done));
const origin = `http://127.0.0.1:${server.address().port}`;

const FONT = "/node_modules/@fontsource/barlow-condensed/files/barlow-condensed-latin";
const crest = (size) => {
  const gap = size * 2.5;
  let rings = "";
  for (let row = 0; row < 2; row += 1) for (let col = 0; col < 3; col += 1) {
    rings += `<circle cx="${size + col * gap}" cy="${size + row * gap}" r="${size * 0.72}" fill="none" stroke="#e3b458" stroke-width="${size * 0.42}"/>`;
  }
  return `<svg width="${size * 2 + gap * 2}" height="${size * 2 + gap}" xmlns="http://www.w3.org/2000/svg">${rings}</svg>`;
};

// `u` is the lockup's unit: every size in it is a multiple of u pixels.
function page({ art, w, h, u = 10, left = 0, top = 0, tagline, position = "center", plain = false }) {
  return `<!doctype html><meta charset="utf-8"><style>
    @font-face { font-family: "BC"; font-weight: 600; src: url("${FONT}-600-normal.woff2") format("woff2"); }
    @font-face { font-family: "BC"; font-weight: 700; src: url("${FONT}-700-normal.woff2") format("woff2"); }
    html, body { margin: 0; }
    body { width: ${w}px; height: ${h}px; overflow: hidden; position: relative; background: #0a0d12 url("${art}") ${position} / cover no-repeat; font-family: "BC", sans-serif; }
    .fade { position: absolute; inset: 0; background:
      linear-gradient(100deg, rgba(8,10,14,0.90) 0%, rgba(8,10,14,0.62) 24%, rgba(8,10,14,0) 52%),
      linear-gradient(0deg, rgba(8,10,14,0.35) 0%, rgba(8,10,14,0) 30%); }
    .lockup { position: absolute; left: ${left}px; top: ${top}px; color: #f3ead7; text-shadow: 0 ${u * 0.3}px ${u * 1.6}px rgba(0,0,0,0.65); }
    .name { font-weight: 600; font-size: ${u * 2.5}px; letter-spacing: ${u * 1.05}px; color: #e3b458; margin-top: ${u * 0.9}px; line-height: 1; }
    .pool { font-weight: 700; font-size: ${u * 11}px; line-height: 0.9; margin-top: ${u * 0.5}px; letter-spacing: ${u * 0.1}px; }
    .rule { display: flex; align-items: center; gap: ${u}px; margin-top: ${u * 1.2}px; font-weight: 600; font-size: ${u * 1.7}px; letter-spacing: ${u * 0.3}px; color: #c9d2dc; }
    .rule::before { content: ""; width: ${u * 4}px; height: ${Math.max(2, u * 0.18)}px; background: #e3b458; }
  </style><body>${plain ? "" : `<div class="fade"></div><div class="lockup">${crest(u * 0.9)}<div class="name">ROKUMON</div><div class="pool">POOL</div>${tagline ? `<div class="rule">${tagline}</div>` : ""}</div>`}</body>`;
}

const JOBS = [
  { out: "banner-hero-1920x1080.png", art: "/art/renders/keyart.png", w: 1920, h: 1080, u: 22, left: 110, top: 90, tagline: "8-BALL IN YOUR BROWSER" },
  { out: "banner-wide-1500x500.png", art: "/art/renders/keyart-wide.png", w: 1500, h: 500, u: 12.5, left: 70, top: 44, tagline: "8-BALL IN YOUR BROWSER" },
  { out: "social-share-1200x630.png", art: "/art/renders/keyart.png", w: 1200, h: 630, u: 14.5, left: 64, top: 50, tagline: "8-BALL IN YOUR BROWSER" },
  { out: "cover-square-1080x1080.png", art: "/art/renders/keyart-square.png", w: 1080, h: 1080, u: 17, left: 64, top: 60, tagline: "8-BALL" },
  // The hub wants a cover near 3:2 with the title on it, and a hero with no text
  // (it uses the key art itself, src/art/keyart.webp).
  { out: "hub-cover-1500x1000.png", art: "/art/renders/keyart.png", w: 1500, h: 1000, u: 18, left: 80, top: 70, tagline: "8-BALL · 9-BALL · BLACKBALL · SIX COINS", position: "62% center" },
  // Premium key art generated with Higgsfield (GPT Image 2.5), in art/higgsfield/.
  // The cover carries the title; the hero is used as it is, with no text.
  { out: "hub-cover-v2-1200x800.png", art: "/art/higgsfield/cover.png", w: 1200, h: 800, u: 15, left: 66, top: 78, tagline: "8-BALL · 9-BALL · BLACKBALL · SIX COINS", position: "center" },
  { out: "hub-hero-v2-1344x752.jpg", art: "/art/higgsfield/hero.png", w: 1344, h: 752, plain: true },
  { out: "banner-hero-v2-1344x752.png", art: "/art/higgsfield/hero.png", w: 1344, h: 752, u: 15, left: 76, top: 60, tagline: "FOUR GAMES · TEN RIVALS" },
  { out: "hub-hero-1600x900.png", art: "/art/renders/keyart.png", w: 1600, h: 900, u: 18, left: 90, top: 76, tagline: "8-BALL IN YOUR BROWSER" },
];

const exists = (p) => access(p).then(() => true, () => false);
await mkdir("art/banners", { recursive: true });
const browser = await chromium.launch({ headless: true, ...(process.platform === "win32" ? { channel: "chrome" } : {}) });
try {
  for (const job of JOBS) {
    if (!(await exists(resolve(root, `.${job.art}`)))) { console.log(`skip ${job.out}: ${job.art} has not been rendered`); continue; }
    const context = await browser.newContext({ viewport: { width: job.w, height: job.h }, deviceScaleFactor: 1 });
    const tab = await context.newPage();
    await tab.goto(`${origin}/blank`); // same origin, so the art and fonts load
    await tab.setContent(page({ ...job, art: origin + job.art }), { waitUntil: "load" });
    await tab.evaluate(() => document.fonts.ready);
    await tab.waitForTimeout(150);
    await tab.screenshot(job.out.endsWith(".jpg") ? { path: `art/banners/${job.out}`, type: "jpeg", quality: 88 } : { path: `art/banners/${job.out}` });
    console.log(`wrote art/banners/${job.out}`);
    await context.close();
  }

  // In-game screenshots at the game's native 1920x1080.
  if (await exists(resolve(root, "dist/index.html"))) {
    const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
    // Seeded so the break repeats.
    await context.addInitScript("(() => { let a = 11; Math.random = () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; })();");
    const tab = await context.newPage();
    await tab.route("**/hub-bridge.js", (route) => route.fulfill({ status: 200, contentType: "text/javascript", body: "" }));
    await tab.goto(`${origin}/dist/index.html`);
    await tab.waitForFunction(() => document.body.dataset.screen === "menu");
    await tab.waitForTimeout(400);
    await tab.screenshot({ path: "art/banners/screenshot-01-title.png" });
    await tab.keyboard.press("1");
    await tab.waitForFunction(() => document.body.dataset.screen === "game");
    await tab.waitForTimeout(500);
    const hasDebug = await tab.evaluate(() => Boolean(window.__GAME_DEBUG__));
    if (hasDebug) {
      // Line up the break with the power bar part drawn.
      await tab.evaluate(() => { const s = window.__GAME_DEBUG__.getScene(); s.aimAngle = -0.035; s.power = 0.72; });
      await tab.waitForTimeout(200);
      await tab.screenshot({ path: "art/banners/screenshot-02-break.png" });
      // Break, let the computer play on, and catch the table mid-game.
      await tab.evaluate(() => {
        const d = window.__GAME_DEBUG__;
        const s = d.getScene();
        const settle = () => { for (let i = 0; i < 80 && (s.phase === "shooting" || s.strike); i += 1) d.stepFrames(30); };
        s.power = 0;
        d.strike(0.95); settle();
        for (let turn = 0; turn < 5 && s.phase !== "over"; turn += 1) {
          for (let i = 0; i < 200 && s.isAiTurn() && s.phase !== "over"; i += 1) d.stepFrames(20);
          if (s.phase === "placing") d.placeCue(260, 270);
          if (s.phase === "aim" && !s.isAiTurn()) { s.resetAim(); d.strike(0.55); settle(); }
        }
        for (let i = 0; i < 200 && s.isAiTurn() && s.phase !== "over"; i += 1) d.stepFrames(20);
        if (s.phase === "placing") d.placeCue(260, 270);
        if (s.phase === "aim") { s.resetAim(); s.power = 0.4; }
        d.stepFrames(40);
      });
      await tab.waitForTimeout(300);
      await tab.screenshot({ path: "art/banners/screenshot-03-midgame.png" });
    } else {
      await tab.screenshot({ path: "art/banners/screenshot-02-break.png" });
    }
    // The campaign ladder part-way up, and a blackball table.
    await tab.evaluate(() => {
      localStorage.setItem("rokumon-pool:campaign", JSON.stringify({ beaten: {
        anayama: { wins: 1, gold: true, bestShots: 14 },
        isa: { wins: 2, gold: false, bestShots: 19 },
        seikai: { wins: 1, gold: true, bestShots: 16 },
      } }));
    });
    await tab.goto(`${origin}/dist/index.html`);
    await tab.waitForFunction(() => document.body.dataset.screen === "menu");
    await tab.keyboard.press("c");
    await tab.waitForFunction(() => document.body.dataset.screen === "campaign");
    await tab.waitForTimeout(400);
    await tab.screenshot({ path: "art/banners/screenshot-04-campaign.png" });
    await tab.keyboard.press("Escape");
    await tab.waitForFunction(() => document.body.dataset.screen === "menu");
    // Blackball is the third game chip on the title screen.
    await tab.mouse.click((267.5 / 960) * 1920, (284 / 540) * 1080);
    await tab.keyboard.press("2");
    await tab.waitForFunction(() => document.body.dataset.screen === "game");
    await tab.waitForTimeout(400);
    await tab.evaluate(() => {
      const d = window.__GAME_DEBUG__;
      const s = d.getScene();
      d.strike(0.95);
      for (let i = 0; i < 80 && (s.phase === "shooting" || s.strike); i += 1) d.stepFrames(30);
      if (s.phase === "placing") d.placeCue(240, 270);
      if (s.phase === "aim") { s.resetAim(); s.power = 0.5; }
      d.stepFrames(260);
    });
    await tab.waitForTimeout(300);
    await tab.screenshot({ path: "art/banners/screenshot-05-blackball.png" });
    // Six Coins, the house game: break, then pot a red so gold is on.
    await tab.evaluate(() => {
      const d = window.__GAME_DEBUG__;
      const s = d.getScene();
      s.scene.restart({ mode: "ai", variant: "sixcoins", difficulty: "normal" });
    });
    await tab.waitForTimeout(500);
    await tab.evaluate(() => {
      const d = window.__GAME_DEBUG__;
      const s = d.getScene();
      const settle = () => { for (let i = 0; i < 80 && (s.phase === "shooting" || s.strike); i += 1) d.stepFrames(30); };
      d.strike(0.95); settle();
      for (let i = 0; i < 200 && s.isAiTurn() && s.phase !== "over"; i += 1) d.stepFrames(20);
      if (s.phase === "placing") d.placeCue(240, 270);
      const red = [...s.balls.values()].find((b) => b.active && Number(b.id) >= 7);
      if (s.phase === "aim" && !s.isAiTurn() && s.match.on === "red" && red) { d.teleportToPocket(red.id, 2); s.firstContact = Number(red.id); settle(); }
      if (s.phase === "aim") { s.resetAim(); s.power = 0.45; }
      d.stepFrames(260);
    });
    await tab.waitForTimeout(300);
    await tab.screenshot({ path: "art/banners/screenshot-06-six-coins.png" });
    await tab.evaluate(() => { localStorage.removeItem("rokumon-pool:campaign"); localStorage.removeItem("rokumon-pool:settings"); });
    console.log("wrote art/banners/screenshot-*.png");
    await context.close();
  } else {
    console.log("skip screenshots: run npm run build first");
  }
} finally {
  await browser.close();
  await new Promise((done) => server.close(done));
}
