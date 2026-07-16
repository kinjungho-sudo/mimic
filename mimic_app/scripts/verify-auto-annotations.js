async function main() {
  const { buildStepClickAnnotations } = await import('../lib/annotations.ts');

  const steps = [
    {
      stepNumber: 1,
      elementRect: { x: 0.1, y: 0.15, width: 0.2, height: 0.08 },
      clickX: 0.2,
      clickY: 0.19,
      actionType: 'click',
      label: '첫 단계',
    },
    {
      stepNumber: 2,
      elementRect: { x: 0.86, y: 0.88, width: 0.12, height: 0.08 },
      clickX: 0.92,
      clickY: 0.92,
      actionType: 'click',
      label: '두 번째 단계',
    },
    {
      stepNumber: 3,
      elementRect: null,
      clickX: 0,
      clickY: 0,
      actionType: 'click',
      label: '화면 모서리',
    },
  ];

  const generated = steps.map(step => buildStepClickAnnotations(step));
  const failures = [];
  generated.forEach((annotations, index) => {
    if (annotations.length !== 4) {
      failures.push({ step: index + 1, reason: 'expected four annotations', count: annotations.length });
      return;
    }
    const expectedTypes = 'spotlight,rect,arrow,text';
    if (annotations.map(item => item.type).join(',') !== expectedTypes) {
      failures.push({ step: index + 1, reason: 'unexpected annotation types' });
    }
    const bounded = annotations.every(annotation =>
      ['x1', 'y1', 'x2', 'y2'].every(key => {
        const value = annotation[key];
        return typeof value !== 'number' || (value >= 0 && value <= 100);
      })
    );
    if (!bounded) failures.push({ step: index + 1, reason: 'coordinate out of bounds' });
  });

  const existing = generated[0];
  const preserved = buildStepClickAnnotations({
    ...steps[0],
    existingAnnotations: existing,
  });
  if (preserved !== existing) failures.push({ reason: 'existing annotations were replaced' });

  const noTarget = buildStepClickAnnotations({
    stepNumber: 4,
    label: '대상 없음',
    elementRect: null,
    clickX: null,
    clickY: null,
  });
  if (noTarget.length !== 0) failures.push({ reason: 'annotation created without location evidence' });

  if (failures.length) {
    console.error(JSON.stringify({ ok: false, failures }, null, 2));
    process.exit(1);
  }

  console.log(JSON.stringify({ ok: true, annotated_steps: generated.length, annotations_per_step: 4 }));
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
