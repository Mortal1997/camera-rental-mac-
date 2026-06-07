'use client';

import { useMemo, useState, useTransition } from 'react';
import { Inbox, PackageCheck, RotateCcw, SendHorizonal, Smartphone, Trash2 } from 'lucide-react';
import { deleteOrder, processExternalOrder } from '../../actions/admin-actions';
import type { Equipment, Order } from '../../actions/types';
import { EmptyState, FormField, Modal, PrimaryButton, SecondaryButton, SectionHeader, SelectInput, StatBadge, SurfaceCard, TextInput, cn } from './ui';

interface DispatchConsoleProps {
  orders: Order[];
  equipmentList: Equipment[];
}

const depositOptions = ['芝麻信用', '押金双免', '支付押金', '熟人免押'];
const shippingMethodOptions = ['邮寄', '自提', '闪送'];

const dangerButtonClassName = 'inline-flex items-center justify-center gap-2 rounded-md bg-red-50 px-3 py-1.5 text-sm text-red-600 transition-colors hover:bg-red-100 hover:text-red-800 disabled:cursor-not-allowed disabled:opacity-50';

type DraftFormState = {
  equipment_id: string;
  start_date: string;
  end_date: string;
  deposit_exemption: string;
  shipping_method: string;
};

function buildInitialFormState(equipmentList: Equipment[]): DraftFormState {
  return {
    equipment_id: equipmentList[0]?.id ?? '',
    start_date: '',
    end_date: '',
    deposit_exemption: depositOptions[0],
    shipping_method: shippingMethodOptions[0],
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
    <div className={cn('rounded-2xl border border-slate-100 bg-white px-4 py-3', className)}>
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{label}</p>
      <p className="mt-2 text-sm text-slate-600" title={title ?? value}>{value}</p>
    </div>
  );
}

