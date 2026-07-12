import { ImageResponse } from 'next/og';
import type { NextRequest } from 'next/server';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const title = searchParams.get('title') ?? '포리';
  const sub = searchParams.get('sub') ?? '30초 만에 인터랙티브 매뉴얼';

  return new ImageResponse(
    (
      <div
        style={{
          width: '1200px',
          height: '630px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          justifyContent: 'flex-end',
          background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4c1d95 100%)',
          padding: '60px',
          fontFamily: 'sans-serif',
          position: 'relative',
        }}
      >
        {/* 배경 장식 원 */}
        <div
          style={{
            position: 'absolute',
            top: '-80px',
            right: '-80px',
            width: '400px',
            height: '400px',
            borderRadius: '50%',
            background: 'rgba(99,102,241,0.2)',
            display: 'flex',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: '-40px',
            left: '400px',
            width: '250px',
            height: '250px',
            borderRadius: '50%',
            background: 'rgba(167,139,250,0.1)',
            display: 'flex',
          }}
        />

        {/* 서비스명 배지 */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'rgba(255,255,255,0.12)',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: '999px',
            padding: '6px 16px',
            marginBottom: '24px',
          }}
        >
          <div
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: '#a78bfa',
              display: 'flex',
            }}
          />
          <span style={{ color: '#c4b5fd', fontSize: '16px', fontWeight: 600 }}>
            포리
          </span>
        </div>

        {/* 제목 */}
        <div
          style={{
            color: 'white',
            fontSize: title.length > 20 ? '52px' : '64px',
            fontWeight: 800,
            lineHeight: 1.15,
            marginBottom: '16px',
            maxWidth: '900px',
          }}
        >
          {title}
        </div>

        {/* 부제 */}
        <div
          style={{
            color: '#c4b5fd',
            fontSize: '28px',
            fontWeight: 400,
            lineHeight: 1.4,
          }}
        >
          {sub}
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    },
  );
}
