'use client';
// production 빌드에서 /sw.js 를 등록한다.
import { useEffect } from 'react';

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;
    if (process.env.NODE_ENV !== 'production') return;
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // 등록 실패는 silent — PWA 가 동작하지 않을 뿐 앱은 정상.
    });
  }, []);
  return null;
}
