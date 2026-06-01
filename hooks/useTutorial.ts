'use client';

import { useState, useEffect, useCallback } from 'react';
import { getTutorial, updateTutorial, publishTutorial, unpublishTutorial } from '@/lib/api/tutorials';
import type { TutorialDetail, Tutorial } from '@/types';

type TutorialState = {
  tutorial: TutorialDetail | null;
  loading: boolean;
  error: string | null;
  update: (patch: Partial<Tutorial>) => Promise<void>;
  publish: () => Promise<{ share_token: string; share_url: string }>;
  unpublish: () => Promise<void>;
};

export function useTutorial(id: string): TutorialState {
  const [tutorial, setTutorial] = useState<TutorialDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    getTutorial(id)
      .then(data => { if (!cancelled) { setTutorial(data); setLoading(false); } })
      .catch(e => { if (!cancelled) { setError(e.message); setLoading(false); } });
    return () => { cancelled = true; };
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

  const unpublish = useCallback(async () => {
    await unpublishTutorial(id);
    setTutorial(prev => prev ? { ...prev, status: 'draft', visibility: 'private', share_token: null, published_at: null } : prev);
  }, [id]);

  return { tutorial, loading, error, update, publish, unpublish };
}
