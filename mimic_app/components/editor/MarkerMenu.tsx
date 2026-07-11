'use client';

import { useState } from 'react';
import { Crosshair, ZoomIn, Volume2, Type, Trash2 } from 'lucide-react';

interface MarkerMenuProps {
  style?: React.CSSProperties;
  onClose: () => void;
}

export function MarkerMenu({ style, onClose }: MarkerMenuProps) {
  const [clickSoundOn, setClickSoundOn] = useState(true);
  const [typingOn, setTypingOn] = useState(false);

  const items = [
    { icon: <Crosshair size={14} />, label: '주석 달기', danger: false, toggle: null },
    { icon: <ZoomIn size={14} />, label: '줌인 영역', danger: false, toggle: null },
    {
      icon: <Volume2 size={14} />,
      label: '클릭 사운드',
      danger: false,
      toggle: { value: clickSoundOn, set: setClickSoundOn },
    },
    {
      icon: <Type size={14} />,
      label: '타이핑 효과',
      danger: false,
      toggle: { value: typingOn, set: setTypingOn },
    },
  ];

  return (
    <>
      {/* Backdrop */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 25 }} onClick={onClose} />

      <div
        style={{
          background: 'white',
          border: '1px solid #E5E7EB',
          borderRadius: '10px',
          boxShadow: '0 14px 32px rgba(17,24,39,0.14)',
          padding: '6px',
          zIndex: 30,
          minWidth: '180px',
          ...style,
        }}
      >
        {items.map(item => (
          <div
            key={item.label}
            onClick={() => {
              if (item.toggle) item.toggle.set((v: boolean) => !v);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '8px 10px',
              borderRadius: '6px',
              fontSize: '12.5px',
              color: '#4B5563',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'background 0.18s ease',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#F9FAFB'; e.currentTarget.style.color = '#111827'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#4B5563'; }}
          >
            <span style={{ color: '#6B7280', flexShrink: 0 }}>{item.icon}</span>
            <span style={{ flex: 1 }}>{item.label}</span>
            {item.toggle && (
              <span
                style={{
                  marginLeft: 'auto',
                  width: '28px',
                  height: '16px',
                  borderRadius: '999px',
                  background: item.toggle.value ? '#009B8E' : '#E5E7EB',
                  position: 'relative',
                  flexShrink: 0,
                  transition: 'background 0.18s ease',
                }}
              >
                <span
                  style={{
                    position: 'absolute',
                    width: '12px',
                    height: '12px',
                    borderRadius: '50%',
                    background: 'white',
                    top: '2px',
                    left: item.toggle.value ? '14px' : '2px',
                    transition: 'left 0.18s ease',
                  }}
                />
              </span>
            )}
          </div>
        ))}

        <div style={{ height: '1px', background: '#F3F4F6', margin: '4px 0' }} />

        <div
          onClick={onClose}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '8px 10px',
            borderRadius: '6px',
            fontSize: '12.5px',
            color: '#DC2626',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            transition: 'background 0.18s ease',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(220,38,38,0.06)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
        >
          <Trash2 size={14} color="#DC2626" />
          하이라이트 삭제
        </div>
      </div>
    </>
  );
}
