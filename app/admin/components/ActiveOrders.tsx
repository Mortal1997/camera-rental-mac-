'use client';

import { useMemo, useState, useTransition } from 'react';
import { Trash2 } from 'lucide-react';
import { deleteOrder, updateOrderStatus } from '../../actions/admin-actions';
import type { Order } from '../../actions/types';
import { EmptyState, PrimaryButton, SectionHeader, StatBadge, SurfaceCard, TableHead, TableShell, Td, Th, Tr } from './ui';

interface ActiveOrdersProps {
  orders: Order[];
}

const dangerButtonClassName = 'inline-flex items-center justify-center gap-2 rounded-md bg-red-50 px-3 py-1.5 text-sm text-red-600 transition-colors hover:bg-red-100 hover:text-red-800 disabled:cursor-not-allowed disabled:opacity-50';

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

  const handleReturn = (orderId: string, equipmentId?: string) => {
    setError(null);
    startTransition(async () => {
      const result = await updateOrderStatus(orderId, 'returned', undefined, equipmentId);
      if (!result.success) {
        setError(result.error ?? '确认归还失败，请稍后重试');
        return;
      }

      setDisplayOrders((current) => current.filter((order) => order.id !== orderId));
    });
  };

  const handleDelete = (orderId: string) => {
    if (!window.confirm('确定要永久删除这个订单吗？此操作无法撤销。')) return;

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
    <SurfaceCard>
      <SectionHeader title="租用中订单" description="跟踪在租设备并快速完成归还。" meta={`${displayOrders.length} 单`} />

      {error ? (
        <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
      ) : null}

      <TableShell>
        {displayOrders.length === 0 ? (
          <EmptyState>暂无租用中订单</EmptyState>
        ) : (
          <table className="w-full min-w-[1180px] text-sm">
            <TableHead>
              <tr>
                <Th>设备</Th>
                <Th>平台 / 外部单号</Th>
                <Th>客户信息</Th>
                <Th>收货地址 / 物流</Th>
                <Th>租用时段</Th>
                <Th>订单金额</Th>
                <Th>状态</Th>
                <Th>操作</Th>
              </tr>
            </TableHead>
            <tbody>
              {displayOrders.map((order) => {
                const overdue = isOverdue(order.end_date);
                const todayEnd = isToday(order.end_date);

                return (
                  <Tr key={order.id}>
                    <Td className="font-medium text-slate-900">{order.equipment?.name ?? '—'}</Td>
                    <Td>
                      <div className="space-y-1">
                        <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                          {order.platform_source || '手动录单'}
                        </span>
                        <p className="text-xs text-slate-400">{order.external_order_id || `内部单号：${order.id}`}</p>
                      </div>
                    </Td>
                    <Td>
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-slate-900">{order.customer_name ?? '—'}</p>
                        <p className="text-sm text-slate-500">{order.customer_phone ?? '—'}</p>
                      </div>
                    </Td>
                    <Td>
                      <div className="space-y-1">
                        <p className="max-w-[200px] truncate text-sm text-slate-700" title={order.shipping_address || '—'}>
                          {order.shipping_address || '—'}
                        </p>
                        <p className="text-xs text-slate-400">{order.shipping_method || '待确认发货方式'}</p>
                      </div>
                    </Td>
                    <Td className="text-slate-600">{formatDateRange(order.start_date, order.end_date)}</Td>
                    <Td className="font-semibold text-emerald-600">{formatCurrency(order.total_price)}</Td>
                    <Td>
                      {todayEnd ? (
                        <StatBadge tone="amber">今日到期</StatBadge>
                      ) : overdue ? (
                        <StatBadge tone="red">已逾期</StatBadge>
                      ) : (
                        <StatBadge tone="slate">租用中</StatBadge>
                      )}
                    </Td>
                    <Td>
                      <div className="flex items-center gap-2">
                        <PrimaryButton onClick={() => handleReturn(order.id, order.equipment_id)} disabled={isPending} className="text-xs">
                          确认归还
                        </PrimaryButton>
                        <button
                          type="button"
                          className={dangerButtonClassName}
                          onClick={() => handleDelete(order.id)}
                          disabled={isPending}
                        >
                          <Trash2 className="h-4 w-4" />删除
                        </button>
                      </div>
                    </Td>
                  </Tr>
                );
              })}
            </tbody>
          </table>
        )}
      </TableShell>
    </SurfaceCard>
  );
}
