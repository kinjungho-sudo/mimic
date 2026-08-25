import assert from 'node:assert/strict';

import {
  decryptHelpScreenshot,
  encodeHelpRequestBody,
  encryptHelpScreenshot,
  parseHelpRequestBody,
} from '../lib/live-guide/help-request.ts';

const source = Buffer.from('private live guide screenshot');
const encrypted = encryptHelpScreenshot(source);
const metadata = {
  v: 1,
  path: 'live-guide-help/11111111-1111-1111-1111-111111111111/user/request.bin',
  key: encrypted.key,
  iv: encrypted.iv,
  tag: encrypted.tag,
  mime: 'image/png',
  page_url: 'https://example.com/practice',
  step_number: 3,
};
const body = encodeHelpRequestBody('버튼을 찾기 어려워요.', metadata);
const parsed = parseHelpRequestBody(body, '11111111-1111-1111-1111-111111111111');

assert.equal(parsed?.text, '버튼을 찾기 어려워요.');
assert.deepEqual(parsed?.metadata, metadata);
assert.deepEqual(decryptHelpScreenshot(encrypted.encrypted, parsed.metadata), source);
assert.equal(parseHelpRequestBody(body, '22222222-2222-2222-2222-222222222222'), null);
assert.equal(parseHelpRequestBody('일반 댓글'), null);

const tampered = Buffer.from(encrypted.encrypted);
tampered[0] ^= 1;
assert.throws(() => decryptHelpScreenshot(tampered, metadata));

console.log(JSON.stringify({ ok: true, checks: 6, scope: 'encrypted-live-guide-help-request' }));
