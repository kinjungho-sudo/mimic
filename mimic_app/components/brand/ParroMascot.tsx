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

/** A stable, front-facing Parro guide avatar. State props remain for API compatibility. */
export function ParroMascot({ size = 48, className, state = 'neutral' }: ParroMascotProps) {
  return (
    <span
      className={[styles.frame, className ?? ''].filter(Boolean).join(' ')}
      style={{ width: size, height: size }}
      data-parro-state={state}
      role="img"
      aria-label="Parro AI 가이드"
    >
      <span className={styles.visual}>
        <span className={styles.stack}>
          <Image className={styles.layer} src={PARRO_FRONT_ASSET} alt="" width={size} height={size} draggable={false} />
        </span>
      </span>
    </span>
  );
}
