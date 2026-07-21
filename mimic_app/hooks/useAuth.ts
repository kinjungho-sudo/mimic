'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { getCurrentUser, signOut } from '@/lib/auth/auth-client';
import type { User } from '@/types';
import type { Session } from '@supabase/supabase-js';

type AuthState = {
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
  updateUser: (patch: Partial<User>) => void;
};

export function useAuth(): AuthState {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;
    let appliedUserId: string | null | undefined;

    const applySession = (session: Session | null) => {
      if (cancelled) return;

      const nextUserId = session?.user?.id ?? null;
      if (appliedUserId === nextUserId) return;
      appliedUserId = nextUserId;

      if (!session?.user) {
        setUser(null);
        setLoading(false);
        return;
      }

      const authUser = { id: session.user.id, email: session.user.email ?? '' } as User;
      setUser(authUser);
      setLoading(false);

      getCurrentUser().then(profile => {
        if (!cancelled) setUser(profile ?? authUser);
      }).catch(() => {
        if (!cancelled) setUser(authUser);
      });
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN') {
        applySession(session);
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setLoading(false);
      }
    });

    // 세션은 브라우저 저장소에서 읽을 수 있으므로 INITIAL_SESSION 이벤트를
    // 오래 기다리지 않고 즉시 복원한다. 동일 세션은 applySession에서 중복 처리하지 않는다.
    void supabase.auth.getSession()
      .then(({ data: { session } }) => applySession(session))
      .catch(() => {
        if (!cancelled) {
          setUser(null);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  return {
    user,
    loading,
    signOut: async () => {
      await signOut();
      setUser(null);
    },
    updateUser: (patch: Partial<User>) => {
      setUser(prev => prev ? { ...prev, ...patch } : prev);
    },
  };
}
