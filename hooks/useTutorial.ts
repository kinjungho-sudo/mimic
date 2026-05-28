'use client';

import { useState, useEffect, useCallback } from 'react';
import { getTutorial, updateTutorial, publishTutorial } from '@/lib/api/tutorials';
import type { TutorialDetail, Tutorial } from '@/types';

type TutorialState = {
  tutorial: TutorialDetail | null;
  loading: boolean;
  error: string | null;
  update: (patch: Partial<Tutorial>) => Promise<void>;
  publish: () => Promise<{ share_token: string; share_url: string }>;
};

export function useTutorial(id: string): TutorialState {
  const [tutorial, setTutorial] = useState<TutorialDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    getTutorial(id)
      .then(data => { setTutorial(data); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, [id]);

  const update = useCallback(async (patch: Partial<Tutorial>) => {
    if (!tutorial) return;
    const updated = await updateTutorial(id, patch);
    setTutorial(prev => prev ? { ...prev, ...updated } : prev);
  }, [id, tutorial]);

  const publish = useCallback(async () => {
    const result = await publishTutorial(id);
    setTutorial(prev => prev ? { ...prev, status: 'published', share_token: result.share_token } : prev);
    return result;
  }, [id]);

  return { tutorial, loading, error, update, publish };
}
