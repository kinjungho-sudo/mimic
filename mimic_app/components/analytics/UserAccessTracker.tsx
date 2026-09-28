'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

const trackedRoots = [
  '/home', '/dashboard', '/manual', '/workspace', '/mypage',
  '/settings', '/trash', '/pages', '/extension-link',
  '/download', '/desktop-setup', '/admin',
];

export function UserAccessTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname || !trackedRoots.some(root => pathname === root || pathname.startsWith(`${root}/`))) return;

    void fetch('/api/user/access', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: pathname }),
      keepalive: true,
    }).catch(() => undefined);
  }, [pathname]);

  return null;
}
