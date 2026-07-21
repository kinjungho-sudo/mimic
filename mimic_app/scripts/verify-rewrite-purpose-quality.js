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

  if (failures.length) {
    console.error(JSON.stringify({ ok: false, failures }, null, 2));
    process.exit(1);
  }
  console.log(JSON.stringify({ ok: true, checks: lowQualityScripts.length + 3 }));
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
