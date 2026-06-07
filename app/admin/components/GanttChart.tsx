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
import { EmptyState, FilterPanel, InfoTile, Modal, PrimaryButton, SecondaryButton, SelectInput, SectionHeader, StatBadge, SurfaceCard, TextInput, cn } from './ui';

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

const STICKY_COLUMN_WIDTH = 132;
const DAY_COLUMN_WIDTH = 70;
const PAST_DAYS = 30;
const FUTURE_DAYS = 60;
const SCROLL_STEP_DAYS = 7;

function getStatusPill(status: string) {
  if (status === 'pending_payment' || status === 'confirmed') {
    return {
      label: '待发货',
      bar: 'bg-sky-400/85 ring-1 ring-white/70 text-slate-900',
      tone: 'blue' as const,
      accent: 'bg-sky-50/90 text-sky-700 border border-sky-200/70',
    };
  }
  if (status === 'using') {
    return {
      label: '租用中',
      bar: 'bg-amber-400/85 ring-1 ring-white/70 text-slate-900',
      tone: 'amber' as const,
      accent: 'bg-amber-50/90 text-amber-700 border border-amber-200/70',
    };
  }
  if (status === 'returned') {
    return {
      label: '已完成',
      bar: 'bg-emerald-400/85 ring-1 ring-white/70 text-slate-900',
      tone: 'emerald' as const,
      accent: 'bg-emerald-50/90 text-emerald-700 border border-emerald-200/70',
    };
  }
  return {
    label: status,
    bar: 'bg-slate-300/92 ring-1 ring-white/70 text-slate-900',
    tone: 'slate' as const,
    accent: 'bg-slate-50/90 text-slate-700 border border-slate-200/70',
  };
}

function getEquipmentStatusBadge(status: EquipmentWithOrders['status']) {
  if (status === 'available') {
    return { icon: CheckCircle2 };
  }
  if (status === 'rented') {
    return { icon: Package2 };
  }
  return { icon: Wrench };
}

