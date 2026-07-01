async function main() {
  const {
    buildCaptureFallbackDraft,
    buildCaptureFallbackTutorialTitle,
    buildCaptureAnnotationLabel,
    isLowQualityCaptureScript,
    isLowQualityCaptureTitle,
    isLowQualityCaptureTutorialTitle,
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
      name: 'slack apps label uses menu context',
      step: { id: '4b', step_number: 4, ai_title: null, ai_description: null, page_url: 'https://app.slack.com/client/T123/apps', domain_name: 'Slack' },
      context: { actionInfo: { type: 'click', label: 'apps' } },
      title: '앱 메뉴 클릭',
      script: '앱 메뉴를 클릭합니다.',
    },
    {
      name: 'slack oauth label uses settings context',
      step: { id: '4c', step_number: 4, ai_title: null, ai_description: null, page_url: 'https://api.slack.com/apps/A0BCYXSD1RD/oauth', domain_name: 'Slack' },
      context: { actionInfo: { type: 'click', label: 'oauth' } },
      title: 'OAuth 설정 클릭',
      script: 'OAuth 설정을 클릭합니다.',
    },
    {
      name: 'weak slack oauth ai draft is replaced',
      step: { id: '4c2', step_number: 4, ai_title: 'oauth 클릭', ai_description: 'oauth를 클릭합니다.', page_url: 'https://api.slack.com/apps/A0BCYXSD1RD/oauth', domain_name: 'Slack' },
      context: { actionInfo: { type: 'click', label: 'oauth' } },
      title: 'OAuth 설정 클릭',
      script: 'OAuth 설정을 클릭합니다.',
    },
    {
      name: 'slack functions label uses menu context',
      step: { id: '4c3', step_number: 4, ai_title: 'functions 클릭', ai_description: 'functions를 클릭합니다.', page_url: 'https://api.slack.com/apps/A0BCYXSD1RD/functions', domain_name: 'Slack' },
      context: { actionInfo: { type: 'click', label: 'functions' } },
      title: 'Functions 메뉴 클릭',
      script: 'Functions 메뉴를 클릭합니다.',
    },
    {
      name: 'slack general label uses channel context',
      step: { id: '4d', step_number: 4, ai_title: null, ai_description: null, page_url: 'https://app.slack.com/client/T123/C123', domain_name: 'jungho Slack' },
      context: { actionInfo: { type: 'click', label: 'general' } },
      title: 'general 채널 클릭',
      script: 'general 채널을 클릭합니다.',
    },
    {
      name: 'weak slack general ai draft is replaced',
      step: { id: '4d2', step_number: 4, ai_title: 'general 클릭', ai_description: 'general을 클릭합니다.', page_url: 'https://app.slack.com/client/T123/C123', domain_name: 'jungho Slack' },
      context: { actionInfo: { type: 'click', label: 'general' } },
      title: 'general 채널 클릭',
      script: 'general 채널을 클릭합니다.',
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
    {
      name: 'gmail unread count becomes manual context',
      step: { id: '7', step_number: 7, ai_title: '메일, 읽지 않은 메일 2458개 클릭', ai_description: '메일, 읽지 않은 메일 2458개를 클릭합니다.', page_url: 'https://mail.google.com/mail/u/0/#inbox', domain_name: 'Gmail' },
      context: { actionInfo: { type: 'click', label: '메일, 읽지 않은 메일 2458개' } },
      title: '메일함 확인',
      script: '메일함을 확인합니다.',
    },
    {
      name: 'long email draft content becomes input context',
      step: { id: '8', step_number: 8, ai_title: '감사하다는 내용과 함께, 꼭 다음번에 같이하자는 내용 써줘.업데이트[받는 사람 성함]님,보내주신 메일 잘 확인했습니다. 감사드립니다.이번에는 아를 클릭합니다.', ai_description: '감사하다는 내용과 함께, 꼭 다음번에 같이하자는 내용 써줘.업데이트[받는 사람 성함]님,보내주신 메일 잘 확인했습니다. 감사드립니다.이번에는 아를 클릭합니다.', page_url: 'https://mail.google.com/mail/u/0/#inbox', domain_name: 'Gmail' },
      context: { actionInfo: { type: 'type', label: '감사하다는 내용과 함께, 꼭 다음번에 같이하자는 내용 써줘.업데이트[받는 사람 성함]님,보내주신 메일 잘 확인했습니다. 감사드립니다.이번에는 아를 클릭합니다.' } },
      title: '메일 본문 입력',
      script: '메일 본문으로 내용을 입력합니다.',
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
    if (/^(edit|oauth|general|functions)\s+(클릭|확인|선택|입력|이동)$/i.test(actual.user_title)) {
      failures.push({ name: `${testCase.name} raw label title guard`, actual });
    }
    if (/^(edit|oauth|general|functions)(을|를)?\s*(클릭|확인|선택|입력|이동)합니다\.?$/i.test(actual.user_script)) {
      failures.push({ name: `${testCase.name} raw label script guard`, actual });
    }
  }

  const fallbackTitle = buildCaptureFallbackTutorialTitle([
    { user_title: '화면 확인' },
    { user_title: '대회소개 클릭' },
  ]);
  if (fallbackTitle !== '대회소개 클릭하기') {
    failures.push({ name: 'tutorial title fallback', expected: '대회소개 클릭하기', actual: fallbackTitle });
  }

  const mailTutorialTitle = buildCaptureFallbackTutorialTitle([
    { user_title: '메일함 확인' },
    { user_title: '메일 쓰기 클릭' },
    { user_title: '받는 사람 입력' },
    { user_title: '참조 입력' },
    { user_title: '메일 본문 입력' },
    { user_title: '제목 입력' },
    { user_title: '메일 보내기 클릭' },
  ]);
  if (mailTutorialTitle !== '메일 작성 후 보내기') {
    failures.push({ name: 'mail tutorial title fallback', expected: '메일 작성 후 보내기', actual: mailTutorialTitle });
  }

  if (!isLowQualityCaptureTitle('edit 클릭')) {
    failures.push({ name: 'low quality title detector', expected: true, actual: false });
  }
  if (!isLowQualityCaptureTitle('oauth 클릭')) {
    failures.push({ name: 'raw oauth title detector', expected: true, actual: false });
  }
  if (!isLowQualityCaptureScript('oauth를 클릭합니다.')) {
    failures.push({ name: 'raw oauth script detector', expected: true, actual: false });
  }
  if (!isLowQualityCaptureTutorialTitle('메일 클릭하기')) {
    failures.push({ name: 'direct click tutorial title detector', expected: true, actual: false });
  }
  if (!isLowQualityCaptureTitle('메일, 읽지 않은 메일 2458개 클릭')) {
    failures.push({ name: 'gmail unread count title detector', expected: true, actual: false });
  }
  if (!isLowQualityCaptureScript('감사하다는 내용과 함께, 꼭 다음번에 같이하자는 내용 써줘.업데이트[받는 사람 성함]님,보내주신 메일 잘 확인했습니다. 감사드립니다.이번에는 아를 클릭합니다. 이걸 어노테이션 텍스트 박스에 포함')) {
    failures.push({ name: 'long captured content script detector', expected: true, actual: false });
  }

  const annotationChecks = [
    { name: 'type annotation label', actual: buildCaptureAnnotationLabel('프롬프트 입력 입력', 'type'), expected: '입력 적용' },
    { name: 'gmail annotation label', actual: buildCaptureAnnotationLabel('메일함 확인', 'click'), expected: '메일함 확인' },
    { name: 'long annotation label', actual: buildCaptureAnnotationLabel('감사하다는 내용과 함께, 꼭 다음번에 같이하자는 내용 써줘.업데이트[받는 사람 성함]님', 'click'), expected: '대상 확인' },
  ];
  for (const check of annotationChecks) {
    if (check.actual !== check.expected) failures.push(check);
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
