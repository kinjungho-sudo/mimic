import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(here, '..');
const repoRoot = path.resolve(appRoot, '..');
const read = relativePath => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

const followStage = read('mimic_app/components/viewer/FollowStage.tsx');
const translations = read('mimic_app/lib/i18n/ui-translations.ts');
const guideEngine = read('mimic_recorder/guide-engine.js');

assert.match(followStage, /function ExpandableGuideText/);
assert.match(followStage, /WebkitLineClamp: 3/);
assert.match(followStage, /data-guide-copy-expanded=\{expanded \? 'true' : 'false'\}/);
assert.match(followStage, /aria-expanded=\{expanded\}/);
assert.match(followStage, /expanded \? '접기' : '… 더보기'/);
assert.match(followStage, /event\.stopPropagation\(\)/);
assert.match(translations, /'… 더보기': '… Show more'/);
assert.match(guideEngine, /data-act="toggle-guide-copy"/);
assert.match(guideEngine, /copy\.style\.webkitLineClamp = nextExpanded \? 'unset' : '3'/);
assert.match(guideEngine, /i18n\('showLess', '접기'\)/);

console.log(JSON.stringify({ ok: true, checks: 10, scope: 'learning-and-live-guide-expandable-copy' }));
