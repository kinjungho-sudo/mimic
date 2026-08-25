import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { markAnnotationsAsManuallyEdited } from '../lib/auto-annotations.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(here, '..');

const autoAnnotations = [
  { id: 'guidde-3-highlight', type: 'rect', x1: 10, y1: 10, x2: 20, y2: 20, color: '#f00', strokeWidth: 2 },
  { id: 'guidde-3-label', type: 'text', x1: 10, y1: 5, x2: 20, y2: 10, color: '#f00', strokeWidth: 2, text: '버튼' },
];
const manualAnnotations = markAnnotationsAsManuallyEdited(autoAnnotations);

assert.equal(manualAnnotations.length, 2);
assert.ok(manualAnnotations.every(annotation => annotation.id.startsWith('manual-')));
assert.equal(manualAnnotations[0].x1, 10);
assert.equal(manualAnnotations[1].text, '버튼');
assert.deepEqual(autoAnnotations.map(annotation => annotation.id), [
  'guidde-3-highlight',
  'guidde-3-label',
]);

const alreadyManual = [{ ...autoAnnotations[0], id: 'ann-existing-manual' }];
assert.equal(markAnnotationsAsManuallyEdited(alreadyManual)[0].id, 'ann-existing-manual');

const manualEditor = fs.readFileSync(
  path.join(appRoot, 'components', 'editor', 'ManualEditor.tsx'),
  'utf8',
);
const annotationEditor = fs.readFileSync(
  path.join(appRoot, 'components', 'editor', 'ImageAnnotationEditor.tsx'),
  'utf8',
);
const editorPage = fs.readFileSync(
  path.join(appRoot, 'app', 'manual', '[id]', 'editor', 'page.tsx'),
  'utf8',
);

assert.match(
  manualEditor,
  /markAnnotationsAsManuallyEdited\(annotations\)[\s\S]*annotationsPersisted:\s*true[\s\S]*await onSave\?\./,
);
assert.match(manualEditor, /step\.annotationsPersisted && existingAnnotations\.length === 0/);
assert.match(
  manualEditor,
  /step\.annotationsPersisted \|\| displayAnnotations\.length > 0[\s\S]*\? displayAnnotations[\s\S]*: buildAutoAnnotation\(step\)/,
);
assert.match(annotationEditor, /await onChange\(latestItems\);[\s\S]*onClose\(\);[\s\S]*catch/);
assert.match(
  editorPage,
  /annotationsPersisted:\s*s\.user_annotations !== null[\s\S]*return saveRequest\.catch/,
);
assert.match(editorPage, /if \(patch\.annotations !== undefined\) throw e/);

console.log(JSON.stringify({
  ok: true,
  checks: 11,
  scope: 'manual-annotation-persistence',
}));
