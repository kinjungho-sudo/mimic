async function main() {
  const {
    buildCaptureFallbackDraft,
    buildCaptureFallbackTutorialTitle,
    buildCaptureAnnotationLabel,
    cleanCaptureTypeText,
    isLowQualityCaptureScript,
    isLowQualityCaptureTitle,
    isLowQualityCaptureTutorialTitle,
    isUsableCaptureDraft,
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
      script: '메일 본문을 입력합니다.',
    },
    {
      name: 'raw search label becomes search box context',
      step: { id: '9', step_number: 9, ai_title: 'search 클릭', ai_description: 'search를 클릭합니다.', page_url: 'https://www.coupang.com/np/search?q=%EB%8D%B0%EB%A6%AC%EC%95%BC%EB%81%BC', domain_name: 'Coupang' },
      context: { actionInfo: { type: 'click', label: 'search' } },
      title: '검색창 클릭',
      script: '검색창을 클릭합니다.',
    },
    {
      name: 'stale add-to-cart label rejected on checkout page',
      step: { id: '10', step_number: 10, ai_title: '장바구니 담기 클릭', ai_description: '장바구니 담기를 클릭합니다.', page_url: 'https://www.coupang.com/order/checkout', domain_name: 'Coupang' },
      context: { actionInfo: { type: 'click', label: '장바구니 담기' } },
      title: '주문 정보 확인',
      script: '주문 정보를 확인합니다.',
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
  if (fallbackTitle !== '대회소개 확인하기') {
    failures.push({ name: 'tutorial title fallback', expected: '대회소개 확인하기', actual: fallbackTitle });
  }

  const notionScheduleTitle = buildCaptureFallbackTutorialTitle([
    { user_title: '일상의 모든 기록 클릭', user_script: '일상의 모든 기록을 클릭합니다.' },
    { user_title: '스케줄 클릭', user_script: '스케줄을 클릭합니다.' },
    { user_title: '텍스트 입력', user_script: '일정 내용을 입력합니다.' },
  ], { serviceNames: ['Notion'] });
  if (notionScheduleTitle !== 'Notion에 일정 기록하기') {
    failures.push({ name: 'Notion schedule goal fallback', expected: 'Notion에 일정 기록하기', actual: notionScheduleTitle });
  }

  const githubCases = [
    {
      name: 'github code tab gets task context',
      step: { id: 'gh-1', step_number: 1, ai_title: null, ai_description: null, page_url: 'https://github.com/kinjungho-sudo/mimic/commit/abc', domain_name: 'GitHub' },
      context: { actionInfo: { type: 'click', label: 'Code' }, elementText: 'Code' },
      title: 'GitHub 저장소 코드 확인',
      script: 'GitHub 저장소 코드를 확인합니다.',
    },
    {
      name: 'github shortcut accessibility noise is discarded',
      step: { id: 'gh-2', step_number: 2, ai_title: null, ai_description: null, page_url: 'https://github.com/kinjungho-sudo/mimic', domain_name: 'GitHub' },
      context: { actionInfo: { type: 'click', label: 'Open menuHomepage (g then d) gGthen dD' } },
      title: 'GitHub 저장소 확인',
      script: 'GitHub 저장소를 확인합니다.',
    },
    {
      name: 'github breadcrumb owner is discarded',
      step: { id: 'gh-3', step_number: 3, ai_title: null, ai_description: null, page_url: 'https://github.com/kinjungho-sudo/mimic', domain_name: 'GitHub' },
      context: { actionInfo: { type: 'click', label: 'kinjungho-sudo' } },
      title: 'GitHub 저장소 확인',
      script: 'GitHub 저장소를 확인합니다.',
    },
    {
      name: 'github homepage show more gets activity context',
      step: { id: 'gh-4', step_number: 4, ai_title: null, ai_description: null, page_url: 'https://github.com/', domain_name: 'GitHub' },
      context: { actionInfo: { type: 'click', label: 'Show more' } },
      title: 'GitHub 활동 목록 확인',
      script: 'GitHub 활동 목록을 확인합니다.',
    },
    {
      name: 'github repository slug gets repository context',
      step: { id: 'gh-5', step_number: 5, ai_title: null, ai_description: null, page_url: 'https://github.com/', domain_name: 'GitHub' },
      context: { actionInfo: { type: 'click', label: 'kinjungho-sudo lineage_claude' } },
      title: 'GitHub 저장소 확인',
      script: 'GitHub 저장소를 확인합니다.',
    },
    {
      name: 'github branches gets settings context',
      step: { id: 'gh-6', step_number: 6, ai_title: null, ai_description: null, page_url: 'https://github.com/kinjungho-sudo/lineage_claude/settings', domain_name: 'GitHub' },
      context: { actionInfo: { type: 'click', label: 'Branches' } },
      title: 'GitHub 브랜치 설정 확인',
      script: 'GitHub 브랜치 설정을 확인합니다.',
    },
  ];
  for (const testCase of githubCases) {
    const actual = buildCaptureFallbackDraft(testCase.step, testCase.context);
    if (actual.user_title !== testCase.title || actual.user_script !== testCase.script) {
      failures.push({ name: testCase.name, expected: { title: testCase.title, script: testCase.script }, actual });
    }
  }

  const githubTutorialTitle = buildCaptureFallbackTutorialTitle([
    { user_title: 'GitHub 저장소 코드 확인' },
  ]);
  if (githubTutorialTitle !== 'GitHub 저장소 코드 확인하기') {
    failures.push({ name: 'github tutorial title', expected: 'GitHub 저장소 코드 확인하기', actual: githubTutorialTitle });
  }

  const githubSettingsTutorialTitle = buildCaptureFallbackTutorialTitle([
    { user_title: 'GitHub 저장소 코드 확인' },
    { user_title: 'GitHub 활동 목록 확인' },
    { user_title: 'GitHub 저장소 확인' },
    { user_title: 'GitHub 저장소 설정 확인' },
    { user_title: 'GitHub 브랜치 설정 확인' },
  ]);
  if (githubSettingsTutorialTitle !== 'GitHub 브랜치 설정 확인하기') {
    failures.push({ name: 'github final goal title', expected: 'GitHub 브랜치 설정 확인하기', actual: githubSettingsTutorialTitle });
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
  if (!isLowQualityCaptureTitle('메일, 읽지 않은 메일 2458개 클릭')) {
    failures.push({ name: 'gmail unread count title detector', expected: true, actual: false });
  }
  if (!isLowQualityCaptureTitle('search 클릭')) {
    failures.push({ name: 'raw search title detector', expected: true, actual: false });
  }
  const rawDomTitles = [
    '파일 등 추가 클릭',
    '페이지 클릭',
    '데이터베이스 클릭',
    'p 확인',
    'Create documentation — Generate PRDs, tech specs, and architecture... 클릭',
    '코스피, 미국 기술주 약세 영향으로 5%대 급락 클릭',
  ];
  for (const title of rawDomTitles) {
    if (!isLowQualityCaptureTitle(title)) {
      failures.push({ name: 'raw DOM title detector', expected: true, actual: false, title });
    }
    if (isUsableCaptureDraft({
      user_title: title,
      user_script: `${title.replace(/\s+(클릭|확인|선택|입력|이동)$/i, '')}를 클릭합니다.`,
    })) {
      failures.push({ name: 'raw DOM draft rejected', expected: false, actual: true, title });
    }
  }
  if (!isLowQualityCaptureTutorialTitle('메일 보내기 클릭하기')) {
    failures.push({ name: 'click tutorial title rejected', expected: true, actual: false });
  }
  if (!isLowQualityCaptureTutorialTitle('Code 클릭')) {
    failures.push({ name: 'raw code tutorial title rejected', expected: true, actual: false });
  }
  if (!isLowQualityCaptureTutorialTitle('Open menuHomepage (g then d) gGthen dD 클릭하기')) {
    failures.push({ name: 'accessibility shortcut tutorial title rejected', expected: true, actual: false });
  }
  const slackAgentFlow = {
    stepTitles: [
      '새 Slack 앱 생성 시작',
      '매니페스트로 앱 설정',
      '연결 토큰 생성',
      '워크스페이스 앱 설치',
      '에이전트 응답 테스트',
    ],
  };
  if (!isLowQualityCaptureTutorialTitle('SLACK에 앱 추가하기', slackAgentFlow)) {
    failures.push({ name: 'vague Slack app title rejected', expected: true, actual: false });
  }
  if (!isLowQualityCaptureTutorialTitle('Slack 앱을 만들고 워크스페이스에 설치하기', slackAgentFlow)) {
    failures.push({ name: 'title missing final agent test rejected', expected: true, actual: false });
  }
  if (isLowQualityCaptureTutorialTitle('Slack AI 에이전트 앱 만들고 테스트하기', slackAgentFlow)) {
    failures.push({ name: 'goal-oriented Slack title accepted', expected: false, actual: true });
  }
  const gmailSendFlow = {
    stepTitles: ['새 메일 작성 시작', '수신자 지정', '메일 제목 작성', '메일 본문 작성', '메일 보내기'],
  };
  if (!isLowQualityCaptureTutorialTitle('Gmail 메일 작성하기', gmailSendFlow)) {
    failures.push({ name: 'title missing final send rejected', expected: true, actual: false });
  }
  if (isLowQualityCaptureTutorialTitle('Gmail로 메일 보내기', gmailSendFlow)) {
    failures.push({ name: 'goal-oriented Gmail title accepted', expected: false, actual: true });
  }
  const cleanedTypeText = cleanCaptureTypeText('아이콘 추가 커버 추가 댓글 추가 뉴스 클리핑 시작하기 AI 기능은 스페이스 키, 명령에는 /를 입력하세요.');
  if (cleanedTypeText !== '뉴스 클리핑') {
    failures.push({ name: 'notion chrome stripped from type text', expected: '뉴스 클리핑', actual: cleanedTypeText });
  }
  if (!isLowQualityCaptureScript('감사하다는 내용과 함께, 꼭 다음번에 같이하자는 내용 써줘.업데이트[받는 사람 성함]님,보내주신 메일 잘 확인했습니다. 감사드립니다.이번에는 아를 클릭합니다. 이걸 어노테이션 텍스트 박스에 포함')) {
    failures.push({ name: 'long captured content script detector', expected: true, actual: false });
  }

  const annotationChecks = [
    { name: 'type annotation label', actual: buildCaptureAnnotationLabel('프롬프트 입력 입력', 'type'), expected: '입력 적용' },
    { name: 'gmail annotation label', actual: buildCaptureAnnotationLabel('메일함 확인', 'click'), expected: '메일함 확인' },
    { name: 'long annotation label', actual: buildCaptureAnnotationLabel('감사하다는 내용과 함께, 꼭 다음번에 같이하자는 내용 써줘.업데이트[받는 사람 성함]님', 'click'), expected: '대상 확인' },
    { name: 'search annotation label', actual: buildCaptureAnnotationLabel('search 클릭', 'click'), expected: '검색창 선택' },
    { name: 'checkout stale annotation label', actual: buildCaptureAnnotationLabel('장바구니 담기 클릭', 'click', 'https://www.coupang.com/order/checkout'), expected: '주문 정보 확인' },
  ];
  for (const check of annotationChecks) {
    if (check.actual !== check.expected) failures.push(check);
  }

  if (isUsableCaptureDraft({
    user_title: '\ud3b8\uc9c0\uc4f0\uae30 \ud074\ub9ad',
    user_script: '0\ub97c \ud074\ub9ad\ud569\ub2c8\ub2e4.',
  })) {
    failures.push({ name: 'usable draft rejects numeric script', expected: false, actual: true });
  }
  if (isUsableCaptureDraft({
    user_title: '0 \ud074\ub9ad',
    user_script: '\ud3b8\uc9c0\uc4f0\uae30\ub97c \ud074\ub9ad\ud569\ub2c8\ub2e4.',
  })) {
    failures.push({ name: 'usable draft rejects numeric title', expected: false, actual: true });
  }
  if (!isUsableCaptureDraft({
    user_title: '\ud3b8\uc9c0\uc4f0\uae30 \ud074\ub9ad',
    user_script: '\ud3b8\uc9c0\uc4f0\uae30\ub97c \ud074\ub9ad\ud569\ub2c8\ub2e4.',
  })) {
    failures.push({ name: 'usable draft accepts meaningful title and script', expected: true, actual: false });
  }
  if (isUsableCaptureDraft({
    user_title: '장바구니 담기 클릭',
    user_script: '장바구니 담기를 클릭합니다.',
  }, { pageUrl: 'https://www.coupang.com/order/checkout' })) {
    failures.push({ name: 'usable draft rejects stale checkout cart action', expected: false, actual: true });
  }

  if (isUsableCaptureDraft({
    user_title: '\ud3b8\uc9c0\uc4f0\uae30 \ud074\ub9ad',
    user_script: '0\ub97c \ud074\ub9ad\ud569\ub2c8\ub2e4.',
  })) {
    failures.push({ name: 'usable draft rejects numeric script', expected: false, actual: true });
  }
  if (isUsableCaptureDraft({
    user_title: '0 \ud074\ub9ad',
    user_script: '\ud3b8\uc9c0\uc4f0\uae30\ub97c \ud074\ub9ad\ud569\ub2c8\ub2e4.',
  })) {
    failures.push({ name: 'usable draft rejects numeric title', expected: false, actual: true });
  }
  if (!isUsableCaptureDraft({
    user_title: '\ud3b8\uc9c0\uc4f0\uae30 \ud074\ub9ad',
    user_script: '\ud3b8\uc9c0\uc4f0\uae30\ub97c \ud074\ub9ad\ud569\ub2c8\ub2e4.',
  })) {
    failures.push({ name: 'usable draft accepts meaningful title and script', expected: true, actual: false });
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
