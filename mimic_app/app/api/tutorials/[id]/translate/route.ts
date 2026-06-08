import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-guard';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { z } from 'zod';
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SUPPORTED_LANGS: Record<string, string> = {
  'en':    'English',
  'ja':    '日本語',
  'zh-CN': '简体中文',
  'es':    'Español',
  'fr':    'Français',
  'de':    'Deutsch',
  'vi':    'Tiếng Việt',
  'th':    'ภาษาไทย',
  'id':    'Bahasa Indonesia',
};

const schema = z.object({
  lang: z.string().refine(l => l in SUPPORTED_LANGS, { message: 'Unsupported language' }),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { lang } = parsed.data;
  const supabase = createServiceRoleClient();

  // 소유권 확인
  const { data: tutorial } = await supabase
    .from('mm_tutorials')
    .select('id')
    .eq('id', id)
    .eq('user_id', auth.userId)
    .single();
  if (!tutorial) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // 스텝 조회
  const { data: steps } = await supabase
    .from('mm_steps')
    .select('id, user_title, ai_title, user_script, ai_description')
    .eq('tutorial_id', id)
    .order('step_number');

  if (!steps || steps.length === 0) {
    return NextResponse.json({ translated: 0 });
  }

  // 이미 번역된 스텝 확인 (캐시 히트)
  const { data: existing } = await supabase
    .from('mm_step_translations')
    .select('step_id')
    .eq('lang', lang)
    .in('step_id', steps.map(s => s.id));

  const existingIds = new Set((existing ?? []).map(e => e.step_id));
  const toTranslate = steps.filter(s => !existingIds.has(s.id));

  if (toTranslate.length === 0) {
    return NextResponse.json({ translated: 0, cached: steps.length });
  }

  // Claude로 일괄 번역
  const stepsText = toTranslate
    .map(s => `[${s.id}]\ntitle: ${s.user_title ?? s.ai_title ?? ''}\nscript: ${s.user_script ?? s.ai_description ?? ''}`)
    .join('\n\n');

  const langName = SUPPORTED_LANGS[lang];
  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 4096,
    messages: [{
      role: 'user',
      content: `다음 매뉴얼 단계들을 ${langName}(${lang})로 번역해줘. 각 단계의 id를 그대로 유지하고, 자연스럽고 전문적인 어투로 번역해줘.

${stepsText}

JSON만 응답 (마크다운 없이):
{
  "steps": [
    { "id": "uuid", "title": "번역된 제목", "script": "번역된 스크립트" }
  ]
}`,
    }],
  });

  const rawText = response.content[0].type === 'text' ? response.content[0].text.trim() : '{}';
  let translated: Array<{ id: string; title: string; script: string }> = [];
  try {
    const clean = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    const parsedJson = JSON.parse(clean);
    translated = Array.isArray(parsedJson.steps) ? parsedJson.steps : [];
  } catch {
    return NextResponse.json({ error: 'Translation parsing failed' }, { status: 500 });
  }

  // 허용된 step_id만 upsert
  const allowedIds = new Set(steps.map(s => s.id));
  const rows = translated
    .filter(t => allowedIds.has(t.id))
    .map(t => ({ step_id: t.id, lang, title: t.title, script: t.script }));

  if (rows.length > 0) {
    await supabase
      .from('mm_step_translations')
      .upsert(rows, { onConflict: 'step_id,lang' });
  }

  return NextResponse.json({ translated: rows.length, cached: existingIds.size });
}

// GET — 번역 결과 조회 (뷰어에서 언어 변경 시 호출)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const lang = request.nextUrl.searchParams.get('lang');
  if (!lang || !(lang in SUPPORTED_LANGS)) {
    return NextResponse.json({ error: 'lang parameter required' }, { status: 400 });
  }

  const supabase = createServiceRoleClient();

  const { data: steps } = await supabase
    .from('mm_steps')
    .select('id')
    .eq('tutorial_id', id);

  if (!steps || steps.length === 0) return NextResponse.json([]);

  const { data: translations } = await supabase
    .from('mm_step_translations')
    .select('step_id, title, script')
    .eq('lang', lang)
    .in('step_id', steps.map(s => s.id));

  return NextResponse.json(translations ?? []);
}
