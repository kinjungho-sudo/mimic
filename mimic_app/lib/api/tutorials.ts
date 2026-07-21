import type { Tutorial, TutorialDetail } from '@/types';
import type { ManualQualityIssue } from '@/lib/manual-quality';

export class TutorialApiError extends Error {
  status: number;
  issues: ManualQualityIssue[];

  constructor(message: string, status: number, issues: ManualQualityIssue[] = []) {
    super(message);
    this.name = 'TutorialApiError';
    this.status = status;
    this.issues = issues;
  }
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new TutorialApiError(
      err.error ?? `API error ${res.status}`,
      res.status,
      Array.isArray(err.issues) ? err.issues : [],
    );
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export async function getTutorials(): Promise<Tutorial[]> {
  return apiFetch<Tutorial[]>('/api/tutorials');
}

export async function createTutorial(options?: { workspace_id?: string | null }): Promise<Tutorial> {
  return apiFetch<Tutorial>('/api/tutorials', {
    method: 'POST',
    body: options?.workspace_id ? JSON.stringify({ workspace_id: options.workspace_id }) : undefined,
  });
}

export async function getTutorial(id: string): Promise<TutorialDetail> {
  return apiFetch<TutorialDetail>(`/api/tutorials/${id}`);
}

export async function updateTutorial(id: string, patch: Partial<Tutorial>): Promise<Tutorial> {
  return apiFetch<Tutorial>(`/api/tutorials/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

export async function deleteTutorial(id: string): Promise<void> {
  return apiFetch<void>(`/api/tutorials/${id}`, { method: 'DELETE' });
}

export async function publishTutorial(
  id: string
): Promise<{ share_token: string; share_url: string }> {
  return apiFetch(`/api/tutorials/${id}/publish`, { method: 'POST' });
}

export async function unpublishTutorial(id: string): Promise<void> {
  return apiFetch(`/api/tutorials/${id}/unpublish`, { method: 'POST' });
}

export async function getPublicTutorial(token: string): Promise<TutorialDetail> {
  return apiFetch<TutorialDetail>(`/api/play/${token}`);
}
