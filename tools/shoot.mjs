// Four Winds: headless screenshot driver + live play-test.
// Serves game/ on :8080, drives chrome-headless-shell over CDP, captures
// each ?shot= scene from shots.json as a JPEG into screenshots/, then
// play-tests the live game (Space to start, play a card, P pause/resume)
// and fails on any console error. Run from the entry root:
//   node tools/shoot.mjs
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const WebSocket = require('/home/hatch/workspace/tools/makefun/node_modules/ws');

const here = fileURLToPath(new URL('.', import.meta.url));
const entryDir = join(here, '..');
const shotsPath = join(entryDir, 'shots.json');
const outDir = join(entryDir, 'screenshots');
const PORT = 8080;
const CDP_PORT = 9222;

const CHROME_CANDIDATES = [
  '/home/hatch/.cache/ms-playwright/chromium_headless_shell-1255/chrome-headless-shell-linux64/chrome-headless-shell',
  '/opt/meta-chromium/chrome',
];

const failures = [];
const consoleErrors = [];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function httpJson(url, method = 'GET') {
  const res = await fetch(url, { method });
  if (!res.ok) throw new Error(`${method} ${url} -> ${res.status}`);
  return res.json();
}

async function waitFor(predicate, timeoutMs, label) {
  const start = Date.now();
  for (;;) {
    try {
      if (await predicate()) return;
    } catch { /* retry */ }
    if (Date.now() - start > timeoutMs) throw new Error(`timed out: ${label}`);
    await sleep(200);
  }
}

class CdpTarget {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.nextId = 1;
    this.pending = new Map();
    this.ready = new Promise((resolve, reject) => {
      this.ws.on('open', resolve);
      this.ws.on('error', reject);
    });
    this.ws.on('message', (data) => {
      const msg = JSON.parse(String(data));
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(JSON.stringify(msg.error)));
        else resolve(msg.result);
      } else if (msg.method === 'Runtime.exceptionThrown') {
        const detail = msg.params?.exceptionDetails;
        consoleErrors.push(`exception: ${detail?.exception?.description ?? detail?.text ?? 'unknown'}`);
      } else if (msg.method === 'Runtime.consoleAPICalled' && msg.params?.type === 'error') {
        consoleErrors.push(`console.error: ${msg.params.args.map((a) => a.value ?? a.description ?? '').join(' ')}`);
      }
    });
  }

  async call(method, params = {}) {
    await this.ready;
    const id = this.nextId++;
    const result = await new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
    return result;
  }

  async eval(expression) {
    const r = await this.call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(`page eval failed: ${r.exceptionDetails.text} ${r.exceptionDetails.exception?.description ?? ''}`);
    return r.result?.value;
  }

  close() {
    try { this.ws.close(); } catch { /* already closed */ }
  }
}

async function openTarget(url) {
  const target = await httpJson(
    `http://127.0.0.1:${CDP_PORT}/json/new?${encodeURIComponent(url)}`, 'PUT',
  );
  const cdp = new CdpTarget(target.webSocketDebuggerUrl);
  await cdp.call('Page.enable');
  await cdp.call('Runtime.enable');
  return { cdp, targetId: target.id };
}

async function closeTarget(id) {
  try {
    await fetch(`http://127.0.0.1:${CDP_PORT}/json/close/${id}`);
  } catch { /* already gone */ }
}

async function captureCanvas(cdp) {
  const dataUrl = await cdp.eval(`(() => {
    const c = document.getElementById('game');
    return c ? c.toDataURL('image/jpeg', 0.85) : null;
  })()`);
  if (!dataUrl || !dataUrl.startsWith('data:image/jpeg;base64,')) {
    throw new Error('canvas toDataURL did not return a JPEG');
  }
  return Buffer.from(dataUrl.slice('data:image/jpeg;base64,'.length), 'base64');
}

async function key(cdp, code, keyName, keyCode) {
  const down = { type: 'rawKeyDown', code, key: keyName, windowsVirtualKeyCode: keyCode };
  await cdp.call('Input.dispatchKeyEvent', down);
  await cdp.call('Input.dispatchKeyEvent', { ...down, type: 'keyUp' });
}

