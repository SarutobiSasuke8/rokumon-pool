/**
 * Real-input browser smoke test.
 *
 * Starts the Vite dev server, drives headless Chrome or Edge over the DevTools
 * protocol, and plays the game with REAL input events (key, mouse, touch), not
 * debug hooks that bypass the input path. Agent harnesses that call game code
 * directly have missed input-path bugs before (idle physics bodies that never
 * woke, controls that only worked through a hook), so this is the gate for
 * writing "playable" in a README.
 *
 *   npm run smoke               run every check
 *   npm run smoke:evidence      also save screenshots to tests/evidence/
 *   npm run smoke -- --record   on a full pass, write docs/SMOKE_STATUS.md
 *
 * Generic checks (every game gets these for free): boots, frame loop advances,
 * no console errors or failed requests, no horizontal overflow at desktop and
 * phone sizes, survives a reload. The game-specific part is tests/smoke.plan.mjs,
 * which plays one full loop with the helpers passed in as `ctx`.
 */
import { spawn } from "node:child_process";
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const appPort = 5300 + (process.pid % 300);
const appUrl = `http://127.0.0.1:${appPort}`;
const captureEvidence = process.argv.includes("--evidence");
const recordStatus = process.argv.includes("--record");
const evidenceDir = path.join(projectRoot, "tests", "evidence");

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitFor(check, label, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const result = await check();
      if (result) return result;
    } catch (error) {
      lastError = error;
    }
    await delay(100);
  }
  throw new Error(`Timed out waiting for ${label}${lastError ? `: ${lastError.message}` : ""}`);
}

async function firstExisting(paths) {
  for (const candidate of paths.filter(Boolean)) {
    try {
      await access(candidate);
      return candidate;
    } catch {}
  }
  return null;
}

// Phaser reads keyCode, and CDP only sets it when windowsVirtualKeyCode is given.
const NAMED_KEYS = {
  Space: { key: " ", code: "Space", vk: 32 },
  Enter: { key: "Enter", code: "Enter", vk: 13 },
  Escape: { key: "Escape", code: "Escape", vk: 27 },
  ArrowLeft: { key: "ArrowLeft", code: "ArrowLeft", vk: 37 },
  ArrowUp: { key: "ArrowUp", code: "ArrowUp", vk: 38 },
  ArrowRight: { key: "ArrowRight", code: "ArrowRight", vk: 39 },
  ArrowDown: { key: "ArrowDown", code: "ArrowDown", vk: 40 },
  Shift: { key: "Shift", code: "ShiftLeft", vk: 16 },
};

function keyInfo(name) {
  if (NAMED_KEYS[name]) return NAMED_KEYS[name];
  if (/^[a-z]$/i.test(name)) {
    const upper = name.toUpperCase();
    return { key: name.toLowerCase(), code: `Key${upper}`, vk: upper.charCodeAt(0), text: name.toLowerCase() };
  }
  if (/^[0-9]$/.test(name)) return { key: name, code: `Digit${name}`, vk: name.charCodeAt(0), text: name };
  throw new Error(`smoke: unknown key "${name}". Add it to NAMED_KEYS in scripts/browser-smoke.mjs`);
}

class CdpClient {
  constructor(url) {
    this.socket = new WebSocket(url);
    this.pending = new Map();
    this.nextId = 0;
    this.problems = [];
  }

  async connect() {
    await new Promise((resolve, reject) => {
      this.socket.addEventListener("open", resolve, { once: true });
      this.socket.addEventListener("error", reject, { once: true });
    });
    this.socket.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data));
      if (message.method === "Runtime.exceptionThrown") {
        const detail = message.params.exceptionDetails;
        this.problems.push(`exception: ${detail?.exception?.description ?? detail?.text ?? "unknown"}`);
        return;
      }
      if (message.method === "Runtime.consoleAPICalled" && message.params.type === "error") {
        this.problems.push(`console.error: ${message.params.args.map((arg) => arg.value ?? arg.description ?? "").join(" ")}`);
        return;
      }
      if (message.method === "Network.responseReceived") {
        const { response } = message.params;
        if (response.status >= 400 && !response.url.endsWith("/favicon.ico")) this.problems.push(`HTTP ${response.status}: ${response.url}`);
        // Vite's dev server answers a missing file with 200 and the HTML page, so a
        // missing image, sound or JSON file shows up as HTML under a non-HTML URL.
        const pathname = new URL(response.url).pathname;
        if (response.mimeType === "text/html" && /\.(png|jpe?g|webp|gif|svg|ogg|mp3|wav|m4a|json|atlas|ttf|woff2?)$/i.test(pathname)) {
          this.problems.push(`missing asset (dev server returned HTML): ${response.url}`);
        }
        return;
      }
      if (message.method === "Network.loadingFailed" && !message.params.canceled) {
        this.problems.push(`request failed: ${message.params.errorText}`);
        return;
      }
      const handler = this.pending.get(message.id);
      if (!handler) return;
      this.pending.delete(message.id);
      if (message.error) handler.reject(new Error(message.error.message));
      else handler.resolve(message.result);
    });
  }

  send(method, params = {}) {
    const id = ++this.nextId;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  async evaluate(expression) {
    const response = await this.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (response.exceptionDetails) {
      throw new Error(response.exceptionDetails.exception?.description ?? response.exceptionDetails.text);
    }
    return response.result.value;
  }

  close() {
    this.socket.close();
  }
}

