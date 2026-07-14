import { ImageResponse } from 'next/og';
import type { NextRequest } from 'next/server';
import { BRAND_COLORS, BRAND_NAME, BRAND_TAGLINE } from '@/lib/brand';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const title = searchParams.get('title') ?? BRAND_NAME;
  const sub = searchParams.get('sub') ?? BRAND_TAGLINE;

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
          background: `linear-gradient(135deg, ${BRAND_COLORS.pointer} 0%, ${BRAND_COLORS.primary} 55%, ${BRAND_COLORS.guide} 100%)`,
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
            background: 'rgba(18,184,134,0.22)',
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
            background: 'rgba(141,214,63,0.16)',
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
              background: BRAND_COLORS.accent,
              display: 'flex',
            }}
          />
          <span style={{ color: BRAND_COLORS.guideSoft, fontSize: '16px', fontWeight: 600 }}>
            {BRAND_NAME}
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
            color: BRAND_COLORS.guideSoft,
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
