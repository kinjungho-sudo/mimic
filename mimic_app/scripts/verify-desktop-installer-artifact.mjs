import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const appRoot = path.resolve(import.meta.dirname, '..');
const installerPath = path.join(appRoot, 'public', 'downloads', 'ParroDesktopSetup.exe');
const releasePath = path.join(appRoot, 'public', 'downloads', 'desktop-release.json');
const clientPath = path.join(appRoot, 'lib', 'desktop-companion-client.ts');

assert.ok(fs.existsSync(installerPath), 'Parro Desktop installer is missing');
assert.ok(fs.existsSync(releasePath), 'Parro Desktop release manifest is missing');

const release = JSON.parse(fs.readFileSync(releasePath, 'utf8'));
const clientSource = fs.readFileSync(clientPath, 'utf8');
const expectedVersion = clientSource.match(/NEXT_PUBLIC_DESKTOP_LATEST_VERSION[\s\S]*?\|\|\s*'([^']+)'/)?.[1];
assert.ok(expectedVersion, 'Unable to read the expected desktop version');

const installer = fs.readFileSync(installerPath);
const sha256 = crypto.createHash('sha256').update(installer).digest('hex').toUpperCase();

assert.equal(release.version, expectedVersion, 'Desktop installer release version is stale');
assert.equal(release.size, installer.byteLength, 'Desktop installer size does not match its release manifest');
assert.equal(release.sha256, sha256, 'Desktop installer hash does not match its release manifest');

console.log(JSON.stringify({ ok: true, version: release.version, size: release.size, sha256 }));
