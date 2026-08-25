import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  hasPersistedManualAnnotationState,
  markAnnotationsAsManuallyEdited,
} from '../lib/auto-annotations.ts';
import { buildClickHighlight } from '../lib/annotations.ts';

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
assert.equal(hasPersistedManualAnnotationState([], null), false);
assert.equal(hasPersistedManualAnnotationState(autoAnnotations, null), false);
assert.equal(hasPersistedManualAnnotationState(manualAnnotations, null), true);
assert.equal(hasPersistedManualAnnotationState([], { annotationsManuallyEdited: true }), true);

const subjectRect = { x: 0.506914, y: 0.39091, width: 0.427719, height: 0.024361 };
const subjectBorder = buildClickHighlight({
  elementRect: subjectRect,
  stepNumber: 4,
  clickX: 0.7208,
  clickY: 0.4031,
  actionType: 'type',
  label: '이메일 제목 입력',
}).find(annotation => annotation.id === 'guidde-4-border');
assert.equal(subjectBorder?.x1, subjectRect.x * 100);
assert.equal(subjectBorder?.y1, subjectRect.y * 100);
assert.equal(subjectBorder?.x2, (subjectRect.x + subjectRect.width) * 100);
assert.equal(subjectBorder?.y2, (subjectRect.y + subjectRect.height) * 100);

const bodyRect = { x: 0.506914, y: 0.427451, width: 0.427719, height: 0.499391 };
const bodyBorder = buildClickHighlight({
  elementRect: bodyRect,
  stepNumber: 5,
  clickX: 0.7208,
  clickY: 0.6771,
  actionType: 'type',
  label: '메일 본문 입력',
}).find(annotation => annotation.id === 'guidde-5-border');
assert.equal(bodyBorder?.x1, bodyRect.x * 100);
assert.equal(bodyBorder?.y1, bodyRect.y * 100);
assert.equal(bodyBorder?.x2, (bodyRect.x + bodyRect.width) * 100);
assert.equal(bodyBorder?.y2, (bodyRect.y + bodyRect.height) * 100);

const compactClickBorder = buildClickHighlight({
  elementRect: bodyRect,
  stepNumber: 6,
  clickX: 0.7208,
  clickY: 0.6771,
  actionType: 'click',
  label: '대상 클릭',
}).find(annotation => annotation.id === 'guidde-6-border');
assert.ok(compactClickBorder && compactClickBorder.x2 - compactClickBorder.x1 < bodyRect.width * 100);
assert.ok(compactClickBorder && compactClickBorder.y2 - compactClickBorder.y1 < bodyRect.height * 100);

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
  /annotationsPersisted:\s*hasPersistedManualAnnotationState\([\s\S]*annotationsManuallyEdited:\s*patch\.annotationsPersisted[\s\S]*return saveRequest\.catch/,
);
assert.doesNotMatch(editorPage, /annotationsPersisted:\s*s\.user_annotations !== null/);
assert.match(editorPage, /if \(patch\.annotations !== undefined\) throw e/);

console.log(JSON.stringify({
  ok: true,
  checks: 26,
  scope: 'manual-annotation-persistence',
}));
