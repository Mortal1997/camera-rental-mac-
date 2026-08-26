'use client';

import { useMemo, useState, useTransition } from 'react';
import { Trash2 } from 'lucide-react';
import { deleteOrder } from '../../actions/admin-actions';
import type { Order } from '../../actions/types';
import { EmptyState, SectionHeader, SurfaceCard, TableHead, TableShell, Td, Th, Tr } from './ui';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface CompletedOrdersProps {
  orders: Order[];
}

const dangerButtonClassName = 'inline-flex items-center justify-center gap-2 rounded-md bg-red-50 px-3 py-1.5 text-sm text-red-600 transition-colors hover:bg-red-100 hover:text-red-800 disabled:cursor-not-allowed disabled:opacity-50';

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

export default function CompletedOrders({ orders }: CompletedOrdersProps) {
  const filtered = useMemo(() => orders.filter((o) => o.status === 'returned' || o.status === 'cancelled'), [orders]);
  const [displayOrders, setDisplayOrders] = useState(filtered);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [deleteDialogOrderId, setDeleteDialogOrderId] = useState<string | null>(null);

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
      <SectionHeader title="已完成订单" description="已归还和已取消的订单记录。取消订单金额不计入财务报表。" meta={`${displayOrders.length} 单`} />

      {error ? (
        <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
      ) : null}

      <div className="mt-4 lg:hidden">
        {displayOrders.length === 0 ? (
          <EmptyState>暂无已完成订单</EmptyState>
        ) : (
          <div className="grid gap-2.5 md:grid-cols-2">
            {displayOrders.map((order) => {
              const titleId = `completed-order-${order.id}`;
              const equipmentName = order.equipment?.name ?? order.expected_equipment_model ?? '未绑定设备';

              return (
                <article
                  key={order.id}
                  aria-labelledby={titleId}
                  className="rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 id={titleId} className="break-words text-[15px] font-semibold leading-5 text-slate-900">
                        {equipmentName}
                      </h3>
                      <p className="mt-1 break-all font-mono text-[11px] leading-4 text-slate-400">
                        {order.equipment?.serial_number ? `SN ${order.equipment.serial_number}` : '未录入 SN'}
                      </p>
                    </div>
                    {order.status === 'cancelled' ? (
                      <span className="inline-flex shrink-0 items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500">
                        已取消
                      </span>
                    ) : (
                      <span className="inline-flex shrink-0 items-center rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700">
                        已完成
                      </span>
                    )}
                  </div>

                  <div className="mt-2.5 flex min-w-0 items-center gap-2 text-xs">
                    <span className="inline-flex shrink-0 items-center rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-700">
                      {order.platform_source || '手动录单'}
                    </span>
                    <span className="min-w-0 truncate text-slate-500" title={order.external_order_id || order.id}>
                      {order.external_order_id || `内部单号：${order.id}`}
                    </span>
                  </div>

                  <dl className="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-2 rounded-xl bg-slate-50/90 p-2.5">
                    <div className="min-w-0">
                      <dt className="text-[10px] text-slate-500">客户</dt>
                      <dd className="mt-0.5 truncate text-sm font-medium text-slate-900">{order.customer_name ?? '—'}</dd>
                      <dd className="mt-0.5 break-all text-xs text-slate-500">{order.customer_phone ?? '—'}</dd>
                    </div>
                    <div className="min-w-0 text-right">
                      <dt className="text-[10px] text-slate-500">订单金额</dt>
                      <dd className={`mt-0.5 text-sm font-semibold ${order.status === 'cancelled' ? 'text-slate-500' : 'text-emerald-600'}`}>
                        {formatCurrency(order.total_price)}
                      </dd>
                      {order.status === 'cancelled' ? (
                        <dd className="mt-0.5 text-[10px] text-slate-500">不计入财务报表</dd>
                      ) : null}
                    </div>
                    <div className="col-span-2 border-t border-slate-200/70 pt-2">
                      <dt className="inline text-[10px] text-slate-500">租用时段：</dt>
                      <dd className="inline text-xs text-slate-700">{formatDateRange(order.start_date, order.end_date)}</dd>
                    </div>
                  </dl>

                  <button
                    type="button"
                    className="mt-2.5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-red-100 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-100 hover:text-red-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    onClick={() => setDeleteDialogOrderId(order.id)}
                    disabled={isPending}
                    aria-label={`删除${equipmentName}订单`}
                  >
                    <Trash2 className="h-4 w-4" />删除订单
                  </button>
                </article>
              );
            })}
          </div>
        )}
      </div>

      <div className="hidden lg:block">
        <TableShell>
        {displayOrders.length === 0 ? (
          <EmptyState>暂无已完成订单</EmptyState>
        ) : (
          <table className="w-full min-w-[940px] text-sm">
            <TableHead>
              <tr>
                <Th>设备</Th>
                <Th className="hidden md:table-cell">平台 / 外部单号</Th>
                <Th className="hidden sm:table-cell">客户信息</Th>
                <Th className="hidden lg:table-cell">收货地址 / 物流</Th>
                <Th className="hidden md:table-cell">租用时段</Th>
                <Th>订单金额</Th>
                <Th className="hidden lg:table-cell">状态</Th>
                <Th>操作</Th>
              </tr>
            </TableHead>
            <tbody>
              {displayOrders.map((order) => (
                <Tr key={order.id}>
                    <Td>
                      <div className="space-y-0.5">
                        <p className="font-medium text-slate-900">{order.equipment?.name ?? '—'}</p>
                        {order.equipment?.serial_number && (
                          <p className="font-mono text-xs text-slate-400">{order.equipment.serial_number}</p>
                        )}
                      </div>
                    </Td>
                  <Td className="hidden md:table-cell">
                    <div className="space-y-1">
                      <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                        {order.platform_source || '手动录单'}
                      </span>
                      <p className="text-xs text-slate-400">{order.external_order_id || `内部单号：${order.id}`}</p>
                    </div>
                  </Td>
                  <Td className="hidden sm:table-cell">
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-slate-900">{order.customer_name ?? '—'}</p>
                      <p className="text-sm text-slate-500">{order.customer_phone ?? '—'}</p>
                    </div>
                  </Td>
                  <Td className="hidden lg:table-cell">
                    <div className="space-y-1">
                      <p className="max-w-[140px] truncate text-sm text-slate-700 sm:max-w-[200px]" title={order.shipping_address || '—'}>
                        {order.shipping_address || '—'}
                      </p>
                      <p className="text-xs text-slate-400">{order.shipping_method || '待确认发货方式'}</p>
                    </div>
                  </Td>
                  <Td className="hidden md:table-cell text-slate-600">{formatDateRange(order.start_date, order.end_date)}</Td>
                  <Td className={order.status === 'cancelled' ? 'text-slate-400' : 'font-semibold text-emerald-600'}>
                    {formatCurrency(order.total_price)}
                    {order.status === 'cancelled' && (
                      <span className="ml-2 inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                        已取消不计入
                      </span>
                    )}
                  </Td>
                  <Td className="hidden lg:table-cell">
                    {order.status === 'cancelled' ? (
                      <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500">已取消</span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700">已完成</span>
                    )}
                  </Td>
                  <Td>
                    <button
                      type="button"
                      className={dangerButtonClassName}
                      onClick={() => setDeleteDialogOrderId(order.id)}
                      disabled={isPending}
                    >
                      <Trash2 className="h-4 w-4" />删除
                    </button>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </table>
        )}
        </TableShell>
      </div>
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
