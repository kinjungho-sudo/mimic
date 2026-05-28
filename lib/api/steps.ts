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
  patch: { user_title?: string | null; user_script?: string | null }
): Promise<void> {
  await apiFetch(`/api/steps/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}
