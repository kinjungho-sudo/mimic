import assert from 'node:assert/strict';
import { buildStepShareUrl, resolveSharedStepIndex } from '../lib/share-links.ts';
import {
  buildEmbedMetadata,
  buildManualShareMetadata,
  buildMissingShareMetadata,
  buildPlaybookShareMetadata,
} from '../lib/share-metadata.ts';

const stableStepId = 'step-2-id';
const steps = [{ id: 'step-1-id' }, { id: stableStepId }, { id: 'step-3-id' }];

assert.equal(
  buildStepShareUrl('https://parro.example/play/token?mode=follow', stableStepId),
  `https://parro.example/play/token?mode=follow&step=${stableStepId}`,
  'step links must preserve the selected viewer mode',
);
assert.equal(
  buildStepShareUrl('https://parro.example/play/token?step=old', stableStepId),
  `https://parro.example/play/token?step=${stableStepId}`,
  'copying another step must replace the prior target',
);
assert.equal(resolveSharedStepIndex(stableStepId, steps), 1, 'stable step ids must resolve to their current order');
assert.equal(resolveSharedStepIndex('2', steps), 1, 'legacy 1-based step links must remain compatible');
assert.equal(resolveSharedStepIndex('99', steps), null, 'out-of-range numeric links must fail closed');
assert.equal(resolveSharedStepIndex('missing', steps), null, 'unknown step ids must fail closed');

const privateManual = buildManualShareMetadata({
  token: 'private-token',
  title: 'Foal AI 검증 흐름',
  visibility: 'private',
});
assert.equal(privateManual.robots?.index, false, 'link-only manuals must not be indexed');
assert.equal(privateManual.robots?.follow, false, 'link-only manuals must not leak crawl paths');
assert.match(String(privateManual.alternates?.canonical), /\/play\/private-token$/, 'manual metadata must canonicalize viewer modes and step links');

const publicManual = buildManualShareMetadata({
  token: 'public-token',
  title: 'Foal AI 검증 흐름',
  visibility: 'public',
  thumbnailUrl: 'https://cdn.example/foal.png',
});
assert.equal(publicManual.robots?.index, true, 'explicitly public manuals must remain searchable');
assert.deepEqual(publicManual.openGraph?.images, [{ url: 'https://cdn.example/foal.png', width: 1200, height: 630, alt: 'Foal AI 검증 흐름 — Parro 매뉴얼' }], 'public manual previews must use the captured thumbnail');

const protectedManual = buildManualShareMetadata({
  token: 'protected-token',
  title: '고객사 비밀 절차',
  visibility: 'public',
  thumbnailUrl: 'https://cdn.example/private.png',
  passwordProtected: true,
});
assert.equal(protectedManual.robots?.index, false, 'password-protected manuals must never be indexed');
assert.doesNotMatch(String(protectedManual.title?.absolute), /고객사 비밀 절차/, 'protected metadata must not expose the document title');
assert.doesNotMatch(JSON.stringify(protectedManual.openGraph), /private\.png|고객사 비밀 절차/, 'protected social previews must not expose private content');

const playbook = buildPlaybookShareMetadata({
  token: 'playbook-token',
  title: 'Foal AI 운영 플레이북',
  description: `  반복되는   공백을 ${'설명 '.repeat(50)}정리합니다.  `,
});
assert.equal(playbook.robots?.index, true, 'published playbooks must stay searchable');
assert.ok((playbook.description?.length ?? 0) <= 160, 'playbook preview descriptions must fit social metadata limits');
assert.match(String(playbook.openGraph?.title), /Foal AI 운영 플레이북/, 'playbook previews must identify the shared document');

const embed = buildEmbedMetadata('embed-token');
assert.equal(embed.robots?.index, false, 'embed duplicates must not be indexed');
assert.match(String(embed.alternates?.canonical), /\/play\/embed-token$/, 'embed metadata must point to the canonical viewer');
assert.equal(buildMissingShareMetadata('매뉴얼').robots?.index, false, 'missing share tokens must fail closed');

console.log(JSON.stringify({ ok: true, checks: 19, scope: 'share-links-and-metadata' }));
