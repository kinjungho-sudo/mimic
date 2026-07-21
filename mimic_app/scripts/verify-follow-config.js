const fs = require('node:fs');
const path = require('node:path');

async function main() {
  const { mergeCapturedTypeText, toFollowSteps } = await import('../lib/follow.ts');
  const { isOversizedGuideTarget, resolveGuideTargetRect } = await import('../lib/follow-target.ts');

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

  const largeCard = { x: 18, y: 22, w: 42, h: 38 };
  const compactTarget = resolveGuideTargetRect(largeCard, 52, 46, 960, 540);
  if (!isOversizedGuideTarget(largeCard) || !compactTarget || compactTarget.w >= largeCard.w || compactTarget.h >= largeCard.h) {
    throw new Error(`oversized DOM was not compacted around the hotspot: ${JSON.stringify(compactTarget)}`);
  }
  const buttonRect = { x: 45, y: 42, w: 8, h: 5 };
  if (resolveGuideTargetRect(buttonRect, 49, 44, 960, 540) !== buttonRect) {
    throw new Error('small DOM targets must keep their detected rectangle');
  }

  const stageSource = fs.readFileSync(path.join(__dirname, '../components/viewer/FollowStage.tsx'), 'utf8');
  const playerSource = fs.readFileSync(path.join(__dirname, '../components/viewer/InteractiveFollowPlayer.tsx'), 'utf8');
  const studioSource = fs.readFileSync(path.join(__dirname, '../app/manual/[id]/studio/page.tsx'), 'utf8');
  if (stageSource.includes('<AnnotationPreview')) {
    throw new Error('learning guide must not composite editor annotations over the original screenshot');
  }
  if (!stageSource.includes('className="mfp-practice-input"') || !stageSource.includes('placeholder={hasTypeText ? typeStr')) {
    throw new Error('learning guide must render a real text input with the authored text as its hint');
  }
  if (!stageSource.includes('nextValue === typeStr') || !playerSource.includes('value !== expected')) {
    throw new Error('learning guide must advance only after the user enters the expected text');
  }
  if (!stageSource.includes('mfp-target-glint') || !stageSource.includes('TARGET_GREEN')) {
    throw new Error('learning guide target must use the animated green highlight');
  }
  if (!stageSource.includes('resolveGuideTargetRect') || !playerSource.includes('!isOversizedGuideTarget(dr)')) {
    throw new Error('large DOM targets must use the compact hotspot-centered visual and hit area');
  }
  if (!studioSource.includes('confirmDeleteStep') || !studioSource.includes('studio.step.delete.fail')) {
    throw new Error('learning guide studio must support persisted step deletion');
  }

  console.log(JSON.stringify({ ok: true, captured_type_text: followStep.typeText, kind: followStep.kind, compact_target: compactTarget, visual_contract: 'original-image-green-highlight-real-input-compact-large-target' }));
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
