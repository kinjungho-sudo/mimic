import type { LiveGuidePayload, LiveGuideStep } from '@/lib/live-guide/server';

type BlockLike = {
  type?: unknown;
  props?: { tutorialId?: unknown };
  children?: unknown;
};

export function extractPlaybookGuideSequence(content: unknown): string[] {
  const sequence: string[] = [];

  const visit = (blocks: unknown) => {
    if (!Array.isArray(blocks)) return;
    for (const raw of blocks) {
      if (!raw || typeof raw !== 'object') continue;
      const block = raw as BlockLike;
      if (block.type === 'guide') {
        const tutorialId = block.props?.tutorialId;
        if (typeof tutorialId === 'string' && tutorialId.trim()) sequence.push(tutorialId.trim());
      }
      visit(block.children);
    }
  };

  visit(content);
  return sequence;
}

export function flattenPlaybookLiveGuideSteps(
  sequence: string[],
  guides: Map<string, LiveGuidePayload>,
): LiveGuideStep[] {
  return sequence.flatMap((tutorialId, blockIndex) => {
    const guide = guides.get(tutorialId);
    if (!guide) return [];
    return guide.steps.map((step, stepIndex) => ({
      ...step,
      id: `${tutorialId}:${blockIndex}:${String(step.id ?? stepIndex)}`,
      source_step_id: step.id,
      source_tutorial_id: tutorialId,
      manual_title: guide.title,
    }));
  });
}
