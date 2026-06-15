'use client';

import { useState } from 'react';
import Link from 'next/link';

// ── 목차 구조 ──────────────────────────────────────────────

const SECTIONS = [
  {
    id: 'intro',
    title: 'MIMIC이란?',
    icon: '✦',
  },
  {
    id: 'quickstart',
    title: '빠른 시작',
    icon: '⚡',
    children: [
      { id: 'install', title: '1. 확장 프로그램 설치' },
      { id: 'record', title: '2. 화면 녹화하기' },
      { id: 'edit', title: '3. 매뉴얼 편집하기' },
      { id: 'share', title: '4. 공유하기' },
    ],
  },
  {
    id: 'features',
    title: '주요 기능',
    icon: '◈',
    children: [
      { id: 'dashboard', title: '대시보드' },
      { id: 'editor', title: '매뉴얼 에디터' },
      { id: 'guide-me', title: '라이브 가이드' },
      { id: 'export', title: '내보내기' },
      { id: 'share-link', title: '공유 링크' },
      { id: 'workspace', title: '워크스페이스' },
    ],
  },
  {
    id: 'plans',
    title: '요금제',
    icon: '◉',
  },
  {
    id: 'faq',
    title: 'FAQ',
    icon: '?',
  },
];

// ── 섹션 컨텐츠 ────────────────────────────────────────────

