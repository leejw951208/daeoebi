'use client';
// Service Worker 갱신 감지 시 사용자에게 새로고침을 안내하는 토스트.
import { useEffect, useState } from 'react';

export function UpdateToast() {
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;
    if (process.env.NODE_ENV !== 'production') return;

    let cancelled = false;

    navigator.serviceWorker.ready.then((registration) => {
      if (cancelled) return;

      const trackWaiting = () => {
        if (registration.waiting) setWaitingWorker(registration.waiting);
      };

      trackWaiting();

      registration.addEventListener('updatefound', () => {
        const installing = registration.installing;
        if (!installing) return;
        installing.addEventListener('statechange', () => {
          if (installing.state === 'installed' && navigator.serviceWorker.controller) {
            setWaitingWorker(installing);
          }
        });
      });
    });

    return () => {
      cancelled = true;
    };
  }, []);

  if (!waitingWorker) return null;

  return (
    <div role="status" className="update-toast">
      <span>새 버전이 있습니다</span>
      <button
        type="button"
        onClick={() => {
          waitingWorker.postMessage({ type: 'SKIP_WAITING' });
          window.location.reload();
        }}
      >
        새로고침
      </button>
    </div>
  );
}
