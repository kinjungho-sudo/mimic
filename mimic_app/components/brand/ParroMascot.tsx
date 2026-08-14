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

const PARRO_FRONT_ASSET = '/brand/parro-3d-neutral.png?v=20260814b';
const PARRO_POINT_ASSET = '/brand/parro-3d-point.png?v=20260814b';

/** A stable Parro guide avatar with a restrained pointing pose for contextual guidance. */
export function ParroMascot({ size = 48, className, state = 'neutral', mirror = false }: ParroMascotProps) {
  const asset = state === 'point' ? PARRO_POINT_ASSET : PARRO_FRONT_ASSET;
  return (
    <span
      className={[styles.frame, className ?? ''].filter(Boolean).join(' ')}
      style={{ width: size, height: size }}
      data-parro-state={state}
      role="img"
      aria-label="Parro AI 가이드"
    >
      <span className={styles.visual} style={{ transform: mirror ? 'scaleX(-1)' : undefined }}>
        <span className={styles.stack}>
          <Image className={styles.layer} src={asset} alt="" width={size} height={size} draggable={false} />
        </span>
      </span>
    </span>
  );
}