function SectionContent({ id }: { id: string }) {
  const h2 = (text: string) => (
    <h2 style={{ fontSize: '22px', fontWeight: 700, color: '#111827', margin: '0 0 16px', letterSpacing: '-0.02em' }}>{text}</h2>
  );
  const h3 = (text: string) => (
    <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#111827', margin: '28px 0 10px' }}>{text}</h3>
  );
  const p = (text: string) => (
    <p style={{ fontSize: '14.5px', color: '#4B5563', lineHeight: 1.75, margin: '0 0 12px' }}>{text}</p>
  );
  const li = (text: string, i: number) => (
    <li key={i} style={{ fontSize: '14.5px', color: '#4B5563', lineHeight: 1.75, marginBottom: '6px' }}>{text}</li>
  );
  const chip = (text: string, color = '#e0e7ff', textColor = '#3730a3') => (
    <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: '6px', background: color, color: textColor, fontSize: '12px', fontWeight: 600, marginRight: '6px' }}>{text}</span>
  );
  const kbd = (text: string) => (
    <code style={{ display: 'inline-block', padding: '2px 7px', background: '#F3F4F6', border: '1px solid #E5E7EB', borderRadius: '5px', fontSize: '12.5px', color: '#374151', fontFamily: 'monospace' }}>{text}</code>
  );

  switch (id) {
    case 'intro':
      return (
        <div>
          {h2('MIMIC이란?')}
          {p('MIMIC은 Chrome 확장 프로그램으로 업무 화면을 녹화해 인터랙티브 매뉴얼을 자동 생성하는 서비스입니다.')}
          {p('클릭 한 번 한 번이 자동으로 캡처되어 단계별 스크린샷 + 설명이 만들어집니다. 완성된 매뉴얼은 링크로 공유하거나, 실제 페이지 위에 라이브 가이드 오버레이로 단계별 안내를 제공합니다.')}
          {h3('MIMIC으로 할 수 있는 것')}
          <ul style={{ paddingLeft: '20px', margin: '0 0 16px' }}>
            {[
              '신규 직원 온보딩 매뉴얼 30초 만에 제작',
              '고객 지원용 서비스 이용 가이드 공유',
              '반복 업무 프로세스 문서화',
              '실제 페이지 위에서 라이브 가이드로 단계별 안내',
              'PDF, PPTX, Markdown으로 내보내기',
            ].map(li)}
          </ul>
        </div>
      );

    case 'install':
      return (
        <div>
          {h2('1. 확장 프로그램 설치')}
          {p('MIMIC Recorder는 Chrome 브라우저에서 동작하는 확장 프로그램입니다.')}
          {h3('설치 방법')}
          <ol style={{ paddingLeft: '20px', margin: '0 0 16px' }}>
            {[
              'Chrome 웹 스토어에서 "MIMIC Recorder"를 검색하세요.',
              '확장 프로그램을 설치합니다.',
              'MIMIC 웹앱(mimic.so)에서 계정을 생성하세요.',
              '확장 프로그램 아이콘을 클릭해 계정을 연결합니다.',
            ].map(li)}
          </ol>
          {h3('지원 브라우저')}
          {p('현재 Google Chrome 및 Chromium 기반 브라우저(Edge, Brave 등)를 지원합니다.')}
        </div>
      );

    case 'record':
      return (
        <div>
          {h2('2. 화면 녹화하기')}
          {p('녹화는 Chrome 확장 프로그램으로 진행합니다. 업무를 수행하듯 화면을 클릭하면 자동으로 캡처됩니다.')}
          {h3('녹화 시작')}
          <ol style={{ paddingLeft: '20px', margin: '0 0 16px' }}>
            {[
              'Chrome 툴바에서 MIMIC Recorder 아이콘을 클릭합니다.',
              '녹화 시작 버튼을 눌러 녹화를 시작합니다.',
              '평소처럼 업무를 진행하며 화면을 클릭합니다. 클릭할 때마다 자동으로 스크린샷이 캡처됩니다.',
              '완료 버튼을 눌러 녹화를 종료합니다.',
            ].map(li)}
          </ol>
          {h3('녹화 완료 후')}
          {p('녹화가 완료되면 AI가 자동으로 각 단계의 제목과 설명을 생성합니다. MIMIC 대시보드에서 생성된 매뉴얼을 확인할 수 있습니다.')}
          {h3('직접 만들기')}
          {p('녹화 없이 직접 만들 수도 있습니다. 대시보드에서 "새 매뉴얼 → 직접 편집하기"를 선택하면 빈 매뉴얼이 생성됩니다.')}
        </div>
      );

    case 'edit':
      return (
        <div>
          {h2('3. 매뉴얼 편집하기')}
          {p('생성된 매뉴얼은 에디터에서 자유롭게 수정할 수 있습니다.')}
          {h3('에디터 열기')}
          {p('대시보드에서 매뉴얼을 클릭하면 뷰어가 열립니다. 우측 상단의 "편집" 버튼을 누르면 에디터 모드로 전환됩니다.')}
          {h3('편집 가능한 항목')}
          <ul style={{ paddingLeft: '20px', margin: '0 0 16px' }}>
            {[
              '매뉴얼 제목',
              '각 단계의 액션 제목',
              '각 단계의 설명/스크립트',
              '스크린샷 위 어노테이션 (화살표, 텍스트, 강조 박스 등)',
              '단계 순서 (드래그로 재정렬)',
              '단계 추가 / 삭제',
            ].map(li)}
          </ul>
          {h3('단축키')}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', margin: '0 0 16px' }}>
            {[
              ['실행 취소', 'Ctrl + Z'],
              ['다시 실행', 'Ctrl + Shift + Z'],
            ].map(([label, key], i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '14px', color: '#4B5563', width: '100px' }}>{label}</span>
                {kbd(key)}
              </div>
            ))}
          </div>
          {h3('편집 완료')}
          {p('우측 상단 "편집 완료" 버튼을 누르면 저장되고 뷰어 모드로 돌아갑니다. 변경사항은 자동 저장됩니다.')}
        </div>
      );

    case 'share':
      return (
        <div>
          {h2('4. 공유하기')}
          {p('완성된 매뉴얼을 링크로 공유하거나, 라이브 가이드 오버레이로 실제 페이지에서 안내할 수 있습니다.')}
          {h3('링크 공유')}
          <ol style={{ paddingLeft: '20px', margin: '0 0 16px' }}>
            {[
              '매뉴얼 상단 "공유" 버튼을 클릭합니다.',
              '링크 복사, 카카오톡, 이메일 중 원하는 방법을 선택합니다.',
              '매뉴얼을 공개 상태로 전환하면 로그인 없이 누구나 볼 수 있습니다.',
            ].map(li)}
          </ol>
          {h3('비밀번호 보호')}
          {p('설정 메뉴에서 공유 링크에 비밀번호를 설정할 수 있습니다. 비밀번호를 설정하면 링크에 접속 시 비밀번호 입력이 요구됩니다.')}
          {h3('라이브 가이드 미리보기')}
          {p('매뉴얼에 원본 페이지 URL이 저장되어 있으면 "라이브 가이드" 버튼이 활성화됩니다. 클릭하면 실제 페이지 위에서 오버레이 가이드를 미리볼 수 있습니다.')}
        </div>
      );

    case 'dashboard':
      return (
        <div>
          {h2('대시보드')}
          {p('대시보드는 매뉴얼을 관리하는 메인 화면입니다.')}
          {h3('매뉴얼 목록')}
          {p('내 워크스페이스와 팀 워크스페이스 탭으로 매뉴얼을 구분해 볼 수 있습니다. 그리드 / 리스트 / 컴팩트 세 가지 보기 방식을 지원합니다.')}
          {h3('검색')}
          {p('상단 검색창에 제목을 입력하면 실시간으로 매뉴얼을 필터링합니다.')}
          {h3('폴더 관리')}
          <ul style={{ paddingLeft: '20px', margin: '0 0 16px' }}>
            {[
              '폴더 만들기: 사이드바 하단 "새 폴더" 클릭',
              '폴더 이름 변경: 폴더명 더블클릭',
              '매뉴얼 이동: 카드 우측 메뉴(⋮) → 폴더로 이동',
              '폴더 삭제: 폴더 우측 메뉴 → 삭제 (폴더 안 매뉴얼은 유지됨)',
            ].map(li)}
          </ul>
          {h3('매뉴얼 카드 메뉴')}
          {p('카드 우측 상단 ⋮ 버튼 또는 마우스 우클릭으로 폴더 이동, 팀 이동, 삭제 메뉴를 사용할 수 있습니다.')}
        </div>
      );

    case 'editor':
      return (
        <div>
          {h2('매뉴얼 에디터')}
          {p('에디터에서 녹화된 매뉴얼의 내용을 수정하고 어노테이션을 추가할 수 있습니다.')}
          {h3('어노테이션 도구')}
          {p('스크린샷 위에 다양한 도형과 텍스트를 추가해 중요한 부분을 강조할 수 있습니다.')}
          <ul style={{ paddingLeft: '20px', margin: '0 0 16px' }}>
            {[
              '화살표: 클릭 위치나 방향을 가리킵니다',
              '사각형 / 원: 요소를 강조합니다',
              '텍스트: 설명을 직접 입력합니다',
              '마커: 번호 배지로 순서를 표시합니다',
              '모자이크: 민감한 정보를 가립니다',
              '스포트라이트: 특정 영역만 밝게 강조합니다',
            ].map(li)}
          </ul>
          {h3('단계 관리')}
          <ul style={{ paddingLeft: '20px', margin: '0 0 16px' }}>
            {[
              '단계 추가: 목차 하단 "+" 버튼 또는 단계 메뉴에서 위/아래 삽입',
              '단계 재정렬: 목차에서 드래그',
              '단계 삭제: 목차 단계 우측 메뉴(⋮) → 삭제',
            ].map(li)}
          </ul>
          {h3('실시간 협업')}
          {p('같은 워크스페이스의 팀원들과 동시에 편집할 수 있습니다. 다른 사람이 수정 중인 단계는 상단에 협업자 아바타로 표시됩니다.')}
        </div>
      );

    case 'guide-me':
      return (
        <div>
          {h2('라이브 가이드')}
          {p('라이브 가이드는 실제 웹페이지 위에 오버레이를 띄워 단계별로 안내하는 기능입니다. 사용자는 별도 화면 없이 실제 업무 페이지에서 바로 가이드를 받을 수 있습니다.')}
          {h3('사용 방법')}
          <ol style={{ paddingLeft: '20px', margin: '0 0 16px' }}>
            {[
              '매뉴얼이 녹화된 원본 페이지 URL이 있어야 합니다.',
              '매뉴얼 상단 "라이브 가이드" 버튼을 클릭합니다.',
              '새 탭에서 원본 페이지가 열리면서 라이브 가이드 오버레이가 시작됩니다.',
              '각 단계에서 클릭해야 할 요소가 하이라이트되고 툴팁으로 설명이 표시됩니다.',
            ].map(li)}
          </ol>
          {h3('오버레이 조작')}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', margin: '0 0 16px' }}>
            {[
              ['다음 단계', '→ 또는 Enter'],
              ['이전 단계', '←'],
              ['닫기', 'Escape'],
            ].map(([label, key], i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '14px', color: '#4B5563', width: '80px' }}>{label}</span>
                {kbd(key)}
              </div>
            ))}
          </div>
          {h3('SDK로 직접 삽입')}
          {p('자체 서비스에 라이브 가이드를 삽입하려면 아래 스크립트를 페이지에 추가하세요.')}
          <pre style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: '8px', padding: '14px', fontSize: '13px', overflowX: 'auto', margin: '0 0 16px' }}>
            {'<script src="https://mimic.so/sdk.js"\n  data-guide="YOUR_TOKEN">\n</script>'}
          </pre>
        </div>
      );

    case 'export':
      return (
        <div>
          {h2('내보내기')}
          {p('완성된 매뉴얼을 다양한 형식으로 내보낼 수 있습니다.')}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', margin: '0 0 24px' }}>
            {[
              { format: 'PDF', desc: '스크린샷 + 설명이 포함된 PDF 문서', badge: '#fee2e2', badgeText: '#dc2626' },
              { format: 'PPTX', desc: '슬라이드 형식의 파워포인트 파일', badge: '#fef3c7', badgeText: '#d97706' },
              { format: 'Markdown', desc: '제목, 설명, 이미지 링크가 포함된 .md 파일', badge: '#d1fae5', badgeText: '#059669' },
            ].map(({ format, desc, badge, badgeText }) => (
              <div key={format} style={{ padding: '14px', background: '#F9FAFB', borderRadius: '10px', border: '1px solid #E5E7EB' }}>
                {chip(format, badge, badgeText)}
                <p style={{ fontSize: '13px', color: '#6B7280', margin: '8px 0 0', lineHeight: 1.55 }}>{desc}</p>
              </div>
            ))}
          </div>
          {h3('내보내기 위치')}
          <ul style={{ paddingLeft: '20px', margin: '0 0 16px' }}>
            {[
              '매뉴얼 뷰어 상단: PDF, PPTX 버튼',
              '공유 플레이어: PDF, PPTX, Markdown 버튼',
            ].map(li)}
          </ul>
        </div>
      );

    case 'share-link':
      return (
        <div>
          {h2('공유 링크')}
          {p('매뉴얼을 링크로 공유하면 로그인 없이 누구나 볼 수 있습니다.')}
          {h3('공유 링크 생성')}
          <ol style={{ paddingLeft: '20px', margin: '0 0 16px' }}>
            {[
              '매뉴얼 상단 "공유" 버튼 클릭',
              '"게시하고 공유" 버튼으로 공개 상태로 전환',
              '링크 복사, 카카오톡, 이메일 중 선택해 공유',
            ].map(li)}
          </ol>
          {h3('비밀번호 보호')}
          {p('설정(⚙) → 공유 비밀번호에서 비밀번호를 입력하면 링크 접속 시 비밀번호가 요구됩니다. 비워두면 보호가 해제됩니다.')}
          {h3('공유 플레이어')}
          {p('공유 링크로 접속하면 슬라이드 모드와 문서 모드 두 가지로 매뉴얼을 볼 수 있습니다. 자동 재생, 속도 조절, PDF/PPTX/MD 내보내기도 지원합니다.')}
        </div>
      );

    case 'workspace':
      return (
        <div>
          {h2('워크스페이스')}
          {p('팀 워크스페이스에서 팀원들과 매뉴얼을 공동 관리할 수 있습니다.')}
          {h3('워크스페이스 만들기')}
          <ol style={{ paddingLeft: '20px', margin: '0 0 16px' }}>
            {[
              '사이드바 "팀 워크스페이스" 섹션의 "+" 버튼을 클릭합니다.',
              '워크스페이스 이름을 입력합니다.',
            ].map(li)}
          </ol>
          {h3('팀원 초대')}
          {p('워크스페이스 설정에서 팀원 이메일로 초대 링크를 보낼 수 있습니다.')}
          {h3('매뉴얼 이동')}
          {p('개인 매뉴얼을 팀 워크스페이스로 이동하거나, 팀 매뉴얼을 다시 개인으로 이동할 수 있습니다. 카드 메뉴(⋮) → "팀으로 이동"을 선택하세요.')}
          {h3('실시간 협업')}
          {p('워크스페이스 내 매뉴얼은 여러 팀원이 동시에 편집할 수 있습니다. 편집 중인 팀원의 아바타가 에디터 상단에 표시됩니다.')}
        </div>
      );

    case 'plans':
      return (
        <div>
          {h2('요금제')}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', margin: '0 0 24px' }}>
            {[
              {
                name: '무료',
                price: '₩0',
                color: '#F9FAFB',
                border: '#E5E7EB',
                features: ['일 3회 매뉴얼 생성', '기본 공유 링크', 'PDF 내보내기', '라이브 가이드'],
              },
              {
                name: 'Pro',
                price: '문의',
                color: '#EEF2FF',
                border: '#a5b4fc',
                features: ['무제한 매뉴얼 생성', '모든 내보내기 형식', '비밀번호 보호', '우선 지원'],
                highlight: true,
              },
              {
                name: 'Team',
                price: '문의',
                color: '#F5F3FF',
                border: '#c4b5fd',
                features: ['Pro 포함 전체 기능', '팀 워크스페이스', '실시간 협업', '멤버 관리'],
              },
            ].map(({ name, price, color, border, features, highlight }) => (
              <div key={name} style={{ padding: '20px', background: color, border: `1px solid ${border}`, borderRadius: '12px' }}>
                <div style={{ fontSize: '15px', fontWeight: 700, color: '#111827', marginBottom: '4px' }}>{name}</div>
                <div style={{ fontSize: '20px', fontWeight: 800, color: highlight ? '#3730a3' : '#111827', marginBottom: '16px' }}>{price}</div>
                <ul style={{ paddingLeft: '16px', margin: 0 }}>
                  {features.map((f, i) => (
                    <li key={i} style={{ fontSize: '13px', color: '#4B5563', marginBottom: '6px', lineHeight: 1.5 }}>{f}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          {p('요금제 관련 문의는 support@mimic.so로 연락해주세요.')}
        </div>
      );

    case 'faq':
      return (
        <div>
          {h2('자주 묻는 질문')}
          {[
            {
              q: 'MIMIC이 뭔가요?',
              a: 'Chrome 확장 프로그램으로 업무 화면을 녹화해 인터랙티브 매뉴얼을 자동 생성하는 서비스입니다. 클릭 동작이 자동 캡처되어 단계별 스크린샷과 설명이 만들어지고, 링크로 공유하거나 라이브 가이드 오버레이로 실제 페이지에서 단계별 안내를 제공합니다.',
            },
            {
              q: '확장 프로그램은 어디서 설치하나요?',
              a: 'Chrome 웹 스토어에서 "MIMIC Recorder"를 검색해 설치하세요. Edge, Brave 등 Chromium 기반 브라우저도 지원합니다. Firefox, Safari는 현재 지원하지 않습니다.',
            },
            {
              q: '매뉴얼 생성이 안 돼요.',
              a: '무료 플랜은 하루 3회까지 생성 가능합니다. 자정에 횟수가 초기화됩니다. 무제한으로 사용하려면 Pro 플랜으로 업그레이드하세요.',
            },
            {
              q: '라이브 가이드가 버튼을 못 찾아요.',
              a: '원본 페이지의 UI가 변경됐을 수 있습니다. 에디터 → 설정(⚙) → "페이지 변경 감지 검사"를 실행하면 변경된 단계를 확인할 수 있습니다. 해당 단계를 다시 녹화하거나 수동으로 수정하세요.',
            },
            {
              q: '라이브 가이드는 어떻게 사용하나요?',
              a: '매뉴얼에 원본 페이지 URL이 저장되어 있으면 상단 "라이브 가이드" 버튼이 활성화됩니다. 클릭하면 새 탭에서 원본 페이지가 열리면서 오버레이가 자동 시작됩니다. → 다음, ← 이전, Esc 닫기 키보드도 지원합니다.',
            },
            {
              q: '공유 링크로 들어갔는데 아무것도 안 보여요.',
              a: '매뉴얼이 아직 초안(draft) 상태일 수 있습니다. "공유" 버튼 → "게시하고 공유"를 눌러 공개 상태로 전환해주세요. 비밀번호가 설정된 경우 비밀번호 입력 후 확인됩니다.',
            },
            {
              q: 'PDF 내보내기가 느려요.',
              a: '스크린샷이 많은 매뉴얼은 생성에 시간이 걸릴 수 있습니다. 페이지를 닫지 말고 잠시 기다려주세요. 완료되면 자동으로 다운로드됩니다.',
            },
            {
              q: 'PDF, PPTX 외에 다른 형식도 지원하나요?',
              a: 'Markdown(.md) 형식도 지원합니다. 공유 플레이어 페이지에서 PDF, PPTX, Markdown 세 가지 형식을 내보낼 수 있습니다.',
            },
            {
              q: '공유 링크에 비밀번호를 설정하고 싶어요.',
              a: '매뉴얼 편집기 → 설정(⚙) → 공유 비밀번호 입력 → 저장하면 됩니다. 비밀번호를 비워두면 보호가 해제됩니다.',
            },
            {
              q: '팀원을 초대하려면 어떻게 하나요?',
              a: '팀 워크스페이스 설정에서 팀원 이메일로 초대 링크를 전송할 수 있습니다. Team 플랜이 필요합니다. 초대된 팀원은 워크스페이스 내 매뉴얼을 공동 편집할 수 있습니다.',
            },
            {
              q: '매뉴얼을 팀 워크스페이스로 이동하려면?',
              a: '대시보드에서 매뉴얼 카드 우측 메뉴(⋮) → "팀으로 이동"을 선택하세요. 반대로 팀 매뉴얼을 개인으로 이동하는 것도 가능합니다.',
            },
            {
              q: '자체 서비스에 라이브 가이드를 삽입할 수 있나요?',
              a: '가능합니다. 페이지에 SDK 스크립트를 추가하거나 URL에 ?mimic_guide=TOKEN 파라미터를 붙이면 라이브 가이드가 자동 시작됩니다.',
            },
            {
              q: '무료 플랜과 Pro 플랜의 차이는 무엇인가요?',
              a: '무료는 일 3회 매뉴얼 생성, 기본 공유, PDF 내보내기를 지원합니다. Pro는 무제한 생성, 모든 내보내기 형식(PDF/PPTX/MD), 비밀번호 보호, 우선 지원을 포함합니다. 가격 문의는 support@mimic.so로 연락해주세요.',
            },
            {
              q: '문의는 어떻게 하나요?',
              a: 'support@mimic.so로 이메일 주시면 빠르게 답변드리겠습니다. 버그 신고, 기능 제안, 요금제 문의 모두 환영합니다.',
            },
          ].map(({ q, a }, i) => (
            <div key={i} style={{ borderBottom: '1px solid #F3F4F6', paddingBottom: '20px', marginBottom: '20px' }}>
              <div style={{ fontSize: '15px', fontWeight: 600, color: '#111827', marginBottom: '8px' }}>Q. {q}</div>
              <div style={{ fontSize: '14px', color: '#4B5563', lineHeight: 1.7 }}>A. {a}</div>
            </div>
          ))}
          <div style={{ padding: '16px 20px', background: '#F0F9FF', border: '1px solid #BAE6FD', borderRadius: '10px', marginTop: '8px' }}>
            <div style={{ fontSize: '14px', fontWeight: 600, color: '#0369a1', marginBottom: '4px' }}>더 궁금한 점이 있으신가요?</div>
            <div style={{ fontSize: '13.5px', color: '#0c4a6e' }}>우측 하단 채팅 버튼으로 바로 질문하거나, <strong>support@mimic.so</strong>로 문의해주세요.</div>
          </div>
        </div>
      );

    default:
      return null;
  }
}

// ── Page ───────────────────────────────────────────────────

export default function HelpPage() {
  const [activeId, setActiveId] = useState('intro');

  const allIds = SECTIONS.flatMap(s => [s.id, ...(s.children?.map(c => c.id) ?? [])]);

  return (
    <div style={{ minHeight: '100vh', background: '#F9FAFB', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      {/* 헤더 */}
      <header style={{ background: 'white', borderBottom: '1px solid #E5E7EB', padding: '0 24px', height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <Link href="/home" style={{ display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none' }}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="28" height="28">
              <circle cx="50" cy="50" r="50" fill="#3730a3"/>
              <text x="50" y="68" textAnchor="middle" fontFamily="Georgia, serif" fontSize="62" fontWeight="700" fill="white">M</text>
            </svg>
            <span style={{ fontSize: '16px', fontWeight: 800, color: '#111827', letterSpacing: '-0.03em' }}>MIMIC</span>
          </Link>
          <span style={{ color: '#D1D5DB' }}>|</span>
          <span style={{ fontSize: '14px', fontWeight: 600, color: '#374151' }}>도움말</span>
        </div>
        <Link href="/home" style={{ fontSize: '13px', color: '#6B7280', textDecoration: 'none', padding: '6px 14px', border: '1px solid #E5E7EB', borderRadius: '7px', background: 'white' }}>
          대시보드로 →
        </Link>
      </header>

      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '40px 24px', display: 'grid', gridTemplateColumns: '220px 1fr', gap: '32px', alignItems: 'start' }}>
        {/* 사이드바 목차 */}
        <nav style={{ position: 'sticky', top: '80px', background: 'white', borderRadius: '12px', border: '1px solid #E5E7EB', padding: '12px', overflow: 'hidden' }}>
          {SECTIONS.map(section => (
            <div key={section.id}>
              <button
                onClick={() => setActiveId(section.id)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '8px 10px', borderRadius: '8px', border: 'none',
                  background: activeId === section.id ? '#EEF2FF' : 'transparent',
                  color: activeId === section.id ? '#3730a3' : '#374151',
                  fontWeight: activeId === section.id ? 700 : 500,
                  fontSize: '13.5px', cursor: 'pointer', textAlign: 'left',
                  transition: 'all 0.12s',
                }}
              >
                <span style={{ fontSize: '12px', opacity: 0.7 }}>{section.icon}</span>
                {section.title}
              </button>
              {section.children && (
                <div style={{ paddingLeft: '12px', marginBottom: '4px' }}>
                  {section.children.map(child => (
                    <button
                      key={child.id}
                      onClick={() => setActiveId(child.id)}
                      style={{
                        width: '100%', padding: '6px 10px', borderRadius: '6px',
                        border: 'none', background: activeId === child.id ? '#EEF2FF' : 'transparent',
                        color: activeId === child.id ? '#3730a3' : '#6B7280',
                        fontWeight: activeId === child.id ? 600 : 400,
                        fontSize: '13px', cursor: 'pointer', textAlign: 'left',
                        transition: 'all 0.12s',
                      }}
                    >
                      {child.title}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </nav>

        {/* 본문 */}
        <main style={{ background: 'white', borderRadius: '12px', border: '1px solid #E5E7EB', padding: '36px 40px', minHeight: '500px' }}>
          <SectionContent id={activeId} />

          {/* 이전/다음 */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '48px', paddingTop: '24px', borderTop: '1px solid #F3F4F6' }}>
            {(() => {
              const idx = allIds.indexOf(activeId);
              const prevId = idx > 0 ? allIds[idx - 1] : null;
              const nextId = idx < allIds.length - 1 ? allIds[idx + 1] : null;
              const findLabel = (id: string) => {
                for (const s of SECTIONS) {
                  if (s.id === id) return s.title;
                  for (const c of s.children ?? []) if (c.id === id) return c.title;
                }
                return id;
              };
              return (
                <>
                  {prevId
                    ? <button onClick={() => setActiveId(prevId)} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '8px', border: '1px solid #E5E7EB', background: 'white', cursor: 'pointer', fontSize: '13px', color: '#374151' }}>← {findLabel(prevId)}</button>
                    : <div />}
                  {nextId
                    ? <button onClick={() => setActiveId(nextId)} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '8px', border: '1px solid #E5E7EB', background: 'white', cursor: 'pointer', fontSize: '13px', color: '#374151' }}>{findLabel(nextId)} →</button>
                    : <div />}
                </>
              );
            })()}
          </div>
        </main>
      </div>
    </div>
  );
}
