const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const launcherPath = path.join(__dirname, '..', 'installer', 'launcher', 'ParroDesktop.cs');
const source = fs.readFileSync(launcherPath, 'utf8');

const actionableButtons = [
  'manual',
  'blur',
  'undo',
  'pause',
  'preview',
  'complete',
  'stop',
];

assert.match(
  source,
  /private static Button MakeToolbarButton[\s\S]*?button\.TabStop = true;[\s\S]*?return button;/,
  'Toolbar action buttons must participate in keyboard Tab navigation.',
);

for (const button of actionableButtons) {
  assert.match(
    source,
    new RegExp(`Button ${button} = MakeToolbarButton\\(`),
    `${button} must use the keyboard-accessible toolbar button factory.`,
  );
  assert.doesNotMatch(
    source,
    new RegExp(`${button}\\.TabStop = false;`),
    `${button} must not be removed from keyboard Tab navigation.`,
  );
}

assert.match(
  source,
  /record\.TabStop = false;/,
  'The non-interactive recording indicator must stay out of Tab navigation.',
);
assert.match(
  source,
  /toolbarPanel\.Visible = true;[\s\S]*?manualButton\.Focus\(\);/,
  'Toolbar mode must place focus on its first actionable control.',
);

console.log(`Desktop toolbar accessibility contract: ${actionableButtons.length + 3} checks passed.`);
