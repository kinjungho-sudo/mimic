async function main() {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const { normalizeStepTitleForComparison, validateRegeneratedStepSet } = await import('../lib/ai/regeneration-quality.ts');
  const { isLowQualityCaptureScript, isLowQualityCaptureTitle } = await import('../lib/ai/capture-fallback.ts');

  const ids = ['1', '2', '3', '4', '5'];
  const repeatedDesktopFallback = ids.map((id, index) => ({
    id,
    user_title: index === 4 ? '최종 결과 확인' : 'desktop.parro.local 설정 진행',
    user_script: index === 4
      ? '앞선 설정이 반영되어 원하는 결과가 표시되는지 확인합니다.'
      : 'desktop.parro.local 주요 영역을 클릭합니다.',
  }));
  const rejected = validateRegeneratedStepSet(ids, repeatedDesktopFallback);
  if (rejected.ok) throw new Error('internal desktop fallback set must be rejected');
  if (!isLowQualityCaptureTitle('desktop.parro.local 설정 진행')) throw new Error('internal desktop title must be low quality');
  if (!isLowQualityCaptureScript('desktop.parro.local 주요 영역을 클릭합니다.')) throw new Error('internal desktop script must be low quality');

  const useful = [
    { id: '1', user_title: '대화 내용 확인', user_script: '메시지를 작성하기 전에 현재 대화의 흐름을 확인합니다.' },
    { id: '2', user_title: '메시지 입력 준비', user_script: '새 메시지를 작성할 수 있도록 대화창의 입력 영역을 선택합니다.' },
    { id: '3', user_title: '메시지 작성', user_script: '상대방에게 전달할 내용을 메시지 입력란에 작성합니다.' },
    { id: '4', user_title: '전송 내용 확인', user_script: '메시지를 보내기 전에 작성한 내용이 올바른지 확인합니다.' },
    { id: '5', user_title: '메시지 보내기', user_script: '작성한 메시지를 상대방에게 전달하기 위해 전송합니다.' },
  ];
  const accepted = validateRegeneratedStepSet(ids, useful);
  if (!accepted.ok) throw new Error(`useful desktop copy was rejected: ${accepted.reason}`);

  const missing = validateRegeneratedStepSet(ids, useful.slice(0, 4));
  if (missing.ok || missing.reason !== 'missing_steps') throw new Error('missing AI steps must reject the whole rewrite');

  if (normalizeStepTitleForComparison('검색창을 선택하기') !== normalizeStepTitleForComparison('검색창 선택')) {
    throw new Error('Korean particles and action endings must not hide duplicate step titles');
  }
  const nearDuplicate = validateRegeneratedStepSet(ids, [
    { id: '1', user_title: '검색창 선택', user_script: '상품을 찾기 위해 검색 영역을 선택합니다.' },
    { id: '2', user_title: '검색창을 선택하기', user_script: '검색할 상품을 입력할 준비를 합니다.' },
    { id: '3', user_title: '검색창 선택합니다', user_script: '검색어를 작성할 수 있도록 입력 위치를 확인합니다.' },
    { id: '4', user_title: '상품명 입력', user_script: '찾을 상품 이름을 입력해 결과를 준비합니다.' },
    { id: '5', user_title: '검색 결과 확인', user_script: '원하는 상품이 결과에 표시되는지 확인합니다.' },
  ]);
  if (nearDuplicate.ok || nearDuplicate.reason !== 'repetitive_copy') {
    throw new Error('near-duplicate titles must fail the regeneration quality gate');
  }

  const route = fs.readFileSync(path.join(process.cwd(), 'app', 'api', 'tutorials', '[id]', 'regenerate-content', 'route.ts'), 'utf8');
  if (!/const fallbackDraft = purposeFallback/.test(route)) throw new Error('regeneration must recover unusable AI steps with a grounded fallback');
  if (!/buildCaptureFallbackTutorialTitle\(drafts/.test(route)) throw new Error('regeneration must recover a low-quality existing tutorial title');
  if (!/fallback_count: fallbackStepIds\.size/.test(route)) throw new Error('regeneration must report actual fallback usage');
  if (!/draftResult\.status === 'ok' \? draftResult\.steps : \[\]/.test(route)) throw new Error('AI provider failure must continue through grounded fallbacks');
  if (!/FOAL_AI_WORKFLOW_COPY/.test(route)) throw new Error('the approved Foal AI verification manual needs deterministic legacy repair copy');
  if (!/assessManualQuality\(tutorialTitle, repairedSteps\)/.test(route)) throw new Error('fallback copy must pass the publishing quality gate before updates');
  if (!/const rollbackResults = await Promise\.all/.test(route)) throw new Error('partial regeneration writes must trigger rollback');
  if (!/updateTutorialTitle\(tutorialTitle, tutorial\.title\)/.test(route)) throw new Error('regeneration rollback must restore the original tutorial title');
  if (!/drafts\[index\]\.user_title[\s\S]*drafts\[index\]\.user_script[\s\S]*step\.user_title[\s\S]*step\.user_script/.test(route)) throw new Error('regeneration rollback must restore original step copy');
  if (!/\.eq\('title', fromTitle\)/.test(route)) throw new Error('tutorial rewrite must not overwrite a concurrent title edit');
  if (!/query\.is\('user_title', null\)[\s\S]*query\.eq\('user_title', fromTitle\)/.test(route)) throw new Error('step rewrite must compare nullable original copy before writing');
  if (!/rollback failed/.test(route)) throw new Error('rollback failures must be surfaced for diagnosis');

  console.log(JSON.stringify({ ok: true, checks: 20, rejected_reason: rejected.reason, near_duplicate_reason: nearDuplicate.reason }));
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
