import { spawn } from 'node:child_process';
import { access, copyFile, mkdir, readdir, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const generatedDir = path.join(rootDir, 'submission', 'video', 'generated');
const visualDir = path.join(generatedDir, 'visuals');
const deckPdf = path.join(rootDir, 'submission', 'ChargeProof-Deck.pdf');
const dashboardUrl = process.env.CHARGEPROOF_DEMO_URL ?? 'https://chargeproof-plum.vercel.app';

await mkdir(visualDir, { recursive: true });
await renderDeckSlides();
await captureDashboardViews();

console.log(`Video visuals are ready in ${path.relative(rootDir, visualDir)}.`);

async function renderDeckSlides() {
  await access(deckPdf);
  const prefix = path.join(visualDir, 'deck-page');
  await runCommand(process.env.PDFTOPPM_PATH ?? 'pdftoppm', ['-png', '-r', '120', deckPdf, prefix]);

  const rendered = (await readdir(visualDir))
    .filter((name) => /^deck-page-\d+\.png$/.test(name))
    .sort((left, right) => pageNumber(left) - pageNumber(right));
  if (rendered.length !== 10) {
    throw new Error(`Expected 10 rendered deck pages, received ${rendered.length}`);
  }
  await Promise.all(
    rendered.map((name, index) =>
      copyFile(path.join(visualDir, name), path.join(visualDir, `slide-${index + 1}.png`)),
    ),
  );
}

async function captureDashboardViews() {
  const chromePath = await resolveChromePath();
  const port = await reservePort();
  const profileDir = path.join(tmpdir(), `chargeproof-video-chrome-${process.pid}-${Date.now()}`);
  await mkdir(profileDir, { recursive: true });

  const chrome = spawn(
    chromePath,
    [
      '--headless=new',
      '--disable-gpu',
      '--disable-extensions',
      '--hide-scrollbars',
      '--no-first-run',
      '--no-default-browser-check',
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${profileDir}`,
      '--window-size=1920,1080',
      dashboardUrl,
    ],
    { stdio: 'ignore', windowsHide: true },
  );

  try {
    const target = await waitForPageTarget(port, dashboardUrl);
    const cdp = await createCdpClient(target.webSocketDebuggerUrl);
    try {
      await cdp.call('Page.enable');
      await cdp.call('Emulation.setDeviceMetricsOverride', {
        width: 1920,
        height: 1080,
        deviceScaleFactor: 1,
        mobile: false,
      });
      await cdp.call('Runtime.evaluate', {
        expression: 'document.fonts.ready.then(() => true)',
        awaitPromise: true,
        returnByValue: true,
      });

      await captureView(cdp, 'dashboard-hero.png');
      await captureView(cdp, 'dashboard-workflow.png', '.workflow');
      await captureView(cdp, 'dashboard-evidence.png', '.evidence');
    } finally {
      await cdp.close();
    }
  } finally {
    if (!chrome.killed) chrome.kill();
  }
}

async function captureView(cdp, filename, selector) {
  const encodedSelector = JSON.stringify(selector ?? '');
  const response = await cdp.call('Runtime.evaluate', {
    expression: `(() => {
      document.documentElement.style.scrollBehavior = 'auto';
      const selector = ${encodedSelector};
      const element = selector ? document.querySelector(selector) : null;
      if (selector && !element) throw new Error('Missing capture selector: ' + selector);
      const target = element ? element.getBoundingClientRect().top + window.scrollY - 24 : 0;
      window.scrollTo(0, Math.max(0, target));
      return { scrollY: window.scrollY, target };
    })()`,
    returnByValue: true,
  });
  if (response.exceptionDetails) throw new Error(`Could not position ${filename}`);
  const scrollY = response.result?.value?.scrollY ?? 0;
  if (selector && scrollY < 100) throw new Error(`${filename} did not reach its target scroll position`);
  await delay(250);
  const screenshot = await cdp.call('Page.captureScreenshot', {
    format: 'png',
    fromSurface: true,
    captureBeyondViewport: false,
  });
  const bytes = Buffer.from(screenshot.data, 'base64');
  if (bytes.length < 10_000) throw new Error(`Screenshot ${filename} is unexpectedly small`);
  await writeFile(path.join(visualDir, filename), bytes);
}

async function resolveChromePath() {
  const candidates = [
    process.env.CHROME_PATH,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    process.env.LOCALAPPDATA
      ? path.join(process.env.LOCALAPPDATA, 'Google', 'Chrome', 'Application', 'chrome.exe')
      : undefined,
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
  ].filter(Boolean);
  for (const candidate of candidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // Try the next known installation path.
    }
  }
  throw new Error('Chrome was not found. Set CHROME_PATH to a Chrome or Chromium executable.');
}

async function reservePort() {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Could not reserve a CDP port');
  const { port } = address;
  await new Promise((resolve) => server.close(resolve));
  return port;
}

async function waitForPageTarget(port, expectedUrl) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json`);
      if (response.ok) {
        const targets = await response.json();
        const page = targets.find((target) => target.type === 'page' && target.url.startsWith(expectedUrl));
        if (page) return page;
      }
    } catch {
      // Chrome is still starting.
    }
    await delay(250);
  }
  throw new Error(`Chrome did not expose ${expectedUrl} through CDP within 30 seconds`);
}

async function createCdpClient(webSocketUrl) {
  const socket = new WebSocket(webSocketUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });

  let requestId = 0;
  const pending = new Map();
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    const handlers = pending.get(message.id);
    if (!handlers) return;
    pending.delete(message.id);
    if (message.error) handlers.reject(new Error(message.error.message));
    else handlers.resolve(message.result ?? {});
  });

  return {
    call(method, params = {}) {
      return new Promise((resolve, reject) => {
        const id = ++requestId;
        pending.set(id, { resolve, reject });
        socket.send(JSON.stringify({ id, method, params }));
      });
    },
    close() {
      socket.close();
    },
  };
}

async function runCommand(command, args) {
  await new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit', windowsHide: true });
    child.once('error', reject);
    child.once('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} exited with code ${code}`));
    });
  });
}

function pageNumber(name) {
  return Number(name.match(/(\d+)\.png$/)?.[1] ?? Number.NaN);
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
