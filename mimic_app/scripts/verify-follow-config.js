async function main() {
  const { mergeCapturedTypeText, toFollowSteps } = await import('../lib/follow.ts');

  const captured = mergeCapturedTypeText(null, ' 몬스테라 ');
  if (captured.typeText !== '몬스테라') {
    throw new Error(`captured type_text was not propagated: ${JSON.stringify(captured)}`);
  }

  const authored = mergeCapturedTypeText({ typeText: '직접 작성값', kind: 'type' }, '몬스테라');
  if (authored.typeText !== '직접 작성값') {
    throw new Error(`authored follow_config.typeText lost priority: ${JSON.stringify(authored)}`);
  }

  const [followStep] = toFollowSteps([{
    title: '상품 검색어 입력',
    body: '원하는 상품을 찾을 수 있도록 검색어를 입력합니다.',
    clickXPct: 50,
    clickYPct: 35,
    followConfig: captured,
  }]);
  if (followStep.kind !== 'type' || followStep.typeText !== '몬스테라') {
    throw new Error(`follow player input is incomplete: ${JSON.stringify(followStep)}`);
  }

  console.log(JSON.stringify({ ok: true, captured_type_text: followStep.typeText, kind: followStep.kind }));
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
