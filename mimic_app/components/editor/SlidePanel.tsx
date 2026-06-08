'use client';

import { Plus } from 'lucide-react';

export interface SlideThumb {
  id: string;
  number: number;
  title: string;
  highlightCount: number;
  markers: Array<{ top?: string; bottom?: string; left?: string; right?: string }>;
}

interface SlidePanelProps {
  slides: SlideThumb[];
  activeSlideId: string;
  onSlideSelect: (id: string) => void;
  onAddSlide: () => void;
}

export function SlidePanel({ slides, activeSlideId, onSlideSelect, onAddSlide }: SlidePanelProps) {
  return (
    <aside
      style={{
        gridColumn: '1',
        gridRow: '2 / 4',
        background: 'white',
        borderRight: '1px solid #F3F4F6',
        padding: '12px 10px',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '4px 6px 12px',
          borderBottom: '1px solid #F3F4F6',
          marginBottom: '8px',
          fontSize: '11.5px',
          color: '#6B7280',
          fontWeight: 500,
        }}
      >
        <span>슬라이드 {slides.length}</span>
        <button
          onClick={onAddSlide}
          title="추가"
          style={{
            width: '22px',
            height: '22px',
            display: 'grid',
            placeItems: 'center',
            borderRadius: '5px',
            color: '#9CA3AF',
            cursor: 'pointer',
            transition: 'background 0.18s ease, color 0.18s ease',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = '#F3F4F6';
            e.currentTarget.style.color = '#374151';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.color = '#9CA3AF';
          }}
        >
          <Plus size={13} />
        </button>
      </div>

      {/* Slide thumbs */}
      {slides.map(slide => {
        const isActive = slide.id === activeSlideId;
        return (
          <div
            key={slide.id}
            onClick={() => onSlideSelect(slide.id)}
            style={{
              display: 'flex',
              flexDirection: 'column',
              padding: '8px',
              borderRadius: '8px',
              marginBottom: '6px',
              cursor: 'pointer',
              border: `2px solid ${isActive ? '#3730a3' : 'transparent'}`,
              background: isActive ? '#e0e7ff' : 'transparent',
              transition: 'background 0.18s ease, border-color 0.18s ease',
            }}
            onMouseEnter={e => {
              if (!isActive) e.currentTarget.style.background = '#FAFAFA';
            }}
            onMouseLeave={e => {
              if (!isActive) e.currentTarget.style.background = 'transparent';
            }}
          >
            {/* Number row */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: '10.5px',
                color: isActive ? '#3730a3' : '#6B7280',
                fontWeight: 500,
                marginBottom: '5px',
              }}
            >
              <span>{slide.number}</span>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '3px',
                  padding: '1px 6px',
                  background: 'rgba(245,158,11,0.14)',
                  color: '#B45309',
                  borderRadius: '999px',
                  fontSize: '9.5px',
                }}
              >
                <span
                  style={{
                    width: '5px',
                    height: '5px',
                    borderRadius: '50%',
                    background: '#F59E0B',
                    display: 'inline-block',
                  }}
                />
                {slide.highlightCount}
              </span>
            </div>

            {/* Preview */}
            <div
              style={{
                height: '70px',
                background: 'white',
                border: '1px solid #E5E7EB',
                borderRadius: '5px',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  inset: '4px',
                  background: '#F9FAFB',
                  borderRadius: '3px',
                }}
              >
                <div style={{ height: '3px', background: '#6B7280', borderRadius: '1px', margin: '6px 6px 2px', width: '60%' }} />
                <div style={{ height: '3px', background: '#D1D5DB', borderRadius: '1px', margin: '0 6px 2px', width: '70%' }} />
                <div style={{ height: '3px', background: '#D1D5DB', borderRadius: '1px', margin: '0 6px 2px', width: '40%' }} />
                {slide.markers.map((m, i) => (
                  <span
                    key={i}
                    style={{
                      position: 'absolute',
                      width: '9px',
                      height: '9px',
                      borderRadius: '50%',
                      background: '#F59E0B',
                      top: m.top,
                      bottom: m.bottom,
                      left: m.left,
                      right: m.right,
                    }}
                  />
                ))}
              </div>
            </div>

            {/* Title */}
            <div
              style={{
                fontSize: '11px',
                color: isActive ? '#111827' : '#4B5563',
                fontWeight: isActive ? 500 : 400,
                marginTop: '6px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {slide.title}
            </div>
          </div>
        );
      })}

      {/* Add slide button */}
      <button
        onClick={onAddSlide}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '5px',
          height: '38px',
          marginTop: '8px',
          border: '1.5px dashed #E5E7EB',
          borderRadius: '7px',
          fontSize: '11.5px',
          color: '#6B7280',
          cursor: 'pointer',
          whiteSpace: 'nowrap',
          transition: 'border-color 0.18s ease, color 0.18s ease',
          background: 'transparent',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.borderColor = '#3730a3';
          e.currentTarget.style.color = '#3730a3';
        }}
        onMouseLeave={e => {
          e.currentTarget.style.borderColor = '#E5E7EB';
          e.currentTarget.style.color = '#6B7280';
        }}
      >
        <Plus size={12} />
        단계 추가
      </button>
    </aside>
  );
}
