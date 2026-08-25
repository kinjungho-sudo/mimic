const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const content = fs.readFileSync(path.join(__dirname, '..', 'content.js'), 'utf8');
const source = content.match(/function typingControlRect\(el\) \{[\s\S]*?\n  \}/)?.[0];
assert.ok(source, 'typingControlRect must remain testable');

function load(hostname) {
  return new Function('location', 'window', `return (${source});`)(
    { hostname },
    { innerHeight: 900 },
  );
}

const ownRect = { x: 100, y: 200, width: 565, height: 69 };
const composeRect = { x: 100, y: 180, width: 565, height: 359 };
const composeParent = {
  getBoundingClientRect: () => composeRect,
  parentElement: null,
};
const gmailBody = {
  isContentEditable: true,
  getAttribute: name => (name === 'role' ? 'textbox' : null),
  getBoundingClientRect: () => ownRect,
  parentElement: composeParent,
};

assert.equal(load('mail.google.com')(gmailBody), composeRect);
assert.equal(load('example.com')(gmailBody), ownRect);
assert.equal(load('mail.google.com')({ ...gmailBody, isContentEditable: false }), ownRect);

console.log(JSON.stringify({ ok: true, checks: 4, scope: 'gmail-typing-geometry' }));
