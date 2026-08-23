'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

type ConnectionStatus = 'idle' | 'connecting' | 'live' | 'error';

interface RefreshRemoteOrdersProps {
  onStatusChange?: (status: ConnectionStatus) => void;
  onRefreshed?: () => void;
}

// 主轮询：每 5 秒查一次"上次游标之后有没有新订单"。有就 router.refresh()。
const POLL_INTERVAL_MS = 5_000;
// 兜底轮询：即使游标没变化也强制刷新一次，覆盖 webhook 写入但 updated_at
// 没前进、或 RLS 命中但 revalidate 没触发的边缘情况。
const FALLBACK_REFRESH_MS = 30_000;

type DispatchPollResponse = {
  fingerprint: string | null;
};

export default function RefreshRemoteOrders({ onStatusChange, onRefreshed }: RefreshRemoteOrdersProps) {
  const router = useRouter();
  const connectionStatusRef = useRef<ConnectionStatus>('idle');
  const setConnectionStatus = (next: ConnectionStatus) => {
    connectionStatusRef.current = next;
  };

  const onStatusChangeRef = useRef(onStatusChange);
  const onRefreshedRef = useRef(onRefreshed);
  useEffect(() => {
    onStatusChangeRef.current = onStatusChange;
    onRefreshedRef.current = onRefreshed;
  }, [onStatusChange, onRefreshed]);

  useEffect(() => {
    let cancelled = false;
    setConnectionStatus('connecting');
    onStatusChangeRef.current?.('connecting');

    const setStatus = (next: ConnectionStatus) => {
      if (cancelled) return;
      setConnectionStatus(next);
      onStatusChangeRef.current?.(next);
    };

    // 首次请求只建立基线，后续指纹变化时刷新服务端组件。
    let lastFingerprint: string | null | undefined;
    let inFlight = false;
    let consecutiveErrors = 0;

    const tick = async () => {
      if (cancelled || inFlight) return;
      inFlight = true;
      try {
        const response = await fetch('/api/orders/dispatch/latest', {
          cache: 'no-store',
          credentials: 'same-origin',
        });

        if (cancelled) return;

        if (!response.ok) {
          console.warn('[Poll] dispatch status request failed:', response.status);
          consecutiveErrors += 1;
          if (consecutiveErrors >= 3) setStatus('error');
          return;
        }

        const data = (await response.json()) as DispatchPollResponse;
        if (lastFingerprint === undefined) {
          lastFingerprint = data.fingerprint;
          setStatus('live');
        } else if (data.fingerprint !== lastFingerprint) {
          lastFingerprint = data.fingerprint;
          router.refresh();
          onRefreshedRef.current?.();
        }
        consecutiveErrors = 0;
      } catch (e) {
        if (cancelled) return;
        console.warn('[Poll] dispatch tick failed:', e);
        consecutiveErrors += 1;
        if (consecutiveErrors >= 3) setStatus('error');
      } finally {
        inFlight = false;
      }
    };

    // 立即跑一次：让状态尽快从 connecting -> live
    void tick();
    const pollInterval = window.setInterval(() => {
      void tick();
    }, POLL_INTERVAL_MS);

    // 兜底：不管游标如何，每 30 秒强制 refresh 一次。
    // 覆盖"订单 created_at 跟其它新单同值"等边缘情况。
    const fallbackInterval = window.setInterval(() => {
      if (cancelled) return;
      router.refresh();
      onRefreshedRef.current?.();
    }, FALLBACK_REFRESH_MS);

    return () => {
      cancelled = true;
      window.clearInterval(pollInterval);
      window.clearInterval(fallbackInterval);
    };
  }, [router]);

  return null;
}
