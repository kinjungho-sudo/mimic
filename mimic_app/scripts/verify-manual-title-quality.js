import { isLowQualityCaptureTitle } from '../lib/ai/capture-fallback.ts';
import { containsSensitiveText, redactSensitive } from '../lib/redact.ts';

const rawSlackTitles = [
  'Create New App 클릭',
  'Use a manifest file to add your app’s basic info, scopes, settings & features to',
  'Select a team 선택',
  'jungho 클릭',
  'Next 클릭',
  '}, 클릭',
  '] 클릭',
  'Create 클릭',
  'A0BGV8HKK5X 클릭',
  'A0BGV8HKK5X 입력',
  'connections:write 클릭',
  'Generate 클릭',
  'Copy 클릭',
  'Done 클릭',
  'OAuth & Permissions 클릭',
  '허용 클릭',
  'Lina 클릭',
  '채팅 클릭',
  '메일 보내기 클릭',
  'Lina에이전트 클릭',
  '너의 역할은 뭐지? 클릭',
  'D0BGC0AS68P 클릭',
  'api.slack.com 주요 영역 클릭',
];

const purposeTitles = [
  'Slack 앱 생성 시작',
  '매니페스트 방식 선택',
  '설치할 워크스페이스 선택',
  '연결에 필요한 권한 추가',
  '앱 연결 토큰 생성',
  '요청 권한 검토 후 설치 승인',
  '에이전트에 테스트 질문 보내기',
  '에이전트 응답 확인',
  '설치 대상 워크스페이스 확인',
  '테스트할 에이전트 선택',
];

const failures = [];
for (const title of rawSlackTitles) {
  if (!isLowQualityCaptureTitle(title)) failures.push({ title, expected: 'reject raw DOM title' });
}
for (const title of purposeTitles) {
  if (isLowQualityCaptureTitle(title)) failures.push({ title, expected: 'accept purpose title' });
}

const sensitive = 'A0BGV8HKK5X와 D0BGC0AS68P, test@example.com';
const redacted = redactSensitive(sensitive) ?? '';
if (!containsSensitiveText(sensitive) || /A0BGV8HKK5X|D0BGC0AS68P|test@example\.com/.test(redacted)) {
  failures.push({ sensitive, redacted, expected: 'mask identifiers and email' });
}

if (failures.length > 0) {
  console.error(JSON.stringify({ ok: false, failures }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({
  ok: true,
  rejected_raw_titles: rawSlackTitles.length,
  accepted_purpose_titles: purposeTitles.length,
  redaction: redacted,
}));
