import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/dashboard';

  if (code) {
    const supabase = await createServerClient();
    const { data: sessionData, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const user = sessionData?.user ?? null;
      if (!user) return NextResponse.redirect(`${origin}/auth/login?error=oauth_callback_failed`);

      const service = createServiceRoleClient();
      const meta = user.user_metadata ?? {};

      const { data: existing } = await service
        .from('mm_users')
        .select('id')
        .eq('id', user.id)
        .single();

      if (!existing) {
        await service.from('mm_users').insert({
          id: user.id,
          email: user.email ?? null,
          name: meta.full_name ?? meta.name ?? null,
          avatar_url: meta.avatar_url ?? meta.picture ?? null,
          auth_provider: 'google',
          plan: 'free',
          agreements: {
            age14: true,
            terms: true,
            privacy: true,
            marketing: false,
            agreed_at: new Date().toISOString(),
          },
        });
      } else {
        // 기존 Google 유저: auth_provider/avatar 최신화
        await service.from('mm_users').update({
          auth_provider: 'google',
          avatar_url: meta.avatar_url ?? meta.picture ?? null,
        }).eq('id', user.id);
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/auth/login?error=oauth_callback_failed`);
}
