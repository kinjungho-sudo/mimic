
with open(r'c:\Users\ADMIN\Desktop\Project\Dev\mimic\app\landingpage\page.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# before: 1~315줄 (index 0~314) — Scene0 return 직전까지
# after: HeroSection 함수부터 끝 (index 636~)
# 636번째 줄(1-indexed) = index 635
before = lines[:315]
after_start = None
for i, line in enumerate(lines):
    if 'function HeroSection()' in line:
        after_start = i
        break
after = lines[after_start:]

new_scenes = r"""    return (
      <div style={{ width: '100%', height: '100%', background: '#F7F7F5', position: 'relative', display: 'grid', gridTemplateColumns: '160px 1fr' }}>
        <div style={{ background: '#F7F7F5', borderRight: '1px solid #E5E7EB', padding: '12px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px 10px' }}>
            <div style={{ width: '18px', height: '18px', borderRadius: '4px', background: '#191919' }} />
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#191919' }}>내 노션</span>
          </div>
          {['홈','받은편지함','즐겨찾기','워크스페이스','설정'].map((t, i) => (
            <div key={t} style={{ padding: '5px 12px', fontSize: '11.5px', color: i === 2 ? '#191919' : '#9B9B9B', fontWeight: i === 2 ? 500 : 400 }}>{t}</div>
          ))}
        </div>
        <div style={{ padding: '22px 26px', position: 'relative' }}>
          <div style={{ fontSize: '19px', fontWeight: 700, color: '#191919', marginBottom: '4px' }}>프로젝트 관리</div>
          <div style={{ fontSize: '11.5px', color: '#B5B5B5', marginBottom: '18px' }}>2025년 6월 · 팀 공유</div>
          {[95, 75, 88, 60, 72].map((w, i) => (
            <div key={i} style={{ height: '9px', background: '#EBEBEA', borderRadius: '3px', width: `${w}%`, marginBottom: '8px' }} />
          ))}
          <div style={{ display: 'flex', gap: '7px', marginTop: '16px' }}>
            {['+ 새 페이지', '템플릿 선택', '가져오기', '게시하기'].map((t, i) => (
              <div key={t} style={{ padding: '7px 11px', borderRadius: '7px', fontSize: '11.5px', fontWeight: i === 0 ? 600 : 400, background: i === 0 ? '#191919' : i === 3 ? '#2F7BF5' : '#F0F0EF', color: i === 0 || i === 3 ? 'white' : '#6B6B6B' }}>{t}</div>
            ))}
          </div>
        </div>
        {[step1, step2, step3].map((active, i) => active && (
          <div key={i} style={{ position: 'absolute', left: CLICKS[i].x, top: CLICKS[i].y, transform: 'translate(-50%,-50%)', pointerEvents: 'none', zIndex: 10 }}>
            <div style={{ position: 'relative', width: '32px', height: '32px' }}>
              <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '2px solid #EF4444', animation: 'rippleOut 0.8s ease-out both' }} />
              <div style={{ position: 'absolute', inset: '8px', borderRadius: '50%', background: 'rgba(239,68,68,0.25)' }} />
            </div>
            <div style={{ position: 'absolute', top: '-22px', left: '50%', transform: 'translateX(-50%)', background: '#111827', color: 'white', fontSize: '10px', fontWeight: 600, padding: '2px 7px', borderRadius: '999px', whiteSpace: 'nowrap', animation: 'sceneIn 0.2s ease both' }}>{i + 1}단계</div>
          </div>
        ))}
        <div style={{ position: 'absolute', top: '12px', right: '12px', display: 'flex', alignItems: 'center', gap: '6px', padding: '5px 11px', background: 'rgba(10,10,15,0.82)', backdropFilter: 'blur(6px)', borderRadius: '999px', fontSize: '11px', color: 'white', fontWeight: 500 }}>
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#EF4444', animation: 'rec-blink 1.2s infinite' }} />
          {[step1, step2, step3].filter(Boolean).length > 0 ? `${[step1, step2, step3].filter(Boolean).length}단계 캡처됨` : 'MIMIC 녹화 중'}
        </div>
      </div>
    );
  };

  // ── 씬 2: MIMIC 에디터 — AI 자동 정리 ──────────────────────
  const Scene2 = () => {
    const ai1 = tick >= 500;
    const ai2 = tick >= 1300;
    const ai3 = tick >= 2100;
    const aiDone = tick >= 3000;
    const STEPS = [
      { title: '+ 새 페이지 클릭', desc: '상단 사이드바에서 "+ 새 페이지" 버튼을 클릭합니다.' },
      { title: '템플릿 선택',      desc: '원하는 템플릿을 고르거나 빈 페이지로 시작합니다.' },
      { title: '게시하기',         desc: '"게시하기" 버튼을 눌러 페이지를 팀에 공유합니다.' },
    ];
    const shown = [ai1, ai2, ai3];
    const visCount = shown.filter(Boolean).length;
    return (
      <div style={{ width: '100%', height: '100%', background: '#111827', display: 'grid', gridTemplateColumns: '195px 1fr' }}>
        <div style={{ borderRight: '1px solid rgba(255,255,255,0.07)', padding: '12px 10px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
          <div style={{ fontSize: '10px', color: '#6B7280', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '4px', padding: '0 4px' }}>스텝 목록</div>
          {STEPS.map((s, i) => (
            <div key={i} style={{ padding: '8px 10px', borderRadius: '8px', background: shown[i] ? (i === visCount - 1 ? 'rgba(109,40,217,0.25)' : 'rgba(255,255,255,0.06)') : 'rgba(255,255,255,0.03)', border: `1px solid ${shown[i] ? (i === visCount - 1 ? 'rgba(109,40,217,0.5)' : 'rgba(255,255,255,0.1)') : 'rgba(255,255,255,0.05)'}`, transition: 'all 0.4s ease', animation: shown[i] ? 'sceneIn 0.35s ease both' : 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ width: '16px', height: '16px', borderRadius: '4px', background: shown[i] ? 'linear-gradient(135deg,#6d28d9,#3730a3)' : 'rgba(255,255,255,0.08)', flexShrink: 0, display: 'grid', placeItems: 'center' }}>
                  <span style={{ fontSize: '9px', color: 'white', fontWeight: 700 }}>{i + 1}</span>
                </div>
                <span style={{ fontSize: '11px', fontWeight: 600, color: shown[i] ? 'white' : '#374151' }}>{s.title}</span>
              </div>
            </div>
          ))}
          {!aiDone && (
            <div style={{ padding: '8px 10px', borderRadius: '8px', border: '1px dashed rgba(109,40,217,0.3)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ display: 'flex', gap: '3px' }}>
                {[0,1,2].map(i => <span key={i} style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#6d28d9', animation: `dotBounce 1s ${i * 0.15}s ease-in-out infinite` }} />)}
              </div>
              <span style={{ fontSize: '10.5px', color: '#6d28d9' }}>AI 분석 중...</span>
            </div>
          )}
        </div>
        <div style={{ padding: '16px' }}>
          {visCount > 0 && (
            <div style={{ animation: 'sceneIn 0.4s ease both' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <div style={{ width: '22px', height: '22px', borderRadius: '6px', background: 'linear-gradient(135deg,#6d28d9,#3730a3)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                  <span style={{ fontSize: '10px', color: 'white', fontWeight: 700 }}>{visCount}</span>
                </div>
                <span style={{ fontSize: '13px', fontWeight: 700, color: 'white' }}>{STEPS[visCount - 1].title}</span>
              </div>
              <div style={{ borderRadius: '8px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)', marginBottom: '12px', background: '#F7F7F5' }}>
                <div style={{ height: '20px', background: '#EBEBEA', display: 'flex', alignItems: 'center', gap: '4px', padding: '0 8px' }}>
                  {['#FF5F57','#FEBC2E','#28C840'].map(c => <span key={c} style={{ width: '6px', height: '6px', borderRadius: '50%', background: c }} />)}
                </div>
                <div style={{ padding: '12px', display: 'flex', gap: '6px' }}>
                  <div style={{ width: '70px', background: '#F0F0EF', borderRadius: '4px', padding: '6px' }}>
                    {[80,60,70,55].map((w, i) => <div key={i} style={{ height: '6px', background: '#DCDCDB', borderRadius: '2px', width: `${w}%`, marginBottom: '4px' }} />)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ height: '9px', background: '#191919', borderRadius: '2px', width: '45%', marginBottom: '7px' }} />
                    <div style={{ display: 'flex', gap: '4px' }}>
                      {['+ 새 페이지','템플릿','가져오기'].map((t, i) => (
                        <div key={t} style={{ padding: '3px 7px', borderRadius: '4px', background: i === 0 ? '#6d28d9' : '#EBEBEA', color: i === 0 ? 'white' : '#6B6B6B', fontSize: '9px', fontWeight: i === 0 ? 600 : 400, border: i === 0 ? '2px solid rgba(239,68,68,0.7)' : 'none' }}>{t}</div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              <div style={{ padding: '10px 12px', background: 'rgba(109,40,217,0.12)', border: '1px solid rgba(109,40,217,0.25)', borderRadius: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '4px' }}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2"><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/></svg>
                  <span style={{ fontSize: '9.5px', color: '#a78bfa', fontWeight: 600 }}>AI 생성</span>
                </div>
                <div style={{ fontSize: '11.5px', color: 'rgba(255,255,255,0.75)', lineHeight: 1.5 }}>{STEPS[visCount - 1].desc}</div>
              </div>
            </div>
          )}
          {aiDone && (
            <div style={{ position: 'absolute', bottom: '14px', right: '14px', display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', background: '#10B981', borderRadius: '999px', fontSize: '11px', color: 'white', fontWeight: 600, animation: 'sceneIn 0.35s ease both' }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
              3단계 자동 완성
            </div>
          )}
        </div>
      </div>
    );
  };

  // ── 씬 3: 에디터에서 어노테이션 추가 ────────────────────────
  const Scene3 = () => {
    const anno1 = tick >= 700;
    const anno2 = tick >= 1600;
    const anno3 = tick >= 2500;
    return (
      <div style={{ width: '100%', height: '100%', background: '#1a1a2e', display: 'grid', gridTemplateColumns: '175px 1fr' }}>
        <div style={{ borderRight: '1px solid rgba(255,255,255,0.07)', padding: '12px 10px' }}>
          <div style={{ fontSize: '10px', color: '#6B7280', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '8px', padding: '0 4px' }}>어노테이션</div>
          {[
            { label: '하이라이트', active: anno1, icon: <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/></svg> },
            { label: '화살표',     active: anno2, icon: <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg> },
            { label: '캡션 텍스트', active: anno3, icon: <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg> },
          ].map(tool => (
            <div key={tool.label} style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '7px 8px', borderRadius: '7px', marginBottom: '2px', background: tool.active ? 'rgba(109,40,217,0.2)' : 'transparent', color: tool.active ? '#a78bfa' : '#6B7280', fontSize: '11.5px', fontWeight: tool.active ? 600 : 400, transition: 'all 0.3s', border: tool.active ? '1px solid rgba(109,40,217,0.35)' : '1px solid transparent' }}>
              {tool.icon}{tool.label}
            </div>
          ))}
          <div style={{ margin: '12px 0 6px', height: '1px', background: 'rgba(255,255,255,0.06)' }} />
          <div style={{ fontSize: '10px', color: '#6B7280', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '6px', padding: '0 4px' }}>스텝</div>
          {['1. + 새 페이지 클릭','2. 템플릿 선택','3. 게시하기'].map((t, i) => (
            <div key={t} style={{ padding: '5px 8px', borderRadius: '6px', fontSize: '10.5px', color: i === 0 ? '#e0d4fe' : '#6B7280', background: i === 0 ? 'rgba(109,40,217,0.15)' : 'transparent', marginBottom: '2px' }}>{t}</div>
          ))}
        </div>
        <div style={{ padding: '14px', position: 'relative' }}>
          <div style={{ borderRadius: '8px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)', background: '#F7F7F5', position: 'relative' }}>
            <div style={{ height: '20px', background: '#EBEBEA', display: 'flex', alignItems: 'center', gap: '4px', padding: '0 8px' }}>
              {['#FF5F57','#FEBC2E','#28C840'].map(c => <span key={c} style={{ width: '6px', height: '6px', borderRadius: '50%', background: c }} />)}
            </div>
            <div style={{ padding: '12px 14px' }}>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#191919', marginBottom: '8px' }}>프로젝트 관리</div>
              <div style={{ display: 'flex', gap: '6px', position: 'relative' }}>
                {['+ 새 페이지', '템플릿', '가져오기', '게시하기'].map((t, i) => (
                  <div key={t} style={{ padding: '5px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: i === 0 ? 600 : 400, background: i === 0 ? '#191919' : i === 3 ? '#2F7BF5' : '#F0F0EF', color: i === 0 || i === 3 ? 'white' : '#6B6B6B' }}>{t}</div>
                ))}
                {anno1 && (
                  <div style={{ position: 'absolute', top: '-4px', left: '-3px', width: '95px', height: 'calc(100% + 8px)', border: '2px solid #f59e0b', borderRadius: '8px', background: 'rgba(245,158,11,0.1)', animation: 'sceneIn 0.3s ease both', pointerEvents: 'none' }}>
                    <div style={{ position: 'absolute', top: '-17px', left: '0', background: '#f59e0b', color: 'white', fontSize: '9px', fontWeight: 700, padding: '1px 6px', borderRadius: '4px', whiteSpace: 'nowrap' }}>하이라이트</div>
                  </div>
                )}
                {anno2 && (
                  <svg style={{ position: 'absolute', top: '-28px', left: '45%', animation: 'sceneIn 0.3s ease both', pointerEvents: 'none' }} width="50" height="36" viewBox="0 0 50 36">
                    <defs><marker id="ah2" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#ef4444"/></marker></defs>
                    <path d="M25,4 Q25,18 18,28" stroke="#ef4444" strokeWidth="2" fill="none" markerEnd="url(#ah2)"/>
                  </svg>
                )}
              </div>
              {anno3 && (
                <div style={{ marginTop: '10px', padding: '7px 10px', background: 'rgba(55,48,163,0.08)', border: '1.5px solid rgba(55,48,163,0.25)', borderRadius: '7px', animation: 'sceneIn 0.35s ease both' }}>
                  <div style={{ fontSize: '11px', color: '#3730a3', fontWeight: 500 }}>💡 이 버튼을 클릭하면 새 페이지가 생성됩니다.</div>
                </div>
              )}
            </div>
          </div>
          <div style={{ position: 'absolute', bottom: '10px', right: '12px', fontSize: '10.5px', color: '#6B7280' }}>
            {[anno1, anno2, anno3].filter(Boolean).length} / 3 어노테이션 추가됨
          </div>
        </div>
      </div>
    );
  };

  // ── 씬 4: 공유 링크 + 플레이어 미리보기 ─────────────────────
  const Scene4 = () => {
    const published   = tick >= 500;
    const linkReady   = tick >= 1200;
    const playerVisible = tick >= 2000;
    const copied      = tick >= 3000;
    return (
      <div style={{ width: '100%', height: '100%', background: 'linear-gradient(145deg,#0f0c29,#302b63,#24243e)', position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '18px', padding: '22px' }}>
        <div style={{ textAlign: 'center', animation: 'sceneIn 0.5s cubic-bezier(0.34,1.4,0.64,1) both' }}>
          <div style={{ width: '52px', height: '52px', borderRadius: '14px', background: 'linear-gradient(135deg,#3730a3,#6d28d9)', margin: '0 auto 10px', display: 'grid', placeItems: 'center', boxShadow: '0 0 0 10px rgba(109,40,217,0.12)', animation: published ? 'checkPop 0.5s cubic-bezier(0.34,1.6,0.64,1) both' : 'none' }}>
            {published
              ? <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
              : <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2"><circle cx="12" cy="12" r="10"/></svg>}
          </div>
          <div style={{ fontSize: '16px', fontWeight: 700, color: 'white' }}>매뉴얼 완성!</div>
          <div style={{ fontSize: '11.5px', color: 'rgba(255,255,255,0.5)', marginTop: '2px' }}>3단계 · 약 28초 소요</div>
        </div>
        {linkReady && (
          <div style={{ width: '100%', maxWidth: '400px', animation: 'sceneIn 0.4s cubic-bezier(0.34,1.4,0.64,1) both' }}>
            <div style={{ display: 'flex', borderRadius: '10px', overflow: 'hidden', border: '1.5px solid rgba(255,255,255,0.13)' }}>
              <div style={{ flex: 1, padding: '9px 13px', background: 'rgba(255,255,255,0.06)', fontSize: '11px', color: 'rgba(255,255,255,0.65)', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                mimic.so/play/notion-new-page-guide
              </div>
              <button style={{ padding: '9px 16px', background: copied ? '#10B981' : 'linear-gradient(135deg,#3730a3,#6d28d9)', color: 'white', fontSize: '11.5px', fontWeight: 600, border: 'none', cursor: 'default', flexShrink: 0, transition: 'background 0.3s' }}>
                {copied ? '복사됨 ✓' : '링크 복사'}
              </button>
            </div>
          </div>
        )}
        {playerVisible && (
          <div style={{ width: '100%', maxWidth: '400px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', overflow: 'hidden', animation: 'sceneIn 0.45s cubic-bezier(0.34,1.3,0.64,1) both' }}>
            <div style={{ padding: '10px 13px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '18px', height: '18px', borderRadius: '4px', background: 'linear-gradient(135deg,#3730a3,#6d28d9)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                <span style={{ color: 'white', fontSize: '8px', fontWeight: 800, fontFamily: 'Georgia,serif' }}>M</span>
              </div>
              <span style={{ fontSize: '11.5px', color: 'white', fontWeight: 600 }}>Notion 페이지 만들기</span>
              <span style={{ marginLeft: 'auto', fontSize: '10px', color: 'rgba(255,255,255,0.4)' }}>3단계</span>
            </div>
            <div style={{ padding: '11px 13px', display: 'flex', gap: '10px', alignItems: 'center' }}>
              <div style={{ width: '44px', height: '34px', borderRadius: '5px', background: '#F7F7F5', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ width: '28px', height: '20px', background: '#EBEBEA', borderRadius: '3px' }} />
              </div>
              <div>
                <div style={{ fontSize: '11px', color: 'white', fontWeight: 600, marginBottom: '3px' }}>1단계 · + 새 페이지 클릭</div>
                <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.45)' }}>상단 사이드바에서 버튼을 클릭합니다.</div>
              </div>
            </div>
            <div style={{ padding: '6px 13px 10px', display: 'flex', gap: '5px' }}>
              {[1,2,3].map(i => <div key={i} style={{ flex: 1, height: '3px', borderRadius: '2px', background: i === 1 ? '#6d28d9' : 'rgba(255,255,255,0.12)' }} />)}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ position: 'relative', maxWidth: '1000px', margin: '0 auto' }}>
      <div style={{ borderRadius: '16px 16px 0 0', overflow: 'hidden', boxShadow: '0 20px 60px -10px rgba(55,48,163,0.28), 0 40px 80px -20px rgba(17,24,39,0.18)', border: '1px solid rgba(55,48,163,0.15)', borderBottom: 'none' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 16px', background: '#18181B', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#FF5F57' }} />
          <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#FEBC2E' }} />
          <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#28C840' }} />
          <div style={{ flex: 1, margin: '0 12px', padding: '4px 12px', borderRadius: '6px', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10"/></svg>
            <span style={{ fontSize: '11.5px', color: 'rgba(255,255,255,0.45)' }}>{SCENE_URLS[scene]}</span>
          </div>
          {scene <= 1 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '4px 10px', borderRadius: '5px', background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', fontSize: '11px', color: '#FCA5A5', fontWeight: 500, flexShrink: 0 }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#EF4444', animation: 'rec-blink 1.2s ease-in-out infinite', display: 'inline-block' }} />
              MIMIC 녹화 중
            </div>
          )}
        </div>
        <div key={scene} style={{ height: '420px', position: 'relative', overflow: 'hidden', animation: 'sceneIn 0.35s ease both' }}>
          {renderScene()}
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '4px', marginTop: '18px' }}>
        {SCENE_LABELS.map((label, i) => {
          const isActive = i === scene;
          const isDone = i < scene;
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: isActive ? '5px 12px 5px 7px' : '5px 8px', borderRadius: '999px', border: `1px solid ${isActive ? 'rgba(109,40,217,0.40)' : isDone ? 'rgba(16,185,129,0.30)' : 'rgba(109,40,217,0.12)'}`, background: isActive ? 'rgba(109,40,217,0.09)' : isDone ? 'rgba(16,185,129,0.06)' : 'transparent', transition: 'all 0.3s ease' }}>
              <div style={{ width: '18px', height: '18px', borderRadius: '5px', flexShrink: 0, background: isActive ? '#6d28d9' : isDone ? '#10B981' : 'rgba(109,40,217,0.12)', fontSize: '9px', fontWeight: 700, display: 'grid', placeItems: 'center', transition: 'all 0.3s ease' }}>
                {isDone ? <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg> : <span style={{ color: isActive ? 'white' : '#9CA3AF' }}>{i + 1}</span>}
              </div>
              {isActive && <span style={{ fontSize: '11px', fontWeight: 600, color: '#6d28d9', whiteSpace: 'nowrap' }}>{label}</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

"""

with open(r'c:\Users\ADMIN\Desktop\Project\Dev\mimic\app\landingpage\page.tsx', 'w', encoding='utf-8') as f:
    f.writelines(before)
    f.write(new_scenes)
    f.writelines(after)

print('DONE, before:', len(before), 'after:', len(after))
