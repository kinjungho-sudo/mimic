async function main() {
  const {
    keepUsableRewriteResults,
    validateGeneratedManualScript,
  } = await import('../lib/ai/text-quality.ts');
  const { assessManualQuality } = await import('../lib/manual-quality.ts');

  const lowQualityScripts = [
    '검색어를 입력합니다.',
    '내용을 작성합니다.',
    '입력 영역을 선택합니다.',
  ];
  const failures = [];
  for (const script of lowQualityScripts) {
    const result = validateGeneratedManualScript(script);
    if (result.ok || result.reason !== 'low_quality') {
      failures.push({ name: 'purpose-light rewrite rejected', script, expected: 'low_quality', actual: result });
    }
  }

  const sourceSteps = [
    { id: 'search', text: '검색창을 클릭합니다.' },
    { id: 'body', text: '내용을 입력합니다.' },
  ];
  const generated = [
    { id: 'search', result: '검색어를 입력합니다.' },
    { id: 'body', result: '사용자가 찾을 정보를 입력해 검색 결과를 준비합니다.' },
  ];
  const kept = keepUsableRewriteResults(sourceSteps, generated);
  const search = kept.find(result => result.id === 'search');
  const body = kept.find(result => result.id === 'body');
  if (!search?.rejected || search.result !== sourceSteps[0].text) {
    failures.push({ name: 'purpose-light rewrite falls back to original', actual: search });
  }
  if (body?.rejected || body?.result !== generated[1].result) {
    failures.push({ name: 'purpose-rich rewrite accepted', actual: body });
  }

  const duplicateIssues = assessManualQuality('상품 검색하기', [
    { id: 'step-1', step_number: 1, user_title: '검색창 선택', user_script: '상품을 찾기 위해 검색 영역을 선택합니다.', screenshot_url: 'one.png', click_x: 100, click_y: 100 },
    { id: 'step-2', step_number: 2, user_title: '검색창을 선택하기', user_script: '검색할 상품을 입력할 준비를 합니다.', screenshot_url: 'two.png', click_x: 100, click_y: 100 },
    { id: 'step-3', step_number: 3, user_title: '상품명 입력', user_script: '상품 이름을 입력해 검색 결과를 준비합니다.', screenshot_url: 'three.png', click_x: 100, click_y: 100 },
  ]).filter(issue => issue.code === 'duplicate_title');
  if (duplicateIssues.length !== 1 || duplicateIssues[0].stepId !== 'step-1') {
    failures.push({ name: 'near-duplicate titles produce one actionable quality warning', actual: duplicateIssues });
  }
  if (duplicateIssues[0]?.severity !== 'error') {
    failures.push({ name: 'duplicate titles block publishing', expected: 'error', actual: duplicateIssues[0]?.severity });
  }
  if (duplicateIssues[0]?.message !== '1·2단계에 같거나 거의 같은 제목 “검색창 선택”이 반복됩니다. 각 단계의 목적을 구분해주세요.'
      || JSON.stringify(duplicateIssues[0]?.relatedStepNumbers) !== JSON.stringify([1, 2])) {
    failures.push({ name: 'duplicate warning identifies every affected step', actual: duplicateIssues[0] });
  }

  const brokenThreadsIssues = assessManualQuality('게시 확인하기', [
    {
      id: 'threads-1', step_number: 1,
      user_title: '텍스트 필드가 비어 있습니다. 입력하여 새 게시물을 작성해보세요. 클릭',
      user_script: '텍스트 필드가 비어 있습니다. 입력하여 새 게시물을 작성해보세요.를 클릭합니다.',
      screenshot_url: 'one.png', element_selector: '#composer',
    },
    {
      id: 'threads-2', step_number: 2,
      user_title: '텍스트 필드가 비어 있습니다. 입력하여 새 게시물을 작성해보세요. 클릭',
      user_script: '텍스트 필드가 비어 있습니다. 입력하여 새 게시물을 작성해보세요.를 클릭합니다.',
      screenshot_url: 'two.png', element_selector: '#composer',
    },
  ]);
  const blockingTextCodes = new Set(['tutorial_title', 'step_title', 'step_script', 'duplicate_title']);
  if (!brokenThreadsIssues.some(issue => issue.code === 'tutorial_title')
      || !brokenThreadsIssues.some(issue => issue.code === 'duplicate_title')
      || brokenThreadsIssues.some(issue => blockingTextCodes.has(issue.code) && issue.severity !== 'error')) {
    failures.push({ name: 'broken Threads copy is blocked before publishing', actual: brokenThreadsIssues });
  }

  const correctedThreadsIssues = assessManualQuality('새 게시물 작성하기', [
    { id: 'threads-fixed-1', step_number: 1, user_title: '게시물 내용 입력', user_script: '새 게시물에 공유할 내용을 입력합니다.', screenshot_url: 'one.png', element_selector: '#composer' },
    { id: 'threads-fixed-2', step_number: 2, user_title: '게시물 게시', user_script: '작성한 내용을 확인한 뒤 게시 버튼을 눌러 공개합니다.', screenshot_url: 'two.png', element_selector: '#publish' },
  ]).filter(issue => blockingTextCodes.has(issue.code));
  if (correctedThreadsIssues.length !== 0) {
    failures.push({ name: 'corrected Threads copy passes text quality gate', actual: correctedThreadsIssues });
  }

  if (failures.length) {
    console.error(JSON.stringify({ ok: false, failures }, null, 2));
    process.exit(1);
  }
  console.log(JSON.stringify({ ok: true, checks: lowQualityScripts.length + 8 }));
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
