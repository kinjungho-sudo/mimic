'use client';

import { useRef, useState } from 'react';
import styles from './page.module.css';

export function DownloadButton({ href }: { href: string }) {
  const locked = useRef(false);
  const [downloading, setDownloading] = useState(false);

  return (
    <a
      className={styles.downloadButton}
      data-testid="desktop-download"
      data-downloading={downloading ? 'true' : 'false'}
      href={href}
      download="ParroDesktopSetup.exe"
      aria-disabled={downloading}
      onClick={event => {
        if (locked.current) {
          event.preventDefault();
          return;
        }
        locked.current = true;
        setDownloading(true);
        window.setTimeout(() => {
          locked.current = false;
          setDownloading(false);
        }, 4000);
      }}
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 3v12m0 0 5-5m-5 5-5-5" />
        <path d="M5 21h14" />
      </svg>
      {downloading ? '다운로드 시작됨' : 'Windows용 다운로드'}
    </a>
  );
}
