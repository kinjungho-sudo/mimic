// Every component keeps its own copy of these identifiers (no shared build step across
// JS, C#, and PowerShell). This check fails as soon as one copy drifts from
// packages/parro-config/parro.json.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repo = path.resolve(import.meta.dirname, '../..');
const read = (file) => fs.readFileSync(path.join(repo, file), 'utf8');
const config = JSON.parse(read('packages/parro-config/parro.json'));
let checks = 0;
const check = (fn) => { fn(); checks += 1; };

const { production, development, local } = config.webappOrigins;
const prodIds = config.recorder.productionExtensionIds;
const allIds = [...prodIds, ...config.recorder.developmentExtensionIds];
const trustedOrigins = [production, development, ...local];
const { version, nativeHostName } = config.desktop;

const sorted = (values) => [...new Set(values)].sort();
// Quoted 32-char extension IDs inside the first block that follows `marker`.
function idsAfter(source, marker, file) {
  const start = source.indexOf(marker);
  assert.ok(start >= 0, `${file}: ${marker} not found`);
  const block = source.slice(start, source.indexOf(/\]|\)|\}/.exec(source.slice(start + marker.length))[0], start + marker.length) + 1);
  return sorted(block.match(/[a-p]{32}/g) ?? []);
}
function originsAfter(source, marker, file) {
  const start = source.indexOf(marker);
  assert.ok(start >= 0, `${file}: ${marker} not found`);
  const end = source.indexOf(/\]|\)|\}/.exec(source.slice(start + marker.length))[0], start + marker.length);
  return sorted(source.slice(start, end).match(/https?:\/\/[a-z0-9.:-]+/g) ?? []);
}

// Recorder
const background = read('mimic_recorder/background.js');
check(() => assert.deepEqual(idsAfter(background, 'const PROD_EXTENSION_IDS', 'background.js'), sorted(prodIds)));
check(() => assert.ok(background.includes(`const PROD_WEBAPP_ORIGIN = '${production}';`)));
check(() => assert.ok(background.includes(`const DEV_WEBAPP_ORIGIN = '${development}';`)));
const content = read('mimic_recorder/content.js');
check(() => assert.deepEqual(idsAfter(content, 'const PROD_EXTENSION_IDS', 'content.js'), sorted(prodIds)));
const manifest = JSON.parse(read('mimic_recorder/manifest.json'));
for (const origin of [production, development, ...local]) {
  check(() => assert.ok(manifest.externally_connectable.matches.includes(`${origin}/*`), `manifest must connect ${origin}`));
}
check(() => assert.ok(read('mimic_recorder/desktop-bridge.js').includes(`'${nativeHostName}'`)));

// Desktop
const host = read('mimic_desktop/native-host/src/host.js');
check(() => assert.ok(host.includes(`const DESKTOP_COMPANION_VERSION = "${version}";`)));
check(() => assert.deepEqual(originsAfter(host, 'const TRUSTED_WEBAPP_ORIGINS', 'host.js'), sorted(trustedOrigins)));
const launcher = read('mimic_desktop/native-host/installer/launcher/ParroDesktop.cs');
check(() => assert.deepEqual(
  sorted([...originsAfter(launcher, 'TrustedWebappOrigins = new[]', 'ParroDesktop.cs'), production]),
  sorted(trustedOrigins),
));
check(() => assert.ok(launcher.includes(`ProductionWebappOrigin = "${production}"`)));
check(() => assert.ok(launcher.includes(`AssemblyFileVersion("${version}.0")`) && launcher.includes(`PREVIEW ${version}`)));
const wizard = read('mimic_desktop/native-host/installer/wizard/ParroDesktopSetup.cs');
check(() => assert.deepEqual(idsAfter(wizard, 'DefaultExtensionIds = {', 'ParroDesktopSetup.cs'), sorted(allIds)));
check(() => assert.ok(wizard.includes(`HostName = "${nativeHostName}"`) && wizard.includes(`ProductVersion = "${version}"`)));
check(() => assert.ok(wizard.includes(`AssemblyFileVersion("${version}.0")`) && wizard.includes(`DESKTOP  ${version}`)));
const installScript = read('mimic_desktop/native-host/installer/install.ps1');
check(() => assert.deepEqual(idsAfter(installScript, '$defaultExtensionIds = @(', 'install.ps1'), sorted(allIds)));
const buildScript = read('mimic_desktop/native-host/scripts/build-dev-installer.ps1');
check(() => assert.ok(buildScript.includes(`-ne "${version}.0"`) && buildScript.includes(`version = "${version}"`)));

// Web app
check(() => assert.equal(JSON.parse(read('mimic_app/public/downloads/desktop-release.json').replace(/^﻿/, '')).version, version));
check(() => assert.ok(read('mimic_app/lib/desktop-companion-client.ts').includes(`|| '${version}'`)));
check(() => assert.ok(read('mimic_app/app/download/desktop/page.tsx').includes(`Preview ${version}`)));

console.log(JSON.stringify({ ok: true, checks, scope: 'shared-config-drift' }));
