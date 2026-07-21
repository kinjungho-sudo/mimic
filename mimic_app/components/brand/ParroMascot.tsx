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

const STATE_ASSETS: Record<ParroMascotState, string> = {
  idle: '/brand/parro-ai-avatar-neutral.png',
  neutral: '/brand/parro-ai-avatar-neutral.png',
  listen: '/brand/parro-ai-avatar-listen.png',
  talk: '/brand/parro-ai-avatar-talk.png',
  point: '/brand/parro-ai-avatar-point.png',
  think: '/brand/parro-ai-avatar-think.png',
  search: '/brand/parro-ai-avatar-search.png',
  warning: '/brand/parro-ai-avatar-warning.png',
  error: '/brand/parro-ai-avatar-error.png',
  blocked: '/brand/parro-ai-avatar-blocked.png',
  clarify: '/brand/parro-ai-avatar-clarify.png',
  success: '/brand/parro-ai-avatar-success.png',
};

const STATE_SEQUENCES: Record<ParroMascotState, ParroMascotState> = {
  idle: 'listen',
  neutral: 'listen',
  listen: 'neutral',
  talk: 'point',
  point: 'talk',
  think: 'search',
  search: 'think',
  warning: 'blocked',
  error: 'clarify',
  blocked: 'warning',
  clarify: 'neutral',
  success: 'talk',
};

const SEQUENCE_CLASSES: Record<ParroMascotState, string> = {
  idle: styles.sequence,
  neutral: styles.sequence,
  listen: styles.sequenceListen,
  talk: styles.sequenceTalk,
  point: styles.sequencePoint,
  think: styles.sequenceThink,
  search: styles.sequenceSearch,
  warning: styles.sequenceWarning,
  error: styles.sequenceError,
  blocked: styles.sequenceBlocked,
  clarify: styles.sequenceClarify,
  success: styles.sequenceSuccess,
};

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
  motion = true,
  mirror = false,
}: ParroMascotProps) {
  const secondaryState = STATE_SEQUENCES[state];
  const frameClassName = [styles.frame, mirror ? styles.mirror : '', className ?? '']
    .filter(Boolean)
    .join(' ');
  const visualClassName = [
    styles.visual,
    motion ? styles[state] : '',
    motion ? styles.sequence : '',
    motion ? SEQUENCE_CLASSES[state] : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <span
      className={frameClassName}
      style={{ width: size, height: size }}
      data-parro-state={state}
      role="img"
      aria-label={`Parro AI 가이드 — ${STATE_LABELS[state]}`}
    >
      <span className={visualClassName}>
        <span className={styles.stack}>
          <Image
            className={`${styles.layer} ${styles.primaryLayer}`}
            src={STATE_ASSETS[state]}
            alt=""
            width={size}
            height={size}
            draggable={false}
          />
          {motion && (
            <Image
              className={`${styles.layer} ${styles.secondaryLayer}`}
              src={STATE_ASSETS[secondaryState]}
              alt=""
              width={size}
              height={size}
              draggable={false}
            />
          )}
        </span>
      </span>
    </span>
  );
}
