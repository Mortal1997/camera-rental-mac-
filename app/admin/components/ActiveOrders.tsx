'use client';

import { useMemo, useState, useTransition } from 'react';
import { CalendarRange, MapPin, MessageSquare, Phone, Truck, Trash2, User } from 'lucide-react';
import { deleteOrder, updateOrderStatus } from '../../actions/admin-actions';
import type { Order } from '../../actions/types';
import { EmptyState, PrimaryButton, SectionHeader, StatBadge, SurfaceCard, cn } from './ui';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface ActiveOrdersProps {
  orders: Order[];
}

const dangerButtonClassName = 'inline-flex items-center justify-center gap-1.5 rounded-full bg-red-50 px-3 py-2 text-xs font-medium text-red-600 transition-colors hover:bg-red-100 hover:text-red-800 disabled:cursor-not-allowed disabled:opacity-50';

function isOverdue(endDate?: string | null): boolean {
  if (!endDate) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(0, 0, 0, 0);
  return end <= today;
}

function isToday(endDate?: string | null): boolean {
  if (!endDate) return false;
  const today = new Date();
  const end = new Date(endDate);
  return (
    end.getFullYear() === today.getFullYear() &&
    end.getMonth() === today.getMonth() &&
    end.getDate() === today.getDate()
  );
}

function formatCurrency(value?: number | null) {
  return `¥${Number(value ?? 0).toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDateRange(start?: string | null, end?: string | null) {
  if (start && end) return `${start} ~ ${end}`;
  if (start) return `${start} 起`;
  if (end) return `至 ${end}`;
  return '待确认租期';
}

export default function ActiveOrders({ orders }: ActiveOrdersProps) {
  const filtered = useMemo(() => orders.filter((o) => o.status === 'using'), [orders]);
  const [displayOrders, setDisplayOrders] = useState(filtered);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [deleteDialogOrderId, setDeleteDialogOrderId] = useState<string | null>(null);

  const handleReturn = (orderId: string, equipmentId?: string) => {
    setError(null);
    startTransition(async () => {
      const result = await updateOrderStatus(orderId, 'returned', undefined, undefined, equipmentId);
      if (!result.success) {
        setError(result.error ?? '确认归还失败，请稍后重试');
        return;
      }

      setDisplayOrders((current) => current.filter((order) => order.id !== orderId));
    });
  };

  const confirmDelete = () => {
    if (!deleteDialogOrderId) return;
    const orderId = deleteDialogOrderId;
    setDeleteDialogOrderId(null);

    setError(null);
    startTransition(async () => {
      const result = await deleteOrder(orderId);
      if (!result.success) {
        setError(result.error ?? '删除订单失败，请稍后重试');
        return;
      }

      setDisplayOrders((current) => current.filter((order) => order.id !== orderId));
    });
  };

  return (
    <>
    <SurfaceCard>
      <SectionHeader title="租用中订单" description="跟踪在租设备并快速完成归还。" meta={`${displayOrders.length} 单`} />

      {error ? (
        <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
      ) : null}

      {displayOrders.length === 0 ? (
        <div className="mt-4">
          <EmptyState>暂无租用中订单</EmptyState>
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-5 xl:grid-cols-3 xl:gap-6">
          {displayOrders.map((order) => {
            const overdue = isOverdue(order.end_date);
            const todayEnd = isToday(order.end_date);

            return (
              <div
                key={order.id}
                className={cn(
                  'group flex h-full flex-col rounded-xl border border-slate-200 bg-white p-3 transition-all hover:border-slate-300 hover:shadow-md md:p-4',
                  overdue && 'border-rose-200 bg-rose-50/30',
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-900 md:text-base">
                      {order.equipment?.name ?? '—'}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-slate-400">
                      {order.external_order_id || `内部单号：${order.id}`}
                    </p>
                  </div>
                  {todayEnd ? (
                    <StatBadge tone="amber" className="shrink-0">今日到期</StatBadge>
                  ) : overdue ? (
                    <StatBadge tone="red" className="shrink-0">已逾期</StatBadge>
                  ) : (
                    <StatBadge tone="slate" className="shrink-0">租用中</StatBadge>
                  )}
                </div>

                <div className="mt-3 flex-1 space-y-1.5 text-sm text-slate-600 md:mt-4 md:space-y-2">
                  <div className="flex items-center gap-2">
                    <User className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                    <span className="truncate text-sm font-medium text-slate-700">{order.customer_name ?? '—'}</span>
                    {order.customer_phone ? (
                      <a
                        href={`tel:${order.customer_phone}`}
                        className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-indigo-600"
                      >
                        <Phone className="h-3.5 w-3.5" />
                        {order.customer_phone}
                      </a>
                    ) : (
                      <span className="text-sm text-slate-400">—</span>
                    )}
                  </div>
                  <div className="flex items-start gap-2">
                    <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                    <span className="line-clamp-2 text-sm text-slate-600" title={order.shipping_address || '—'}>
                      {order.shipping_address || '—'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CalendarRange className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                    <span className={cn('text-sm', overdue ? 'font-medium text-rose-600' : 'text-slate-600')}>
                      {formatDateRange(order.start_date, order.end_date)}
                    </span>
                  </div>
                  {order.notes ? (
                    <div className="flex items-start gap-2 rounded-lg bg-slate-50 px-2 py-1.5">
                      <MessageSquare className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                      <span className="line-clamp-2 text-xs italic text-slate-500" title={order.notes}>
                        {order.notes}
                      </span>
                    </div>
                  ) : null}
                </div>

                <div className="mt-auto flex items-center justify-between border-t border-slate-100 pt-3 md:pt-4">
                  <span className="text-xs text-slate-400 md:text-sm">订单金额</span>
                  <span className="text-base font-semibold text-emerald-600 md:text-lg">
                    {formatCurrency(order.total_price)}
                  </span>
                </div>

                <div className="mt-3 flex flex-col gap-2 border-t border-slate-100 pt-3 md:mt-4 md:pt-4">
                  <PrimaryButton
                    onClick={() => handleReturn(order.id, order.equipment_id)}
                    disabled={isPending}
                    className="w-full !py-2 text-xs"
                  >
                    <Truck className="h-3.5 w-3.5" />
                    确认归还
                  </PrimaryButton>
                  <button
                    type="button"
                    className={cn(dangerButtonClassName, 'w-full')}
                    onClick={() => setDeleteDialogOrderId(order.id)}
                    disabled={isPending}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    删除订单
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </SurfaceCard>

    <Dialog open={deleteDialogOrderId !== null} onOpenChange={(open) => !open && setDeleteDialogOrderId(null)}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>确认删除订单</DialogTitle>
          <DialogDescription>确定要永久删除这个订单吗？此操作无法撤销。</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <button
            type="button"
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => setDeleteDialogOrderId(null)}
            disabled={isPending}
          >
            取消
          </button>
          <button
            type="button"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-red-50 px-4 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => void confirmDelete()}
            disabled={isPending}
          >
            {isPending ? '删除中...' : '确认删除'}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}
