'use client';

import Image from 'next/image';
import styles from './ParroMascot.module.css';

export type ParroMascotState =
  | 'idle'
  | 'neutral'
  | 'listen'
  | 'talk'
  | 'point'
  | 'think'
  | 'search'
  | 'warning'
  | 'error'
  | 'blocked'
  | 'clarify'
  | 'success';

type ParroMascotProps = {
  size?: number;
  className?: string;
  state?: ParroMascotState;
  motion?: boolean;
  mirror?: boolean;
};

const PARRO_FRONT_ASSET = '/brand/parro-3d-neutral.png';

const STATE_LABELS: Record<ParroMascotState, string> = {
  idle: '대기 중',
  neutral: '대기 중',
  listen: '듣는 중',
  talk: '안내 중',
  point: '위치 안내 중',
  think: '생각 중',
  search: '검색 중',
  warning: '주의 안내',
  error: '오류 안내',
  blocked: '중단 안내',
  clarify: '확인 요청',
  success: '완료',
};

/** Parro의 표정·동작 상태를 공유하는 AI 가이드 아바타. */
export function ParroMascot({
  size = 48,
  className,
  state = 'neutral',
}: ParroMascotProps) {
  const frameClassName = [styles.frame, className ?? ''].filter(Boolean).join(' ');

  return (
    <span
      className={frameClassName}
      style={{ width: size, height: size }}
      data-parro-state={state}
      role="img"
      aria-label={`Parro AI 가이드 — ${STATE_LABELS[state]}`}
    >
      <span className={styles.visual}>
        <span className={styles.stack}>
          <Image
            className={styles.layer}
            src={PARRO_FRONT_ASSET}
            alt=""
            width={size}
            height={size}
            draggable={false}
          />
        </span>
      </span>
    </span>
  );
}
