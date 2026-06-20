'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

type ConnectionStatus = 'idle' | 'connecting' | 'live' | 'error';

interface RefreshRemoteOrdersProps {
  userId: string;
  onStatusChange?: (status: ConnectionStatus) => void;
  onRefreshed?: () => void;
}

// 主轮询：每 5 秒查一次"上次游标之后有没有新订单"。有就 router.refresh()。
const POLL_INTERVAL_MS = 5_000;
// 兜底轮询：即使游标没变化也强制刷新一次，覆盖 webhook 写入但 updated_at
// 没前进、或 RLS 命中但 revalidate 没触发的边缘情况。
const FALLBACK_REFRESH_MS = 30_000;

type DispatchPollRow = {
  id: string;
  status: string;
  created_at: string;
};

export default function RefreshRemoteOrders({ userId, onStatusChange, onRefreshed }: RefreshRemoteOrdersProps) {
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
    if (!userId) return;

    let cancelled = false;
    setConnectionStatus('connecting');
    onStatusChangeRef.current?.('connecting');

    const supabase = createClient();
    const setStatus = (next: ConnectionStatus) => {
      if (cancelled) return;
      setConnectionStatus(next);
      onStatusChangeRef.current?.(next);
    };

    // 游标：上次看到的"最新订单 created_at"。第一次为空，意思是查全表。
    let lastSeenCreatedAt: string | null = null;
    let inFlight = false;
    let consecutiveErrors = 0;

    const tick = async () => {
      if (cancelled || inFlight) return;
      inFlight = true;
      try {
        let query = supabase
          .from('orders')
          .select('id, status, created_at')
          .eq('user_id', userId)
          .in('status', ['unprocessed', 'pending_payment'])
          .order('created_at', { ascending: false })
          .limit(1);

        if (lastSeenCreatedAt) {
          query = query.gt('created_at', lastSeenCreatedAt);
        }

        const { data, error } = await query;

        if (cancelled) return;

        if (error) {
          console.warn('[Poll] dispatch query error:', error);
          consecutiveErrors += 1;
          if (consecutiveErrors >= 3) setStatus('error');
          return;
        }

        // 第一次成功查询后把状态切到 live
        if (lastSeenCreatedAt === null) {
          setStatus('live');
        } else if (data && data.length > 0) {
          // 游标之后有新订单 -> 拉一次 RSC
          router.refresh();
          onRefreshedRef.current?.();
        }

        const latest = (data?.[0] as DispatchPollRow | undefined) ?? null;
        if (latest?.created_at) {
          lastSeenCreatedAt = latest.created_at;
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
  }, [userId, router]);

  return null;
}
