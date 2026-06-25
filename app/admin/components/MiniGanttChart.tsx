'use client';

import {
  AlertTriangle,
  CheckCircle2,
  Clipboard,
  Edit2,
  Loader2,
  Package2,
  RotateCcw,
  Send,
  Truck,
  UserRound,
  Wrench,
  X,
} from 'lucide-react';
import { format } from 'date-fns';
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { updateOrderFields, updateOrderStatus } from '../../actions/admin-actions';
import {
  InfoTile,
  Modal,
  PrimaryButton,
  SecondaryButton,
  StatBadge,
  TextInput,
  cn,
} from './ui';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import type { DateRange } from 'react-day-picker';
import { EXPRESS_CARRIERS } from '@/lib/goofish/express-codes';
import { getEffectiveEquipmentStatus, type EffectiveEquipmentStatus } from '@/lib/equipment-status';

interface MiniGanttChartProps {
  equipment: Array<{
    id: string;
    name: string;
    serial_number?: string | null;
    status: string;
    orders: Array<{
      id: string;
      customer_name?: string | null;
      customer_phone?: string | null;
      shipping_address?: string | null;
      start_date?: string | null;
      end_date?: string | null;
      status: string;
      notes?: string | null;
      total_price?: number | null;
      deposit_paid?: number | null;
      deposit_exemption?: string | null;
      tracking_number?: string | null;
    }>;
  }>;
}

const DAY_COLUMN_WIDTH = 72;
const PAGE_SIZE = 10;
const PAST_DAYS = 14;
const FUTURE_DAYS = 30;
const TOTAL_DAYS = PAST_DAYS + FUTURE_DAYS;

const HOLIDAYS_2026 = [
  '2026-01-01', '2026-02-16', '2026-02-17', '2026-02-18', '2026-02-19',
  '2026-02-20', '2026-02-21', '2026-02-22', '2026-04-04',
  '2026-05-01', '2026-05-02', '2026-05-03', '2026-05-04', '2026-05-05',
  '2026-06-19', '2026-09-25',
  '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05', '2026-10-06', '2026-10-07',
];

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function isWeekend(date: Date) {
  return date.getDay() === 0 || date.getDay() === 6;
}

function isHoliday(dateKey: string) {
  return HOLIDAYS_2026.includes(dateKey);
}

function getStatusPill(status: string) {
  if (status === 'pending_payment' || status === 'confirmed') {
    return { label: '待发货', bar: 'bg-sky-100 text-sky-700', textColor: 'text-sky-700', tone: 'blue' as const, accent: 'bg-sky-50 text-sky-700' };
  }
  if (status === 'using') {
    return { label: '租用中', bar: 'bg-amber-100 text-amber-700', textColor: 'text-amber-700', tone: 'amber' as const, accent: 'bg-amber-50 text-amber-700' };
  }
  if (status === 'returned') {
    return { label: '已完成', bar: 'bg-emerald-100 text-emerald-700', textColor: 'text-emerald-700', tone: 'emerald' as const, accent: 'bg-emerald-50 text-emerald-700' };
  }
  if (status === 'cancelled') {
    return { label: '已取消', bar: 'bg-slate-100 text-slate-400', textColor: 'text-slate-400', tone: 'slate' as const, accent: 'bg-slate-50 text-slate-500' };
  }
  return { label: status, bar: 'bg-slate-100 text-slate-600', textColor: 'text-slate-600', tone: 'slate' as const, accent: 'bg-slate-50 text-slate-600' };
}

function getMiniGanttStatusBadge(status: EffectiveEquipmentStatus) {
  if (status === 'available') return { label: '闲置', icon: CheckCircle2, tone: 'bg-emerald-500 text-white' };
  if (status === 'rented') return { label: '租用中', icon: Package2, tone: 'bg-amber-500 text-white' };
  if (status === 'pending') return { label: '待发货', icon: Truck, tone: 'bg-sky-500 text-white' };
  if (status === 'overdue') return { label: '逾期未还', icon: AlertTriangle, tone: 'bg-rose-600 text-white animate-pulse' };
  if (status === 'maintenance') return { label: '维修中', icon: Wrench, tone: 'bg-rose-500 text-white' };
  return { label: '未知', icon: Wrench, tone: 'bg-slate-500 text-white' };
}

