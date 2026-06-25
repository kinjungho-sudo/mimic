async function main() {
  const {
    buildCaptureFallbackDraft,
    buildCaptureFallbackTutorialTitle,
    isLowQualityCaptureTitle,
  } = await import('../lib/ai/capture-fallback.ts');

  const cases = [
    {
      name: 'action label click',
      step: { id: '1', step_number: 1, ai_title: null, ai_description: null, page_url: 'https://ksqa.or.kr', domain_name: 'KSQA' },
      context: { actionInfo: { type: 'click', label: '대회소개' } },
      title: '대회소개 클릭',
      script: '대회소개를 클릭합니다.',
    },
    {
      name: 'generic edit label uses google slides context',
      step: { id: '2', step_number: 2, ai_title: null, ai_description: null, page_url: 'https://docs.google.com/presentation/d/abc/edit', domain_name: 'Google Slides' },
      context: { actionInfo: { type: 'click', label: 'edit' } },
      title: '파일명 영역 클릭',
      script: '파일명 영역을 클릭합니다.',
    },
    {
      name: 'generic edit no action uses google slides screen context',
      step: { id: '3', step_number: 3, ai_title: null, ai_description: null, page_url: 'https://docs.google.com/presentation/d/abc/edit', domain_name: 'Google Slides' },
      context: { actionInfo: { type: 'click', label: 'edit' }, noAction: true },
      title: '슬라이드 편집 화면 확인',
      script: '슬라이드 편집 화면을 확인합니다.',
    },
    {
      name: 'element text fallback',
      step: { id: '4', step_number: 4, ai_title: null, ai_description: null, page_url: 'https://example.com', domain_name: null },
      context: { actionInfo: { type: 'click' }, elementText: '자료 다운로드' },
      title: '자료 다운로드 클릭',
      script: '자료 다운로드를 클릭합니다.',
    },
    {
      name: 'weak ai title ignored',
      step: { id: '5', step_number: 5, ai_title: '단계 5 진행', ai_description: '', page_url: 'https://example.com', domain_name: null },
      context: { actionInfo: { type: 'select', label: '계정' } },
      title: '계정 선택',
      script: '계정을 선택합니다.',
    },
    {
      name: 'last resort only',
      step: { id: '6', step_number: 6, ai_title: null, ai_description: null, page_url: null, domain_name: null },
      context: {},
      title: '화면 확인',
      script: '화면을 확인합니다.',
    },
  ];

  const failures = [];
  for (const testCase of cases) {
    const actual = buildCaptureFallbackDraft(testCase.step, testCase.context);
    if (actual.user_title !== testCase.title || actual.user_script !== testCase.script) {
      failures.push({ name: testCase.name, expected: { title: testCase.title, script: testCase.script }, actual });
    }
    if (!actual.user_title.trim() || !actual.user_script.trim()) {
      failures.push({ name: `${testCase.name} empty guard`, actual });
    }
    if (/^edit\s+(클릭|확인|선택|입력|이동)$/i.test(actual.user_title)) {
      failures.push({ name: `${testCase.name} generic label guard`, actual });
    }
  }

  const fallbackTitle = buildCaptureFallbackTutorialTitle([
    { user_title: '화면 확인' },
    { user_title: '대회소개 클릭' },
  ]);
  if (fallbackTitle !== '대회소개 클릭하기') {
    failures.push({ name: 'tutorial title fallback', expected: '대회소개 클릭하기', actual: fallbackTitle });
  }

  if (!isLowQualityCaptureTitle('edit 클릭')) {
    failures.push({ name: 'low quality title detector', expected: true, actual: false });
  }

  if (failures.length) {
    console.error(JSON.stringify({ ok: false, failures }, null, 2));
    process.exit(1);
  }

  console.log(JSON.stringify({ ok: true, cases: cases.length, empty_titles: 0, empty_scripts: 0 }));
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
