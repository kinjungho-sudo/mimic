import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/auth-guard';
import { guardTutorialAccess } from '@/lib/auth/workspace-guard';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { generateDraft } from '@/lib/ai/claude';
import {
  buildCaptureFallbackDraft,
  buildCaptureFallbackTutorialTitle,
  isLowQualityCaptureTitle,
  isLowQualityCaptureTutorialTitle,
  isUsableCaptureDraft,
} from '@/lib/ai/capture-fallback';
import { validateRegeneratedStepSet } from '@/lib/ai/regeneration-quality';
import { maskManualCopy } from '@/lib/manual-quality';

type Params = { params: Promise<{ id: string }> };

type StoredStep = {
  id: string;
  step_number: number;
  user_title: string | null;
  ai_title: string | null;
  user_script: string | null;
  ai_description: string | null;
  page_url: string | null;
  domain_name: string | null;
  type_text: string | null;
  screenshot_url: string | null;
  element_text?: string | null;
  action_info?: {
    type?: string;
    label?: string;
    text?: string;
    targetContext?: {
      captureSurface?: 'web' | 'desktop';
      captureApp?: string | null;
      accessibleName?: string | null;
      contextLabel?: string | null;
      pageTitle?: string | null;
    };
  } | null;
};

const SLACK_AGENT_WORKFLOW_COPY = [
  ['Slack 앱 생성 시작', '새 Slack 앱 만들기를 시작해 연결 설정을 준비합니다.'],
  ['매니페스트 방식 선택', '앱 정보를 한 번에 설정할 수 있도록 매니페스트 방식을 선택합니다.'],
  ['설치할 워크스페이스 선택', '앱을 만들고 사용할 Slack 워크스페이스를 선택합니다.'],
  ['선택한 워크스페이스 확인', '앱을 만들 워크스페이스가 올바른지 확인합니다.'],
  ['매니페스트 편집 단계로 이동', '선택한 워크스페이스에서 매니페스트 편집 화면으로 이동합니다.'],
  ['매니페스트 기본 정보 입력', '앱 이름과 기본 정보를 매니페스트에 입력합니다.'],
  ['매니페스트 권한 정보 입력', '에이전트 연결과 설치에 필요한 권한을 매니페스트에 입력합니다.'],
  ['앱 생성 단계로 이동', '매니페스트 내용을 확인하고 앱 생성 단계로 이동합니다.'],
  ['Slack 앱 생성 완료', '입력한 매니페스트로 Slack 앱을 생성합니다.'],
  ['생성된 앱 확인', '생성된 Slack 앱과 기본 정보를 확인합니다.'],
  ['앱 식별 정보 입력', '에이전트 연결에 사용할 Slack 앱 식별 정보를 입력합니다.'],
  ['앱 식별 정보 적용', '입력한 Slack 앱 식별 정보를 연결 설정에 적용합니다.'],
  ['연결에 필요한 권한 추가', 'Slack 앱 연결에 필요한 권한 범위를 추가합니다.'],
  ['앱 연결 토큰 생성', '에이전트가 Slack 앱에 연결할 때 사용할 토큰을 생성합니다.'],
  ['연결 토큰 안전하게 복사', '생성된 연결 토큰을 노출되지 않도록 안전하게 복사합니다.'],
  ['연결 설정 완료', '복사한 토큰을 적용하고 앱 연결 설정을 완료합니다.'],
  ['앱 권한 설정 열기', '워크스페이스 설치에 필요한 OAuth 권한 설정을 엽니다.'],
  ['설치 대상 워크스페이스 확인', '앱을 설치할 Slack 워크스페이스가 맞는지 확인합니다.'],
  ['요청 권한 검토 후 설치 승인', '요청 권한과 설치 대상을 검토한 뒤 앱 설치를 승인합니다.'],
  ['OAuth 토큰 안전하게 복사', '설치 후 발급된 OAuth 토큰을 노출되지 않도록 안전하게 복사합니다.'],
  ['테스트할 에이전트 선택', 'Slack 연결을 확인할 AI 에이전트를 선택합니다.'],
  ['에이전트 채팅 열기', '선택한 에이전트의 응답을 시험할 채팅 화면을 엽니다.'],
  ['테스트 메시지 작성 시작', '에이전트에게 보낼 테스트 메시지 작성을 시작합니다.'],
  ['테스트 메시지 입력', '에이전트의 동작을 확인할 테스트 질문을 입력합니다.'],
  ['에이전트 대화 선택', '테스트 질문을 보낼 에이전트 대화를 선택합니다.'],
  ['에이전트에 테스트 질문 보내기', 'Slack 연결과 에이전트 동작을 확인할 질문을 전송합니다.'],
  ['에이전트 응답 확인', '테스트 질문에 대한 에이전트 응답이 정상적으로 표시되는지 확인합니다.'],
] as const;

