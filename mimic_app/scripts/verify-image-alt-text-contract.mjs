import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { plainImageAlt, resolveImageAlt } from '../lib/image-alt.ts';

const root = resolve(import.meta.dirname, '..');
const read = path => readFileSync(resolve(root, path), 'utf8');

assert.equal(plainImageAlt('<strong>저장</strong>&nbsp;버튼'), '저장 버튼');
assert.equal(plainImageAlt('값 &#99999999;'), '값 &#99999999;');
assert.equal(resolveImageAlt(' 결제 정보 입력 화면 ', '무시', '무시'), '결제 정보 입력 화면');
assert.equal(resolveImageAlt('', '이메일 입력', '<p>가입할 이메일을 입력합니다.</p>'), '이메일 입력. 가입할 이메일을 입력합니다.');
assert.equal(resolveImageAlt(null, '', ''), '단계 화면');
assert.equal(resolveImageAlt('x'.repeat(520), '', '').length, 500);

const migration = read('supabase/migrations/044_add_image_alt_text.sql');
assert.match(migration, /ADD COLUMN IF NOT EXISTS image_alt_text text/);

const editor = read('components/editor/ManualEditor.tsx');
assert.match(editor, /data-testid="step-image-alt-editor"/);
assert.match(editor, /maxLength=\{500\}/);
assert.match(editor, /onBlur=\{event => onSave\(\{ imageAltText: event\.target\.value\.trim\(\) \|\| null \}\)\}/);

const stepRoute = read('app/api/steps/[id]/route.ts');
assert.match(stepRoute, /image_alt_text: z\.string\(\)\.max\(500\)\.nullable\(\)\.optional\(\)/);

assert.match(read('app/api/play/[token]/route.ts'), /image_alt_text:/);
assert.match(read('app/api/guide/[token]/route.ts'), /image_alt_text/);
assert.match(read('app/api/p/[token]/route.ts'), /image_alt_text/);

for (const path of [
  'app/play/[token]/page.tsx',
  'app/embed/[token]/page.tsx',
  'components/guidebook/schema.tsx',
  'components/viewer/FollowStage.tsx',
]) {
  assert.match(read(path), /resolveImageAlt\(/, `${path} must render the resolved image description`);
}

console.log(JSON.stringify({ ok: true, checks: 18, scope: 'image-alt-text' }));
