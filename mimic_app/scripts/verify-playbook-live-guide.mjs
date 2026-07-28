import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  extractPlaybookGuideSequence,
  flattenPlaybookLiveGuideSteps,
} from '../lib/live-guide/playbook.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(here, '..');
const repoRoot = path.resolve(appRoot, '..');
const read = relativePath => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

let checks = 0;
const check = assertion => {
  assertion();
  checks += 1;
};

const sequence = extractPlaybookGuideSequence([
  { type: 'paragraph', content: [] },
  { type: 'guide', props: { tutorialId: 'manual-a' } },
  {
    type: 'bulletListItem',
    children: [
      { type: 'guide', props: { tutorialId: 'manual-b' } },
    ],
  },
  { type: 'guide', props: { tutorialId: 'manual-a' } },
]);
check(() => assert.deepEqual(sequence, ['manual-a', 'manual-b', 'manual-a']));

const guides = new Map([
  ['manual-a', {
    tutorial_id: 'manual-a',
    title: '첫 번째 매뉴얼',
    steps: [
      { id: 'a-1', title: 'A1', instruction: '', page_url: 'https://example.com/a', hidden: false },
      { id: 'a-2', title: 'A2', instruction: '', page_url: 'https://example.com/a2', hidden: false },
    ],
  }],
  ['manual-b', {
    tutorial_id: 'manual-b',
    title: '두 번째 매뉴얼',
    steps: [
      { id: 'b-1', title: 'B1', instruction: '', page_url: 'https://example.com/b', hidden: false },
    ],
  }],
]);
const flattened = flattenPlaybookLiveGuideSteps(sequence, guides);
check(() => assert.deepEqual(flattened.map(step => step.title), ['A1', 'A2', 'B1', 'A1', 'A2']));
check(() => assert.deepEqual(flattened.map(step => step.manual_title), [
  '첫 번째 매뉴얼',
  '첫 번째 매뉴얼',
  '두 번째 매뉴얼',
  '첫 번째 매뉴얼',
  '첫 번째 매뉴얼',
]));
check(() => assert.equal(new Set(flattened.map(step => step.id)).size, flattened.length));

const endpoint = read('mimic_app/app/api/guide/playbook/[token]/route.ts');
const legacyEndpoint = read('mimic_app/app/api/guide/[token]/route.ts');
const playbookServer = read('mimic_app/lib/live-guide/playbook-server.ts');
const publicPage = read('mimic_app/app/p/[token]/page.tsx');
const liveGuideClient = read('mimic_app/lib/api/liveGuide.ts');
const background = read('mimic_recorder/background.js');

check(() => assert.match(endpoint, /resolvePublishedPlaybookLiveGuide\(token\)/));
check(() => assert.match(playbookServer, /extractPlaybookGuideSequence\(page\.content\)/));
check(() => assert.match(playbookServer, /flattenPlaybookLiveGuideSteps\(sequence, guides\)/));
check(() => assert.match(playbookServer, /tutorial\.user_id === page\.user_id/));
check(() => assert.match(legacyEndpoint, /resolvePublishedPlaybookLiveGuide\(token, supabase\)/));
check(() => assert.match(publicPage, /startPlaybookLiveGuide\(token\)/));
check(() => assert.match(publicPage, /합쳐진 매뉴얼을 Live Guide로 실행/));
check(() => assert.match(liveGuideClient, /guide_source: source/));
check(() => assert.match(background, /guideSource === 'playbook'/));

console.log(JSON.stringify({ ok: true, checks, scope: 'playbook-live-guide-flattening-and-legacy-recorder-compatibility' }));
