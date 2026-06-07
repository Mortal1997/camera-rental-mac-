'use client';

import {
  AlertTriangle,
  CalendarRange,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clipboard,
  Loader2,
  MapPin,
  Package2,
  Phone,
  RotateCcw,
  Send,
  Truck,
  UserRound,
  Wrench,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { updateOrderStatus } from '../../actions/admin-actions';
import type { EquipmentWithOrders, Order } from '../../actions/types';
import { EmptyState, Modal, PrimaryButton, SecondaryButton, SelectInput, SectionHeader, StatBadge, SurfaceCard, TextInput, cn } from './ui';

interface GanttChartProps {
  equipment: EquipmentWithOrders[];
}

type SelectedOrderState = {
  order: Order;
  equipmentId: string;
  equipmentName: string;
  category?: string;
};

const HOLIDAYS_2026 = [
  '2026-01-01',
  '2026-02-16',
  '2026-02-17',
  '2026-02-18',
  '2026-02-19',
  '2026-02-20',
  '2026-02-21',
  '2026-02-22',
  '2026-04-04',
  '2026-05-01',
  '2026-05-02',
  '2026-05-03',
  '2026-05-04',
  '2026-05-05',
  '2026-06-19',
  '2026-09-25',
  '2026-10-01',
  '2026-10-02',
  '2026-10-03',
  '2026-10-04',
  '2026-10-05',
  '2026-10-06',
  '2026-10-07',
];

const STICKY_COLUMN_WIDTH = 176;
const DAY_COLUMN_WIDTH = 76;
const PAST_DAYS = 30;
const FUTURE_DAYS = 60;
const SCROLL_STEP_DAYS = 7;

function getStatusPill(status: string) {
  if (status === 'pending_payment' || status === 'confirmed') {
    return {
      label: '待发货',
      bar: 'bg-blue-500/95 ring-1 ring-blue-300/50',
      tone: 'blue' as const,
      accent: 'bg-blue-100 text-blue-700',
    };
  }
  if (status === 'using') {
    return {
      label: '租用中',
      bar: 'bg-amber-500/95 ring-1 ring-amber-300/50',
      tone: 'amber' as const,
      accent: 'bg-amber-100 text-amber-700',
    };
  }
  if (status === 'returned') {
    return {
      label: '已完成',
      bar: 'bg-emerald-500/95 ring-1 ring-emerald-300/50',
      tone: 'emerald' as const,
      accent: 'bg-emerald-100 text-emerald-700',
    };
  }
  return {
    label: status,
    bar: 'bg-slate-500/95 ring-1 ring-slate-300/50',
    tone: 'slate' as const,
    accent: 'bg-slate-100 text-slate-700',
  };
}

function getEquipmentStatusBadge(status: EquipmentWithOrders['status']) {
  if (status === 'available') {
    return { label: '空闲', tone: 'emerald' as const, icon: CheckCircle2 };
  }
  if (status === 'rented') {
    return { label: '已出租', tone: 'amber' as const, icon: Package2 };
  }
  return { label: '维护中', tone: 'red' as const, icon: Wrench };
}

function formatDayLabel(date: Date) {
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function formatMonthLabel(date: Date) {
  return `${date.getFullYear()} 年 ${date.getMonth() + 1} 月`;
}

function getStartOfDay(dateLike: string | Date) {
  const date = new Date(dateLike);
  date.setHours(0, 0, 0, 0);
  return date;
}

function getDateDiffInDays(start: Date, end: Date) {
  return Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
}

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function isWeekend(date: Date) {
  const day = date.getDay();
  return day === 0 || day === 6;
}

function isHoliday(dateString: string) {
  return HOLIDAYS_2026.includes(dateString);
}

function isSameDay(left: Date, right: Date) {
  return toDateKey(left) === toDateKey(right);
}

function getColumnTone({ holiday, weekend, todayColumn }: { holiday: boolean; weekend: boolean; todayColumn: boolean }) {
  if (todayColumn) return 'bg-blue-50/70';
  if (holiday) return 'bg-red-50/80';
  if (weekend) return 'bg-slate-50';
  return '';
}

function matchesStatusFilter(orders: Order[], filter: string) {
  if (filter === 'all') return true;
  return orders.some((order) => order.status === filter);
}

function getTooltipPlacement(index: number, span: number, totalDays: number, rowIndex: number, totalRows: number) {
  const horizontal = index + span > totalDays - 6 ? 'right' : 'left';
  const vertical = rowIndex >= totalRows - 2 ? 'top' : 'bottom';
  return { horizontal, vertical };
}

function getNextStatusAction(order: Order) {
  if (order.status === 'pending_payment' || order.status === 'confirmed') {
    return {
      label: '标记发货',
      nextStatus: 'using',
      icon: Send,
      tone: 'primary' as const,
      requireTracking: true,
    };
  }

  if (order.status === 'using') {
    return {
      label: '标记归还',
      nextStatus: 'returned',
      icon: CheckCircle2,
      tone: 'secondary' as const,
      requireTracking: false,
    };
  }

  return null;
}

function buildOrderSummary(selectedOrder: SelectedOrderState) {
  return [
    `客户：${selectedOrder.order.customer_name || '—'}`,
    `电话：${selectedOrder.order.customer_phone || '—'}`,
    `设备：${selectedOrder.equipmentName}`,
    `时间：${selectedOrder.order.start_date} ~ ${selectedOrder.order.end_date}`,
    `地址：${selectedOrder.order.shipping_address || '—'}`,
    `订单号：${selectedOrder.order.id}`,
    `运单号：${selectedOrder.order.tracking_number || '—'}`,
  ].join('\n');
}

function InfoCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof CalendarRange;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
      <div className="flex items-center gap-2 text-slate-400">
        <Icon className="h-4 w-4" />
        <span className="text-xs font-semibold uppercase tracking-[0.16em]">{label}</span>
      </div>
      <p className="mt-3 text-sm font-medium text-slate-700">{value}</p>
    </div>
  );
}

