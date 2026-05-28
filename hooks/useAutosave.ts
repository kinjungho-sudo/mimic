'use client';

import { useEffect, useRef, useState } from 'react';
import { updateTutorial } from '@/lib/api/tutorials';
import type { Tutorial } from '@/types';

type AutosaveState = {
  saving: boolean;
  lastSaved: Date | null;
  error: string | null;
};

export function useAutosave(
  id: string,
  patch: Partial<Tutorial> | null,
  delay = 500
): AutosaveState {
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const patchRef = useRef(patch);
  patchRef.current = patch;

  useEffect(() => {
    if (!id || !patch || Object.keys(patch).length === 0) return;

    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(async () => {
      if (!patchRef.current) return;
      setSaving(true);
      setError(null);
      try {
        await updateTutorial(id, patchRef.current);
        setLastSaved(new Date());
      } catch (e) {
        setError(e instanceof Error ? e.message : '저장 실패');
      } finally {
        setSaving(false);
      }
    }, delay);

    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  // patch 객체 참조 변경 시만 트리거 — id/delay는 deps에 포함
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, delay, JSON.stringify(patch)]);

  return { saving, lastSaved, error };
}
