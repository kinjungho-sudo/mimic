import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { chromium } from 'playwright';
import { resolvePlaywrightChromium } from './recorder-profile-harness.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const helperSource = await readFile(path.join(root, 'lib', 'desktop-download-once.js'), 'utf8');
let downloadRequests = 0;
let browser = null;
let server = null;
let checks = 0;

function check(assertion) {
  assertion();
  checks += 1;
}

async function closeServer() {
  if (!server) return;
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}

try {
  server = http.createServer((request, response) => {
    if (request.url === '/desktop-download-once.js') {
      response.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8', 'cache-control': 'no-store' });
      response.end(helperSource);
      return;
    }
    if (request.url === '/ParroDesktopSetup.exe') {
      downloadRequests += 1;
      response.writeHead(200, {
        'content-type': 'application/vnd.microsoft.portable-executable',
        'content-disposition': 'attachment; filename="ParroDesktopSetup.exe"',
        'cache-control': 'no-store',
      });
      response.end(Buffer.from('Parro desktop fixture'));
      return;
    }
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
    response.end(`<!doctype html>
      <html lang="ko">
        <body>
          <button id="download" type="button">Windows용 다운로드</button>
          <output id="state">ready</output>
          <script type="module">
            import { startDesktopDownloadOnce } from '/desktop-download-once.js';
            const button = document.querySelector('#download');
            const state = document.querySelector('#state');
            button.addEventListener('click', () => {
              startDesktopDownloadOnce(button, {
                href: '/ParroDesktopSetup.exe',
                filename: 'ParroDesktopSetup.exe',
                lockMs: 1000,
                onLockChange: locked => { state.textContent = locked ? 'locked' : 'ready'; },
              });
            });
            button.addEventListener('dblclick', event => event.preventDefault());
          </script>
        </body>
      </html>`);
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  assert.ok(address && typeof address === 'object');

  browser = await chromium.launch({ headless: true, executablePath: resolvePlaywrightChromium() });
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${address.port}/`, { waitUntil: 'domcontentloaded' });

  const downloadPromise = page.waitForEvent('download');
  await page.locator('#download').dblclick();
  const download = await downloadPromise;
  check(() => assert.equal(download.suggestedFilename(), 'ParroDesktopSetup.exe'));
  await page.waitForTimeout(200);
  check(() => assert.equal(downloadRequests, 1));
  const stateText = await page.locator('#state').textContent();
  const buttonDisabled = await page.locator('#download').isDisabled();
  check(() => assert.equal(stateText, 'locked'));
  check(() => assert.equal(buttonDisabled, true));
  await download.cancel();

  console.log(JSON.stringify({ ok: true, checks, browser: 'playwright-chromium', requests: downloadRequests }));
} finally {
  if (browser) await browser.close();
  await closeServer();
}
