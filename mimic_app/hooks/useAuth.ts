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

    const applySession = (session: Session | null) => {
      if (cancelled) return;

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

    const fallback = setTimeout(() => {
      supabase.auth.getSession()
        .then(({ data: { session } }) => applySession(session))
        .catch(() => {
          if (!cancelled) {
            setUser(null);
            setLoading(false);
          }
        });
    }, 4000);

    return () => {
      cancelled = true;
      clearTimeout(fallback);
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
