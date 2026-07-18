import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from 'playwright';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const extensionPath = path.resolve(scriptDir, '..', '..', 'mimic_recorder');
const tempRoot = path.resolve(os.tmpdir());

export function createOwnedRecorderProfile() {
  return fs.mkdtempSync(path.join(tempRoot, 'Parro-BrowserProfile-'));
}

export function isOwnedRecorderProfile(profileDir) {
  const resolvedProfile = path.resolve(profileDir);
  return resolvedProfile.startsWith(`${tempRoot}${path.sep}`)
    && path.basename(resolvedProfile).startsWith('Parro-BrowserProfile-');
}

export function removeOwnedRecorderProfile(profileDir) {
  const resolvedProfile = path.resolve(profileDir);
  if (!isOwnedRecorderProfile(resolvedProfile)) {
    throw new Error(`Refusing to remove unexpected browser profile path: ${resolvedProfile}`);
  }
  fs.rmSync(resolvedProfile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}

function resolvePlaywrightChromium() {
  const requested = chromium.executablePath();
  if (fs.existsSync(requested)) return requested;

  const cacheRoot = process.env.PLAYWRIGHT_BROWSERS_PATH
    ? path.resolve(process.env.PLAYWRIGHT_BROWSERS_PATH)
    : path.join(process.env.LOCALAPPDATA || '', 'ms-playwright');
  if (!cacheRoot || !fs.existsSync(cacheRoot)) {
    throw new Error('Playwright Chromium is not installed. Run `npx playwright install chromium` explicitly.');
  }

  const executableSuffix = process.platform === 'win32'
    ? path.join('chrome-win64', 'chrome.exe')
    : process.platform === 'darwin'
      ? path.join('chrome-mac', 'Chromium.app', 'Contents', 'MacOS', 'Chromium')
      : path.join('chrome-linux', 'chrome');
  const candidates = fs.readdirSync(cacheRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^chromium-\d+$/.test(entry.name))
    .map((entry) => ({
      revision: Number(entry.name.slice('chromium-'.length)),
      executable: path.join(cacheRoot, entry.name, executableSuffix),
    }))
    .filter((candidate) => fs.existsSync(candidate.executable))
    .sort((a, b) => b.revision - a.revision);

  if (!candidates.length) {
    throw new Error('Playwright Chromium is not installed. Run `npx playwright install chromium` explicitly.');
  }
  return candidates[0].executable;
}

export async function launchIsolatedRecorder(profileDir) {
  if (!isOwnedRecorderProfile(profileDir)) throw new Error('Recorder profile is not an owned temporary profile.');
  const context = await chromium.launchPersistentContext(profileDir, {
    channel: 'chromium',
    executablePath: resolvePlaywrightChromium(),
    headless: true,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
    ],
  });
  let [worker] = context.serviceWorkers();
  if (!worker) worker = await context.waitForEvent('serviceworker');
  return { context, worker, extensionId: new URL(worker.url()).host };
}
