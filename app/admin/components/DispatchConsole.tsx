'use client';

import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import * as React from 'react';
import { useEffect, useMemo, useState, useTransition } from 'react';
import { type DateRange } from 'react-day-picker';
import {
  CalendarRange,
  PackageCheck,
  RotateCcw,
  SendHorizonal,
  Smartphone,
  Trash2,
  Truck,
} from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { deleteOrder, processExternalOrder } from '../../actions/admin-actions';
import type { Equipment, Order } from '../../actions/types';
import RefreshRemoteOrders from './RefreshRemoteOrders';
import SyncOrdersButton from './SyncOrdersButton';
import {
  Drawer,
  EmptyState,
  FilterPanel,
  FormField,
  InfoTile,
  PrimaryButton,
  SecondaryButton,
  SectionHeader,
  SelectInput,
  StatBadge,
  SurfaceCard,
  TextInput,
  cn,
} from './ui';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DateRangePicker } from '@/components/ui/date-range-picker';

interface DispatchConsoleProps {
  orders: Order[];
  equipmentList: Equipment[];
  highlightedExternalOrderIds?: string[];
  userId?: string;
  rawRealtimeStatus?: string | null;
}

const depositOptions = ['芝麻信用', '押金双免', '支付押金', '熟人免押'];
const shippingMethodOptions = ['邮寄', '自提', '闪送'];

type DraftFormState = {
  equipment_id: string;
  shipping_address: string;
  start_date: string;
  end_date: string;
  deposit_exemption: string;
  shipping_method: string;
};

interface DispatchDrawerContentProps {
  order: Order;
  formValues: Omit<DraftFormState, 'start_date' | 'end_date'>;
  dateRange: DateRange | undefined;
  onDateRangeChange: (range: DateRange | undefined) => void;
  availableEquipment: Equipment[];
  updateFormValue: <K extends keyof DraftFormState>(key: K, value: DraftFormState[K]) => void;
  equipmentLabelMap: Map<string, string>;
}

interface DispatchOrderCardProps {
  order: Order;
  assignedEquipmentLabel?: string | null;
  isHighlighted: boolean;
  isPending: boolean;
  onOpen: (order: Order) => void;
  onDelete: (orderId: string) => void;
}

