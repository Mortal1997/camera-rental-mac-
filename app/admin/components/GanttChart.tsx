'use client';

import {
  AlertTriangle,
  CalendarRange,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clipboard,
  Clock,
  Edit2,
  Loader2,
  MapPin,
  Package2,
  Phone,
  RotateCcw,
  Send,
  Truck,
  UserRound,
  X,
  Wrench,
} from 'lucide-react';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { type DateRange } from 'react-day-picker';
import { updateOrderFields, updateOrderStatus } from '../../actions/admin-actions';
import type { Equipment, EquipmentWithOrders, Order, Order as OrderType } from '../../actions/types';
import { EmptyState, FilterPanel, InfoTile, Modal, PrimaryButton, SecondaryButton, SelectInput, SectionHeader, StatBadge, SurfaceCard, TextInput, cn } from './ui';
import { Button } from '@/components/ui/button';
import { DateRangePicker } from '@/components/ui/date-range-picker';

interface GanttChartProps {
  equipment: EquipmentWithOrders[];
  equipmentList: Equipment[];
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

const MIN_STICKY_COLUMN_WIDTH = 120;
const MAX_STICKY_COLUMN_WIDTH = 320;
const DEFAULT_STICKY_COLUMN_WIDTH = 180;
const DAY_COLUMN_WIDTH = 70;
const PAST_DAYS = 30;
const FUTURE_DAYS = 60;
const SCROLL_STEP_DAYS = 7;

function getStatusPill(status: string) {
  if (status === 'pending_payment' || status === 'confirmed') {
    return {
      label: '待发货',
      bar: 'bg-indigo-100 text-indigo-700',
      tone: 'blue' as const,
      accent: 'bg-indigo-50 text-indigo-700',
    };
  }
  if (status === 'using') {
    return {
      label: '租用中',
      bar: 'bg-amber-100 text-amber-700',
      tone: 'amber' as const,
      accent: 'bg-amber-50 text-amber-700',
    };
  }
  if (status === 'returned') {
    return {
      label: '已完成',
      bar: 'bg-emerald-100 text-emerald-700',
      tone: 'emerald' as const,
      accent: 'bg-emerald-50 text-emerald-700',
    };
  }
  return {
    label: status,
    bar: 'bg-slate-100 text-slate-700',
    tone: 'slate' as const,
    accent: 'bg-slate-100 text-slate-600',
  };
}

function getEquipmentStatusBadge(status: EquipmentWithOrders['status']) {
  if (status === 'available') return { label: '闲置', icon: CheckCircle2, tone: 'bg-green-500 text-white' };
  if (status === 'rented') return { label: '租用中', icon: Package2, tone: 'bg-orange-500 text-white' };
  if (status === 'pending') return { label: '待发货', icon: Clock, tone: 'bg-blue-500 text-white' };
  return { label: '维护中', icon: Wrench, tone: 'bg-slate-500 text-white' };
}

function getOrderStatusKey(status: Order['status']) {
  if (status === 'confirmed' || status === 'pending_payment') return 'pending';
  if (status === 'using') return 'renting';
  if (status === 'returned' || status === 'cancelled') return 'idle';
  return 'pending';
}

function getEffectiveEquipmentStatus(item: EquipmentWithOrders) {
  const statuses = item.orders.map((order) => getOrderStatusKey(order.status));
  if (statuses.some((value) => value === 'renting')) return 'rented';
  if (statuses.some((value) => value === 'pending')) return 'pending';
  return item.status;
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
  if (todayColumn) return 'bg-indigo-50/80';
  if (holiday) return 'bg-rose-50/60';
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
    return { label: '标记发货', nextStatus: 'using', icon: Send, tone: 'primary' as const, requireTracking: true };
  }
  if (order.status === 'using') {
    return { label: '标记归还', nextStatus: 'returned', icon: CheckCircle2, tone: 'secondary' as const, requireTracking: false };
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

function buildCustomerInfo(selectedOrder: SelectedOrderState) {
  const lines = [
    selectedOrder.order.customer_name,
    selectedOrder.order.customer_phone,
    selectedOrder.order.shipping_address,
  ];
  return lines.filter(Boolean).join('\n');
}

function InfoCard({ icon: Icon, label, value }: { icon: typeof CalendarRange; label: string; value: string }) {
  return (
    <InfoTile className="p-4">
      <div className="flex items-center gap-2 text-slate-500">
        <Icon className="h-4 w-4 text-indigo-600" />
        <span className="text-[11px] font-medium uppercase tracking-[0.14em]">{label}</span>
      </div>
      <p className="mt-3 text-sm font-medium text-slate-900">{value}</p>
    </InfoTile>
  );
}

export default function GanttChart({ equipment, equipmentList }: GanttChartProps) {
  const today = useMemo(() => getStartOfDay(new Date()), []);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [hoveredOrderId, setHoveredOrderId] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<SelectedOrderState | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editDateRange, setEditDateRange] = useState<DateRange | undefined>();
  const [editForm, setEditForm] = useState({ customer_name: '', customer_phone: '', shipping_address: '', start_date: '', end_date: '', equipment_id: '', notes: '' });
  const [sfLoading, setSfLoading] = useState(false);
  const [sfError, setSfError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [actionError, setActionError] = useState<string | null>(null);
  const [copyMessage, setCopyMessage] = useState<string | null>(null);
  const [trackingNumberInput, setTrackingNumberInput] = useState('');
  const [confirmShip, setConfirmShip] = useState(false);
  const [isPending, startTransition] = useTransition();
  const dragStateRef = useRef({ isDown: false, startX: 0, scrollLeft: 0 });
  const [resizableWidth, setResizableWidth] = useState(DEFAULT_STICKY_COLUMN_WIDTH);
  const effectiveResizableWidth = Math.max(MIN_STICKY_COLUMN_WIDTH, Math.min(MAX_STICKY_COLUMN_WIDTH, resizableWidth));

  const days = useMemo(() => Array.from({ length: PAST_DAYS + FUTURE_DAYS }, (_, index) => {
    const date = new Date(today);
    date.setDate(date.getDate() + index - PAST_DAYS);
    return date;
  }), [today]);

  const monthGroups = useMemo(() => {
    const groups: Array<{ label: string; startIndex: number; span: number }> = [];
    days.forEach((date, index) => {
      const label = formatMonthLabel(date);
      const last = groups[groups.length - 1];
      if (!last || last.label !== label) groups.push({ label, startIndex: index, span: 1 });
      else last.span += 1;
    });
    return groups;
  }, [days]);

  const categories = useMemo(() => Array.from(new Set(equipment.map((item) => item.category).filter(Boolean))) as string[], [equipment]);

  const filteredEquipment = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return equipment.filter((item) => {
      const matchesSearch = !term || item.name.toLowerCase().includes(term) || (item.serial_number ?? '').toLowerCase().includes(term) || item.orders.some((order) => (order.customer_name ?? '').toLowerCase().includes(term));
      const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter;
      const matchesStatus = matchesStatusFilter(item.orders, statusFilter);
      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [equipment, searchTerm, categoryFilter, statusFilter]);

  const totalOrders = useMemo(() => filteredEquipment.reduce((sum, item) => sum + item.orders.length, 0), [filteredEquipment]);
  const currentStatus = selectedOrder ? getStatusPill(selectedOrder.order.status) : null;
  const nextStatusAction = selectedOrder ? getNextStatusAction(selectedOrder.order) : null;

  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollLeft = PAST_DAYS * DAY_COLUMN_WIDTH - effectiveResizableWidth * 0.2;
  }, []);

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

  const scrollToDayIndex = (index: number) => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTo({ left: index * DAY_COLUMN_WIDTH, behavior: 'smooth' });
  };