async function main() {
  const chrome = CHROME_CANDIDATES.find((p) => existsSync(p));
  if (!chrome) throw new Error('no headless chrome found in candidates');

  const server = spawn(process.execPath, ['serve.ts', '--port', String(PORT)], {
    cwd: entryDir, stdio: ['ignore', 'pipe', 'pipe'],
  });
  const browser = spawn(chrome, [
    `--remote-debugging-port=${CDP_PORT}`,
    '--no-sandbox',
    '--disable-gpu',
    '--window-size=1280,800',
    '--hide-scrollbars',
    'about:blank',
  ], { stdio: ['ignore', 'pipe', 'pipe'] });

  let exitCode = 0;
  try {
    await waitFor(async () => {
      const res = await fetch(`http://127.0.0.1:${PORT}/index.html`);
      return res.ok;
    }, 15000, 'dev server up');
    await waitFor(async () => {
      const res = await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`);
      return res.ok;
    }, 15000, 'CDP up');
    console.log('server + browser up');

    const shots = JSON.parse(readFileSync(shotsPath, 'utf8'));
    mkdirSync(outDir, { recursive: true });
    for (const shot of shots) {
      const url = `http://127.0.0.1:${PORT}/${shot.query}`;
      const { cdp, targetId } = await openTarget(url);
      try {
        await waitFor(async () => (await cdp.eval('window.__shotReady === true')) === true, 30000, `${shot.name} ready`);
        const buf = await captureCanvas(cdp);
        const dest = join(outDir, shot.name);
        writeFileSync(dest, buf);
        const size = statSync(dest).size;
        console.log(`${shot.name}: ${size} bytes`);
        if (size > 262144) failures.push(`${shot.name} is ${size} bytes, over the 256 KiB cap`);
      } finally {
        cdp.close();
        await closeTarget(targetId);
      }
    }

    // Live play-test: Space starts, Digit1 plays a card, P pauses/resumes.
    const { cdp, targetId } = await openTarget(`http://127.0.0.1:${PORT}/`);
    try {
      await waitFor(async () => (await cdp.eval(`!!document.getElementById('game')`)) === true, 15000, 'game page load');
      await sleep(800);
      const before = await captureCanvas(cdp);
      await key(cdp, 'Space', ' ', 32);
      await sleep(700);
      const statusAfterStart = await cdp.eval(`document.getElementById('status').textContent`);
      if (!/Playing/.test(statusAfterStart ?? '')) failures.push(`play-test: status after Space was ${JSON.stringify(statusAfterStart)}`);
      await key(cdp, 'Digit1', '1', 49);
      await sleep(600);
      const duringReveal = await captureCanvas(cdp);
      if (duringReveal.equals(before)) failures.push('play-test: canvas unchanged after playing a card');
      await sleep(1500); // reveal resolves, next round starts
      await key(cdp, 'KeyP', 'p', 80);
      await sleep(400);
      const statusPaused = await cdp.eval(`document.getElementById('status').textContent`);
      if (!/Paused/.test(statusPaused ?? '')) failures.push(`play-test: status after P was ${JSON.stringify(statusPaused)}`);
      await key(cdp, 'KeyP', 'p', 80);
      await sleep(400);
      const statusResumed = await cdp.eval(`document.getElementById('status').textContent`);
      if (!/Playing/.test(statusResumed ?? '')) failures.push(`play-test: status after resume was ${JSON.stringify(statusResumed)}`);
      console.log('play-test: start, play, pause, resume all observed');
    } finally {
      cdp.close();
      await closeTarget(targetId);
    }
  } finally {
    server.kill();
    browser.kill();
  }

  if (consoleErrors.length > 0) failures.push(`console errors: ${consoleErrors.join(' | ')}`);
  if (failures.length > 0) {
    console.error('FAILURES:');
    for (const f of failures) console.error(` - ${f}`);
    exitCode = 1;
  } else {
    console.log('shoot.mjs: all screenshots captured, play-test passed, no console errors');
  }
  process.exit(exitCode);
}

main().catch((err) => {
  console.error(`shoot.mjs crashed: ${err.message}`);
  process.exit(1);
});
