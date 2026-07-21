import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const component = await readFile(new URL('../components/landing/ProductDemo.tsx', import.meta.url), 'utf8');
const css = await readFile(new URL('../components/landing/ProductDemo.module.css', import.meta.url), 'utf8');

assert.match(component, /className=\{styles\.slideImageFrame\}[\s\S]*?<img[\s\S]*?className=\{styles\.slideAnnotation\}/);
assert.match(css, /\.slideImageFrame\s*\{[^}]*position:\s*relative[^}]*max-width:\s*100%/s);
assert.match(css, /\.slideImageFrame\s*>\s*img\s*\{[^}]*max-width:\s*100%[^}]*max-height:\s*300px/s);
assert.doesNotMatch(css, /\.slideCanvas\s*>\s*img/);
assert.match(css, /\.viewerToggle span,[^\n]*font-size:\s*10px/);
assert.match(css, /\.previewLabel strong,[^\n]*\.previewLabel small[^\n]*font-size:\s*10px/);
assert.match(css, /\.slideChapter strong\s*\{[^}]*font-size:\s*11px/s);
assert.match(css, /\.documentStepCard p\s*\{[^}]*font-size:\s*10px/s);
assert.match(css, /\.motionNote\s*\{[^}]*font-size:\s*14px/s);

console.log('Landing demo layout contract: 9 checks passed.');