function getEquipmentStatusDotTone(orders: Order[], fallbackStatus: EquipmentWithOrders['status']) {
  const activeOrder = orders.find((order) => order.status === 'using') ?? orders.find((order) => order.status === 'pending_payment' || order.status === 'confirmed') ?? orders.find((order) => order.status === 'returned');

  if (activeOrder) {
    const pill = getStatusPill(activeOrder.status);
    if (pill.tone === 'blue') return 'bg-sky-400 text-white';
    if (pill.tone === 'amber') return 'bg-amber-400 text-white';
    if (pill.tone === 'emerald') return 'bg-emerald-400 text-white';
  }

  if (fallbackStatus === 'available') return 'bg-sky-400 text-white';
  if (fallbackStatus === 'rented') return 'bg-amber-400 text-white';
  return 'bg-emerald-400 text-white';
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
  if (todayColumn) return 'bg-sky-50/70';
  if (holiday) return 'bg-rose-50/65';
  if (weekend) return 'bg-slate-50/70';
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
    <InfoTile className="p-4">
      <div className="flex items-center gap-2 text-slate-400">
        <Icon className="h-4 w-4" />
        <span className="text-[11px] font-medium uppercase tracking-[0.14em]">{label}</span>
      </div>
      <p className="mt-3 text-sm font-medium text-slate-700">{value}</p>
    </InfoTile>
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

  const categories = useMemo(
    () => Array.from(new Set(equipment.map((item) => item.category).filter(Boolean))) as string[],
    [equipment]
  );

  const filteredEquipment = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return equipment.filter((item) => {
      const matchesSearch =
        !term ||
        item.name.toLowerCase().includes(term) ||
        (item.serial_number ?? '').toLowerCase().includes(term) ||
        item.orders.some((order) => (order.customer_name ?? '').toLowerCase().includes(term));

      const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter;
      const matchesStatus = matchesStatusFilter(item.orders, statusFilter);

      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [equipment, searchTerm, categoryFilter, statusFilter]);

  const totalOrders = useMemo(
    () => filteredEquipment.reduce((sum, item) => sum + item.orders.length, 0),
    [filteredEquipment]
  );

  const currentStatus = selectedOrder ? getStatusPill(selectedOrder.order.status) : null;
  const nextStatusAction = selectedOrder ? getNextStatusAction(selectedOrder.order) : null;

  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollLeft = PAST_DAYS * DAY_COLUMN_WIDTH - STICKY_COLUMN_WIDTH * 0.2;
  }, []);

  const stopDragging = () => {
    dragStateRef.current.isDown = false;
    setIsDragging(false);
  };

  const handleMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest('button, input, select, textarea, a')) return;
    dragStateRef.current = {
      isDown: true,
      startX: event.pageX,
      scrollLeft: scrollRef.current?.scrollLeft ?? 0,
    };
    setIsDragging(true);
  };

  const handleMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!dragStateRef.current.isDown || !scrollRef.current) return;
    const delta = event.pageX - dragStateRef.current.startX;
    scrollRef.current.scrollLeft = dragStateRef.current.scrollLeft - delta;
  };

  const scrollToDayIndex = (dayIndex: number) => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTo({
      left: dayIndex * DAY_COLUMN_WIDTH,
      behavior: 'smooth',
    });
  };

  const scrollByDays = (direction: number) => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollBy({
      left: direction * SCROLL_STEP_DAYS * DAY_COLUMN_WIDTH,
      behavior: 'smooth',
    });
  };

  const resetFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setCategoryFilter('all');
  };

  const handleCopy = async (text: string, message: string) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopyMessage(message);
      setActionError(null);
    } catch {
      setActionError('复制失败，请手动复制');
    }
  };

  const handleStatusAction = () => {
    if (!selectedOrder || !nextStatusAction) return;

    setActionError(null);
    startTransition(async () => {
      const result = await updateOrderStatus(
        selectedOrder.order.id,
        nextStatusAction.nextStatus,
        nextStatusAction.requireTracking ? trackingNumberInput || undefined : undefined,
        selectedOrder.equipmentId
      );

      if (!result.success) {
        setActionError(result.error ?? '状态更新失败，请稍后重试');
        return;
      }

      setCopyMessage(nextStatusAction.nextStatus === 'using' ? '已完成发货，设备状态已同步为出租中' : '已完成归还，设备状态已同步为空闲');
      setSelectedOrder((current) =>
        current
          ? {
              ...current,
              order: {
                ...current.order,
                status: nextStatusAction.nextStatus,
                tracking_number: nextStatusAction.requireTracking ? trackingNumberInput : current.order.tracking_number,
              },
            }
          : null
      );
      if (nextStatusAction.requireTracking) {
        setConfirmShip(false);
      }
    });
  };

  return (
    <>
      <SurfaceCard className="p-0">
        <div className="border-b border-slate-100 px-4 py-4 sm:px-6 sm:py-5">
          <SectionHeader
            title="排期看板"
            description="显示过去 30 天到未来 60 天内所有设备的租赁安排。"
            meta={<span>{filteredEquipment.length} / {equipment.length} 台设备</span>}
          />

          <FilterPanel className="xl:grid-cols-[minmax(0,1.3fr)_auto] xl:items-end">
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400">搜索</p>
                <TextInput
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="设备名 / 序列号 / 客户名"
                />
              </div>
              <div>
                <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400">订单状态</p>
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
                <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400">设备分类</p>
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
                <StatBadge tone="slate">范围：{toDateKey(days[0])} ~ {toDateKey(days[days.length - 1])}</StatBadge>
                <StatBadge tone="slate">当前结果：{filteredEquipment.length} 台 / {totalOrders} 条排期</StatBadge>
              </div>
            </div>
          </FilterPanel>
        </div>

        <div
          ref={scrollRef}
          onMouseDown={handleMouseDown}
          onMouseLeave={stopDragging}
          onMouseUp={stopDragging}
          onMouseMove={handleMouseMove}
          className={cn(
            'overflow-x-auto overflow-y-visible p-4 select-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
            isDragging ? 'cursor-grabbing' : 'cursor-grab'
          )}
        >
          {filteredEquipment.length === 0 ? (
            <EmptyState>当前筛选条件下暂无排期数据</EmptyState>
          ) : (
            <table className="w-full min-w-[5200px] table-fixed border-collapse text-xs sm:min-w-[7000px]">
              <thead>
                <tr>
                  <th
                    rowSpan={2}
                    className="sticky left-0 z-40 border-b border-slate-100 bg-white/96 px-4 py-3 text-center font-semibold text-slate-500 backdrop-blur-xl"
                    style={{ width: STICKY_COLUMN_WIDTH, minWidth: STICKY_COLUMN_WIDTH, boxShadow: '12px 0 24px -18px rgba(15, 23, 42, 0.10)' }}
                  >
                    <span className="flex items-center justify-center">设备</span>
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
                          'border-b border-slate-100 px-3 py-2 text-left text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400',
                          containsToday && 'bg-sky-50/65 text-sky-700'
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
                            ? 'bg-rose-50/70 text-rose-500'
                            : weekend
                              ? 'bg-slate-50/70 text-slate-600'
                              : 'text-slate-400',
                          todayColumn && 'z-10 bg-sky-50/70'
                        )}
                        style={{ width: DAY_COLUMN_WIDTH }}
                      >
                        {todayColumn ? <span className="pointer-events-none absolute inset-y-0 left-0 w-px bg-sky-300/80" /> : null}
                        <div
                          className={cn(
                            'mx-auto flex w-fit items-center gap-1 rounded-md px-2 py-1',
                            todayColumn && 'bg-white/88 font-semibold text-sky-700 ring-1 ring-sky-100'
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
                  const equipmentStatusDotTone = getEquipmentStatusDotTone(item.orders, item.status);
                  const EquipmentStatusIcon = equipmentStatus.icon;

                  return (
                    <tr key={item.id}>
                      <td
                        className="sticky left-0 z-30 border-b border-slate-100 bg-white/94 px-2 py-2.5 font-medium text-slate-800 backdrop-blur-xl"
                        style={{ width: STICKY_COLUMN_WIDTH, minWidth: STICKY_COLUMN_WIDTH, boxShadow: '10px 0 20px -18px rgba(15, 23, 42, 0.08)' }}
                      >
                        <div className="flex items-center gap-1.5">
                          <p className="min-w-0 truncate text-[12px] font-semibold tracking-[-0.01em] text-slate-600">{item.name}</p>
                          <span
                            className={cn('inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full shadow-[0_1px_2px_rgba(15,23,42,0.08)]', equipmentStatusDotTone)}
                          >
                            <EquipmentStatusIcon className="h-2.5 w-2.5" />
                          </span>
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
                              {todayColumn ? <span className="pointer-events-none absolute inset-y-0 left-0 z-0 w-px bg-sky-300/80" /> : null}
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
                            {todayColumn ? <span className="pointer-events-none absolute inset-y-0 left-0 z-0 w-px bg-sky-300/80" /> : null}
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
                                    'flex h-full items-center justify-between gap-2 overflow-hidden rounded-xl px-2.5 py-1.5 shadow-[0_10px_24px_rgba(255,255,255,0.22)] transition-all duration-150',
                                    pill.bar,
                                    isHovered && 'ring-2 ring-white/65'
                                  )}
                                >
                                  <div className="min-w-0">
                                    <p className="truncate text-[11px] font-semibold leading-4">{order.customer_name ?? '订单'}</p>
                                    <p className="truncate text-[10px] text-slate-700/70">{pill.label}</p>
                                  </div>
                                  {clampedSpan >= 2 ? <span className="shrink-0 rounded-full bg-white/45 px-2 py-0.5 text-[10px] font-medium text-slate-700">{rawSpan} 天</span> : null}
                                </div>
                              </button>

                              {isHovered ? (
                                <div
                                  className={cn(
                                    'absolute z-30 w-56 rounded-[22px] border border-white/75 bg-white/92 p-4 text-left text-slate-700 shadow-[0_18px_44px_rgba(15,23,42,0.08)] backdrop-blur-xl sm:w-64',
                                    tooltipPlacement.horizontal === 'right' ? 'right-0' : 'left-0',
                                    tooltipPlacement.vertical === 'top' ? 'bottom-full mb-2' : 'top-full mt-2'
                                  )}
                                >
                                  <div className="flex items-center justify-between gap-3">
                                    <p className="text-sm font-semibold text-slate-900">{order.customer_name ?? '未命名客户'}</p>
                                    <span className={cn('rounded-full px-2.5 py-1 text-[10px] font-semibold', pill.accent)}>{pill.label}</span>
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
              <p className={cn('text-sm', actionError ? 'text-rose-500' : 'text-emerald-600')}>
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
              <StatBadge tone="slate">订单号：{selectedOrder.order.id}</StatBadge>
              {selectedOrder.category ? <StatBadge tone="slate">分类：{selectedOrder.category}</StatBadge> : null}
            </div>

            {nextStatusAction?.requireTracking ? (
              <div className="space-y-3 rounded-[24px] border border-sky-200/70 bg-sky-50/72 p-4">
                <div className="flex items-center gap-2 text-sky-700">
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
                <label className="flex items-start gap-3 rounded-[20px] border border-amber-200/75 bg-white/80 px-3 py-3 text-sm text-amber-800 backdrop-blur-sm">
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
              <InfoTile className="p-5">
                <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400">物流信息</p>
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
              </InfoTile>

              <InfoTile className="p-5">
                <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400">费用信息</p>
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
              </InfoTile>
            </div>
          </div>
        ) : null}
      </Modal>
    </>
  );
}