function buildInitialFormState(equipmentList: Equipment[], order?: Order | null): DraftFormState {
  return {
    equipment_id: order?.equipment_id || equipmentList[0]?.id || '',
    shipping_address: order?.shipping_address || '',
    start_date: order?.start_date || '',
    end_date: order?.end_date || '',
    deposit_exemption: order?.deposit_exemption || depositOptions[0],
    shipping_method: order?.shipping_method || shippingMethodOptions[0],
  };
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

function OrderDataField({ label, value, title, className }: { label: string; value: string; title?: string; className?: string }) {
  return (
    <InfoTile className={className}>
      <p className="text-xs font-medium uppercase tracking-[0.14em] text-gray-400">{label}</p>
      <p className="mt-1.5 text-sm text-gray-600" title={title ?? value}>{value}</p>
    </InfoTile>
  );
}

function DispatchDrawerContent({
  order,
  formValues,
  dateRange,
  onDateRangeChange,
  availableEquipment,
  updateFormValue,
  equipmentLabelMap,
}: DispatchDrawerContentProps) {
  const rangeDisplay = React.useMemo(() => {
    if (!dateRange?.from && !dateRange?.to) return '待确认租期';
    if (dateRange.from && dateRange.to) {
      return `${format(dateRange.from, 'yyyy-MM-dd')} ~ ${format(dateRange.to, 'yyyy-MM-dd')}`;
    }
    if (dateRange.from) return `${format(dateRange.from, 'yyyy-MM-dd')} 起`;
    return '待确认租期';
  }, [dateRange]);

  return (
    <div className="space-y-5">
      <InfoTile className="rounded-[24px] bg-muted/55 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <StatBadge tone="slate">{order.platform_source || '手动录单'}</StatBadge>
          <StatBadge tone="amber">待接单核对</StatBadge>
        </div>
        <div className="mt-4 grid gap-3 text-sm text-muted-foreground sm:grid-cols-2 xl:grid-cols-3">
          <OrderDataField label="外部单号" value={order.external_order_id || '未提供'} />
          <OrderDataField label="客户姓名" value={order.customer_name || '—'} />
          <OrderDataField label="联系电话" value={order.customer_phone || '—'} />
          <OrderDataField label="期望设备型号" value={order.expected_equipment_model || '待分配'} />
          <OrderDataField label="订单总金额" value={formatCurrency(order.total_price)} />
          <OrderDataField label="已收押金" value={formatCurrency(order.deposit_paid)} />
        </div>
      </InfoTile>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <FormField label="分配具体设备" className="md:col-span-2">
          <SelectInput
            value={formValues.equipment_id}
            onChange={(e) => updateFormValue('equipment_id', e.target.value)}
          >
            {availableEquipment.map((equipment) => (
              <option key={equipment.id} value={equipment.id}>
                {equipment.name}
                {equipment.serial_number ? ` · ${equipment.serial_number}` : ''}
              </option>
            ))}
          </SelectInput>
          {order.expected_equipment_model ? (
            <p className="mt-1.5 text-xs text-muted-foreground">
              平台期望：{order.expected_equipment_model}，请从上方选择实际分配的设备
            </p>
          ) : null}
        </FormField>

        <FormField label="收货地址" className="md:col-span-2">
          <TextInput value={formValues.shipping_address} onChange={(e) => updateFormValue('shipping_address', e.target.value)} placeholder="请输入完整收货地址" />
        </FormField>

        <FormField label="租赁期限" className="md:col-span-2">
          <DateRangePicker
            date={dateRange}
            onDateChange={onDateRangeChange}
            placeholder="请选择租赁期限..."
          />
        </FormField>

        <FormField label="免押方式">
          <SelectInput value={formValues.deposit_exemption} onChange={(e) => updateFormValue('deposit_exemption', e.target.value)}>
            {depositOptions.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </SelectInput>
        </FormField>
        <FormField label="发货方式">
          <SelectInput value={formValues.shipping_method} onChange={(e) => updateFormValue('shipping_method', e.target.value)}>
            {shippingMethodOptions.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </SelectInput>
        </FormField>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <InfoTile className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <CalendarRange className="h-4 w-4 text-emerald-600" />
            <p className="text-[11px] font-medium uppercase tracking-[0.14em]">当前租期预览</p>
          </div>
          <p className="mt-3 text-sm font-medium text-foreground">{rangeDisplay}</p>
        </InfoTile>
        <InfoTile className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Truck className="h-4 w-4 text-emerald-600" />
            <p className="text-[11px] font-medium uppercase tracking-[0.14em]">调度结果预览</p>
          </div>
          <p className="mt-3 text-sm font-medium text-foreground">{equipmentLabelMap.get(formValues.equipment_id) || '待分配设备'}</p>
          <p className="mt-1 text-xs text-slate-400">{formValues.shipping_method || '待确认'} / {formValues.deposit_exemption || '待确认'}</p>
        </InfoTile>
      </div>
    </div>
  );
}

function DispatchOrderCard({
  order,
  assignedEquipmentLabel,
  isHighlighted,
  isPending,
  onOpen,
  onDelete,
}: DispatchOrderCardProps) {
  return (
    <article
      className={cn(
        'flex h-full flex-col rounded-2xl border border-gray-200/80 bg-white p-6 shadow-sm transition-all duration-200 hover:scale-[0.98] hover:shadow-md active:scale-[0.97]',
        isHighlighted && 'border-indigo-300 ring-2 ring-indigo-200/70'
      )}
    >
      <button
        type="button"
        onClick={() => onOpen(order)}
        className="min-w-0 flex-1 text-left"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <StatBadge tone="slate">{order.platform_source || '手动录单'}</StatBadge>
              <StatBadge tone="amber">待调度</StatBadge>
            </div>
            <h3 className="mt-3 truncate text-base font-semibold text-slate-800">{order.customer_name || '未命名客户'}</h3>
            <div className="mt-2 flex items-center gap-2 text-sm text-gray-500">
              <Smartphone className="h-3.5 w-3.5 text-gray-400" />
              <span className="truncate">{order.customer_phone || '未提供联系电话'}</span>
            </div>
          </div>

          <div className="shrink-0 text-right">
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-gray-400">订单金额</p>
            <p className="mt-1 text-base font-semibold text-indigo-600">{formatCurrency(order.total_price)}</p>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-4">
          <OrderDataField label="租期" value={formatDateRange(order.start_date, order.end_date)} />
          <OrderDataField
            label="设备"
            value={
              order.equipment?.name
                ? `${order.equipment.name}${order.equipment.serial_number ? ` · ${order.equipment.serial_number}` : ''}`
                : assignedEquipmentLabel || order.expected_equipment_model || '待分配'
            }
          />
        </div>

        <div className="mt-4 rounded-xl bg-gray-50 px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-gray-400">收货地址</p>
          <p className="mt-1.5 line-clamp-2 text-sm text-gray-500" title={order.shipping_address || '待补充收货地址'}>
            {order.shipping_address || '待补充收货地址'}
          </p>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-gray-400">
          <span>发货：{order.shipping_method || '待确认'}</span>
          <span>免押：{order.deposit_exemption || '待确认'}</span>
        </div>

        <p className="mt-3 truncate text-xs font-medium text-gray-400">{order.external_order_id || `内部单号 ${order.id}`}</p>
      </button>

      <div className="mt-6 space-y-3">
        <PrimaryButton className="w-full justify-center" onClick={() => onOpen(order)} disabled={isPending}>
          <PackageCheck className="h-4 w-4" />编辑并接单
        </PrimaryButton>
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => onDelete(order.id)}
            disabled={isPending}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-rose-400 transition-all duration-200 hover:text-rose-500 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Trash2 className="h-3.5 w-3.5" />删除
          </button>
        </div>
      </div>
    </article>
  );
}

export default function DispatchConsole({ orders, equipmentList, highlightedExternalOrderIds = [], userId, rawRealtimeStatus }: DispatchConsoleProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [formValues, setFormValues] = useState<DraftFormState>(() => buildInitialFormState(equipmentList));
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [searchTerm, setSearchTerm] = useState('');
  const [platformFilter, setPlatformFilter] = useState('all');
  const [activeHighlights, setActiveHighlights] = useState<string[]>(() => highlightedExternalOrderIds);
  const [deleteDialogOrderId, setDeleteDialogOrderId] = useState<string | null>(null);

  const availableEquipment = useMemo(() => equipmentList, [equipmentList]);

  const equipmentLabelMap = useMemo(
    () =>
      new Map(
        equipmentList.map((eq) => [
          eq.id,
          eq.serial_number ? `${eq.name} · ${eq.serial_number}` : eq.name,
        ])
      ),
    [equipmentList]
  );

  const sourcePlatforms = useMemo(() => {
    const sources = new Set(orders.map((o) => o.platform_source).filter(Boolean));
    return Array.from(sources) as string[];
  }, [orders]);

  const filteredOrders = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return orders.filter((order) => {
      const matchesSearch =
        !term ||
        (order.customer_name ?? '').toLowerCase().includes(term) ||
        (order.customer_phone ?? '').toLowerCase().includes(term) ||
        (order.platform_source ?? '').toLowerCase().includes(term) ||
        (order.expected_equipment_model ?? '').toLowerCase().includes(term) ||
        (order.external_order_id ?? '').toLowerCase().includes(term) ||
        order.id.toLowerCase().includes(term);

      const matchesPlatform = platformFilter === 'all' || order.platform_source === platformFilter;

      return matchesSearch && matchesPlatform;
    });
  }, [orders, searchTerm, platformFilter]);

  const [mounted, setMounted] = useState(false);
  const [refreshStatus, setRefreshStatus] = useState<'idle' | 'connecting' | 'live' | 'error'>('idle');
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(null);
  useEffect(() => {
    setMounted(true);
  }, []);

  const handleRefreshed = React.useCallback(() => {
    setLastRefreshedAt(new Date());
  }, []);

  const formatRefreshTime = (value: Date | null) => {
    if (!value) return '尚未刷新';
    return value.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const refreshStatusLabel = React.useMemo(() => {
    const base =
      refreshStatus === 'connecting'
        ? '自动同步连接中...'
        : refreshStatus === 'live'
          ? '自动同步已就绪'
          : refreshStatus === 'error'
            ? '自动同步连接断开，将按30秒间隔重试'
            : '自动同步待启动';

    const raw = rawRealtimeStatus?.trim();
    if (refreshStatus !== 'live' && raw && raw !== 'SUBSCRIBED') {
      return `${base}（${raw}）`;
    }
    return base;
  }, [refreshStatus, rawRealtimeStatus]);

  const refreshStatusClassName = React.useMemo(() => {
    if (refreshStatus === 'connecting') return 'text-amber-600';
    if (refreshStatus === 'live') return 'text-emerald-600';
    if (refreshStatus === 'error') return 'text-rose-500';
    return 'text-slate-500';
  }, [refreshStatus]);

  useEffect(() => {
    if (!mounted) return;
    if (activeHighlights.length === 0) return;

    const timer = window.setTimeout(() => {
      setActiveHighlights([]);
      const nextParams = new URLSearchParams(searchParams.toString());
      nextParams.delete('highlightOrders');
      nextParams.delete('highlightAt');
      router.replace(nextParams.toString() ? `${pathname}?${nextParams.toString()}` : pathname, { scroll: false });
    }, 3000);

    return () => window.clearTimeout(timer);
  }, [activeHighlights, mounted, pathname, router, searchParams]);

  const openDrawer = (order: Order) => {
    setSelectedOrder(order);
    setFormError(null);
    setFormValues(buildInitialFormState(equipmentList, order));
    setDateRange(
      order.start_date && order.end_date
        ? { from: new Date(order.start_date), to: new Date(order.end_date) }
        : order.start_date
        ? { from: new Date(order.start_date), to: new Date(order.start_date) }
        : undefined
    );
  };

  const closeDrawer = () => {
    setSelectedOrder(null);
    setFormError(null);
    setFormValues(buildInitialFormState(equipmentList));
    setDateRange(undefined);
  };

  const updateFormValue = <K extends keyof DraftFormState>(key: K, value: DraftFormState[K]) => {
    setFormValues((current) => ({ ...current, [key]: value }));
  };

  const handleSubmit = () => {
    if (!selectedOrder) return;

    if (!dateRange?.from || !dateRange?.to) {
      setFormError('请选择完整的租赁期限');
      return;
    }

    setFormError(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.set('equipment_id', formValues.equipment_id);
      formData.set('shipping_address', formValues.shipping_address);
      formData.set('start_date', format(dateRange.from!, 'yyyy-MM-dd'));
      formData.set('end_date', format(dateRange.to!, 'yyyy-MM-dd'));
      formData.set('deposit_exemption', formValues.deposit_exemption);
      formData.set('shipping_method', formValues.shipping_method);

      const result = await processExternalOrder(selectedOrder.id, formData);
      if (!result.success) {
        setFormError(result.error ?? '接单失败，请稍后重试');
        return;
      }

      router.refresh();
      closeDrawer();
    });
  };

  const confirmDelete = () => {
    if (!deleteDialogOrderId) return;
    const orderId = deleteDialogOrderId;
    setDeleteDialogOrderId(null);

    setFormError(null);
    startTransition(async () => {
      const result = await deleteOrder(orderId);
      if (!result.success) {
        setFormError(result.error ?? '删除订单失败，请稍后重试');
        return;
      }

      router.refresh();
      if (selectedOrder?.id === orderId) {
        closeDrawer();
      }
    });
  };

  const resetFilters = () => {
    setSearchTerm('');
    setPlatformFilter('all');
  };

  return (
    <>
      <RefreshRemoteOrders
        userId={userId ?? ''}
        onStatusChange={setRefreshStatus}
        onRefreshed={handleRefreshed}
      />
      <SurfaceCard className="bg-slate-50 shadow-none">
        <SectionHeader
          title="待调度订单"
          description="点击卡片或下方按钮打开右侧调度抽屉，可连续编辑租期、收货地址、发货方式、免押方式和设备分配。"
          meta={(
            <div className="flex flex-col items-start gap-3 sm:items-end">
              <span className="text-sm text-slate-500">{filteredOrders.length} / {orders.length} 单</span>
              <span className={`text-xs ${refreshStatusClassName}`}>{refreshStatusLabel}</span>
              <span className="text-xs text-slate-400">上次刷新：{formatRefreshTime(lastRefreshedAt)}</span>
              <SyncOrdersButton />
            </div>
          )}
        />

        {formError ? (
          <div className="mt-5 rounded-[20px] border border-rose-200/80 bg-rose-50/80 px-4 py-3 text-sm text-rose-600">{formError}</div>
        ) : null}

        <FilterPanel className="xl:grid-cols-[minmax(0,1.3fr)_auto] xl:items-end">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400">搜索</p>
              <TextInput
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="客户名 / 手机号 / 平台 / 型号 / 外部单号 / 订单号"
              />
            </div>
            <div>
              <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400">平台来源</p>
              <SelectInput value={platformFilter} onChange={(e) => setPlatformFilter(e.target.value)}>
                <option value="all">全部平台</option>
                {sourcePlatforms.map((platform) => (
                  <option key={platform} value={platform}>{platform}</option>
                ))}
              </SelectInput>
            </div>
          </div>
          <div className="xl:self-end">
            <SecondaryButton onClick={resetFilters}>
              <RotateCcw className="h-4 w-4" />重置
            </SecondaryButton>
          </div>
        </FilterPanel>

        {filteredOrders.length === 0 ? (
          <div className="mt-6">
            <EmptyState>
              {orders.length === 0
                ? '当前没有可分配的外部平台订单'
                : '没有符合条件的订单，请调整筛选条件'}
            </EmptyState>
          </div>
        ) : (
          <div className="mt-8 grid gap-6 md:grid-cols-2 2xl:grid-cols-3">
            {filteredOrders.map((order) => (
              <DispatchOrderCard
                key={order.id}
                order={order}
                assignedEquipmentLabel={order.equipment_id ? equipmentLabelMap.get(order.equipment_id) : null}
                isHighlighted={Boolean(order.external_order_id && activeHighlights.includes(order.external_order_id))}
                isPending={isPending}
                onOpen={openDrawer}
                onDelete={(orderId) => setDeleteDialogOrderId(orderId)}
              />
            ))}
          </div>
        )}
      </SurfaceCard>

      <Drawer
        open={Boolean(selectedOrder)}
        onClose={closeDrawer}
        eyebrow="Dispatch Drawer"
        icon={SendHorizonal}
        title={selectedOrder ? `调度：${selectedOrder.customer_name || '未命名客户'}` : '编辑并接单'}
        footer={(
          <div className="flex flex-col gap-3">
            {formError ? (
              <div className="rounded-2xl border border-rose-200/80 bg-rose-50/80 px-4 py-3 text-sm text-rose-600">{formError}</div>
            ) : null}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:flex-wrap sm:justify-end sm:gap-3">
              <SecondaryButton onClick={closeDrawer} disabled={isPending} className="w-full sm:w-auto">取消</SecondaryButton>
              <PrimaryButton
                onClick={handleSubmit}
                disabled={isPending}
                className="w-full sm:w-auto"
              >
                {isPending ? '处理中...' : '确认接单'}
              </PrimaryButton>
            </div>
          </div>
        )}
      >
        {selectedOrder ? (
          <DispatchDrawerContent
            order={selectedOrder}
            formValues={formValues}
            dateRange={dateRange}
            onDateRangeChange={setDateRange}
            availableEquipment={availableEquipment}
            updateFormValue={updateFormValue}
            equipmentLabelMap={equipmentLabelMap}
          />
        ) : null}
      </Drawer>

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