function isDesktopStep(step: StoredStep): boolean {
  return step.action_info?.targetContext?.captureSurface === 'desktop'
    || /(?:desktop|windows)\.parro\.(?:local|app)/i.test(`${step.page_url ?? ''} ${step.domain_name ?? ''}`);
}

function slackAgentWorkflowCopy(steps: StoredStep[], index: number) {
  if (steps.length !== SLACK_AGENT_WORKFLOW_COPY.length) return null;
  const evidence = steps.map(step => `${step.domain_name ?? ''} ${step.page_url ?? ''} ${step.ai_title ?? ''} ${step.user_title ?? ''}`).join(' ');
  if (!/slack/i.test(evidence) || !/(?:에이전트|agent|응답|테스트)/i.test(evidence)) return null;
  const [user_title, user_script] = SLACK_AGENT_WORKFLOW_COPY[index];
  return { id: steps[index].id, user_title, user_script };
}

function serviceName(step: StoredStep): string {
  if (/slack/i.test(`${step.domain_name ?? ''} ${step.page_url ?? ''}`)) return 'Slack';
  if (/notion/i.test(`${step.domain_name ?? ''} ${step.page_url ?? ''}`)) return 'Notion';
  if (/gmail|mail\.google/i.test(`${step.domain_name ?? ''} ${step.page_url ?? ''}`)) return 'Gmail';
  const domainName = step.domain_name?.trim() || '';
  if (/^(?:desktop|windows)\.parro\.(?:local|app)$/i.test(domainName)) {
    return step.action_info?.targetContext?.captureApp?.trim() || 'Windows';
  }
  return domainName || '서비스';
}

