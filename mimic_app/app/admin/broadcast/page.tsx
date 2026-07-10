'use client';

import { useState, useEffect } from 'react';
import { BRAND_NAME } from '@/lib/brand';

export default function BroadcastPage() {
  const [consenting, setConsenting] = useState<number | null>(null);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState<'test' | 'all' | null>(null);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  useEffect(() => {
    fetch('/api/admin/broadcast')
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (d) setConsenting(d.consenting ?? 0); })
      .catch(() => {});
  }, []);

  const send = async (test: boolean) => {
    if (!subject.trim() || !body.trim()) { setResult({ ok: false, msg: '제목과 본문을 입력하세요.' }); return; }
    if (!test) {
      if (!confirm(`수신 동의자 ${consenting ?? '?'}명에게 발송합니다. 계속할까요?`)) return;
    }
    setSending(test ? 'test' : 'all');
    setResult(null);
    try {
      const res = await fetch('/api/admin/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject: subject.trim(), body, test }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setResult({ ok: false, msg: d.error ?? '발송 실패' }); return; }
      if (d.test) setResult({ ok: true, msg: `미리보기 1통을 ${d.to}로 보냈어요.` });
      else setResult({ ok: true, msg: `발송 완료 — 대상 ${d.total}명 / 성공 ${d.sent} / 실패 ${d.failed}` });
    } catch {
      setResult({ ok: false, msg: '네트워크 오류가 발생했어요.' });
    } finally {
      setSending(null);
    }
  };

  const inputStyle: React.CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '11px 13px', borderRadius: '9px', border: '1px solid #E2E8F0', fontSize: '14px', color: '#111827', outline: 'none', fontFamily: 'inherit', background: 'white' };

  return (
    <div style={{ padding: '28px 32px', maxWidth: '720px' }}>
      <h1 style={{ fontSize: '20px', fontWeight: 700, margin: '0 0 4px' }}>소식 발송</h1>
      <p style={{ fontSize: '13px', color: '#64748B', margin: '0 0 22px' }}>
        이메일 수신에 동의한 회원에게 업데이트·소식을 보냅니다.
        {consenting !== null && <> 현재 수신 동의자 <b style={{ color: '#009B8E' }}>{consenting}명</b>.</>}
      </p>

      <div style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: '14px', padding: '22px' }}>
        <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>제목</label>
        <input value={subject} onChange={e => { setSubject(e.target.value); setResult(null); }} placeholder={`예: ${BRAND_NAME} 6월 업데이트 — 라이브 가이드 Beta 자동입력 출시`} style={{ ...inputStyle, marginBottom: '16px' }} maxLength={200} />

        <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>본문</label>
        <textarea value={body} onChange={e => { setBody(e.target.value); setResult(null); }} rows={12}
          placeholder={'평문으로 작성하세요. 빈 줄로 문단을 나눕니다.\n링크/뉴스 기사 주소를 그대로 붙여넣어도 됩니다.\n\n(브랜드 템플릿으로 자동 감싸서 발송됩니다 — HTML 몰라도 됩니다.)'}
          style={{ ...inputStyle, lineHeight: 1.6, resize: 'vertical' }} maxLength={50000} />
        <p style={{ fontSize: '11.5px', color: '#94A3B8', margin: '8px 0 0' }}>빈 줄 = 문단 구분. {BRAND_NAME} 브랜드 템플릿으로 감싸 발송하며, 푸터에 수신거부 안내가 자동 포함됩니다.</p>

        <div style={{ display: 'flex', gap: '10px', marginTop: '20px', alignItems: 'center' }}>
          <button onClick={() => send(true)} disabled={!!sending}
            style={{ padding: '10px 16px', borderRadius: '9px', border: '1px solid #DDE7E4', background: 'white', color: '#009B8E', fontSize: '13px', fontWeight: 600, cursor: sending ? 'not-allowed' : 'pointer' }}>
            {sending === 'test' ? '발송 중…' : '나에게 미리보기'}
          </button>
          <button onClick={() => send(false)} disabled={!!sending}
            style={{ padding: '10px 18px', borderRadius: '9px', border: 'none', background: 'linear-gradient(135deg,#009B8E,#12B886)', color: 'white', fontSize: '13px', fontWeight: 700, cursor: sending ? 'not-allowed' : 'pointer', opacity: sending ? 0.7 : 1 }}>
            {sending === 'all' ? '발송 중…' : `동의자 전체 발송${consenting !== null ? ` (${consenting})` : ''}`}
          </button>
          {result && (
            <span style={{ fontSize: '12.5px', color: result.ok ? '#10B981' : '#EF4444', marginLeft: '4px' }}>
              {result.ok ? '✓' : '✕'} {result.msg}
            </span>
          )}
        </div>
      </div>

      <p style={{ fontSize: '11.5px', color: '#94A3B8', marginTop: '14px', lineHeight: 1.6 }}>
        ⚠️ Gmail 발송 한도(개인 ~500/일)에 유의하세요. 대량 발송 시 일부가 스팸 분류될 수 있습니다.
      </p>
    </div>
  );
}
