const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const koreanPattern = /[가-힣]/;

const en = JSON.parse(read('_locales/en/messages.json'));
const ko = JSON.parse(read('_locales/ko/messages.json'));
const enKeys = Object.keys(en).sort();
const koKeys = Object.keys(ko).sort();

assert.deepEqual(enKeys, koKeys, 'English and Korean locale catalogs must have identical keys');
for (const key of enKeys) {
  assert.equal(typeof en[key]?.message, 'string', `English message is missing: ${key}`);
  assert.equal(typeof ko[key]?.message, 'string', `Korean message is missing: ${key}`);
  assert.ok(en[key].message.trim(), `English message is empty: ${key}`);
  assert.doesNotMatch(en[key].message, koreanPattern, `English message contains Korean: ${key}`);
  assert.deepEqual(
    Object.keys(en[key].placeholders || {}).sort(),
    Object.keys(ko[key].placeholders || {}).sort(),
    `Placeholder definitions differ: ${key}`,
  );
}

const manifest = JSON.parse(read('manifest.json'));
assert.equal(manifest.default_locale, 'ko', 'Recorder default locale must remain Korean');
assert.equal(manifest.name, '__MSG_extensionName__');
assert.equal(manifest.description, '__MSG_extensionDescription__');

const sourceFiles = [
  'popup.html',
  'popup.js',
  'request-mic.html',
  'request-mic.js',
  'privacy_policy.html',
  'guide-engine.js',
  'content.js',
  'background.js',
  'desktop-import.js',
];

const referencedKeys = new Set();
for (const relativePath of sourceFiles) {
  const source = read(relativePath);
  for (const match of source.matchAll(/data-i18n(?:-html|-title|-alt)?="([^"]+)"/g)) {
    referencedKeys.add(match[1]);
  }
  for (const match of source.matchAll(/\b(?:t|i18n)\(\s*['"]([A-Za-z0-9_]+)['"]/g)) {
    referencedKeys.add(match[1]);
  }
}

for (const key of referencedKeys) {
  assert.ok(en[key], `Referenced i18n key is missing from English catalog: ${key}`);
  assert.ok(ko[key], `Referenced i18n key is missing from Korean catalog: ${key}`);
}

for (const relativePath of ['popup.html', 'request-mic.html']) {
  const visibleMarkup = read(relativePath)
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '');
  const stack = [];
  const uncovered = [];
  const voidTags = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);
  for (const token of visibleMarkup.match(/<[^>]+>|[^<]+/g) || []) {
    if (token.startsWith('</')) {
      stack.pop();
      continue;
    }
    if (token.startsWith('<')) {
      if (/^<!|^<\?/.test(token) || /\/>$/.test(token)) continue;
      const localized = /data-i18n(?:-html|-title|-alt)?=/.test(token);
      const tagName = token.match(/^<\s*([a-z0-9-]+)/i)?.[1]?.toLowerCase();
      if (tagName && voidTags.has(tagName)) continue;
      stack.push(localized || stack.some(Boolean));
      continue;
    }
    if (koreanPattern.test(token) && !stack.some(Boolean)) uncovered.push(token.trim());
  }
  assert.deepEqual(uncovered, [], `${relativePath} contains visible Korean without an i18n marker`);
}

const sinkPatterns = [
  /\.textContent\s*=/,
  /\.innerHTML\s*=/,
  /\bshowToast\(/,
  /\balert\(/,
  /\berror\s*:/,
  /\bmessage\s*:/,
];
for (const relativePath of sourceFiles.filter((file) => file.endsWith('.js'))) {
  const lines = read(relativePath).split(/\r?\n/);
  lines.forEach((line, index) => {
    if (!koreanPattern.test(line) || !sinkPatterns.some((pattern) => pattern.test(line))) return;
    if (/\b(?:t|i18n)\(/.test(line)) return;
    if (/\b(?:console\.|log\()/.test(line)) return;
    assert.fail(`${relativePath}:${index + 1} has an unlocalized Korean UI sink`);
  });
}

console.log(
  `Recorder i18n verified: ${enKeys.length} locale messages, ${referencedKeys.size} referenced keys`,
);
