'use client';

import { useEffect, useState } from 'react';
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
      { id: 'dashboard', title: '홈 화면' },
      { id: 'editor', title: '매뉴얼 에디터' },
      { id: 'practice', title: '학습 가이드' },
      { id: 'playbook', title: '플레이북' },
      { id: 'guide-me', title: '라이브 가이드 Beta' },
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

const ALL_SECTION_IDS = SECTIONS.flatMap(s => [s.id, ...(s.children?.map(c => c.id) ?? [])]);

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
  const img = (src: string, caption: string) => (
    <figure style={{ margin: '16px 0 20px' }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={caption} style={{ display: 'block', width: '100%', borderRadius: '12px', border: '1px solid #E5E7EB', boxShadow: '0 4px 16px rgba(17,24,39,0.08)' }} />
      <figcaption style={{ fontSize: '12.5px', color: '#9CA3AF', marginTop: '8px', textAlign: 'center' }}>{caption}</figcaption>
    </figure>
  );

  switch (id) {
    case 'intro':
      return (
        <div>
          {h2('MIMIC이란?')}
          {p('MIMIC은 Chrome 확장 프로그램으로 업무 화면을 녹화해 SOP와 인터랙티브 매뉴얼을 자동 생성하고, 필요한 순간에는 화면 위 가이드로 실행까지 연결하는 서비스입니다.')}
          {img('/help/product-overview.png', 'MIMIC — SOP 제작부터 화면 위 실행 안내까지')}
          {p('클릭 한 번 한 번이 자동으로 캡처되어 단계별 스크린샷과 설명이 만들어집니다. 완성된 매뉴얼은 링크와 문서로 공유하고, 필요하면 학습 가이드나 확장 프로그램 기반 라이브 가이드 Beta로 실행을 안내할 수 있습니다.')}
          {h3('MIMIC으로 할 수 있는 것')}
          <ul style={{ paddingLeft: '20px', margin: '0 0 16px' }}>
            {[
              '신규 직원 온보딩 SOP와 매뉴얼 빠르게 제작',
              '고객 지원용 서비스 이용 가이드 공유',
              '반복 업무 프로세스 문서화',
              '캡처 화면 위 학습 가이드로 단계별 훈련',
              'PDF, PPTX, Word로 내보내기',
            ].map(li)}
          </ul>
        </div>
      );

    case 'install':
      return (
        <div>
          {h2('1. 확장 프로그램 설치')}
          {p('MIMIC Recorder는 Chrome 브라우저에서 동작하는 확장 프로그램입니다. 설치 후 MIMIC 홈 화면에서 바로 녹화를 시작할 수 있습니다.')}
          {h3('설치 방법')}
          <ol style={{ paddingLeft: '20px', margin: '0 0 16px' }}>
            {[
              'Chrome 웹 스토어에서 "MIMIC Recorder"를 검색해 설치합니다.',
              'MIMIC 홈 화면에서 "새로 만들기" 버튼을 클릭합니다.',
              '"새 매뉴얼(녹화)"를 선택하면 녹화 모달이 열립니다. 여기서 확장 연동이 자동으로 처리됩니다.',
            ].map(li)}
          </ol>
          {h3('확장을 찾을 수 없을 때')}
          {p('녹화 모달에서 "MIMIC Recorder 설치하기" 버튼이 나타나면 스토어로 이동해 설치하세요. 설치 후 "설치 완료 — 다시 시도" 버튼을 누르면 바로 연결됩니다.')}
          {h3('지원 브라우저')}
          {p('현재 Google Chrome 및 Chromium 기반 브라우저(Edge, Brave 등)를 지원합니다. Firefox, Safari는 지원하지 않습니다.')}
        </div>
      );

    case 'record':
      return (
        <div>
          {h2('2. 화면 녹화하기')}
          {p('녹화는 MIMIC 홈 화면에서 시작합니다. 평소처럼 업무를 진행하면 클릭할 때마다 자동으로 캡처됩니다.')}
          {h3('녹화 시작')}
          <ol style={{ paddingLeft: '20px', margin: '0 0 16px' }}>
            {[
              '홈 화면 우측 상단 "새로 만들기" 버튼을 클릭합니다.',
              '"새 매뉴얼(녹화)" 를 선택하면 녹화 안내 모달이 뜹니다.',
              '"페이지 선택하기 →" 버튼을 눌러 녹화할 탭을 선택합니다.',
              '"녹화 시작" 버튼을 누르면 해당 탭이 활성화되고 우측에 MIMIC Recorder 사이드 패널이 열립니다.',
              '사이드 패널의 녹화 버튼을 누르고 평소처럼 업무를 진행하세요. 클릭마다 자동으로 스크린샷이 캡처됩니다.',
              '완료 버튼을 눌러 녹화를 종료합니다.',
            ].map(li)}
          </ol>
          {h3('녹화 완료 후')}
          {p('녹화가 완료되면 AI가 자동으로 각 단계의 제목과 설명을 생성합니다. 홈 화면의 매뉴얼 탭에서 생성된 매뉴얼을 확인할 수 있습니다.')}
        </div>
      );

    case 'edit':
      return (
        <div>
          {h2('3. 매뉴얼 편집하기')}
          {p('생성된 매뉴얼은 에디터에서 자유롭게 수정할 수 있습니다.')}
          {h3('에디터 열기')}
          {p('홈 화면에서 매뉴얼을 클릭하면 뷰어가 열립니다. 우측 상단의 "편집" 버튼을 누르면 에디터 모드로 전환됩니다.')}
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
          {p('완성된 매뉴얼은 링크로 공유할 수 있습니다. 원본 URL과 확장 프로그램 조건이 맞으면 라이브 가이드 Beta로 실제 페이지 위에서 안내할 수도 있습니다.')}
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
          {h3('라이브 가이드 Beta 미리보기')}
          {p('매뉴얼에 원본 페이지 URL이 저장되어 있고 확장 프로그램이 연결되어 있으면 "라이브 가이드 Beta" 버튼이 활성화됩니다. 실제 페이지의 UI가 크게 바뀐 경우 일부 단계는 다시 녹화하거나 핫스팟을 조정해야 할 수 있습니다.')}
        </div>
      );

    case 'dashboard':
      return (
        <div>
          {h2('홈 화면')}
          {p('홈 화면은 매뉴얼, 플레이북, 폴더, 워크스페이스를 관리하는 작업 공간입니다.')}
          {img('/help/dashboard.png', '홈 화면 — 새로 만들기 메뉴와 콘텐츠 목록')}
          {h3('콘텐츠 유형 탭')}
          {p('상단에 2개의 탭으로 콘텐츠 유형을 전환할 수 있습니다.')}
          <ul style={{ paddingLeft: '20px', margin: '0 0 16px' }}>
            {[
              '매뉴얼 — 녹화로 만든 단계별 스크린샷 가이드',
              '플레이북 — 여러 매뉴얼을 하나로 엮은 통합 문서',
            ].map(li)}
          </ul>
          {p('학습 가이드와 라이브 가이드 Beta는 매뉴얼의 스튜디오에서 만들고 관리합니다.')}
          {h3('새 콘텐츠 만들기')}
          {p('"새로 만들기" 버튼을 클릭하면 드롭다운이 열립니다. 새 매뉴얼(녹화), 새 플레이북(통합 문서), 폴더를 만들 수 있습니다.')}
          {h3('내 워크스페이스 / 팀 워크스페이스')}
          {p('사이드바에서 개인 워크스페이스와 팀 워크스페이스를 전환할 수 있습니다. 팀 탭에서는 팀원과 공유하는 콘텐츠만 표시됩니다.')}
          {h3('검색')}
          {p('상단 검색창에 제목을 입력하면 현재 탭의 콘텐츠를 실시간으로 필터링합니다.')}
          {h3('폴더 관리')}
          <ul style={{ paddingLeft: '20px', margin: '0 0 16px' }}>
            {[
              '폴더 만들기: 우측 상단 "새로 만들기" → "폴더" 선택',
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
          {h3('팀 작업')}
          {p('팀 워크스페이스에서는 매뉴얼을 함께 관리하고, 팀원 초대와 권한 기반 접근을 사용할 수 있습니다. 여러 사용자의 동시 편집 상태를 실시간으로 보여주는 기능은 아직 제한적으로 제공됩니다.')}
        </div>
      );

    case 'practice':
      return (
        <div>
          {h2('학습 가이드')}
          {p('학습 가이드는 녹화된 화면 위에서 직접 클릭해보며 단계를 익히는 인터랙티브 연습입니다. 문서로 정리된 절차를 캡처 화면 위 행동으로 이어주며, 받는 사람은 별도 설치 없이 브라우저에서 연습할 수 있습니다.')}
          {h3('학습 가이드 만들기')}
          {p('매뉴얼의 스튜디오에서 학습 가이드를 생성·편집·공유합니다. 녹화된 매뉴얼이면 스튜디오에서 학습 가이드를 만들 수 있습니다.')}
          {h3('학습 가이드 공유')}
          {p('스튜디오에서 학습 가이드 링크를 복사해 팀원에게 공유하세요. 받는 사람은 별도 설치 없이 브라우저에서 바로 따라할 수 있습니다.')}
          {h3('연습 진행 방법')}
          <ol style={{ paddingLeft: '20px', margin: '0 0 16px' }}>
            {[
              '각 단계에서 화면 위의 핫스팟(강조 표시)을 찾습니다.',
              '핫스팟을 클릭하면 다음 단계로 자동 이동합니다.',
              '→ / ← 키보드로 단계를 앞뒤로 이동할 수도 있습니다.',
              'Esc 키로 연습을 종료합니다.',
            ].map(li)}
          </ol>
          {h3('학습 가이드 vs 라이브 가이드 Beta 차이')}
          <ul style={{ paddingLeft: '20px', margin: '0 0 16px' }}>
            {[
              '학습 가이드 — 캡처된 스크린샷 위에서 연습 (실제 사이트 미접속)',
              '라이브 가이드 Beta — 원본 URL과 확장 프로그램 조건이 맞을 때 실제 웹사이트 위에서 안내',
            ].map(li)}
          </ul>
        </div>
      );

    case 'playbook':
      return (
        <div>
          {h2('플레이북')}
          {p('플레이북은 여러 매뉴얼과 텍스트를 하나의 통합 문서로 엮는 기능입니다. 온보딩 가이드, 프로세스 문서, SOP 패키지 등 복합 문서를 만들 때 사용합니다.')}
          {h3('플레이북 만들기')}
          <ol style={{ paddingLeft: '20px', margin: '0 0 16px' }}>
            {[
              '홈 화면 우측 상단 "새로 만들기"에서 "새 플레이북(통합 문서)"를 선택합니다.',
              '또는 홈 화면 "플레이북" 탭에서 "새 플레이북 만들기"를 클릭합니다.',
              '제목을 입력하고 빈 에디터가 열립니다.',
            ].map(li)}
          </ol>
          {h3('편집기 사용법')}
          {p('플레이북 에디터는 블록 기반 문서 편집기입니다.')}
          <ul style={{ paddingLeft: '20px', margin: '0 0 16px' }}>
            {[
              '/ 를 입력하면 슬래시 메뉴가 열려 블록 유형(제목, 목록, 코드블록 등)을 선택할 수 있습니다.',
              '"가이드 임베드"를 선택하면 기존 매뉴얼을 문서 안에 삽입할 수 있습니다.',
              '왼쪽 핸들(⋮⋮)을 드래그해 블록 순서를 변경합니다.',
              '핸들 클릭 → 변환 메뉴로 블록 유형을 전환할 수 있습니다.',
            ].map(li)}
          </ul>
          {h3('공유')}
          {p('플레이북도 일반 매뉴얼과 동일하게 공유 링크를 생성해 팀원이나 고객에게 전달할 수 있습니다.')}
        </div>
      );

    case 'guide-me':
      return (
        <div>
          {h2('라이브 가이드 Beta')}
          {p('라이브 가이드 Beta는 실제 웹페이지 위에 오버레이를 띄워 단계별로 안내하는 기능입니다. 현재는 원본 URL이 저장된 매뉴얼과 MIMIC Recorder 확장 프로그램이 필요하며, 페이지 구조가 바뀌면 일부 단계가 맞지 않을 수 있습니다.')}
          {img('/help/live-guide.jpg', '라이브 가이드 Beta — 실제 페이지 위 AI 말풍선·핫스팟')}
          {h3('사용 조건')}
          {p('MIMIC Recorder 확장 프로그램이 설치되어 있고, 녹화 시 원본 페이지 URL이 저장되어 있어야 합니다. 무료 플랜에서는 사용량 제한이 적용될 수 있습니다.')}
          {h3('실행 방법 (받는 사람)')}
          <ol style={{ paddingLeft: '20px', margin: '0 0 16px' }}>
            {[
              '매뉴얼 또는 스튜디오에서 "라이브 가이드 Beta" 버튼을 클릭합니다.',
              '원본 페이지가 새 탭에서 열리고 확장 프로그램이 오버레이를 표시합니다.',
              '각 단계에서 클릭해야 할 요소가 하이라이트되고 AI 말풍선으로 설명이 표시됩니다.',
              '표시된 곳을 클릭하면 다음 단계로 자동으로 넘어갑니다.',
            ].map(li)}
          </ol>
          {h3('키보드 단축키')}
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
          {h3('버튼이 안 찾아질 때')}
          {p('원본 페이지의 UI가 변경됐을 수 있습니다. 매뉴얼 에디터에서 해당 단계를 다시 녹화하거나 수동으로 핫스팟 위치를 수정하세요.')}
        </div>
      );

    case 'export':
      return (
        <div>
          {h2('내보내기')}
          {p('완성된 매뉴얼을 다양한 형식으로 내보낼 수 있습니다.')}
          {img('/help/export.png', '매뉴얼 상단의 PDF·PPTX·Word 내보내기 버튼')}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', margin: '0 0 24px' }}>
            {[
              { format: 'PDF', desc: '스크린샷 + 설명이 포함된 PDF 문서', badge: '#fee2e2', badgeText: '#dc2626' },
              { format: 'PPTX', desc: '슬라이드 형식의 파워포인트 파일', badge: '#fef3c7', badgeText: '#d97706' },
              { format: 'Word', desc: '문서 편집과 공유에 적합한 .docx 파일', badge: '#d1fae5', badgeText: '#059669' },
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
              '매뉴얼 뷰어 상단: PDF, PPTX, Word 버튼',
              '공유 플레이어: PDF, PPTX, Word 버튼',
            ].map(li)}
          </ul>
        </div>
      );

    case 'share-link':
      return (
        <div>
          {h2('공유 링크')}
          {p('매뉴얼을 링크로 공유하면 로그인 없이 누구나 볼 수 있습니다.')}
          {img('/help/share-player.png', '공유 플레이어 — 슬라이드·웹 문서·학습 가이드로 볼 수 있어요')}
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
          {p('공유 링크로 접속하면 슬라이드 모드와 문서 모드 두 가지로 매뉴얼을 볼 수 있습니다. 자동 재생, 속도 조절, PDF/PPTX/Word 내보내기도 지원합니다.')}
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
              '사이드바 "팀 워크스페이스" 섹션 하단의 새 워크스페이스 버튼을 클릭합니다.',
              '워크스페이스 이름을 입력합니다.',
            ].map(li)}
          </ol>
          {h3('팀원 초대')}
          {p('워크스페이스 설정에서 팀원 이메일로 초대 링크를 보낼 수 있습니다.')}
          {h3('매뉴얼 이동')}
          {p('개인 매뉴얼을 팀 워크스페이스로 이동하거나, 팀 매뉴얼을 다시 개인으로 이동할 수 있습니다. 카드 메뉴(⋮) → "팀으로 이동"을 선택하세요.')}
          {h3('팀 작업')}
          {p('워크스페이스 내 매뉴얼을 팀원이 함께 관리할 수 있습니다. 초대 링크와 멤버 관리로 접근 권한을 나누고, 필요한 매뉴얼을 개인 워크스페이스와 팀 워크스페이스 사이에서 이동할 수 있습니다.')}
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
                features: ['일 3회 매뉴얼 생성', '기본 공유 링크', 'PDF 내보내기', '학습 가이드 확인'],
              },
              {
                name: 'Pro',
                price: '문의',
                color: '#EEF2FF',
                border: '#a5b4fc',
                features: ['매뉴얼 생성 한도 확대', 'PDF/PPTX/Word 내보내기', '비밀번호 보호', '학습 가이드 + 라이브 가이드 Beta'],
                highlight: true,
              },
              {
                name: 'Team',
                price: '문의',
                color: '#F5F3FF',
                border: '#c4b5fd',
                features: ['Pro 포함 전체 기능', '팀 워크스페이스', '멤버 관리', '팀 단위 지원'],
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
              a: 'Chrome 확장 프로그램으로 업무 화면을 녹화해 SOP와 인터랙티브 매뉴얼을 자동 생성하는 서비스입니다. 클릭 동작이 자동 캡처되어 단계별 스크린샷과 설명이 만들어지고, 링크·문서·학습 가이드로 공유할 수 있습니다. 조건이 맞으면 라이브 가이드 Beta로 실제 페이지 위 안내도 사용할 수 있습니다.',
            },
            {
              q: '확장 프로그램은 어디서 설치하나요?',
              a: 'Chrome 웹 스토어에서 "MIMIC Recorder"를 검색해 설치하세요. Edge, Brave 등 Chromium 기반 브라우저도 지원합니다. Firefox, Safari는 현재 지원하지 않습니다.',
            },
            {
              q: '매뉴얼 생성이 안 돼요.',
              a: '무료 플랜은 하루 3회까지 생성 가능합니다. 자정에 횟수가 초기화됩니다. 더 많은 생성 한도와 고급 기능이 필요하면 Pro 출시 알림 또는 기업 문의를 이용하세요.',
            },
            {
              q: '라이브 가이드 Beta가 버튼을 못 찾아요.',
              a: '원본 페이지의 UI가 변경됐을 수 있습니다. 매뉴얼 에디터에서 해당 단계를 다시 녹화하거나 수동으로 핫스팟 위치를 수정하세요.',
            },
            {
              q: '라이브 가이드 Beta는 어떻게 사용하나요?',
              a: '매뉴얼에 원본 페이지 URL이 저장되어 있고 확장 프로그램이 연결되어 있으면 "라이브 가이드 Beta" 버튼이 활성화됩니다. 클릭하면 새 탭에서 원본 페이지가 열리고 오버레이 안내가 시작됩니다. → 다음, ← 이전, Esc 닫기 키보드도 지원합니다.',
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
              a: 'Word(.docx) 형식도 지원합니다. 매뉴얼 뷰어와 공유 플레이어에서 PDF, PPTX, Word 형식으로 내보낼 수 있습니다.',
            },
            {
              q: '공유 링크에 비밀번호를 설정하고 싶어요.',
              a: '매뉴얼 편집기 → 설정(⚙) → 공유 비밀번호 입력 → 저장하면 됩니다. 비밀번호를 비워두면 보호가 해제됩니다.',
            },
            {
              q: '팀원을 초대하려면 어떻게 하나요?',
              a: '팀 워크스페이스 설정에서 팀원 이메일로 초대 링크를 전송할 수 있습니다. 초대된 팀원은 권한에 따라 워크스페이스 내 매뉴얼을 함께 관리할 수 있습니다.',
            },
            {
              q: '매뉴얼을 팀 워크스페이스로 이동하려면?',
              a: '홈 화면에서 매뉴얼 카드 우측 메뉴(⋮) → "팀으로 이동"을 선택하세요. 반대로 팀 매뉴얼을 개인으로 이동하는 것도 가능합니다.',
            },
            {
              q: '학습 가이드와 라이브 가이드 Beta의 차이가 뭔가요?',
              a: '학습 가이드는 캡처된 스크린샷 위에서 연습하는 모드로, 실제 사이트에 접속하지 않습니다. 라이브 가이드 Beta는 원본 URL과 확장 프로그램 조건이 맞을 때 실제 웹사이트 위에 오버레이를 띄워 안내합니다. 먼저 학습 가이드로 안정적으로 공유하고, 실제 업무 수행 안내가 필요할 때 라이브 가이드 Beta를 사용하세요.',
            },
            {
              q: '플레이북이 뭔가요?',
              a: '여러 매뉴얼과 텍스트를 하나의 통합 문서로 엮는 기능입니다. 홈 화면 "새로 만들기"에서 "새 플레이북(통합 문서)"을 선택하거나, "플레이북" 탭에서 만들 수 있습니다. 슬래시(/) 명령으로 제목, 목록, 코드블록, 가이드 임베드 등의 블록을 추가할 수 있습니다.',
            },
            {
              q: '무료 플랜과 Pro 플랜의 차이는 무엇인가요?',
              a: '무료는 일 3회 매뉴얼 생성, 기본 공유, PDF 내보내기를 지원합니다. Pro는 생성 한도 확대, PDF/PPTX/Word 내보내기, 비밀번호 보호, 학습 가이드와 라이브 가이드 Beta를 포함할 예정입니다. 가격 문의는 support@mimic.so로 연락해주세요.',
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

  useEffect(() => {
    const syncFromHash = () => {
      const nextId = window.location.hash.replace('#', '');
      if (nextId && ALL_SECTION_IDS.includes(nextId)) setActiveId(nextId);
    };

    syncFromHash();
    window.addEventListener('hashchange', syncFromHash);
    return () => window.removeEventListener('hashchange', syncFromHash);
  }, []);

  const selectSection = (id: string) => {
    setActiveId(id);
    window.history.replaceState(null, '', `#${id}`);
  };

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
          홈으로 →
        </Link>
      </header>

      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '40px 24px', display: 'grid', gridTemplateColumns: '220px 1fr', gap: '32px', alignItems: 'start' }}>
        {/* 사이드바 목차 */}
        <nav style={{ position: 'sticky', top: '80px', background: 'white', borderRadius: '12px', border: '1px solid #E5E7EB', padding: '12px', overflow: 'hidden' }}>
          {SECTIONS.map(section => (
            <div key={section.id}>
              <button
                onClick={() => selectSection(section.id)}
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
                      onClick={() => selectSection(child.id)}
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
              const idx = ALL_SECTION_IDS.indexOf(activeId);
              const prevId = idx > 0 ? ALL_SECTION_IDS[idx - 1] : null;
              const nextId = idx < ALL_SECTION_IDS.length - 1 ? ALL_SECTION_IDS[idx + 1] : null;
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
                    ? <button onClick={() => selectSection(prevId)} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '8px', border: '1px solid #E5E7EB', background: 'white', cursor: 'pointer', fontSize: '13px', color: '#374151' }}>← {findLabel(prevId)}</button>
                    : <div />}
                  {nextId
                    ? <button onClick={() => selectSection(nextId)} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '8px', border: '1px solid #E5E7EB', background: 'white', cursor: 'pointer', fontSize: '13px', color: '#374151' }}>{findLabel(nextId)} →</button>
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
