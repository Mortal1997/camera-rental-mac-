'use client';

import { AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { PrimaryButton, cn } from './ui';

type InvalidOrder = {
  order_no: string | null;
  reason: string;
  raw_order?: Record<string, unknown>;
};

type SyncResponse = {
  success?: boolean;
  message?: string;
  error?: string;
  details?: string;
  code?: string | null;
  hint?: string | null;
  inserted_count?: number;
  inserted_external_order_ids?: string[];
  fetched_count?: number;
  skipped_duplicates?: number;
  sync_mode?: string;
  invalid_orders?: InvalidOrder[];
};

export default function SyncOrdersButton() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<{
    tone: 'success' | 'error';
    message: string;
    code?: string | null;
    hint?: string | null;
    insertedCount?: number;
    fetchedCount?: number;
    invalidOrders?: InvalidOrder[];
  } | null>(null);

  useEffect(() => {
    if (!result) return;

    const timer = window.setTimeout(() => {
      setResult(null);
    }, 2600);

    return () => window.clearTimeout(timer);
  }, [result]);

  const handleSync = async () => {
    if (isLoading) return;

    setIsLoading(true);
    setResult(null);

    try {
      const response = await fetch('/api/webhooks/orders/sync-orders', {
        method: 'GET',
      });

      const data = (await response.json().catch(() => null)) as SyncResponse | null;

      if (!response.ok) {
        const errorMessage =
          data?.error || data?.message || data?.details || `同步失败，状态码 ${response.status}`;

        setResult({
          tone: 'error',
          message: errorMessage,
          code: data?.code ?? null,
          hint: data?.hint ?? null,
          invalidOrders: data?.invalid_orders ?? [],
        });
        return;
      }

      const successMessage = data?.message || '闲管家订单已同步完成';
      const insertedExternalOrderIds = data?.inserted_external_order_ids ?? [];
      setResult({
        tone: 'success',
        message: successMessage,
        insertedCount: data?.inserted_count,
        fetchedCount: data?.fetched_count,
        invalidOrders: data?.invalid_orders ?? [],
        code: data?.sync_mode ?? null,
        hint: typeof data?.skipped_duplicates === 'number' ? `跳过重复订单 ${data.skipped_duplicates} 单` : null,
      });

      const nextParams = new URLSearchParams(searchParams.toString());
      if (insertedExternalOrderIds.length > 0) {
        nextParams.set('highlightOrders', insertedExternalOrderIds.join(','));
        nextParams.set('highlightAt', Date.now().toString());
      } else {
        nextParams.delete('highlightOrders');
        nextParams.delete('highlightAt');
      }

      router.replace(nextParams.toString() ? `${pathname}?${nextParams.toString()}` : pathname, { scroll: false });
      window.queueMicrotask(() => {
        router.refresh();
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : '请求发送失败';
      setResult({
        tone: 'error',
        message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const successSummary = result
    ? `已同步 ${result.insertedCount ?? 0} 单${result.invalidOrders && result.invalidOrders.length > 0 ? ` · 异常 ${result.invalidOrders.length} 单` : ''}`
    : null;

  return (
    <div className="flex w-full flex-col items-stretch gap-2 sm:items-end">
      <PrimaryButton
        type="button"
        onClick={handleSync}
        disabled={isLoading}
        className="w-full justify-center bg-indigo-600 shadow-[0_8px_20px_rgba(79,70,229,0.18)] hover:bg-indigo-500 sm:w-auto sm:min-w-[180px]"
      >
        <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
        {isLoading ? '同步中...' : '同步闲管家订单'}
      </PrimaryButton>

      {result ? (
        <div
          className={cn(
            'w-full rounded-2xl border px-3.5 py-2.5 text-xs sm:max-w-[320px]',
            result.tone === 'success'
              ? 'border-emerald-200/80 bg-emerald-50/80 text-emerald-700'
              : 'border-rose-200/80 bg-rose-50/85 text-rose-700'
          )}
        >
          <div className="flex items-start gap-2">
            {result.tone === 'success' ? (
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            ) : (
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            )}
            <div className="min-w-0 flex-1 space-y-1">
              <p className="font-medium leading-5">{result.tone === 'success' ? successSummary : result.message}</p>
              {result.tone === 'success' ? (
                <>
                  {result.message !== '闲管家订单已同步完成' ? <p className="leading-5 opacity-80">{result.message}</p> : null}
                  {typeof result.fetchedCount === 'number' ? <p className="leading-5 opacity-80">本次拉取 {result.fetchedCount} 单</p> : null}
                  {result.hint ? <p className="leading-5 opacity-80">{result.hint}</p> : null}
                </>
              ) : (
                <>
                  {result.hint ? <p className="leading-5 opacity-80">{result.hint}</p> : null}
                  {result.invalidOrders && result.invalidOrders.length > 0 ? <p className="leading-5 opacity-80">异常订单 {result.invalidOrders.length} 单</p> : null}</>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