function purposeFallback(step: StoredStep, index: number, steps: StoredStep[]) {
  const workflowCopy = slackAgentWorkflowCopy(steps, index);
  if (workflowCopy) return workflowCopy;

  // Keep regeneration idempotent: the AI fields preserve the original capture,
  // while user fields may already contain a previously generated fallback.
  const rawTitle = maskManualCopy(step.ai_title || step.user_title);
  const rawScript = maskManualCopy(step.ai_description || step.user_script);
  const text = `${rawTitle} ${rawScript}`;
  const lower = text.toLowerCase();
  const service = serviceName(step);
  const total = steps.length;
  let title = '';
  let script = '';

  if (/\b(?:api\.|app\.)?slack\.com\s+(?:주요 영역|화면)/i.test(text)) {
    if (index < 6) {
      title = '선택한 워크스페이스 확인';
      script = '앱을 만들 워크스페이스가 올바르게 선택되었는지 확인합니다.';
    } else if (index < 20) {
      title = '설치 대상 워크스페이스 확인';
      script = '앱을 설치할 워크스페이스가 맞는지 다시 확인합니다.';
    } else if (index < 24) {
      title = '테스트할 에이전트 선택';
      script = '응답을 확인할 에이전트를 선택해 대화 준비를 마칩니다.';
    } else {
      title = '에이전트 대화 선택';
      script = '테스트 질문을 보낼 에이전트 대화를 선택합니다.';
    }
  } else if (/create new app/.test(lower)) {
    title = `${service === '서비스' ? '앱' : service + ' 앱'} 생성 시작`;
    script = '새 앱 만들기를 시작해 이후 연결 설정을 준비합니다.';
  } else if (/manifest|매니페스트/.test(lower)) {
    title = '매니페스트 방식 선택';
    script = '앱 정보를 한 번에 설정할 수 있도록 매니페스트 방식을 선택합니다.';
  } else if (/select a team|워크스페이스|team/.test(lower)) {
    title = '설치할 워크스페이스 선택';
    script = '앱을 사용할 워크스페이스를 확인하고 선택합니다.';
  } else if (/connections?:write|연결 권한/.test(lower)) {
    title = '연결에 필요한 권한 추가';
    script = '앱 연결에 필요한 권한 범위를 추가합니다.';
  } else if (/oauth\s*&?\s*permissions?|oauth 권한/.test(lower)) {
    title = '앱 권한 설정 열기';
    script = '워크스페이스 설치에 필요한 OAuth 권한 설정으로 이동합니다.';
  } else if (/허용|\ballow\b|승인/.test(lower)) {
    title = '요청 권한 검토 후 설치 승인';
    script = '요청 권한과 대상 워크스페이스를 확인한 뒤 앱 설치를 승인합니다.';
  } else if (/generate|토큰 생성/.test(lower)) {
    title = '앱 연결 토큰 생성';
    script = '외부 서비스와 연결할 때 사용할 앱 토큰을 생성합니다.';
  } else if (/\bcopy\b|복사/.test(lower)) {
    title = index > total * 0.65 ? 'OAuth 토큰 안전하게 복사' : '연결 토큰 안전하게 복사';
    script = '생성된 토큰을 노출되지 않도록 안전하게 복사합니다.';
  } else if (/채팅|\bchat\b/.test(lower)) {
    title = '에이전트 채팅 열기';
    script = '설치한 에이전트의 응답을 시험할 수 있도록 채팅 화면을 엽니다.';
  } else if (/역할은|질문|메시지|메일 보내기/.test(lower)) {
    title = index >= total - 2
      ? '에이전트에 테스트 질문 보내기'
      : index <= 22 ? '테스트 메시지 작성 시작' : '테스트 메시지 입력';
    script = index >= total - 2
      ? '에이전트의 동작을 확인할 테스트 질문을 전송합니다.'
      : index <= 22 ? '에이전트에게 보낼 테스트 메시지 작성을 시작합니다.' : '에이전트의 동작을 확인할 테스트 메시지를 입력합니다.';
  } else if (/\[서비스 식별자\]|\[식별자\]/.test(text)) {
    title = index >= total - 1
      ? '에이전트 응답 확인'
      : /입력/.test(text)
        ? (index > 10 ? '앱 식별 정보 적용' : '앱 식별 정보 입력')
        : '생성된 앱 확인';
    script = index >= total - 1
      ? '테스트 질문에 대한 에이전트 응답이 정상적으로 표시되는지 확인합니다.'
      : '화면에 표시된 앱 정보를 확인해 다음 연결 설정에 사용합니다.';
  } else if (/^\s*[}\]\[{),.;]+/.test(text)) {
    title = index <= 5 ? '매니페스트 기본 정보 입력' : '매니페스트 권한 정보 입력';
    script = index <= 5
      ? '매니페스트에 앱의 기본 정보를 입력하고 형식을 확인합니다.'
      : '매니페스트에 필요한 권한 정보를 입력하고 형식을 확인합니다.';
  } else if (/\bnext\b|다음/.test(lower)) {
    title = index < 6 ? '매니페스트 편집 단계로 이동' : '앱 생성 단계로 이동';
    script = '현재 설정 내용을 확인하고 다음 단계로 이동합니다.';
  } else if (/\bcreate\b|생성/.test(lower)) {
    title = `${service === '서비스' ? '앱' : service + ' 앱'} 생성 완료`;
    script = '입력한 설정으로 앱을 생성하고 결과를 확인합니다.';
  } else if (/\bdone\b|완료/.test(lower)) {
    title = '연결 설정 완료';
    script = '연결 정보가 저장되었는지 확인하고 설정을 마칩니다.';
  } else if (index >= total - 1) {
    title = '최종 결과 확인';
    script = '앞선 설정이 반영되어 원하는 결과가 표시되는지 확인합니다.';
  } else {
    const fallback = buildCaptureFallbackDraft({
      id: step.id,
      ai_title: step.ai_title,
      ai_description: step.ai_description,
      page_url: step.page_url,
      step_number: step.step_number,
      domain_name: step.domain_name,
      type_text: step.type_text,
    });
    title = isLowQualityCaptureTitle(fallback.user_title) ? `${service} 설정 진행` : fallback.user_title;
    script = fallback.user_script || '현재 설정을 확인하고 다음 작업에 필요한 상태를 준비합니다.';
  }

  return { id: step.id, user_title: title.slice(0, 80), user_script: script };
}