function getDateDiffInDays(start: Date, end: Date) {
  return Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
}

function getNextStatusAction(order: { status: string }) {
  if (order.status === 'pending_payment' || order.status === 'confirmed') {
    return { label: '标记发货', nextStatus: 'using', icon: Send, tone: 'primary' as const, requireTracking: true };
  }
  if (order.status === 'using') {
    return { label: '标记归还', nextStatus: 'returned', icon: CheckCircle2, tone: 'secondary' as const, requireTracking: false };
  }
  return null;
}


type SelectedOrderState = {
  order: NonNullable<MiniGanttChartProps['equipment'][0]['orders'][0]>;
  equipmentId: string;
  equipmentName: string;
};

export default function MiniGanttChart({ equipment }: MiniGanttChartProps) {
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef({ isDown: false, startX: 0, scrollLeft: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [hoveredOrderId, setHoveredOrderId] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<SelectedOrderState | null>(null);
  const [page, setPage] = useState(0);
  const [isEditing, setIsEditing] = useState(false);
  const [editDateRange, setEditDateRange] = useState<DateRange | undefined>();
  const [editForm, setEditForm] = useState({ customer_name: '', customer_phone: '', shipping_address: '', start_date: '', end_date: '', equipment_id: '', notes: '' });
  const [actionError, setActionError] = useState<string | null>(null);
  const [copyMessage, setCopyMessage] = useState<string | null>(null);

  type TooltipState = {
    order: NonNullable<MiniGanttChartProps['equipment'][0]['orders'][0]>;
    equipmentName: string;
    barRect: DOMRect;
  };

  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  const showTooltip = useCallback((order: TooltipState['order'], equipmentName: string, barRect: DOMRect) => {
    setTooltip({ order, equipmentName, barRect });
  }, []);

  const hideTooltip = useCallback(() => setTooltip(null), []);
  const [trackingNumberInput, setTrackingNumberInput] = useState('');
  const [confirmShip, setConfirmShip] = useState(false);
  const [shipMethod, setShipMethod] = useState<'express' | 'hainter' | 'pickup'>('express');
  const [expressCarrier, setExpressCarrier] = useState<string>('shunfeng');
  const [isPending, startTransition] = useTransition();

  const stopDragging = () => {
    dragStateRef.current.isDown = false;
    setIsDragging(false);
  };

  const handleMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest('button, input, select, textarea, a')) return;
    dragStateRef.current = { isDown: true, startX: event.pageX, scrollLeft: scrollRef.current?.scrollLeft ?? 0 };
    setIsDragging(true);
  };

  const handleMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!dragStateRef.current.isDown || !scrollRef.current) return;
    const diff = event.pageX - dragStateRef.current.startX;
    scrollRef.current.scrollLeft = dragStateRef.current.scrollLeft - diff;
  };

  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTo({ left: PAST_DAYS * DAY_COLUMN_WIDTH, behavior: 'smooth' });
  }, []);

  const days = useMemo(
    () =>
      Array.from({ length: TOTAL_DAYS }, (_, i) => {
        const d = new Date(today);
        d.setDate(d.getDate() + i - PAST_DAYS);
        return d;
      }),
    [today]
  );

  const totalPages = Math.max(1, Math.ceil(equipment.length / PAGE_SIZE));
  const pagedEquipment = useMemo(
    () => equipment.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE),
    [equipment, page]
  );

  const columnTones = useMemo(() => {
    const todayKey = toDateKey(today);
    return days.map((d) => {
      const key = toDateKey(d);
      const weekend = isWeekend(d);
      const holiday = isHoliday(key);
      const isToday = key === todayKey;
      if (isToday) return 'bg-indigo-50/70';
      if (holiday) return 'bg-rose-50/50';
      if (weekend) return 'bg-slate-50';
      return '';
    });
  }, [days, today]);

  const currentStatus = selectedOrder ? getStatusPill(selectedOrder.order.status) : null;
  const nextStatusAction = selectedOrder ? getNextStatusAction(selectedOrder.order) : null;

  const buildCustomerInfo = (so: SelectedOrderState) => {
    const lines = [so.order.customer_name, so.order.customer_phone, so.order.shipping_address];
    return lines.filter(Boolean).join('\n');
  };

  const handleCopy = async (value: string, successText: string) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopyMessage(successText);
      setActionError(null);
    } catch {
      setActionError('复制失败，请稍后重试');
    }
  };

  const handleStatusAction = () => {
    if (!selectedOrder || !nextStatusAction) return;
    if (nextStatusAction.requireTracking && shipMethod === 'express' && !trackingNumberInput.trim()) {
      setActionError('请先填写运单号');
      return;
    }
    const carrier = EXPRESS_CARRIERS.find((c) => c.code === expressCarrier) ?? EXPRESS_CARRIERS[0];

    startTransition(async () => {
      const result = await updateOrderStatus(
        selectedOrder.order.id,
        nextStatusAction.nextStatus,
        nextStatusAction.requireTracking ? trackingNumberInput.trim() : undefined,
        shipMethod,
        undefined,
        {
          pushToGoofish: nextStatusAction.nextStatus === 'using' && shipMethod === 'express',
          expressCode: shipMethod === 'express' ? carrier.code : undefined,
          expressName: shipMethod === 'express' ? carrier.name : undefined,
        }
      );

      if (!result.success) {
        setActionError(result.error ?? '状态更新失败');
        return;
      }

      let message = '';
      if (nextStatusAction.nextStatus === 'using') {
        if (result.goofishPush === 'ok') {
          message = `已完成发货，设备状态已同步为出租中，闲管家已回传（${carrier.name}）`;
        } else if (result.goofishPush === 'failed') {
          message = '本地已发货，闲管家回传失败，请稍后重试';
        } else if (result.goofishPush === 'no_carrier') {
          message = `已完成发货（${shipMethod === 'hainter' ? '跑腿' : '自提'}，闲管家无需回传）`;
        } else if (result.goofishPush === 'skipped') {
          message = '已完成发货，闲管家凭证缺失未回传';
        } else {
          message = '已完成发货，设备状态已同步为出租中';
        }
      } else {
        message = '已完成归还，设备状态已同步为空闲';
      }
      setCopyMessage(message);
      setSelectedOrder(null);
      if (nextStatusAction.requireTracking) setConfirmShip(false);
    });
  };

  const openEditMode = () => {
    if (!selectedOrder) return;
    const order = selectedOrder.order;
    setEditForm({
      customer_name: order.customer_name ?? '',
      customer_phone: order.customer_phone ?? '',
      shipping_address: order.shipping_address ?? '',
      start_date: order.start_date ?? '',
      end_date: order.end_date ?? '',
      equipment_id: selectedOrder.equipmentId,
      notes: order.notes ?? '',
    });
    setEditDateRange(
      order.start_date && order.end_date
        ? { from: new Date(order.start_date), to: new Date(order.end_date) }
        : order.start_date
        ? { from: new Date(order.start_date), to: new Date(order.start_date) }
        : undefined
    );
    setIsEditing(true);
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setEditForm({ customer_name: '', customer_phone: '', shipping_address: '', start_date: '', end_date: '', equipment_id: '', notes: '' });
    setEditDateRange(undefined);
  };

  const handleSaveEdit = () => {
    if (!selectedOrder) return;
    const resolvedStart = editDateRange?.from ? format(editDateRange.from, 'yyyy-MM-dd') : undefined;
    const resolvedEnd = editDateRange?.to ? format(editDateRange.to, 'yyyy-MM-dd') : undefined;
    startTransition(async () => {
      const result = await updateOrderFields(selectedOrder.order.id, {
        customer_name: editForm.customer_name,
        customer_phone: editForm.customer_phone,
        shipping_address: editForm.shipping_address,
        start_date: resolvedStart,
        end_date: resolvedEnd,
        equipment_id: editForm.equipment_id,
        notes: editForm.notes,
      });
      if (!result.success) {
        setActionError(result.error ?? '保存失败');
        return;
      }
      setSelectedOrder((current) => current ? { ...current, order: { ...current.order, customer_name: editForm.customer_name || undefined, customer_phone: editForm.customer_phone || undefined, shipping_address: editForm.shipping_address || undefined, start_date: resolvedStart || undefined, end_date: resolvedEnd || undefined, notes: editForm.notes || undefined } } : null);
      setIsEditing(false);
      setCopyMessage('订单信息已更新');
    });
  };

  return (
    <div>
      <div className="animate-chart-enter-delayed mt-4 rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500">设备排期</span>
            <span className="text-xs text-slate-400">
              {equipment.length} 台 / 第 {page + 1} / {totalPages} 页
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => {
                setPage((p) => Math.max(0, p - 1));
                scrollRef.current?.scrollTo({ left: 0, behavior: 'smooth' });
              }}
              disabled={page === 0}
              className="flex h-6 w-6 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 disabled:cursor-not-allowed disabled:opacity-30"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => {
                setPage((p) => Math.min(totalPages - 1, p + 1));
                scrollRef.current?.scrollTo({ left: 0, behavior: 'smooth' });
              }}
              disabled={page >= totalPages - 1}
              className="flex h-6 w-6 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 disabled:cursor-not-allowed disabled:opacity-30"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>

        <div
          ref={scrollRef}
          onMouseDown={handleMouseDown}
          onMouseLeave={stopDragging}
          onMouseUp={stopDragging}
          onMouseMove={handleMouseMove}
          className={cn(
            'overflow-x-auto overflow-y-visible [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
            isDragging ? 'cursor-grabbing' : 'cursor-grab select-none'
          )}
        >
          <div className="py-2">
            <table
              className="w-full table-fixed border-collapse text-xs"
              style={{ minWidth: TOTAL_DAYS * DAY_COLUMN_WIDTH + 160 }}
            >
              <thead>
                <tr>
                  <th
                    className="sticky left-0 z-20 border-b border-r border-slate-100 bg-white px-3 py-2 text-left font-medium uppercase tracking-wide text-slate-400 shadow-[4px_0_10px_-4px_rgba(0,0,0,0.06)] isolate"
                    style={{ width: 160 }}
                  >
                    设备
                  </th>
                  {days.map((d, i) => {
                    const key = toDateKey(d);
                    const todayKey = toDateKey(today);
                    const isToday = key === todayKey;
                    return (
                      <th
                        key={key}
                        className={cn(
                          'border-b border-slate-100 px-0 py-1.5 text-center font-medium',
                          columnTones[i]
                        )}
                        style={{ width: DAY_COLUMN_WIDTH }}
                      >
                        {isToday ? (
                          <span className="flex h-5 w-5 items-center justify-center rounded-md bg-white text-[9px] font-bold text-indigo-600 shadow-sm ring-1 ring-indigo-300">
                            今
                          </span>
                        ) : (
                          <span className={cn(isHoliday(key) ? 'text-rose-400' : isWeekend(d) ? 'text-slate-300' : 'text-slate-400')}>
                            {d.getDate()}
                          </span>
                        )}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {pagedEquipment.map((item) => {
                  const effectiveStatus = getEffectiveEquipmentStatus(item as Parameters<typeof getEffectiveEquipmentStatus>[0], today);
                  const statusInfo = getMiniGanttStatusBadge(effectiveStatus);
                  const StatusIcon = statusInfo.icon;
                  return (
                    <tr key={item.id} style={{ height: 17 }}>
                      <td
                        className="sticky left-0 z-20 border-b border-r border-slate-100 bg-slate-50 px-3 shadow-[4px_0_10px_-4px_rgba(0,0,0,0.06)]"
                        style={{ width: 160, height: 17 }}
                      >
                        <div className="flex min-w-0 items-center gap-2">
                          <div className="min-w-0 flex-1">
                            <span className="block truncate text-xs font-medium text-gray-900">{item.name}</span>
                            <span className="block truncate text-[10px] text-gray-400">{item.serial_number || '—'}</span>
                          </div>
                          <span className={cn('inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full shadow-sm', statusInfo.tone)}>
                            <StatusIcon className="h-2.5 w-2.5" />
                          </span>
                        </div>
                      </td>
                      {days.map((d, dayIdx) => {
                        const key = toDateKey(d);
                        const todayKey = toDateKey(today);
                        const isToday = key === todayKey;

                        const order = item.orders.find((o) => {
                          if (!o.start_date || o.status === 'cancelled') return false;
                          const start = new Date(o.start_date);
                          start.setHours(0, 0, 0, 0);
                          const end = o.end_date ? new Date(o.end_date) : start;
                          end.setHours(0, 0, 0, 0);
                          return dayIdx >= getDateDiffInDays(days[0], start) && dayIdx <= getDateDiffInDays(days[0], end);
                        });

                        if (!order) {
                          return (
                            <td
                              key={`${item.id}-${key}`}
                              className={cn(
                                'relative border-b border-slate-100',
                                columnTones[dayIdx]
                              )}
                              style={{ height: 17, width: DAY_COLUMN_WIDTH }}
                            >
                              {isToday ? (
                                <span className="pointer-events-none absolute inset-y-0 left-0 z-0 w-px bg-indigo-300" />
                              ) : null}
                            </td>
                          );
                        }

                        const startDate = new Date(order.start_date!);
                        const endDate = order.end_date ? new Date(order.end_date) : startDate;
                        startDate.setHours(0, 0, 0, 0);
                        endDate.setHours(0, 0, 0, 0);
                        const startDiff = getDateDiffInDays(days[0], startDate);
                        const rawSpan = getDateDiffInDays(startDate, endDate) + 1;
                        const span = Math.min(rawSpan, days.length - dayIdx);

                        if (dayIdx !== startDiff) {
                          return (
                            <td
                              key={`${item.id}-${key}`}
                              className={cn(
                                'relative border-b border-slate-100',
                                columnTones[dayIdx]
                              )}
                              style={{ height: 17, width: DAY_COLUMN_WIDTH }}
                            >
                              {isToday ? (
                                <span className="pointer-events-none absolute inset-y-0 left-0 z-0 w-px bg-indigo-300" />
                              ) : null}
                            </td>
                          );
                        }

                        const pill = getStatusPill(order.status);
                        const barWidth = span * DAY_COLUMN_WIDTH;
                        const isHovered = hoveredOrderId === order.id;

                        return (
                          <td
                            key={`${item.id}-${key}`}
                            className={cn(
                              'relative border-b border-slate-100 p-0',
                              columnTones[dayIdx]
                            )}
                            style={{ height: 17, width: DAY_COLUMN_WIDTH }}
                          >
                            {isToday ? (
                              <span className="pointer-events-none absolute inset-y-0 left-0 z-0 w-px bg-indigo-300" />
                            ) : null}
                            <div
                              className={cn(
                                'absolute inset-y-1 left-0 z-20 overflow-visible transition-all duration-150',
                                isHovered && 'z-40'
                              )}
                              style={{ width: barWidth }}
                              onMouseEnter={(e) => {
                                setHoveredOrderId(order.id);
                                showTooltip(order, item.name, e.currentTarget.getBoundingClientRect());
                              }}
                              onMouseLeave={() => {
                                setHoveredOrderId((current) => (current === order.id ? null : current));
                                hideTooltip();
                              }}
                              onClick={() => {
                                setActionError(null);
                                setCopyMessage(null);
                                setConfirmShip(false);
                                setTrackingNumberInput(order.tracking_number || '');
                                setShipMethod('express');
                                setSelectedOrder({ order, equipmentId: item.id, equipmentName: item.name });
                              }}
                            >
                              <div
                                className={cn(
                                  'flex h-full w-full items-center justify-between gap-1 overflow-hidden rounded-lg px-2 py-1 shadow-sm transition-all duration-150',
                                  pill.bar,
                                  isHovered && 'ring-2 ring-indigo-100'
                                )}
                              >
                                <div className="min-w-0">
                                  <p className="truncate text-[11px] font-semibold leading-4">{order.customer_name || '—'}</p>
                                </div>
                                {span >= 2 ? <span className="shrink-0 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-medium text-slate-500">{rawSpan} 天</span> : null}
                              </div>
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      <Modal
        open={Boolean(selectedOrder)}
        onClose={() => {
          setSelectedOrder(null);
          setIsEditing(false);
          setEditForm({ customer_name: '', customer_phone: '', shipping_address: '', start_date: '', end_date: '', equipment_id: '', notes: '' });
          setEditDateRange(undefined);
          setActionError(null);
          setCopyMessage(null);
          setTrackingNumberInput('');
          setConfirmShip(false);
        }}
        eyebrow="Order Detail"
        icon={Package2}
        title={selectedOrder?.order.customer_name || '订单详情'}
        maxWidthClassName="max-w-2xl"
        footer={
          <div className="space-y-3">
            {(actionError || copyMessage) ? (
              <p className={cn('text-sm', actionError ? 'text-rose-600' : 'text-foreground')}>
                {actionError || copyMessage}
              </p>
            ) : null}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:flex-wrap sm:justify-end sm:gap-3">
              {!isEditing ? (
                <>
                  <SecondaryButton onClick={openEditMode}>
                    <Edit2 className="h-4 w-4" />编辑订单
                  </SecondaryButton>
                  {selectedOrder ? (
                    <SecondaryButton
                      onClick={() => handleCopy(buildCustomerInfo(selectedOrder), '已复制客户信息')}
                      disabled={!selectedOrder.order.customer_name && !selectedOrder.order.customer_phone && !selectedOrder.order.shipping_address}
                    >
                      <Clipboard className="h-4 w-4" />复制客户信息
                    </SecondaryButton>
                  ) : null}
                  {nextStatusAction ? nextStatusAction.tone === 'primary' ? (
                    <PrimaryButton
                      onClick={handleStatusAction}
                      disabled={isPending || (nextStatusAction.requireTracking && !confirmShip)}
                    >
                      {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <nextStatusAction.icon className="h-4 w-4" />}
                      {confirmShip && nextStatusAction.requireTracking ? '确认发货' : nextStatusAction.label}
                    </PrimaryButton>
                  ) : (
                    <SecondaryButton onClick={handleStatusAction} disabled={isPending}>
                      {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <nextStatusAction.icon className="h-4 w-4" />}
                      {nextStatusAction.label}
                    </SecondaryButton>
                  ) : null}
                  <SecondaryButton onClick={() => { setSelectedOrder(null); setActionError(null); setCopyMessage(null); setTrackingNumberInput(''); setConfirmShip(false); }}>关闭</SecondaryButton>
                </>
              ) : (
                <>
                  <SecondaryButton onClick={cancelEdit} disabled={isPending}><X className="h-4 w-4" />取消</SecondaryButton>
                  <PrimaryButton onClick={handleSaveEdit} disabled={isPending}>
                    {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}保存修改
                  </PrimaryButton>
                </>
              )}
            </div>
          </div>
        }
      >
        {selectedOrder ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              {currentStatus ? <StatBadge tone={currentStatus.tone}>{currentStatus.label}</StatBadge> : null}
              <StatBadge tone="slate">订单号：{selectedOrder.order.id}</StatBadge>
            </div>

            {nextStatusAction?.requireTracking && !isEditing ? (
              <div className="space-y-2 rounded-2xl bg-amber-50 p-3">
                <div className="flex items-center gap-2 text-amber-700">
                  <Truck className="h-4 w-4" />
                  <p className="text-sm font-semibold">发货方式</p>
                </div>
                <div className="flex gap-2">
                  {(['express', 'hainter', 'pickup'] as const).map((method) => (
                    <button
                      key={method}
                      type="button"
                      onClick={() => { setShipMethod(method); setTrackingNumberInput(''); setConfirmShip(false); }}
                      className={cn(
                        'flex flex-1 items-center justify-center gap-2 rounded-xl border-2 px-3 py-2 text-[13px] font-medium transition-all',
                        shipMethod === method
                          ? 'border-amber-400 bg-white text-amber-700 shadow-sm'
                          : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
                      )}
                    >
                      {method === 'express' ? <Truck className="h-4 w-4" /> : method === 'hainter' ? <RotateCcw className="h-4 w-4" /> : <UserRound className="h-4 w-4" />}
                      {method === 'express' ? '快递' : method === 'hainter' ? '跑腿' : '自提'}
                    </button>
                  ))}
                </div>
                {shipMethod === 'express' && (
                  <div className="space-y-2">
                    <select
                      value={expressCarrier}
                      onChange={(e) => { setExpressCarrier(e.target.value); if (confirmShip) setConfirmShip(false); }}
                      className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm shadow-sm transition-all outline-none focus:border-foreground/30 focus:ring-2 focus:ring-foreground/10"
                    >
                      {EXPRESS_CARRIERS.map((c) => (
                        <option key={c.code} value={c.code}>{c.name}</option>
                      ))}
                    </select>
                    <TextInput
                      value={trackingNumberInput}
                      onChange={(e) => { setTrackingNumberInput(e.target.value); if (confirmShip) setConfirmShip(false); }}
                      placeholder="请输入运单号"
                    />
                  </div>
                )}
                {shipMethod === 'hainter' && (
                  <TextInput
                    value={trackingNumberInput}
                    onChange={(e) => { setTrackingNumberInput(e.target.value); if (confirmShip) setConfirmShip(false); }}
                    placeholder="请输入跑腿运单号（选填）"
                  />
                )}
                <label className="flex items-start gap-3 rounded-xl bg-white px-3 py-2.5 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={confirmShip}
                    onChange={(e) => setConfirmShip(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="flex items-start gap-2">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    我已确认客户信息、收货地址无误，立即执行发货。
                  </span>
                </label>
              </div>
            ) : null}

            {isEditing ? (
              <div className="space-y-3 rounded-2xl border border-indigo-200 bg-indigo-50/50 p-4">
                <p className="flex items-center gap-2 text-sm font-semibold text-indigo-700">
                  <Edit2 className="h-4 w-4" />编辑订单信息
                </p>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <label className="text-[12px] font-medium text-slate-500">客户姓名</label>
                    <TextInput
                      value={editForm.customer_name}
                      onChange={(e) => setEditForm((f) => ({ ...f, customer_name: e.target.value }))}
                      placeholder="收件人姓名"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[12px] font-medium text-slate-500">联系电话</label>
                    <TextInput
                      value={editForm.customer_phone}
                      onChange={(e) => setEditForm((f) => ({ ...f, customer_phone: e.target.value }))}
                      placeholder="收件人电话"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[12px] font-medium text-slate-500">租赁期限</label>
                    <DateRangePicker
                      date={editDateRange}
                      onDateChange={setEditDateRange}
                      placeholder="请选择租赁期限..."
                    />
                  </div>
                  <div className="md:col-span-2 space-y-1.5">
                    <label className="text-[12px] font-medium text-slate-500">收货地址</label>
                    <textarea
                      value={editForm.shipping_address}
                      onChange={(e) => setEditForm((f) => ({ ...f, shipping_address: e.target.value }))}
                      placeholder="详细收货地址"
                      rows={2}
                      className="w-full resize-none rounded-2xl border border-input bg-background px-4 py-3 text-[14px] text-foreground shadow-sm transition-all outline-none focus:border-foreground/30 focus:ring-2 focus:ring-foreground/10"
                    />
                  </div>
                  <div className="md:col-span-2 space-y-1.5">
                    <label className="text-[12px] font-medium text-slate-500">订单备注</label>
                    <textarea
                      value={editForm.notes}
                      onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))}
                      placeholder="客户特殊需求、注意事项等..."
                      rows={3}
                      className="w-full resize-none rounded-2xl border border-input bg-background px-4 py-3 text-[14px] text-foreground shadow-sm transition-all outline-none focus:border-foreground/30 focus:ring-2 focus:ring-foreground/10"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <>
                <InfoTile className="p-3">
                  <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400">订单信息</p>
                  <div className="mt-2 grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
                    <div className="flex items-start justify-between gap-3">
                      <span className="text-slate-400">设备</span>
                      <span className="text-right font-medium">{selectedOrder.equipmentName}</span>
                    </div>
                    <div className="flex items-start justify-between gap-3">
                      <span className="text-slate-400">租赁时间</span>
                      <span className="text-right font-medium">{selectedOrder.order.start_date} ~ {selectedOrder.order.end_date}</span>
                    </div>
                    <div className="flex items-start justify-between gap-3">
                      <span className="text-slate-400">客户姓名</span>
                      <span className="text-right font-medium">{selectedOrder.order.customer_name || '—'}</span>
                    </div>
                    <div className="flex items-start justify-between gap-3">
                      <span className="text-slate-400">联系电话</span>
                      <span className="text-right font-medium">{selectedOrder.order.customer_phone || '—'}</span>
                    </div>
                    <div className="flex items-start justify-between gap-3 sm:col-span-2">
                      <span className="text-slate-400">收货地址</span>
                      <span className="text-right font-medium">{selectedOrder.order.shipping_address || '—'}</span>
                    </div>
                  </div>
                </InfoTile>

                <div className="grid gap-4 md:grid-cols-2">
                  <InfoTile className="p-3">
                    <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400">物流信息</p>
                    <div className="mt-2 space-y-2 text-sm text-slate-700">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-slate-400">运单号</span>
                        <span className="font-medium">{selectedOrder.order.tracking_number || '暂未录入'}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-slate-400">免押方式</span>
                        <span className="font-medium">{selectedOrder.order.deposit_exemption || '—'}</span>
                      </div>
                    </div>
                  </InfoTile>

                  <InfoTile className="p-3">
                    <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400">费用信息</p>
                    <div className="mt-2 space-y-2 text-sm text-slate-700">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-slate-400">订单金额</span>
                        <span className="font-medium">¥{Number(selectedOrder.order.total_price || 0).toFixed(2)}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-slate-400">已付押金</span>
                        <span className="font-medium">¥{Number(selectedOrder.order.deposit_paid || 0).toFixed(2)}</span>
                      </div>
                    </div>
                  </InfoTile>
                </div>

                {selectedOrder.order.notes ? (
                  <InfoTile className="p-3">
                    <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400">订单备注</p>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{selectedOrder.order.notes}</p>
                  </InfoTile>
                ) : (
                  <InfoTile className="p-3">
                    <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400">订单备注</p>
                    <p className="mt-2 text-sm text-muted-foreground">暂无备注</p>
                  </InfoTile>
                )}
              </>
            )}
          </div>
        ) : null}
      </Modal>
      {tooltip && (
        <div
          className="pointer-events-none absolute z-50 w-56 rounded-2xl bg-white p-3 text-left shadow-xl ring-1 ring-black/5 sm:w-64"
          style={{
            left: tooltip.barRect.left + tooltip.barRect.width / 2,
            top: tooltip.barRect.bottom + 4,
            transform: 'translateX(-50%)',
          }}
        >
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-slate-900">{tooltip.order.customer_name ?? '未命名客户'}</p>
          </div>
          <div className="mt-2.5 space-y-1.5 text-xs text-slate-700">
            <div className="flex items-start justify-between gap-3">
              <span className="text-slate-400">设备</span>
              <span className="text-right font-medium">{tooltip.equipmentName}</span>
            </div>
            <div className="flex items-start justify-between gap-3">
              <span className="text-slate-400">时间</span>
              <span className="text-right font-medium">{tooltip.order.start_date} ~ {tooltip.order.end_date}</span>
            </div>
            <div className="flex items-start justify-between gap-3">
              <span className="text-slate-400">电话</span>
              <span className="font-medium">{tooltip.order.customer_phone || '—'}</span>
            </div>
            {tooltip.order.notes ? (
              <div className="rounded-lg bg-amber-50 px-2 py-1.5 text-amber-700">
                <span className="font-medium">&#128221; </span>{tooltip.order.notes}
              </div>
            ) : null}
            <p className="pt-1 text-[10px] text-slate-400">点击查看完整订单详情</p>
          </div>
        </div>
      )}
    </div>
  );
}
