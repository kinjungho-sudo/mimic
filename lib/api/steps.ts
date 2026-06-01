async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? `API error ${res.status}`);
  }
  return res.json();
}

export async function updateStep(
  id: string,
  patch: { user_title?: string | null; user_script?: string | null; user_annotations?: unknown }
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

export async function reorderSteps(
  tutorialId: string,
  order: Array<{ id: string; order_index: number }>
): Promise<void> {
  await apiFetch(`/api/steps`, {
    method: 'PATCH',
    body: JSON.stringify({ tutorial_id: tutorialId, order }),
  });
}
