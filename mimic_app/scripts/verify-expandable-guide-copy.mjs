import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(here, '..');
const repoRoot = path.resolve(appRoot, '..');
const read = relativePath => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

const followStage = read('mimic_app/components/viewer/FollowStage.tsx');
const guideEngine = read('mimic_recorder/guide-engine.js');

assert.match(followStage, /function ExpandableGuideText/);
assert.match(followStage, /data-guide-copy-expanded="true"/);
assert.match(followStage, /overflowWrap: 'anywhere'/);
assert.doesNotMatch(followStage, /WebkitLineClamp|… 더보기/);
assert.match(guideEngine, /data-role="guide-copy" data-expanded="true"/);
assert.match(guideEngine, /white-space:normal;overflow-wrap:anywhere/);
assert.doesNotMatch(guideEngine, /data-act="toggle-guide-copy"|-webkit-line-clamp:3|slice\(0, 60\)/);

console.log(JSON.stringify({ ok: true, checks: 7, scope: 'learning-and-live-guide-full-copy' }));