  const scrollByDays = (direction: number) => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollBy({ left: direction * SCROLL_STEP_DAYS * DAY_COLUMN_WIDTH, behavior: 'smooth' });
  };

  const startResizing = (event: React.MouseEvent<HTMLTableCellElement>) => {
    event.preventDefault();
    event.stopPropagation();
    dragStateRef.current.isDown = false;
    setIsDragging(false);
    document.addEventListener('mousemove', handleResize);
    document.addEventListener('mouseup', stopResizing, { once: true });
  };

  const handleResize = (event: MouseEvent) => {
    if (!scrollRef.current) return;
    const tableRect = scrollRef.current.getBoundingClientRect();
    const nextWidth = Math.max(MIN_STICKY_COLUMN_WIDTH, Math.min(MAX_STICKY_COLUMN_WIDTH, event.clientX - tableRect.left));
    setResizableWidth(nextWidth);
  };

  const stopResizing = () => {
    document.removeEventListener('mousemove', handleResize);
  };

  const resetFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setCategoryFilter('all');
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
    if (nextStatusAction.requireTracking && !trackingNumberInput.trim()) {
      setActionError('请先填写运单号');
      return;
    }

    startTransition(async () => {
      const result = await updateOrderStatus(
        selectedOrder.order.id,
        nextStatusAction.nextStatus,
        nextStatusAction.requireTracking ? trackingNumberInput.trim() : undefined,
      );

      if (!result.success) {
        setActionError(result.error ?? '状态更新失败');
        return;
      }

      setCopyMessage(nextStatusAction.nextStatus === 'using' ? '已完成发货，设备状态已同步为出租中' : '已完成归还，设备状态已同步为空闲');
      setSelectedOrder((current) => current ? {
        ...current,
        order: {
          ...current.order,
          status: nextStatusAction.nextStatus as OrderType['status'],
          tracking_number: nextStatusAction.requireTracking ? trackingNumberInput : current.order.tracking_number,
        },
      } : null);
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
      const eq = equipmentList.find((e) => e.id === editForm.equipment_id);
      setSelectedOrder((current) => current ? {
        ...current,
        equipmentId: editForm.equipment_id,
        equipmentName: eq?.name ?? current.equipmentName,
        order: {
          ...current.order,
          customer_name: editForm.customer_name || undefined,
          customer_phone: editForm.customer_phone || undefined,
          shipping_address: editForm.shipping_address || undefined,
          start_date: resolvedStart || undefined,
          end_date: resolvedEnd || undefined,
          equipment_id: editForm.equipment_id,
          notes: editForm.notes || undefined,
        },
      } : null);
      setIsEditing(false);
      setCopyMessage('订单信息已更新');
    });
  };

  const handleSfOneClick = async () => {
    if (!selectedOrder) return;
    if (!selectedOrder.order.customer_name || !selectedOrder.order.customer_phone || !selectedOrder.order.shipping_address) {
      setSfError('订单缺少收件人信息，请先补充收件人姓名、电话和收货地址');
      return;
    }
    setSfLoading(true);
    setSfError(null);
    try {
      const res = await fetch('/api/shipping/sf-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: selectedOrder.order.id }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setSfError(data.error ?? '顺丰下单失败，请稍后重试');
        return;
      }
      setTrackingNumberInput(data.tracking_number);
      setConfirmShip(true);
      setCopyMessage(`顺丰下单成功，运单号：${data.tracking_number}`);
    } catch {
      setSfError('网络请求失败，请稍后重试');
    } finally {
      setSfLoading(false);
    }
  };

  return (
    <>
      <SurfaceCard className="overflow-hidden p-0">
        <div className="border-b border-slate-100 px-4 py-4 sm:px-6 sm:py-5">
          <SectionHeader
            title="排期看板"
            description="显示过去 30 天到未来 60 天内所有设备的租赁安排。"
            meta={<span>{filteredEquipment.length} / {equipment.length} 台设备</span>}
          />

          <FilterPanel className="xl:grid-cols-[minmax(0,1.3fr)_auto] xl:items-end">
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--text-muted)]">搜索</p>
                <TextInput value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="设备名 / 序列号 / 客户名" />
              </div>
              <div>
                <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--text-muted)]">订单状态</p>
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
                <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--text-muted)]">设备分类</p>
                <SelectInput value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
                  <option value="all">全部分类</option>
                  {categories.map((category) => <option key={category} value={category}>{category}</option>)}
                </SelectInput>
              </div>
            </div>

            <div className="flex flex-col gap-3 xl:items-end">
              <div className="flex flex-wrap items-center gap-2">
                <SecondaryButton onClick={() => scrollByDays(-1)}><ChevronLeft className="h-4 w-4" />上周</SecondaryButton>
                <PrimaryButton onClick={() => scrollToDayIndex(PAST_DAYS)}>跳转今天</PrimaryButton>
                <SecondaryButton onClick={() => scrollByDays(1)}>下周<ChevronRight className="h-4 w-4" /></SecondaryButton>
                <SecondaryButton onClick={resetFilters}><RotateCcw className="h-4 w-4" />重置筛选</SecondaryButton>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--text-muted)]">
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
          className={cn('overflow-x-auto overflow-y-visible p-4 select-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden', isDragging ? 'cursor-grabbing' : 'cursor-grab')}
        >
          {filteredEquipment.length === 0 ? (
            <EmptyState>当前筛选条件下暂无排期数据</EmptyState>
          ) : (
            <table className="w-full min-w-[5200px] table-fixed border-collapse text-xs sm:min-w-[7000px]">
              <thead>
                <tr>
                  <th
                    rowSpan={2}
                    className="sticky left-0 z-40 relative border-b border-r border-slate-200 bg-slate-50 px-4 py-3 text-center font-semibold text-slate-500 shadow-[6px_0_16px_-6px_rgba(0,0,0,0.10)]"
                    style={{ width: effectiveResizableWidth, minWidth: MIN_STICKY_COLUMN_WIDTH, maxWidth: MAX_STICKY_COLUMN_WIDTH }}
                  >
                    <span className="flex items-center justify-center">设备</span>
                    <div className="absolute inset-y-0 right-0 w-2 cursor-col-resize" onMouseDown={startResizing} />
                  </th>
                  {monthGroups.map((group) => {
                    const containsToday = days.slice(group.startIndex, group.startIndex + group.span).some((date) => isSameDay(date, today));
                    return (
                      <th
                        key={`${group.label}-${group.startIndex}`}
                        colSpan={group.span}
                        className={cn('border-b border-slate-100 bg-white px-3 py-2 text-left text-[11px] font-medium uppercase tracking-[0.14em] text-slate-500', containsToday && 'bg-indigo-50 text-indigo-600')}
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
                          'relative border-b border-slate-100 bg-white px-1 py-3 text-center font-medium',
                          holiday ? 'bg-rose-50/80 text-rose-600' : weekend ? 'bg-slate-50 text-slate-500' : 'text-slate-500',
                          todayColumn && 'z-10 bg-indigo-50'
                        )}
                        style={{ width: DAY_COLUMN_WIDTH }}
                      >
                        {todayColumn ? <span className="pointer-events-none absolute inset-y-0 left-0 w-px bg-indigo-300" /> : null}
                        <div className={cn('mx-auto flex w-fit items-center gap-1 rounded-md px-2 py-1', todayColumn && 'bg-white font-semibold text-indigo-600 ring-1 ring-indigo-100')}>
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
                  const effectiveStatus = getEffectiveEquipmentStatus(item);
                  const equipmentStatus = getEquipmentStatusBadge(effectiveStatus);
                  const EquipmentStatusIcon = equipmentStatus.icon;

                  if (rowIndex < 5) {
                    // eslint-disable-next-line no-console
                    console.debug('[gantt-equipment-status]', {
                      index: rowIndex,
                      id: item.id,
                      name: item.name,
                      baseStatus: item.status,
                      orders: item.orders.map((order) => ({ id: order.id, status: order.status })),
                      effectiveStatus,
                      tone: equipmentStatus.tone,
                    });
                  }

                  return (
                    <tr key={item.id}>
                      <td
                        className="sticky left-0 z-30 border-b border-r border-slate-100 bg-slate-50 pl-3 pr-2 py-2.5 shadow-[6px_0_16px_-6px_rgba(0,0,0,0.10)]"
                        style={{ width: effectiveResizableWidth, minWidth: MIN_STICKY_COLUMN_WIDTH, maxWidth: MAX_STICKY_COLUMN_WIDTH }}
                      >
                        <div className="flex min-w-0 items-center gap-2">
                          <div className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium text-gray-900">{item.name}</span>
                            <span className="block truncate text-[11px] text-gray-400">{item.serial_number || '—'}</span>
                          </div>
                          <span className={cn('inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full shadow-sm', equipmentStatus.tone)}>
                            <EquipmentStatusIcon className="h-3.5 w-3.5" />
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
                            <td key={`${item.id}-${dateKey}`} className={cn('relative h-16 border-b border-slate-100', getColumnTone({ holiday, weekend, todayColumn }))} style={{ width: DAY_COLUMN_WIDTH }}>
                              {todayColumn ? <span className="pointer-events-none absolute inset-y-0 left-0 z-0 w-px bg-indigo-300" /> : null}
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
                          <td key={`${item.id}-${dateKey}`} className={cn('relative h-16 border-b border-slate-100 p-0', getColumnTone({ holiday, weekend, todayColumn }))} style={{ width: DAY_COLUMN_WIDTH }}>
                            {todayColumn ? <span className="pointer-events-none absolute inset-y-0 left-0 z-0 w-px bg-indigo-300" /> : null}
                            <div
                              className={cn('absolute inset-y-2 left-0 z-20 overflow-visible transition-all duration-150', isHovered && 'z-40 scale-[1.01]')}
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
                                  setSelectedOrder({ order, equipmentId: item.id, equipmentName: item.name, category: item.category });
                                }}
                                className="block h-full w-full text-left outline-none"
                              >
                                <div className={cn('flex h-full items-center justify-between gap-2 overflow-hidden rounded-xl px-2.5 py-1.5 shadow-sm transition-all duration-150', pill.bar, isHovered && 'ring-2 ring-indigo-100')}>
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-1">
                                      <p className="truncate text-[11px] font-semibold leading-4">{order.customer_name ?? '订单'}</p>
                                      {order.notes ? <span className="shrink-0 text-[10px]">📝</span> : null}
                                    </div>
                                    <p className="truncate text-[10px] text-slate-500">{pill.label}</p>
                                  </div>
                                  {clampedSpan >= 2 ? <span className="shrink-0 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-medium text-slate-500">{rawSpan} 天</span> : null}
                                </div>
                              </button>

                              {isHovered ? (
                                <div className={cn('absolute z-30 w-56 rounded-2xl bg-white p-4 text-left shadow-lg sm:w-64', tooltipPlacement.horizontal === 'right' ? 'right-0' : 'left-0', tooltipPlacement.vertical === 'top' ? 'bottom-full mb-2' : 'top-full mt-2')}>
                                  <div className="flex items-center justify-between gap-3">
                                    <p className="text-sm font-semibold text-slate-900">{order.customer_name ?? '未命名客户'}</p>
                                    <span className={cn('rounded-full px-2.5 py-1 text-[10px] font-semibold', pill.accent)}>{pill.label}</span>
                                  </div>
                                  <div className="mt-3 space-y-2 text-xs text-slate-700">
                                    <div className="flex items-start justify-between gap-3"><span className="text-slate-400">设备</span><span className="text-right font-medium">{item.name}</span></div>
                                    <div className="flex items-start justify-between gap-3"><span className="text-slate-400">时间</span><span className="text-right font-medium">{order.start_date} ~ {order.end_date}</span></div>
                                    <div className="flex items-start justify-between gap-3"><span className="text-slate-400">电话</span><span className="font-medium">{order.customer_phone || '—'}</span></div>
                                    {order.notes ? <div className="rounded-lg bg-amber-50 px-2.5 py-2 text-amber-700"><span className="font-medium">📝 </span>{order.notes}</div> : null}
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
          setIsEditing(false);
          setEditForm({ customer_name: '', customer_phone: '', shipping_address: '', start_date: '', end_date: '', equipment_id: '', notes: '' });
          setEditDateRange(undefined);
          setActionError(null);
          setCopyMessage(null);
          setTrackingNumberInput('');
          setConfirmShip(false);
          setSfError(null);
        }}
        eyebrow="Order Detail"
        icon={Package2}
        title={selectedOrder?.order.customer_name || '订单详情'}
        maxWidthClassName="max-w-3xl"
        footer={
          <div className="space-y-3">
            {(actionError || copyMessage || sfError) ? (
              <p className={cn('text-sm', actionError || sfError ? 'text-rose-600' : 'text-foreground')}>
                {actionError || sfError || copyMessage}
              </p>
            ) : null}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:flex-wrap sm:justify-end sm:gap-3">
              {!isEditing ? (
                <>
                  <SecondaryButton onClick={openEditMode}>
                    <Edit2 className="h-4 w-4" />编辑订单
                  </SecondaryButton>
                  {selectedOrder ? <SecondaryButton onClick={() => handleCopy(buildCustomerInfo(selectedOrder), '已复制客户信息')} disabled={!selectedOrder.order.customer_name && !selectedOrder.order.customer_phone && !selectedOrder.order.shipping_address}><Clipboard className="h-4 w-4" />复制客户信息</SecondaryButton> : null}
                  {nextStatusAction ? nextStatusAction.tone === 'primary' ? (
                    <PrimaryButton onClick={handleStatusAction} disabled={isPending || (nextStatusAction.requireTracking && !confirmShip)}>
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
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-3">
              {currentStatus ? <StatBadge tone={currentStatus.tone}>{currentStatus.label}</StatBadge> : null}
              <StatBadge tone="slate">订单号：{selectedOrder.order.id}</StatBadge>
              {selectedOrder.category ? <StatBadge tone="slate">分类：{selectedOrder.category}</StatBadge> : null}
            </div>

            {nextStatusAction?.requireTracking && !isEditing ? (
              <div className="space-y-3 rounded-2xl bg-amber-50 p-4">
                <div className="flex items-center gap-2 text-amber-700">
                  <Truck className="h-4 w-4" />
                  <p className="text-sm font-semibold">发货前请录入运单号</p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
                  <div className="flex-1">
                    <TextInput
                      value={trackingNumberInput}
                      onChange={(e) => { setTrackingNumberInput(e.target.value); if (confirmShip) setConfirmShip(false); }}
                      placeholder="请输入顺丰 / 京东 / 菜鸟等运单号"
                    />
                  </div>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={handleSfOneClick}
                    disabled={sfLoading}
                    className="shrink-0 gap-1.5 rounded-2xl bg-indigo-600 px-4 py-3 text-[13px] font-medium text-white shadow-sm transition-all hover:bg-indigo-500 active:scale-[0.98] disabled:opacity-60"
                  >
                    {sfLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    顺丰一键下单
                  </Button>
                </div>
                <label className="flex items-start gap-3 rounded-2xl bg-white px-3 py-3 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={confirmShip}
                    onChange={(e) => setConfirmShip(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="flex items-start gap-2">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    我已确认客户信息、收货地址和运单号无误，立即执行发货。
                  </span>
                </label>
              </div>
            ) : null}

            {isEditing ? (
              <div className="space-y-4 rounded-2xl border border-indigo-200 bg-indigo-50/50 p-5">
                <p className="flex items-center gap-2 text-sm font-semibold text-indigo-700">
                  <Edit2 className="h-4 w-4" />编辑订单信息
                </p>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <label className="text-[12px] font-medium text-slate-500">设备</label>
                    <SelectInput
                      value={editForm.equipment_id}
                      onChange={(e) => setEditForm((f) => ({ ...f, equipment_id: e.target.value }))}
                    >
                      {equipmentList.map((eq) => (
                        <option key={eq.id} value={eq.id}>{eq.name}{eq.serial_number ? ` · ${eq.serial_number}` : ''}</option>
                      ))}
                    </SelectInput>
                  </div>
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
                <InfoTile className="p-4">
                  <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400">订单信息</p>
                  <div className="mt-3 grid gap-3 text-sm text-slate-700 sm:grid-cols-2">
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
                    <div className="flex items-start justify-between gap-3">
                      <span className="text-slate-400">订单金额</span>
                      <span className="text-right font-medium">¥{Number(selectedOrder.order.total_price || 0).toFixed(2)}</span>
                    </div>
                  </div>
                </InfoTile>

                <div className="grid gap-4 md:grid-cols-2">
                  <InfoTile className="p-4">
                    <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400">物流信息</p>
                    <div className="mt-3 space-y-3 text-sm text-slate-700">
                      <div className="flex items-center justify-between gap-3"><span className="text-slate-400">运单号</span><span className="font-medium">{selectedOrder.order.tracking_number || '暂未录入'}</span></div>
                      <div className="flex items-center justify-between gap-3"><span className="text-slate-400">免押方式</span><span className="font-medium">{selectedOrder.order.deposit_exemption || '—'}</span></div>
                    </div>
                  </InfoTile>

                  <InfoTile className="p-4">
                    <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400">费用信息</p>
                    <div className="mt-3 space-y-3 text-sm text-slate-700">
                      <div className="flex items-center justify-between gap-3"><span className="text-slate-400">订单金额</span><span className="font-medium">¥{Number(selectedOrder.order.total_price || 0).toFixed(2)}</span></div>
                      <div className="flex items-center justify-between gap-3"><span className="text-slate-400">已付押金</span><span className="font-medium">¥{Number(selectedOrder.order.deposit_paid || 0).toFixed(2)}</span></div>
                    </div>
                  </InfoTile>
                </div>

                {selectedOrder.order.notes ? (
                  <InfoTile className="p-4">
                    <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400">订单备注</p>
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{selectedOrder.order.notes}</p>
                  </InfoTile>
                ) : (
                  <InfoTile className="p-4">
                    <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400">订单备注</p>
                    <p className="mt-3 text-sm text-muted-foreground">暂无备注</p>
                  </InfoTile>
                )}
              </>
            )}
          </div>
        ) : null}
      </Modal>
    </>
  );
}
