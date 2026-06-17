'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { getCurrentUser, signOut } from '@/lib/auth/auth-client';
import type { User } from '@/types';

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

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (cancelled) return;

      if (event === 'INITIAL_SESSION') {
        if (session?.user) {
          setUser({ id: session.user.id, email: session.user.email ?? '' } as User);
          setLoading(false);
          getCurrentUser().then(u => {
            if (!cancelled && u) setUser(u);
          }).catch(() => {});
        } else {
          setUser(null);
          setLoading(false);
        }
      } else if (event === 'SIGNED_IN') {
        // 로그인 직후에만 DB 프로필 로드 (TOKEN_REFRESHED로 인한 재발화 무시)
        if (session?.user) {
          setLoading(false);
          getCurrentUser().then(u => {
            if (!cancelled && u) setUser(u);
          }).catch(() => {});
        }
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setLoading(false);
      }
      // TOKEN_REFRESHED, USER_UPDATED 등은 무시 — user state 불필요한 갱신 방지
    });

    // 안전망: 4초 후에도 loading 중이면 강제 해제
    const fallback = setTimeout(() => {
      if (!cancelled) setLoading(false);
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
