import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const layout = await readFile(new URL('../app/layout.tsx', import.meta.url), 'utf8');
const globals = await readFile(new URL('../app/globals.css', import.meta.url), 'utf8');

assert.match(layout, /className="parro-skip-link" href="#parro-main-content"/);
assert.match(layout, />\s*본문으로 바로가기\s*</);
assert.match(layout, /id="parro-main-content"[^>]*tabIndex=\{-1\}/);
assert.match(globals, /\.parro-skip-link:focus-visible\s*\{[^}]*transform:\s*translateY\(0\)/s);
assert.match(globals, /:where\(a\[href\], button, input, textarea, select,/);
assert.match(globals, /\):focus-visible\s*\{\s*outline: 3px solid var\(--mm-accent\)/s);
assert.match(globals, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
assert.doesNotMatch(layout, /MIMIC/);

console.log('Accessibility foundation contract: 8 checks passed.');
