async function main() {
  const {
    keepUsableRewriteResults,
    validateGeneratedManualScript,
  } = await import('../lib/ai/text-quality.ts');

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

  if (failures.length) {
    console.error(JSON.stringify({ ok: false, failures }, null, 2));
    process.exit(1);
  }
  console.log(JSON.stringify({ ok: true, checks: lowQualityScripts.length + 2 }));
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
