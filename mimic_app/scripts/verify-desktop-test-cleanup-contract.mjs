import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const source = await readFile(path.join(root, 'scripts', 'verify-desktop-download-once.mjs'), 'utf8');
let checks = 0;
function check(assertion) { assertion(); checks += 1; }

check(() => assert.match(source, /async function closeServer\(\) \{\s*if \(!server\?\.listening\) return;/,
  'desktop download cleanup must skip a server that never started listening'));
check(() => assert.match(source, /server\.close\(\(error\) => error \? reject\(error\) : resolve\(\)\)/,
  'desktop download cleanup must still report close errors for a listening server'));
check(() => assert.match(source, /finally \{[\s\S]*await closeServer\(\);\s*\}/,
  'desktop download verification must always attempt safe cleanup'));

console.log(JSON.stringify({ ok: true, checks }));
