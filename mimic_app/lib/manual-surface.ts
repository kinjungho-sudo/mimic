import type { Step, Tutorial } from '@/types';

type StepLike = Pick<Step, 'page_url' | 'domain_name' | 'target_context'>;
type TutorialLike = Pick<Tutorial, 'first_page_url'> & {
  capture_surface?: 'web' | 'desktop' | null;
  steps?: StepLike[];
};

const DESKTOP_INTERNAL_HOST = /\b(?:desktop|windows)\.parro\.(?:local|app)\b/i;

export function isDesktopStep(step: StepLike): boolean {
  const target = step.target_context;
  const captureSurface = target && typeof target === 'object' && !Array.isArray(target)
    ? (target as { captureSurface?: unknown }).captureSurface
    : null;

  return captureSurface === 'desktop'
    || DESKTOP_INTERNAL_HOST.test(step.page_url ?? '')
    || DESKTOP_INTERNAL_HOST.test(step.domain_name ?? '');
}

export function isDesktopTutorial(tutorial: TutorialLike | null | undefined): boolean {
  if (!tutorial) return false;
  if (tutorial.capture_surface === 'desktop') return true;
  if (DESKTOP_INTERNAL_HOST.test(tutorial.first_page_url ?? '')) return true;
  return Array.isArray(tutorial.steps) && tutorial.steps.some(isDesktopStep);
}
