'use client';

import { useEffect, useState } from 'react';

type Theme = 'light' | 'dark';

function getTheme(): Theme {
  try {
    const s = localStorage.getItem('mm-theme');
    if (s === 'dark' || s === 'light') return s;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

function applyTheme(theme: Theme) {
  document.documentElement.setAttribute('data-theme', theme);
  // transition 클래스는 첫 적용 후 추가 (깜빡임 방지)
  requestAnimationFrame(() => {
    document.documentElement.classList.add('mm-theme-ready');
  });
  try { localStorage.setItem('mm-theme', theme); } catch {}
}

export function ThemeToggle({ className }: { className?: string }) {
  const [theme, setTheme] = useState<Theme>('light');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setTheme(getTheme());
    setMounted(true);

    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => {
      // 수동으로 설정된 경우 시스템 변경 무시
      if (!localStorage.getItem('mm-theme')) {
        const next = mq.matches ? 'dark' : 'light';
        setTheme(next);
        applyTheme(next);
      }
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const toggle = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    applyTheme(next);
  };

  // 마운트 전에는 서버/클라이언트 불일치 방지를 위해 렌더 생략
  if (!mounted) return <div style={{ width: '36px', height: '36px' }} />;

  const isDark = theme === 'dark';

  return (
    <button
      onClick={toggle}
      className={className}
      title={isDark ? '라이트 모드로 전환' : '다크 모드로 전환'}
      style={{
        width: '36px',
        height: '36px',
        borderRadius: '8px',
        border: '1px solid var(--mm-border)',
        background: 'var(--mm-bg-soft)',
        color: 'var(--mm-text-2)',
        display: 'grid',
        placeItems: 'center',
        cursor: 'pointer',
        flexShrink: 0,
        transition: 'background 0.18s, border-color 0.18s, color 0.18s',
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLElement).style.background = 'var(--mm-bg-subtle)';
        (e.currentTarget as HTMLElement).style.color = 'var(--mm-text-1)';
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.background = 'var(--mm-bg-soft)';
        (e.currentTarget as HTMLElement).style.color = 'var(--mm-text-2)';
      }}
    >
      {isDark ? (
        // Sun icon
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="12" cy="12" r="4"/>
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>
        </svg>
      ) : (
        // Moon icon
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
        </svg>
      )}
    </button>
  );
}
