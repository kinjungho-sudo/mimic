'use client';

import { useState, useEffect, useCallback } from 'react';
import { getTutorials, deleteTutorial } from '@/lib/api/tutorials';
import type { Tutorial } from '@/types';

type TutorialsState = {
  tutorials: Tutorial[];
  loading: boolean;
  error: string | null;
  remove: (id: string) => Promise<void>;
  refresh: () => void;
};

export function useTutorials(enabled = true): TutorialsState {
  const [tutorials, setTutorials] = useState<Tutorial[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!enabled) { setLoading(false); return; }
    setLoading(true);
    getTutorials()
      .then(data => { setTutorials(data); })
      .catch(e => { setError(e.message); })
      .finally(() => { setLoading(false); });
  }, [tick, enabled]);

  const remove = useCallback(async (id: string) => {
    await deleteTutorial(id);
    setTutorials(prev => prev.filter(t => t.id !== id));
  }, []);

  const refresh = useCallback(() => setTick(t => t + 1), []);

  return { tutorials, loading, error, remove, refresh };
}
