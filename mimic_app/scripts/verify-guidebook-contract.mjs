import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8');

const editor = read('components', 'guidebook', 'GuidebookEditor.tsx');
const schema = read('components', 'guidebook', 'schema.tsx');

assert.match(editor, /useState<HTMLElement \| null>\(\(\) => document\.body\)/, 'floating menus must portal to the viewport root on the first render');
assert.match(editor, /createPortal\(/, 'add-block menu must render outside editor clipping containers');
assert.doesNotMatch(editor, /<SideMenuController\s+portalElement=/, 'the transient side control must stay inside the editor hover boundary');
assert.match(editor, /<components\.SideMenu\.Button[\s\S]*onMouseDown=\{event => \{[\s\S]*onOpen\(block,/, 'add-block menu must use the editor side-menu control and open before it unmounts');
assert.match(editor, /window\.innerHeight - addMenu\.anchor\.bottom >= 280/, 'add-block menu must choose an upward placement near the viewport bottom');
assert.match(editor, /role="menu"\s*\n\s*aria-label="블록 삽입"/, 'add-block menu must remain keyboard discoverable');
assert.match(editor, /strategy:\s*'fixed'/, 'floating menus must use viewport-fixed positioning');
assert.match(editor, /max-height:\s*min\(360px,\s*calc\(100dvh - 24px\)\)/, 'suggestion menu must fit within the viewport');
assert.match(editor, /overflow-y:\s*auto/, 'suggestion menu must remain scrollable');

assert.match(editor, /'video\/mp4':\s*'mp4'/, 'MP4 uploads must be accepted');
assert.match(editor, /'video\/webm':\s*'webm'/, 'WebM uploads must be accepted');
assert.match(editor, /video:\s*50 \* 1024 \* 1024/, 'video uploads must have an explicit limit');
assert.match(editor, /\.storage\s*\n\s*\.from\('naviaction'\)\s*\n\s*\.upload\(/, 'uploads must go directly to storage');
assert.doesNotMatch(editor, /fetch\('\/api\/pages\/upload'/, 'video bytes must not pass through the Vercel function body');

assert.match(schema, /fetch\(`\/api\/tutorials\/\$\{tutorialId\}`\)/, 'embedded guides must load an authenticated inline preview');
assert.match(schema, /aria-expanded=\{previewOpen\}/, 'inline preview control must expose its expanded state');
assert.match(schema, /\{previewOpen \? '접기' : '펼치기'\}/, 'embedded guides must expand in the editor');
assert.match(schema, /<GuideSteps guide=\{guide\} \/>/, 'editor preview must render the selected guide steps');

console.log(JSON.stringify({ ok: true, checks: 18, scope: 'parro-guidebook-contract' }));