const results = [];

async function check(name, fn) {
  try {
    await fn();
    results.push({ name, ok: true });
    console.log(`  ok    ${name}`);
  } catch (error) {
    results.push({ name, ok: false, error: error.message });
    console.log(`  FAIL  ${name}\n        ${error.message}`);
  }
}

function expect(condition, message) {
  if (!condition) throw new Error(message);
}

const profileDir = await mkdtemp(path.join(tmpdir(), "game-smoke-"));
const viteBin = path.join(projectRoot, "node_modules", "vite", "bin", "vite.js");
const server = spawn(process.execPath, [viteBin, "--host", "127.0.0.1", "--port", String(appPort), "--strictPort"], {
  cwd: projectRoot,
  stdio: "ignore",
  windowsHide: true,
});
let browser = null;
let client = null;

async function cleanup() {
  try { client?.close(); } catch {}
  browser?.kill();
  server.kill();
  await delay(300);
  await rm(profileDir, { recursive: true, force: true }).catch(() => {});
}

try {
  if (captureEvidence) await mkdir(evidenceDir, { recursive: true });
  await waitFor(async () => (await fetch(appUrl)).ok, "Vite dev server");
  const chromePath = await firstExisting([
    process.env.CHROME_PATH,
    process.platform === "win32" ? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" : null,
    process.platform === "win32" ? "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe" : null,
    process.platform === "win32" ? "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe" : null,
    process.platform === "win32" ? "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe" : null,
    process.platform === "darwin" ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" : null,
    process.platform === "linux" ? "/usr/bin/google-chrome" : null,
    process.platform === "linux" ? "/usr/bin/google-chrome-stable" : null,
    process.platform === "linux" ? "/usr/bin/chromium" : null,
  ]);
  if (!chromePath) throw new Error("Chrome or Edge was not found. Set CHROME_PATH to run the smoke test.");

  browser = spawn(chromePath, [
    "--headless=new",
    "--remote-debugging-port=0",
    `--user-data-dir=${profileDir}`,
    "--no-first-run",
    "--disable-gpu",
    "--no-sandbox",
    "--autoplay-policy=no-user-gesture-required",
    "--window-size=1280,720",
    appUrl,
  ], { stdio: "ignore", windowsHide: true });

  const portText = await waitFor(async () => {
    try { return await readFile(path.join(profileDir, "DevToolsActivePort"), "utf8"); } catch { return null; }
  }, "DevTools port");
  const debugPort = portText.split(/\r?\n/)[0];
  const target = await waitFor(async () => {
    const list = await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json();
    return list.find((entry) => entry.type === "page" && entry.url.startsWith(appUrl));
  }, "game page target");

  client = new CdpClient(target.webSocketDebuggerUrl);
  await client.connect();
  await client.send("Page.enable");
  await client.send("Runtime.enable");
  await client.send("Network.enable");

  const ev = (expression) => client.evaluate(expression);
  const GAME = "(window.__PHASER_GAME__ || window.__game)";
  const bootExpression = `Boolean(${GAME}?.isBooted) && Boolean(document.querySelector('canvas'))`;

  // ---- the game's plan module (loaded first: it can set phone size and ignores)
  const planPath = path.join(projectRoot, "tests", "smoke.plan.mjs");
  let planModule = null;
  let planError = null;
  try {
    planModule = await import(pathToFileURL(planPath).href);
  } catch (error) {
    planError = error;
  }
  const phoneSize = planModule?.phone ?? { width: 390, height: 844 };
  const ignore = planModule?.ignore ?? [];

  // ---- helpers handed to the game's plan --------------------------------
  const ctx = {
    delay,
    expect,
    check,
    eval: ev,
    waitFor,
    debug: (expression) => ev(`window.__GAME_DEBUG__.${expression}`),
    state: () => ev("window.__GAME_DEBUG__.snapshotState()"),
    hasDebug: () => ev("Boolean(window.__GAME_DEBUG__)"),
    /** Press and release a real key; `hold` keeps it down for that many ms. */
    async key(name, { hold = 60 } = {}) {
      const info = keyInfo(name);
      const base = { key: info.key, code: info.code, windowsVirtualKeyCode: info.vk, nativeVirtualKeyCode: info.vk };
      await client.send("Input.dispatchKeyEvent", { type: info.text ? "keyDown" : "rawKeyDown", ...base, text: info.text });
      await delay(hold);
      await client.send("Input.dispatchKeyEvent", { type: "keyUp", ...base });
      await delay(40);
    },
    /** Real mouse click at client coordinates. */
    async click(x, y) {
      await client.send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y });
      await client.send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1 });
      await client.send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 });
      await delay(80);
    },
    /** Real touch tap at client coordinates. */
    async tap(x, y) {
      await client.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
      await delay(50);
      await client.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      await delay(80);
    },
    /** Real touch swipe between client coordinates (use after ctx.viewport("phone")). */
    async swipe(from, to, { steps = 10, stepMs = 16 } = {}) {
      await client.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: from.x, y: from.y }] });
      for (let step = 1; step <= steps; step += 1) {
        const t = step / steps;
        await client.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t }] });
        await delay(stepMs);
      }
      await client.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      await delay(80);
    },
    /** Reload the page with a different query string, for example ctx.goto("?seed=7"). */
    async goto(search) {
      await client.send("Page.navigate", { url: appUrl + "/" + search });
      await delay(300);
      await waitFor(() => ev(bootExpression), "game boot after navigation");
      await delay(400);
    },
    /** Real mouse drag between client coordinates. */
    async drag(from, to, { steps = 10, stepMs = 16 } = {}) {
      await client.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: from.x, y: from.y });
      await client.send("Input.dispatchMouseEvent", { type: "mousePressed", x: from.x, y: from.y, button: "left", clickCount: 1 });
      for (let step = 1; step <= steps; step += 1) {
        const t = step / steps;
        await client.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t, button: "left", buttons: 1 });
        await delay(stepMs);
      }
      await client.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: to.x, y: to.y, button: "left", clickCount: 1 });
      await delay(80);
    },
    /** Game-space coordinates to client coordinates, via the debug hook. */
    /** The game handle expression, for use inside ctx.eval strings. */
    game: GAME,
    /** Game-space coordinates to client coordinates (works without a game-side hook). */
    point: (x, y) => ev(`(() => { const g = ${GAME}; const r = g.canvas.getBoundingClientRect(); const s = g.scale.gameSize; return { x: r.left + (${x} / s.width) * r.width, y: r.top + (${y} / s.height) * r.height }; })()`),
    /** Named positions the scene registered through installDebug (targets). */
    targets: () => ev("window.__GAME_DEBUG__.targets()"),
    /**
     * Switch to a phone-sized, touch-enabled viewport, or back to desktop.
     * Phaser only attaches touch listeners if touch exists when the page boots, so
     * pass { reload: true } before testing real touch input: the page reloads (and
     * the game restarts, keeping the query string) inside the new viewport, like a
     * phone would load it. Without it the viewport changes but touch drags will not
     * reach the game.
     */
    async viewport(kind, { reload = false } = {}) {
      if (kind === "phone") {
        await client.send("Emulation.setDeviceMetricsOverride", { width: phoneSize.width, height: phoneSize.height, deviceScaleFactor: 1, mobile: true, screenWidth: phoneSize.width, screenHeight: phoneSize.height });
        await client.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
      } else {
        await client.send("Emulation.clearDeviceMetricsOverride");
        await client.send("Emulation.setTouchEmulationEnabled", { enabled: false });
      }
      await delay(500);
      if (reload) {
        await client.send("Page.reload");
        await delay(300);
        await waitFor(() => ev(bootExpression), "game boot after viewport reload");
        await delay(500);
      }
    },
    async shot(name) {
      if (!captureEvidence) return;
      const image = await client.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
      await writeFile(path.join(evidenceDir, `${name}.png`), Buffer.from(image.data, "base64"));
    },
    async reload() {
      await client.send("Page.reload");
      await delay(300);
      await waitFor(() => ev(bootExpression), "game boot after reload");
      await delay(400);
    },
  };

  // ---- generic checks ----------------------------------------------------
  console.log(`Smoke test: ${path.basename(projectRoot)} at ${appUrl}`);

  await check("boots to a visible canvas", async () => {
    await waitFor(() => ev(bootExpression), "Phaser game boot (window.__PHASER_GAME__ is set in dev builds by src/main)");
    await delay(600);
    const rect = await ev("(() => { const r = document.querySelector('canvas').getBoundingClientRect(); return { w: r.width, h: r.height }; })()");
    expect(rect.w > 50 && rect.h > 50, `canvas is ${rect.w}x${rect.h}`);
    await ctx.shot("boot");
  });

  await check("frame loop advances", async () => {
    const before = await ev(`${GAME}.loop.frame`);
    await delay(700);
    const after = await ev(`${GAME}.loop.frame`);
    expect(after > before + 5, `loop.frame went ${before} -> ${after} in 700ms; the game loop is stalled or throttled`);
  });

  const overflowCheck = (label) => async () => {
    const layout = await ev(`(() => {
      const doc = document.documentElement;
      const r = document.querySelector('canvas').getBoundingClientRect();
      return { overflow: doc.scrollWidth > doc.clientWidth, left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: doc.clientWidth, height: doc.clientHeight };
    })()`);
    expect(!layout.overflow, `horizontal page overflow at ${label}`);
    expect(layout.left >= -1 && layout.right <= layout.width + 1, `canvas leaves the viewport horizontally at ${label} (${Math.round(layout.left)}..${Math.round(layout.right)} of ${layout.width})`);
    expect(layout.top >= -1 && layout.bottom <= layout.height + 1, `canvas leaves the viewport vertically at ${label} (${Math.round(layout.top)}..${Math.round(layout.bottom)} of ${layout.height})`);
  };

  await check("layout fits at desktop size", overflowCheck("desktop"));
  await ctx.viewport("phone");
  await check(`layout fits at phone size (${phoneSize.width}x${phoneSize.height})`, overflowCheck(`phone ${phoneSize.width}x${phoneSize.height}`));
  await ctx.shot("phone-boot");
  await ctx.viewport("desktop");

  // ---- the game's own real-input round ----------------------------------
  if (planError) {
    await check("smoke plan loads (tests/smoke.plan.mjs)", async () => { throw new Error(`could not load the plan: ${planError.message}`); });
  } else if (typeof planModule.default === "function") {
    await planModule.default(ctx);
  } else {
    await check("smoke plan loads (tests/smoke.plan.mjs)", async () => { throw new Error("tests/smoke.plan.mjs has no default export function"); });
  }

  await check("survives a reload", async () => {
    await ctx.reload();
    const frame = await ev(`${GAME}.loop.frame`);
    expect(frame > 0, "no frames after reload");
  });

  await check("no console errors or failed requests", async () => {
    const problems = client.problems.filter((text) => !ignore.some((pattern) => pattern.test(text)));
    expect(problems.length === 0, `${problems.length} problem(s): ${[...new Set(problems)].slice(0, 6).join(" | ")}`);
  });
} catch (error) {
  results.push({ name: "smoke harness", ok: false, error: error.message });
  console.log(`  FAIL  smoke harness\n        ${error.message}`);
} finally {
  await cleanup();
}

const failed = results.filter((entry) => !entry.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed.`);

if (recordStatus) {
  const stamp = new Date().toISOString().slice(0, 10);
  const line = failed.length === 0
    ? `Real-input smoke test: **PASS** on ${stamp}, ${results.length} checks (\`npm run smoke\`).`
    : `Real-input smoke test: **FAIL** on ${stamp}, ${failed.length} of ${results.length} checks failing (\`npm run smoke\`).`;
  const body = [
    "# Smoke status",
    "",
    line,
    "",
    "Written by `npm run smoke -- --record`. A README may say \"playable\" only while this file says PASS. This is agent-run input, not a human playtest.",
    "",
    ...results.map((entry) => `- ${entry.ok ? "pass" : "FAIL"}: ${entry.name}${entry.ok ? "" : ` (${entry.error})`}`),
    "",
  ].join("\n");
  await mkdir(path.join(projectRoot, "docs"), { recursive: true });
  await writeFile(path.join(projectRoot, "docs", "SMOKE_STATUS.md"), body);
  console.log("Wrote docs/SMOKE_STATUS.md");
}

process.exit(failed.length === 0 ? 0 : 1);