export default function DispatchConsole({ orders, equipmentList }: DispatchConsoleProps) {
  const [draftOrders, setDraftOrders] = useState(orders);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [formValues, setFormValues] = useState<DraftFormState>(() => buildInitialFormState(equipmentList));
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [searchTerm, setSearchTerm] = useState('');
  const [platformFilter, setPlatformFilter] = useState('all');

  const availableEquipment = useMemo(
    () => equipmentList.filter((equipment) => equipment.status === 'available'),
    [equipmentList]
  );

  const sourcePlatforms = useMemo(() => {
    const sources = new Set(orders.map((o) => o.platform_source).filter(Boolean));
    return Array.from(sources) as string[];
  }, [orders]);

  const filteredOrders = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return draftOrders.filter((order) => {
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
  }, [draftOrders, searchTerm, platformFilter]);

  const openModal = (order: Order) => {
    setSelectedOrder(order);
    setFormError(null);
    setFormValues((current) => ({
      equipment_id: availableEquipment[0]?.id ?? current.equipment_id,
      start_date: order.start_date || '',
      end_date: order.end_date || '',
      deposit_exemption: order.deposit_exemption || depositOptions[0],
      shipping_method: order.shipping_method || shippingMethodOptions[0],
    }));
  };

  const closeModal = () => {
    setSelectedOrder(null);
    setFormError(null);
    setFormValues(buildInitialFormState(availableEquipment));
  };

  const handleSubmit = () => {
    if (!selectedOrder) return;

    setFormError(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.set('equipment_id', formValues.equipment_id);
      formData.set('start_date', formValues.start_date);
      formData.set('end_date', formValues.end_date);
      formData.set('deposit_exemption', formValues.deposit_exemption);
      formData.set('shipping_method', formValues.shipping_method);

      const result = await processExternalOrder(selectedOrder.id, formData);
      if (!result.success) {
        setFormError(result.error ?? '接单失败，请稍后重试');
        return;
      }

      setDraftOrders((current) => current.filter((order) => order.id !== selectedOrder.id));
      closeModal();
    });
  };

  const handleDelete = (orderId: string) => {
    if (!window.confirm('确定要永久删除这个订单吗？此操作无法撤销。')) return;

    setFormError(null);
    startTransition(async () => {
      const result = await deleteOrder(orderId);
      if (!result.success) {
        setFormError(result.error ?? '删除订单失败，请稍后重试');
        return;
      }

      setDraftOrders((current) => current.filter((order) => order.id !== orderId));
      if (selectedOrder?.id === orderId) {
        closeModal();
      }
    });
  };

  const resetFilters = () => {
    setSearchTerm('');
    setPlatformFilter('all');
  };

  return (
    <>
      <SurfaceCard>
        <SectionHeader
          title="待调度订单"
          description="先完成设备分配与信息补全，再让订单流入待发货列表。"
          meta={<span>{filteredOrders.length} / {draftOrders.length} 单</span>}
        />

        {formError ? (
          <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{formError}</div>
        ) : null}

        <div className="mt-5 grid gap-3 rounded-2xl border border-slate-100 bg-slate-50/70 p-4 xl:grid-cols-[minmax(0,1.3fr)_auto] xl:items-end">
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">搜索</p>
              <TextInput
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="客户名 / 手机号 / 平台 / 型号 / 外部单号 / 订单号"
              />
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">平台来源</p>
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
        </div>

        {filteredOrders.length === 0 ? (
          <div className="mt-6">
            <EmptyState>
              {draftOrders.length === 0
                ? '当前没有待处理的外部平台订单'
                : '没有符合条件的订单，请调整筛选条件'}
            </EmptyState>
          </div>
        ) : (
          <div className="mt-6 grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {filteredOrders.map((order) => (
              <article key={order.id} className="rounded-3xl border border-slate-100 bg-gradient-to-br from-white to-slate-50 p-5 shadow-sm transition-transform hover:-translate-y-0.5 hover:shadow-lg">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                        {order.platform_source || '手动录单'}
                      </span>
                      <StatBadge tone="slate">未处理</StatBadge>
                    </div>
                    <p className="mt-2 truncate text-xs text-slate-400">
                      {order.external_order_id || `内部单号：${order.id}`}
                    </p>
                    <h3 className="mt-3 text-sm font-medium text-slate-900">{order.customer_name || '未命名客户'}</h3>
                    <div className="mt-1 flex items-center gap-2 text-sm text-slate-500">
                      <Smartphone className="h-4 w-4 text-slate-400" />
                      <span>{order.customer_phone || '未提供联系电话'}</span>
                    </div>
                  </div>
                  <div className="rounded-2xl bg-indigo-50 p-3 text-indigo-600">
                    <Inbox className="h-5 w-5" />
                  </div>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <OrderDataField
                    label="收货地址 / 物流"
                    value={order.shipping_address || '待补充收货地址'}
                    title={order.shipping_address || '待补充收货地址'}
                    className="sm:col-span-2"
                  />
                  <OrderDataField label="发货方式" value={order.shipping_method || '待确认'} />
                  <OrderDataField label="租期" value={formatDateRange(order.start_date, order.end_date)} />
                  <OrderDataField label="期望设备型号" value={order.expected_equipment_model || '待分配'} />
                  <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 sm:col-span-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-600">订单总金额</p>
                    <p className="mt-2 text-lg font-semibold text-emerald-600">{formatCurrency(order.total_price)}</p>
                  </div>
                </div>

                <div className="mt-5 flex items-center gap-3">
                  <PrimaryButton className="flex-1" onClick={() => openModal(order)} disabled={isPending}>
                    <PackageCheck className="h-4 w-4" />分配并接单
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
              </article>
            ))}
          </div>
        )}
      </SurfaceCard>

      <Modal
        open={Boolean(selectedOrder)}
        onClose={closeModal}
        eyebrow="Dispatch Intake"
        icon={SendHorizonal}
        title={selectedOrder ? `接单：${selectedOrder.customer_name || '未命名客户'}` : '分配并接单'}
        maxWidthClassName="max-w-4xl"
        footer={
          <div className="flex flex-wrap justify-end gap-3">
            {formError ? (
              <div className="w-full rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{formError}</div>
            ) : null}
            <SecondaryButton onClick={closeModal} disabled={isPending}>取消</SecondaryButton>
            <PrimaryButton onClick={handleSubmit} disabled={isPending || availableEquipment.length === 0}>
              {isPending ? '处理中...' : '确认接单'}
            </PrimaryButton>
          </div>
        }
      >
        {selectedOrder ? (
          <div className="grid gap-5 md:grid-cols-2">
            <div className="md:col-span-2 rounded-3xl border border-slate-100 bg-slate-50 p-5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                  {selectedOrder.platform_source || '手动录单'}
                </span>
                <StatBadge tone="indigo">待接单核对</StatBadge>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3 text-sm text-slate-600">
                <OrderDataField label="外部单号" value={selectedOrder.external_order_id || '未提供'} />
                <OrderDataField label="客户姓名" value={selectedOrder.customer_name || '—'} />
                <OrderDataField label="联系电话" value={selectedOrder.customer_phone || '—'} />
                <OrderDataField label="收货地址" value={selectedOrder.shipping_address || '—'} title={selectedOrder.shipping_address || '—'} className="xl:col-span-2" />
                <OrderDataField label="发货方式" value={selectedOrder.shipping_method || '待确认'} />
                <OrderDataField label="期望设备型号" value={selectedOrder.expected_equipment_model || '待分配'} />
                <OrderDataField label="租期" value={formatDateRange(selectedOrder.start_date, selectedOrder.end_date)} />
                <OrderDataField label="免押方式" value={selectedOrder.deposit_exemption || '待确认'} />
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-600">订单总金额</p>
                  <p className="mt-2 text-base font-semibold text-emerald-600">{formatCurrency(selectedOrder.total_price)}</p>
                </div>
                <div className="rounded-2xl border border-slate-100 bg-white px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">已收押金</p>
                  <p className="mt-2 text-sm font-medium text-slate-900">{formatCurrency(selectedOrder.deposit_paid)}</p>
                </div>
              </div>
            </div>

            <FormField label="分配具体设备" className="md:col-span-2">
              <SelectInput value={formValues.equipment_id} onChange={(e) => setFormValues((prev) => ({ ...prev, equipment_id: e.target.value }))}>
                {availableEquipment.length === 0 ? (
                  <option value="">当前无空闲设备</option>
                ) : (
                  availableEquipment.map((equipment) => (
                    <option key={equipment.id} value={equipment.id}>
                      {equipment.name}{equipment.serial_number ? ` · SN ${equipment.serial_number}` : ''}
                    </option>
                  ))
                )}
              </SelectInput>
              {selectedOrder.expected_equipment_model ? (
                <p className="mt-1.5 text-xs text-slate-400">平台期望：{selectedOrder.expected_equipment_model}，请从上方选择实际分配的设备</p>
              ) : null}
            </FormField>

            <FormField label="租用开始日期">
              <TextInput type="date" value={formValues.start_date} onChange={(e) => setFormValues((prev) => ({ ...prev, start_date: e.target.value }))} />
            </FormField>

            <FormField label="租用结束日期">
              <TextInput type="date" value={formValues.end_date} onChange={(e) => setFormValues((prev) => ({ ...prev, end_date: e.target.value }))} />
            </FormField>

            <FormField label="免押方式">
              <SelectInput value={formValues.deposit_exemption} onChange={(e) => setFormValues((prev) => ({ ...prev, deposit_exemption: e.target.value }))}>
                {depositOptions.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </SelectInput>
            </FormField>

            <FormField label="发货方式">
              <SelectInput value={formValues.shipping_method} onChange={(e) => setFormValues((prev) => ({ ...prev, shipping_method: e.target.value }))}>
                {shippingMethodOptions.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </SelectInput>
            </FormField>
          </div>
        ) : null}
      </Modal>
    </>
  );
}
