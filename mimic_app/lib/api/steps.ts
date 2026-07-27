async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? `API error ${res.status}`);
  }
  if (res.status === 204) return undefined as T; // DELETE 등 빈 응답 — json() 호출 시 throw 방지
  return res.json();
}

import type { FollowConfig } from '@/types';

type StepTargetPatch = {
  page_url?: string | null;
  element_selector?: string | null;
  element_xpath?: string | null;
  element_rect?: { x: number; y: number; width: number; height: number } | null;
  target_context?: Record<string, unknown> | null;
  click_x?: number | null;
  click_y?: number | null;
};

export async function updateStep(
  id: string,
  patch: { user_title?: string | null; user_script?: string | null; title_font_size?: number | null; user_annotations?: unknown; image_zoom?: number | null; image_offset_x?: number | null; image_offset_y?: number | null; domain_name?: string | null; domain_hostname?: string | null; follow_config?: FollowConfig | null } & StepTargetPatch
): Promise<void> {
  await apiFetch(`/api/steps/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

export async function createStep(
  tutorialId: string,
  orderIndex: number,
  stepNumber: number
): Promise<{ id: string; step_number: number }> {
  return apiFetch(`/api/steps`, {
    method: 'POST',
    body: JSON.stringify({ tutorial_id: tutorialId, order_index: orderIndex, step_number: stepNumber }),
  });
}

export async function deleteStep(id: string): Promise<void> {
  await apiFetch(`/api/steps/${id}`, { method: 'DELETE' });
}

export async function duplicateStep(
  id: string
): Promise<{ id: string; step_number: number; order_index: number }> {
  return apiFetch(`/api/steps/${id}/duplicate`, { method: 'POST' });
}

export async function reorderSteps(
  tutorialId: string,
  order: Array<{ id: string; order_index: number }>
): Promise<void> {
  await apiFetch(`/api/steps`, {
    method: 'PATCH',
    body: JSON.stringify({ tutorial_id: tutorialId, order }),
  });
}
