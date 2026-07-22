import { isLowQualityCaptureScript, isLowQualityCaptureTitle, isLowQualityCaptureTutorialTitle } from '@/lib/ai/capture-fallback';
import { normalizeStepTitleForComparison } from '@/lib/ai/regeneration-quality';
import { containsSensitiveText, redactSensitive } from '@/lib/redact';

export type ManualQualityStep = {
  id: string;
  step_number?: number | null;
  user_title?: string | null;
  ai_title?: string | null;
  user_script?: string | null;
  ai_description?: string | null;
  screenshot_url?: string | null;
  click_x?: number | null;
  click_y?: number | null;
  element_rect?: unknown;
  element_selector?: string | null;
  element_xpath?: string | null;
  follow_config?: { hidden?: boolean; kind?: string | null; hotspotX?: number | null; hotspotY?: number | null } | null;
  step_type?: string | null;
  pii_detected?: boolean | null;
};

export type ManualQualityIssue = {
  code: 'empty_manual' | 'tutorial_title' | 'step_title' | 'step_script' | 'sensitive_text' | 'pii_image' | 'missing_image' | 'missing_target' | 'duplicate_title';
  severity: 'error' | 'warning';
  message: string;
  stepId?: string;
  stepNumber?: number;
  relatedStepNumbers?: number[];
};

const EXPLANATION_STEP_TYPES = new Set(['visual_only_step', 'visual_overlay_step', 'manual_capture_step', 'blocked_step']);

function plain(value: string | null | undefined): string {
  return (value ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

export function maskManualCopy(value: string | null | undefined): string {
  return plain(redactSensitive(value) ?? '');
}

export function assessManualQuality(title: string | null | undefined, steps: ManualQualityStep[]): ManualQualityIssue[] {
  const issues: ManualQualityIssue[] = [];
  const visibleSteps = steps.filter(step => !step.follow_config?.hidden);

  if (visibleSteps.length === 0) {
    return [{ code: 'empty_manual', severity: 'error', message: '공유할 단계가 없습니다.' }];
  }

  const stepTitles = visibleSteps.map(step => plain(step.user_title || step.ai_title));
  if (isLowQualityCaptureTutorialTitle(title, { stepTitles })) {
    issues.push({
      code: 'tutorial_title',
      severity: 'error',
      message: '전체 제목을 사용자가 최종적으로 달성하는 결과로 바꿔주세요.',
    });
  }

  const titleGroups = new Map<string, number[]>();
  stepTitles.forEach((value, index) => {
    const normalized = normalizeStepTitleForComparison(value);
    if (!normalized) return;
    const stepNumber = visibleSteps[index].step_number ?? index + 1;
    titleGroups.set(normalized, [...(titleGroups.get(normalized) ?? []), stepNumber]);
  });

  visibleSteps.forEach((step, index) => {
    const stepNumber = step.step_number ?? index + 1;
    const stepTitle = plain(step.user_title || step.ai_title);
    const stepScript = plain(step.user_script || step.ai_description);
    const meta = { stepId: step.id, stepNumber };

    if (isLowQualityCaptureTitle(stepTitle)) {
      issues.push({
        code: 'step_title', severity: 'error', ...meta,
        message: `${stepNumber}단계 제목이 버튼명·식별자 중심입니다. 업무 목적이 드러나게 다시 작성해주세요.`,
      });
    }
    if (isLowQualityCaptureScript(stepScript)) {
      issues.push({
        code: 'step_script', severity: 'error', ...meta,
        message: `${stepNumber}단계 설명에 수행 이유와 완료 상태를 한 문장으로 작성해주세요.`,
      });
    }
    if (containsSensitiveText(stepTitle) || containsSensitiveText(stepScript)) {
      issues.push({
        code: 'sensitive_text', severity: 'error', ...meta,
        message: `${stepNumber}단계 텍스트에 이메일·토큰·내부 식별자가 포함되어 있습니다.`,
      });
    }
    if (step.pii_detected) {
      issues.push({
        code: 'pii_image', severity: 'error', ...meta,
        message: `${stepNumber}단계 이미지의 개인정보 영역을 블러 처리해주세요.`,
      });
    }
    if (!step.screenshot_url) {
      issues.push({
        code: 'missing_image', severity: 'warning', ...meta,
        message: `${stepNumber}단계에 학습 화면 이미지가 없습니다.`,
      });
    }

    const explanationOnly = EXPLANATION_STEP_TYPES.has(step.step_type ?? '') || step.follow_config?.kind === 'none';
    const hasTarget = (step.follow_config?.hotspotX != null && step.follow_config?.hotspotY != null)
      || (step.click_x != null && step.click_y != null)
      || !!step.element_rect
      || !!step.element_selector
      || !!step.element_xpath;
    if (!explanationOnly && !hasTarget) {
      issues.push({
        code: 'missing_target', severity: 'error', ...meta,
        message: `${stepNumber}단계의 클릭·입력 대상을 다시 지정해주세요.`,
      });
    }

    const normalizedStepTitle = normalizeStepTitleForComparison(stepTitle);
    const duplicateStepNumbers = normalizedStepTitle ? (titleGroups.get(normalizedStepTitle) ?? []) : [];
    if (duplicateStepNumbers.length > 1) {
      const firstDuplicate = visibleSteps.findIndex(candidate => (
        normalizeStepTitleForComparison(plain(candidate.user_title || candidate.ai_title)) === normalizedStepTitle
      ));
      if (firstDuplicate === index) {
        issues.push({
          code: 'duplicate_title', severity: 'error', ...meta,
          relatedStepNumbers: duplicateStepNumbers,
          message: `${duplicateStepNumbers.join('·')}단계에 같거나 거의 같은 제목 “${stepTitle}”이 반복됩니다. 각 단계의 목적을 구분해주세요.`,
        });
      }
    }
  });

  return issues;
}

export function inferGuideSection(title: string | null | undefined, body: string | null | undefined, index: number, total: number): string {
  const text = `${plain(title)} ${plain(body)}`;
  if (/응답|테스트|채팅|대화|메시지|질문|에이전트/i.test(text)) return '응답 테스트';
  if (/OAuth|권한|허용|승인|설치|워크스페이스/i.test(text)) return '권한과 설치';
  if (/토큰|연결|connections?:|scope|복사|Generate/i.test(text)) return '연결 설정';
  if (/앱\s*(생성|만들)|manifest|매니페스트|Create New App|team/i.test(text)) return '앱 만들기';
  const progress = total <= 1 ? 1 : index / (total - 1);
  if (progress < 0.25) return '준비';
  if (progress < 0.65) return '설정';
  if (progress < 0.9) return '실행';
  return '결과 확인';
}

export function riskNoticeForStep(title: string | null | undefined, body: string | null | undefined): string | null {
  const text = `${plain(title)} ${plain(body)}`;
  if (/OAuth|권한|허용|승인|설치/i.test(text)) return '요청 권한과 설치 대상 워크스페이스를 확인한 뒤 승인하세요.';
  if (/삭제|제거|초기화|해지|취소/i.test(text)) return '삭제하거나 취소하면 되돌리기 어려울 수 있으니 대상을 다시 확인하세요.';
  if (/결제|구매|주문|송금|이체/i.test(text)) return '금액과 결제 대상을 확인한 뒤 진행하세요.';
  if (/게시|배포|공개|발행|전송|보내기/i.test(text)) return '외부에 공개되거나 전송되는 내용과 대상을 확인하세요.';
  return null;
}