export default function GanttChart({ equipment }: GanttChartProps) {
  const today = useMemo(() => getStartOfDay(new Date()), []);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [hoveredOrderId, setHoveredOrderId] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<SelectedOrderState | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [actionError, setActionError] = useState<string | null>(null);
  const [copyMessage, setCopyMessage] = useState<string | null>(null);
  const [trackingNumberInput, setTrackingNumberInput] = useState('');
  const [confirmShip, setConfirmShip] = useState(false);
  const [isPending, startTransition] = useTransition();
  const dragStateRef = useRef({ isDown: false, startX: 0, scrollLeft: 0 });

  const days = useMemo(() => {
    return Array.from({ length: PAST_DAYS + FUTURE_DAYS }, (_, index) => {
      const date = new Date(today);
      date.setDate(date.getDate() + index - PAST_DAYS);
      return date;
    });
  }, [today]);

  const monthGroups = useMemo(() => {
    const groups: Array<{ label: string; startIndex: number; span: number }> = [];

    days.forEach((date, index) => {
      const label = formatMonthLabel(date);
      const last = groups[groups.length - 1];
      if (!last || last.label !== label) {
        groups.push({ label, startIndex: index, span: 1 });
      } else {
        last.span += 1;
      }
    });

    return groups;
  }, [days]);

  const categories = useMemo(() => {
    return Array.from(new Set(equipment.map((item) => item.category?.trim()).filter(Boolean))) as string[];
  }, [equipment]);

  const filteredEquipment = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return equipment.filter((item) => {
      const matchesSearch =
        !normalizedSearch ||
        item.name.toLowerCase().includes(normalizedSearch) ||
        item.serial_number?.toLowerCase().includes(normalizedSearch) ||
        item.orders.some((order) => (order.customer_name ?? '').toLowerCase().includes(normalizedSearch));

      const matchesCategory = categoryFilter === 'all' || (item.category ?? '') === categoryFilter;
      const matchesStatus = matchesStatusFilter(item.orders, statusFilter);

      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [categoryFilter, equipment, searchTerm, statusFilter]);

  const totalOrders = useMemo(() => filteredEquipment.reduce((sum, item) => sum + item.orders.length, 0), [filteredEquipment]);

  const currentStatus = selectedOrder ? getStatusPill(selectedOrder.order.status) : null;
  const nextStatusAction = selectedOrder ? getNextStatusAction(selectedOrder.order) : null;

  const scrollToDayIndex = (dayIndex: number) => {
    const scroller = scrollRef.current;
    if (!scroller) return;
    const targetLeft = dayIndex * DAY_COLUMN_WIDTH - DAY_COLUMN_WIDTH * 1.5;
    scroller.scrollTo({ left: Math.max(targetLeft, 0), behavior: 'smooth' });
  };

  const scrollByDays = (direction: -1 | 1) => {
    const scroller = scrollRef.current;
    if (!scroller) return;
    scroller.scrollBy({ left: direction * DAY_COLUMN_WIDTH * SCROLL_STEP_DAYS, behavior: 'smooth' });
  };

  const resetFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setCategoryFilter('all');
  };

  useEffect(() => {
    scrollToDayIndex(PAST_DAYS);
  }, []);

  useEffect(() => {
    if (!copyMessage) return;
    const timer = window.setTimeout(() => setCopyMessage(null), 2000);
    return () => window.clearTimeout(timer);
  }, [copyMessage]);

  const handleMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    const scroller = scrollRef.current;
    if (!scroller) return;

    dragStateRef.current = {
      isDown: true,
      startX: event.pageX - scroller.offsetLeft,
      scrollLeft: scroller.scrollLeft,
    };
    setIsDragging(true);
  };

  const stopDragging = () => {
    dragStateRef.current.isDown = false;
    setIsDragging(false);
  };

  const handleMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    const scroller = scrollRef.current;
    if (!scroller || !dragStateRef.current.isDown) return;

    event.preventDefault();
    const x = event.pageX - scroller.offsetLeft;
    const walk = x - dragStateRef.current.startX;
    scroller.scrollLeft = dragStateRef.current.scrollLeft - walk;
  };

  const handleCopy = async (content: string, message: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopyMessage(message);
      setActionError(null);
    } catch {
      setActionError('复制失败，请检查浏览器权限');
    }
  };

  const handleStatusAction = () => {
    if (!selectedOrder || !nextStatusAction) return;

    const trackingNumber = trackingNumberInput.trim();
    if (nextStatusAction.requireTracking && !trackingNumber) {
      setActionError('发货前请先填写运单号');
      return;
    }

    if (nextStatusAction.requireTracking && !confirmShip) {
      setActionError('请先确认本次发货信息无误');
      return;
    }

    setActionError(null);
    startTransition(async () => {
      const result = await updateOrderStatus(
        selectedOrder.order.id,
        nextStatusAction.nextStatus,
        nextStatusAction.requireTracking ? trackingNumber : selectedOrder.order.tracking_number,
        selectedOrder.equipmentId
      );

      if (!result.success) {
        setActionError(result.error ?? '更新订单状态失败');
        return;
      }

      setSelectedOrder({
        ...selectedOrder,
        order: {
          ...selectedOrder.order,
          status: nextStatusAction.nextStatus as Order['status'],
          tracking_number: nextStatusAction.requireTracking ? trackingNumber : selectedOrder.order.tracking_number,
        },
      });

      setConfirmShip(false);
      if (nextStatusAction.requireTracking) {
        setCopyMessage('已完成发货并保存运单号');
      } else {
        setCopyMessage('已完成归还，设备状态已同步为空闲');
      }
    });
  };

  return (
    <>
      <SurfaceCard className="p-0">
        <div className="border-b border-slate-100 px-6 py-5">
          <SectionHeader
            title="排期看板"
            description="显示过去 30 天到未来 60 天内所有设备的租赁安排。"
            meta={<span>{filteredEquipment.length} / {equipment.length} 台设备</span>}
          />

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <StatBadge tone="blue">待发货</StatBadge>
            <StatBadge tone="amber">租用中</StatBadge>
            <StatBadge tone="emerald">已完成</StatBadge>
            <StatBadge tone="red">法定节假日</StatBadge>
            <StatBadge tone="slate">周末</StatBadge>
            <StatBadge tone="indigo">今日列</StatBadge>
          </div>

          <div className="mt-5 grid gap-3 rounded-2xl border border-slate-100 bg-slate-50/70 p-4 xl:grid-cols-[minmax(0,1.3fr)_auto] xl:items-end">
            <div className="grid gap-3 md:grid-cols-3">
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">搜索</p>
                <TextInput
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="设备名 / 序列号 / 客户名"
                />
              </div>
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">订单状态</p>
                <SelectInput value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                  <option value="all">全部状态</option>
                  <option value="pending_payment">待支付</option>
                  <option value="confirmed">已确认</option>
                  <option value="using">租用中</option>
                  <option value="returned">已归还</option>
                  <option value="cancelled">已取消</option>
                </SelectInput>
              </div>
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">设备分类</p>
                <SelectInput value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
                  <option value="all">全部分类</option>
                  {categories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </SelectInput>
              </div>
            </div>

            <div className="flex flex-col gap-3 xl:items-end">
              <div className="flex flex-wrap items-center gap-2">
                <SecondaryButton onClick={() => scrollByDays(-1)}>
                  <ChevronLeft className="h-4 w-4" />上周
                </SecondaryButton>
                <PrimaryButton onClick={() => scrollToDayIndex(PAST_DAYS)}>跳转今天</PrimaryButton>
                <SecondaryButton onClick={() => scrollByDays(1)}>
                  下周<ChevronRight className="h-4 w-4" />
                </SecondaryButton>
                <SecondaryButton onClick={resetFilters}>
                  <RotateCcw className="h-4 w-4" />重置筛选
                </SecondaryButton>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <span className="rounded-full bg-white px-3 py-1 shadow-sm">范围：{toDateKey(days[0])} ~ {toDateKey(days[days.length - 1])}</span>
                <span className="rounded-full bg-white px-3 py-1 shadow-sm">当前结果：{filteredEquipment.length} 台 / {totalOrders} 条排期</span>
              </div>
            </div>
          </div>
        </div>

        <div
          ref={scrollRef}
          onMouseDown={handleMouseDown}
          onMouseLeave={stopDragging}
          onMouseUp={stopDragging}
          onMouseMove={handleMouseMove}
          className={cn(
            'overflow-x-auto p-4 select-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
            isDragging ? 'cursor-grabbing' : 'cursor-grab'
          )}
        >
          {filteredEquipment.length === 0 ? (
            <EmptyState>当前筛选条件下暂无排期数据</EmptyState>
          ) : (
            <table className="w-full min-w-[7000px] table-fixed border-collapse text-xs">
              <thead>
                <tr>
                  <th
                    rowSpan={2}
                    className="sticky left-0 z-30 border-b border-slate-100 bg-white px-4 py-3 text-left font-semibold text-slate-500"
                    style={{ width: STICKY_COLUMN_WIDTH }}
                  >
                    设备
                  </th>
                  {monthGroups.map((group) => {
                    const containsToday = days
                      .slice(group.startIndex, group.startIndex + group.span)
                      .some((date) => isSameDay(date, today));
                    return (
                      <th
                        key={`${group.label}-${group.startIndex}`}
                        colSpan={group.span}
                        className={cn(
                          'border-b border-slate-100 px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400',
                          containsToday && 'bg-blue-50/60 text-blue-700'
                        )}
                      >
                        {group.label}
                      </th>
                    );
                  })}
                </tr>
                <tr>
                  {days.map((date) => {
                    const dateKey = toDateKey(date);
                    const holiday = isHoliday(dateKey);
                    const weekend = isWeekend(date);
                    const todayColumn = isSameDay(date, today);

                    return (
                      <th
                        key={dateKey}
                        className={cn(
                          'relative border-b border-slate-100 px-1 py-3 text-center font-medium',
                          holiday
                            ? 'bg-red-50/80 text-red-500'
                            : weekend
                              ? 'bg-slate-50 text-slate-600'
                              : 'text-slate-400',
                          todayColumn && 'z-10 bg-blue-50/80'
                        )}
                        style={{ width: DAY_COLUMN_WIDTH }}
                      >
                        {todayColumn ? <span className="pointer-events-none absolute inset-y-0 left-0 w-px bg-blue-400/70" /> : null}
                        <div
                          className={cn(
                            'mx-auto flex w-fit items-center gap-1 rounded-md px-2 py-1',
                            todayColumn && 'bg-blue-100 font-bold text-blue-700 ring-1 ring-blue-200'
                          )}
                        >
                          <span>{formatDayLabel(date)}</span>
                          {holiday ? <span className="text-[10px] font-semibold">休</span> : null}
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {filteredEquipment.map((item, rowIndex) => {
                  const equipmentStatus = getEquipmentStatusBadge(item.status);
                  const EquipmentStatusIcon = equipmentStatus.icon;

                  return (
                    <tr key={item.id}>
                      <td
                        className="sticky left-0 z-20 border-b border-slate-100 bg-white px-4 py-4 font-medium text-slate-900"
                        style={{ width: STICKY_COLUMN_WIDTH }}
                      >
                        <div className="space-y-1.5">
                          <p>{item.name}</p>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium', equipmentStatus.tone === 'emerald' ? 'bg-emerald-50 text-emerald-700' : equipmentStatus.tone === 'amber' ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700')}>
                              <EquipmentStatusIcon className="h-3 w-3" />
                              {equipmentStatus.label}
                            </span>
                            {item.category ? <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">{item.category}</span> : null}
                            <p className="text-[11px] text-slate-400">{item.orders.length} 条排期</p>
                          </div>
                        </div>
                      </td>
                      {days.map((date, index) => {
                        const dateKey = toDateKey(date);
                        const holiday = isHoliday(dateKey);
                        const weekend = isWeekend(date);
                        const todayColumn = isSameDay(date, today);
                        const order = item.orders.find((currentOrder: Order) => {
                          if (!currentOrder.start_date) return false;
                          const startDate = getStartOfDay(currentOrder.start_date);
                          return getDateDiffInDays(days[0], startDate) === index;
                        });

                        if (!order) {
                          return (
                            <td
                              key={`${item.id}-${dateKey}`}
                              className={cn('relative h-16 border-b border-slate-100', getColumnTone({ holiday, weekend, todayColumn }))}
                              style={{ width: DAY_COLUMN_WIDTH }}
                            >
                              {todayColumn ? <span className="pointer-events-none absolute inset-y-0 left-0 z-0 w-px bg-blue-400/70" /> : null}
                            </td>
                          );
                        }

                        const pill = getStatusPill(order.status);
                        const startDate = getStartOfDay(order.start_date ?? order.end_date ?? date);
                        const endDate = getStartOfDay(order.end_date ?? order.start_date ?? date);
                        const rawSpan = getDateDiffInDays(startDate, endDate) + 1;
                        const clampedSpan = Math.min(rawSpan, days.length - index);
                        const isHovered = hoveredOrderId === order.id;
                        const tooltipPlacement = getTooltipPlacement(index, clampedSpan, days.length, rowIndex, filteredEquipment.length);

                        return (
                          <td
                            key={`${item.id}-${dateKey}`}
                            className={cn('relative h-16 border-b border-slate-100 p-0', getColumnTone({ holiday, weekend, todayColumn }))}
                            style={{ width: DAY_COLUMN_WIDTH }}
                          >
                            {todayColumn ? <span className="pointer-events-none absolute inset-y-0 left-0 z-0 w-px bg-blue-400/70" /> : null}
                            <div
                              className={cn(
                                'absolute inset-y-2 left-0 z-10 overflow-visible transition-transform duration-150',
                                isHovered && 'scale-[1.01]'
                              )}
                              style={{ width: `calc(${DAY_COLUMN_WIDTH}px * ${clampedSpan})` }}
                              onMouseEnter={() => setHoveredOrderId(order.id)}
                              onMouseLeave={() => setHoveredOrderId((current) => (current === order.id ? null : current))}
                            >
                              <button
                                type="button"
                                onClick={() => {
                                  setActionError(null);
                                  setCopyMessage(null);
                                  setConfirmShip(false);
                                  setTrackingNumberInput(order.tracking_number || '');
                                  setSelectedOrder({
                                    order,
                                    equipmentId: item.id,
                                    equipmentName: item.name,
                                    category: item.category,
                                  });
                                }}
                                className="block h-full w-full text-left outline-none"
                              >
                                <div
                                  className={cn(
                                    'flex h-full items-center justify-between gap-2 overflow-hidden rounded-xl px-2.5 py-1.5 text-white shadow-sm transition-all duration-150',
                                    pill.bar,
                                    isHovered && 'shadow-lg ring-2 ring-white/60'
                                  )}
                                >
                                  <div className="min-w-0">
                                    <p className="truncate text-[11px] font-semibold leading-4">{order.customer_name ?? '订单'}</p>
                                    <p className="truncate text-[10px] text-white/85">{pill.label}</p>
                                  </div>
                                  {clampedSpan >= 2 ? <span className="shrink-0 rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-medium">{rawSpan} 天</span> : null}
                                </div>
                              </button>

                              {isHovered ? (
                                <div
                                  className={cn(
                                    'absolute z-30 w-64 rounded-2xl border border-slate-200 bg-white p-4 text-left text-slate-700 shadow-2xl',
                                    tooltipPlacement.horizontal === 'right' ? 'right-0' : 'left-0',
                                    tooltipPlacement.vertical === 'top' ? 'bottom-full mb-2' : 'top-full mt-2'
                                  )}
                                >
                                  <div className="flex items-center justify-between gap-3">
                                    <p className="text-sm font-semibold text-slate-900">{order.customer_name ?? '未命名客户'}</p>
                                    <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold', pill.accent)}>{pill.label}</span>
                                  </div>
                                  <div className="mt-3 space-y-2 text-xs">
                                    <div className="flex items-start justify-between gap-3">
                                      <span className="text-slate-400">设备</span>
                                      <span className="text-right font-medium text-slate-700">{item.name}</span>
                                    </div>
                                    <div className="flex items-start justify-between gap-3">
                                      <span className="text-slate-400">时间</span>
                                      <span className="text-right font-medium text-slate-700">{order.start_date} ~ {order.end_date}</span>
                                    </div>
                                    <div className="flex items-start justify-between gap-3">
                                      <span className="text-slate-400">电话</span>
                                      <span className="font-medium text-slate-700">{order.customer_phone || '—'}</span>
                                    </div>
                                    <p className="pt-2 text-[11px] text-slate-400">点击色块可查看完整订单详情</p>
                                  </div>
                                </div>
                              ) : null}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </SurfaceCard>

      <Modal
        open={Boolean(selectedOrder)}
        onClose={() => {
          setSelectedOrder(null);
          setActionError(null);
          setCopyMessage(null);
          setTrackingNumberInput('');
          setConfirmShip(false);
        }}
        eyebrow="Order Detail"
        icon={Package2}
        title={selectedOrder?.order.customer_name || '订单详情'}
        maxWidthClassName="max-w-3xl"
        footer={
          <div className="space-y-3">
            {(actionError || copyMessage) ? (
              <p className={cn('text-sm', actionError ? 'text-red-500' : 'text-emerald-600')}>
                {actionError || copyMessage}
              </p>
            ) : null}
            <div className="flex flex-wrap justify-end gap-2">
              {selectedOrder ? (
                <SecondaryButton onClick={() => handleCopy(selectedOrder.order.customer_phone || '', '已复制联系电话')} disabled={!selectedOrder.order.customer_phone}>
                  <Clipboard className="h-4 w-4" />复制电话
                </SecondaryButton>
              ) : null}
              {selectedOrder ? (
                <SecondaryButton onClick={() => handleCopy(selectedOrder.order.shipping_address || '', '已复制收货地址')} disabled={!selectedOrder.order.shipping_address}>
                  <MapPin className="h-4 w-4" />复制地址
                </SecondaryButton>
              ) : null}
              {selectedOrder ? (
                <SecondaryButton onClick={() => handleCopy(buildOrderSummary(selectedOrder), '已复制订单摘要')}>
                  <Clipboard className="h-4 w-4" />复制摘要
                </SecondaryButton>
              ) : null}
              {nextStatusAction ? (
                nextStatusAction.tone === 'primary' ? (
                  <PrimaryButton onClick={handleStatusAction} disabled={isPending || (nextStatusAction.requireTracking && !confirmShip)}>
                    {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <nextStatusAction.icon className="h-4 w-4" />}
                    {confirmShip && nextStatusAction.requireTracking ? '确认发货' : nextStatusAction.label}
                  </PrimaryButton>
                ) : (
                  <SecondaryButton onClick={handleStatusAction} disabled={isPending}>
                    {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <nextStatusAction.icon className="h-4 w-4" />}
                    {nextStatusAction.label}
                  </SecondaryButton>
                )
              ) : null}
              <SecondaryButton
                onClick={() => {
                  setSelectedOrder(null);
                  setActionError(null);
                  setCopyMessage(null);
                  setTrackingNumberInput('');
                  setConfirmShip(false);
                }}
              >
                关闭
              </SecondaryButton>
            </div>
          </div>
        }
      >
        {selectedOrder ? (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-3">
              {currentStatus ? <StatBadge tone={currentStatus.tone}>{currentStatus.label}</StatBadge> : null}
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-500">订单号：{selectedOrder.order.id}</span>
              {selectedOrder.category ? <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-500">分类：{selectedOrder.category}</span> : null}
            </div>

            {nextStatusAction?.requireTracking ? (
              <div className="space-y-3 rounded-2xl border border-blue-100 bg-blue-50/70 p-4">
                <div className="flex items-center gap-2 text-blue-700">
                  <Truck className="h-4 w-4" />
                  <p className="text-sm font-semibold">发货前请录入运单号</p>
                </div>
                <TextInput
                  value={trackingNumberInput}
                  onChange={(e) => {
                    setTrackingNumberInput(e.target.value);
                    if (confirmShip) setConfirmShip(false);
                  }}
                  placeholder="请输入顺丰 / 京东 / 菜鸟等运单号"
                />
                <label className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-800">
                  <input
                    type="checkbox"
                    checked={confirmShip}
                    onChange={(e) => setConfirmShip(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-amber-300 text-amber-600 focus:ring-amber-500"
                  />
                  <span className="flex items-start gap-2">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    我已确认客户信息、收货地址和运单号无误，立即执行发货。
                  </span>
                </label>
              </div>
            ) : null}

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <InfoCard icon={Package2} label="设备" value={selectedOrder.equipmentName} />
              <InfoCard icon={CalendarRange} label="租赁时间" value={`${selectedOrder.order.start_date} ~ ${selectedOrder.order.end_date}`} />
              <InfoCard icon={UserRound} label="客户姓名" value={selectedOrder.order.customer_name || '—'} />
              <InfoCard icon={Phone} label="联系电话" value={selectedOrder.order.customer_phone || '—'} />
              <InfoCard icon={MapPin} label="收货地址" value={selectedOrder.order.shipping_address || '—'} />
              <InfoCard icon={CalendarRange} label="订单金额" value={`¥${Number(selectedOrder.order.total_price || 0).toFixed(2)}`} />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-slate-100 bg-white p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">物流信息</p>
                <div className="mt-4 space-y-3 text-sm text-slate-600">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-slate-400">运单号</span>
                    <span className="font-medium text-slate-700">{selectedOrder.order.tracking_number || '暂未录入'}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-slate-400">免押方式</span>
                    <span className="font-medium text-slate-700">{selectedOrder.order.deposit_exemption || '—'}</span>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-100 bg-white p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">费用信息</p>
                <div className="mt-4 space-y-3 text-sm text-slate-600">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-slate-400">订单金额</span>
                    <span className="font-medium text-slate-700">¥{Number(selectedOrder.order.total_price || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-slate-400">已付押金</span>
                    <span className="font-medium text-slate-700">¥{Number(selectedOrder.order.deposit_paid || 0).toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </Modal>
    </>
  );
}