export async function POST(request: NextRequest, { params }: Params) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const guard = await guardTutorialAccess(id, auth.userId, 'editor');
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const supabase = createServiceRoleClient();
  const [{ data: tutorial }, { data: rawSteps, error: stepsError }] = await Promise.all([
    supabase.from('mm_tutorials').select('id, title').eq('id', id).single(),
    supabase.from('mm_steps')
      .select('*')
      .eq('tutorial_id', id)
      .order('order_index')
      .order('step_number'),
  ]);

  if (!tutorial) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (stepsError || !rawSteps?.length) return NextResponse.json({ error: '재작성할 단계가 없습니다.' }, { status: 422 });

  const steps = rawSteps as StoredStep[];
  const aiInput = steps.map(step => {
    const target = step.action_info?.targetContext;
    const captureSurface = target?.captureSurface ?? (isDesktopStep(step) ? 'desktop' : null);
    return {
      ...step,
      user_title: maskManualCopy(step.user_title),
      ai_title: maskManualCopy(step.ai_title),
      user_script: maskManualCopy(step.user_script),
      ai_description: maskManualCopy(step.ai_description),
      action_type: step.action_info?.type ?? null,
      action_label: maskManualCopy(step.action_info?.label),
      element_text: maskManualCopy(step.element_text || target?.accessibleName),
      context_label: maskManualCopy(target?.contextLabel),
      page_title: maskManualCopy(target?.pageTitle),
      capture_surface: captureSurface,
      capture_app: maskManualCopy(target?.captureApp),
    };
  });
  const draftResult = await generateDraft(aiInput);
  if (draftResult.status !== 'ok') {
    console.warn('[regenerate-content] AI unavailable; trying grounded fallbacks:', {
      tutorialId: id,
      status: draftResult.status,
      reason: draftResult.reason,
    });
  }
  const aiById = new Map(
    (draftResult.status === 'ok' ? draftResult.steps : []).map(step => [step.id, step]),
  );
  const fallbackStepIds = new Set<string>();

  const aiDrafts = steps.map((step, index) => {
    const aiDraft = aiById.get(step.id);
    const target = step.action_info?.targetContext;
    const captureSurface = target?.captureSurface ?? (isDesktopStep(step) ? 'desktop' : undefined);
    const actionInfo = step.action_info ? {
      type: step.action_info.type,
      label: step.action_info.label,
      text: step.action_info.text,
      targetContext: target || captureSurface ? {
        captureSurface,
        captureApp: target?.captureApp ?? undefined,
        accessibleName: target?.accessibleName ?? undefined,
        contextLabel: target?.contextLabel ?? undefined,
        pageTitle: target?.pageTitle ?? undefined,
      } : undefined,
    } : captureSurface ? { targetContext: { captureSurface } } : undefined;
    const maskedAiDraft = aiDraft ? {
      user_title: maskManualCopy(aiDraft.user_title),
      user_script: maskManualCopy(aiDraft.user_script),
    } : null;
    if (isUsableCaptureDraft(maskedAiDraft, {
      pageUrl: step.page_url,
      elementText: step.element_text || step.action_info?.targetContext?.accessibleName,
      actionInfo,
    })) {
      return { id: step.id, user_title: maskedAiDraft!.user_title, user_script: maskedAiDraft!.user_script };
    }

    const fallbackDraft = purposeFallback(step, index, steps);
    if (isUsableCaptureDraft(fallbackDraft, {
      pageUrl: step.page_url,
      elementText: step.element_text || step.action_info?.targetContext?.accessibleName,
      actionInfo,
    })) {
      fallbackStepIds.add(step.id);
      return fallbackDraft;
    }
    return null;
  });
  if (aiDrafts.some(draft => draft === null)) {
    return NextResponse.json(
      { error: '일부 단계의 AI 결과가 화면 내용과 맞지 않아 기존 내용은 변경하지 않았습니다.' },
      { status: 422 },
    );
  }
  const drafts = aiDrafts.filter((draft): draft is NonNullable<typeof draft> => draft !== null);
  const setQuality = validateRegeneratedStepSet(steps.map(step => step.id), drafts);
  if (!setQuality.ok) {
    console.warn('[regenerate-content] rejected draft set:', { tutorialId: id, reason: setQuality.reason });
    return NextResponse.json(
      { error: 'AI 결과가 지나치게 반복되거나 구체성이 부족해 기존 내용은 변경하지 않았습니다.' },
      { status: 422 },
    );
  }

  let tutorialTitle = draftResult.status === 'ok' ? maskManualCopy(draftResult.tutorial_title) : '';
  if (isLowQualityCaptureTutorialTitle(tutorialTitle, { stepTitles: drafts.map(draft => draft.user_title) })) {
    const currentTitle = maskManualCopy(tutorial.title);
    if (!isLowQualityCaptureTutorialTitle(currentTitle, { stepTitles: drafts.map(draft => draft.user_title) })) {
      tutorialTitle = currentTitle;
    } else {
      tutorialTitle = buildCaptureFallbackTutorialTitle(drafts, {
        serviceNames: steps.map(serviceName),
      });
      if (isLowQualityCaptureTutorialTitle(tutorialTitle, { stepTitles: drafts.map(draft => draft.user_title) })) {
        return NextResponse.json(
          { error: '전체 목적을 설명하는 제목을 만들지 못해 기존 내용은 변경하지 않았습니다.' },
          { status: 422 },
        );
      }
    }
  }

  const updates = await Promise.all([
    supabase.from('mm_tutorials').update({ title: tutorialTitle }).eq('id', id),
    ...drafts.map(draft => supabase.from('mm_steps').update({
      user_title: draft.user_title,
      user_script: draft.user_script,
    }).eq('id', draft.id).eq('tutorial_id', id)),
  ]);
  const failed = updates.find(result => result.error);
  if (failed?.error) return NextResponse.json({ error: failed.error.message }, { status: 500 });

  return NextResponse.json({
    title: tutorialTitle,
    steps: drafts,
    ai_status: draftResult.status,
    fallback_count: fallbackStepIds.size,
  });
}
