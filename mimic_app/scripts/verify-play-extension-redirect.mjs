import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const player = readFileSync(new URL('../app/play/[token]/page.tsx', import.meta.url), 'utf8');
const brand = readFileSync(new URL('../lib/brand.ts', import.meta.url), 'utf8');

let checks = 0;
const check = assertion => {
  assertion();
  checks += 1;
};

check(() => assert.match(player, /BRAND_EXTENSION_STORE_URL/));
check(() => assert.match(player, /result\.reason === 'not_installed'/));
check(() => assert.match(player, /window\.location\.assign\(BRAND_EXTENSION_STORE_URL\)/));
check(() => assert.match(brand, /BRAND_NEXT_EXTENSION_ID = 'lefkpmfgdbhckcemfghpegleknaepekm'/));
check(() => assert.match(
  brand,
  /chromewebstore\.google\.com\/detail\/parro-recorder\/\$\{BRAND_NEXT_EXTENSION_ID\}/,
));

console.log(JSON.stringify({
  ok: true,
  checks,
  scope: 'play-extension-install-redirect',
}));
