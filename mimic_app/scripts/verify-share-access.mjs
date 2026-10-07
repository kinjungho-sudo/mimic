// Run with: node --conditions=react-server --loader ./scripts/ts-path-loader.mjs scripts/verify-share-access.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

process.env.SHARE_ACCESS_SECRET = 'verify-share-access-secret';
const { createShareAccessProof, verifyShareAccessProof, SHARE_ACCESS_TTL_MS } = await import('../lib/auth/share-access.ts');

const root = path.resolve(import.meta.dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
let checks = 0;
const check = (fn) => { fn(); checks += 1; };

const now = Date.UTC(2026, 9, 8);
const proof = createShareAccessProof('tutorial-1', 'salt:hash', now);
check(() => assert.ok(verifyShareAccessProof(proof, 'tutorial-1', 'salt:hash', now)));
check(() => assert.ok(!verifyShareAccessProof(proof, 'tutorial-2', 'salt:hash', now), 'proof is bound to one manual'));
check(() => assert.ok(!verifyShareAccessProof(proof, 'tutorial-1', 'salt:changed', now), 'password change revokes proof'));
check(() => assert.ok(!verifyShareAccessProof(proof, 'tutorial-1', 'salt:hash', now + SHARE_ACCESS_TTL_MS + 1), 'proof expires'));
check(() => assert.ok(!verifyShareAccessProof(`${now + SHARE_ACCESS_TTL_MS * 100}.${proof.split('.')[1]}`, 'tutorial-1', 'salt:hash', now), 'expiry is signed'));
check(() => assert.ok(!verifyShareAccessProof('', 'tutorial-1', 'salt:hash', now)));
check(() => assert.ok(!verifyShareAccessProof('garbage', 'tutorial-1', 'salt:hash', now)));
check(() => assert.match(proof, /^\d{10,16}\.[A-Za-z0-9_-]{20,128}$/, 'proof must match the Recorder whitelist'));

// Every route that serves a password-protected manual by share token must check access.
for (const route of ['app/api/guide/[token]/route.ts', 'app/api/export/pdf/token/[token]/route.ts']) {
  const source = read(route);
  check(() => assert.match(source, /share_password/, `${route} must load share_password`));
  check(() => assert.match(source, /hasShareAccess\(/, `${route} must require share access`));
}
check(() => assert.match(read('app/api/play/[token]/route.ts'), /createShareAccessProof\(/));
check(() => assert.doesNotMatch(read('app/api/guide/[token]/route.ts'), /getSession\(/, 'guide route must verify JWT claims'));

// Public playbooks must not embed protected manuals.
for (const file of ['app/api/p/[token]/route.ts', 'lib/live-guide/playbook-server.ts']) {
  check(() => assert.match(read(file), /!\w+\.share_password/, `${file} must exclude password-protected manuals`));
}

const recorder = fs.readFileSync(path.join(root, '../mimic_recorder/background.js'), 'utf8');
check(() => assert.match(recorder, /'X-Parro-Share-Access': shareAccess/));

console.log(JSON.stringify({ ok: true, checks, scope: 'share-access-contract' }));
