'use client';

import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { useMemo, useRef, useState, useTransition } from 'react';
import { type DateRange } from 'react-day-picker';
import { bulkCreateOrders, createManualOrder, deleteOrder, updateOrderFields, updateOrderStatus } from '../../actions/admin-actions';
import type { Equipment, Order } from '../../actions/types';
import { read, utils, writeFileXLSX } from 'xlsx';
import { Download, Edit2, FileSpreadsheet, MessageSquare, Package, Plus, Truck, Upload } from 'lucide-react';
import { DangerButton, EmptyState, FormField, Modal, PrimaryButton, SecondaryButton, SectionHeader, SelectInput, StatBadge, SurfaceCard, TableHead, TableShell, Td, TextInput, Th, Tr } from './ui';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { DateRangePicker } from '@/components/ui/date-range-picker';

interface PendingOrdersProps {
  orders: Order[];
  equipmentList: Equipment[];
}

const depositOptions = ['芝麻信用', '押金双免', '支付押金', '熟人免押'];
const orderTemplateRows = [
  {
    客户姓名: '张三',
    联系电话: '13800000000',
    收货地址: '北京市朝阳区示例路 88 号',
    平台来源: '小程序',
    外部单号: 'ORDER-20260606-001',
    订单金额: 899,
    租用开始日期: '2026-06-10',
    租用结束日期: '2026-06-13',
    免押方式: '芝麻信用',
    发货方式: '邮寄',
  },
];

const initialFormState = {
  equipment_id: '',
  customer_name: '',
  customer_phone: '',
  shipping_address: '',
  deposit_exemption: depositOptions[0],
  total_price: '',
};

type ImportedOrderRecord = {
  rowNumber: number;
  customer_name: string;
  customer_phone: string;
  shipping_address: string;
  platform_source: string;
  external_order_id: string;
  total_price: number;
  start_date: string | null;
  end_date: string | null;
  deposit_exemption: string;
  shipping_method: string;
  issues: string[];
};

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

function normalizeText(value: unknown) {
  if (value == null) return '';
  return String(value).trim();
}

function normalizeNumber(value: unknown) {
  if (typeof value === 'number') return value;
  const text = normalizeText(value).replace(/,/g, '');
  if (!text) return 0;
  const num = Number(text);
  return Number.isFinite(num) ? num : 0;
}

function excelSerialToDate(serial: number) {
  const utcDays = Math.floor(serial - 25569);
  const utcValue = utcDays * 86400;
  return new Date(utcValue * 1000);
}

function normalizeDate(value: unknown) {
  if (value == null || value === '') return null;

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    const date = excelSerialToDate(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
  }

  const text = normalizeText(value);
  if (!text) return null;

  const normalizedText = text.replace(/[./]/g, '-');
  const parsed = new Date(normalizedText);
  if (Number.isNaN(parsed.getTime())) {
    const match = normalizedText.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (!match) return null;
    const [, year, month, day] = match;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  return parsed.toISOString().slice(0, 10);
}

function buildImportedOrderRecord(row: Record<string, unknown>, index: number): ImportedOrderRecord {
  const customer_name = normalizeText(row['客户姓名']);
  const customer_phone = normalizeText(row['联系电话']);
  const shipping_address = normalizeText(row['收货地址']);
  const totalPriceRaw = row['订单金额'];
  const total_price = normalizeNumber(totalPriceRaw);
  const start_date = normalizeDate(row['租用开始日期']);
  const end_date = normalizeDate(row['租用结束日期']);
  const issues: string[] = [];

  if (!customer_name) issues.push('缺少客户姓名');
  if (!customer_phone) issues.push('缺少联系电话');
  if (!shipping_address) issues.push('缺少收货地址');
  if (normalizeText(totalPriceRaw) === '' || total_price < 0) issues.push('订单金额无效');
  if (normalizeText(row['租用开始日期']) && !start_date) issues.push('开始日期格式无效');
  if (normalizeText(row['租用结束日期']) && !end_date) issues.push('结束日期格式无效');
  if (start_date && end_date && start_date > end_date) issues.push('结束日期早于开始日期');

  return {
    rowNumber: index + 2,
    customer_name,
    customer_phone,
    shipping_address,
    platform_source: normalizeText(row['平台来源']),
    external_order_id: normalizeText(row['外部单号']),
    total_price,
    start_date,
    end_date,
    deposit_exemption: normalizeText(row['免押方式']) || depositOptions[0],
    shipping_method: normalizeText(row['发货方式']) || '邮寄',
    issues,
  };
}

export default function PendingOrders({ orders, equipmentList }: PendingOrdersProps) {
  const filtered = useMemo(
    () => orders.filter((o) => o.status === 'pending_payment' || o.status === 'confirmed'),
    [orders]
  );
  const [displayOrders, setDisplayOrders] = useState(filtered);
  const [trackingInputs, setTrackingInputs] = useState<Record<string, string>>({});
  const [isPending, startTransition] = useTransition();
  const [sfLoadingStates, setSfLoadingStates] = useState<Record<string, boolean>>({});
  const [sfToast, setSfToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [sfDialogOrderId, setSfDialogOrderId] = useState<string | null>(null);
  const [sfPickupTime, setSfPickupTime] = useState('');
  const [deleteDialogOrderId, setDeleteDialogOrderId] = useState<string | null>(null);
  const [editDialogOrder, setEditDialogOrder] = useState<Order | null>(null);
  const [editDateRange, setEditDateRange] = useState<DateRange | undefined>();
  const [editFormValues, setEditFormValues] = useState({
    customer_name: '',
    customer_phone: '',
    shipping_address: '',
    equipment_id: '',
    start_date: '',
    end_date: '',
    notes: '',
  });
  const [editFormError, setEditFormError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImportPreviewOpen, setIsImportPreviewOpen] = useState(false);
  const [importPreviewRecords, setImportPreviewRecords] = useState<ImportedOrderRecord[]>([]);
  const [formValues, setFormValues] = useState(() => ({
    ...initialFormState,
    equipment_id: equipmentList[0]?.id ?? '',
  }));
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [formError, setFormError] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const validImportRecords = importPreviewRecords.filter((record) => record.issues.length === 0);
  const invalidImportRecords = importPreviewRecords.filter((record) => record.issues.length > 0);

  const closeModal = () => {
    setIsModalOpen(false);
    setFormError(null);
    setFormValues({ ...initialFormState, equipment_id: equipmentList[0]?.id ?? '' });
    setDateRange(undefined);
  };

  const closeImportPreview = () => {
    setIsImportPreviewOpen(false);
    setImportError(null);
    setImportPreviewRecords([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const downloadTemplate = () => {
    const worksheet = utils.json_to_sheet(orderTemplateRows);
    const workbook = utils.book_new();
    utils.book_append_sheet(workbook, worksheet, '订单导入模板');
    writeFileXLSX(workbook, '待发货订单批量导入模板.xlsx');
  };

  const handleShip = (orderId: string) => {
    const trackingNumber = trackingInputs[orderId]?.trim();
    startTransition(async () => {
      const result = await updateOrderStatus(orderId, 'using', trackingNumber || undefined);
      if (!result.success) {
        setFormError(result.error ?? '发货失败，请稍后重试');
        return;
      }

      setDisplayOrders((current) => current.filter((order) => order.id !== orderId));
      setTrackingInputs((prev) => {
        const next = { ...prev };
        delete next[orderId];
        return next;
      });
    });
  };

  const openEditDialog = (order: Order) => {
    setEditDialogOrder(order);
    setEditFormValues({
      customer_name: order.customer_name ?? '',
      customer_phone: order.customer_phone ?? '',
      shipping_address: order.shipping_address ?? '',
      equipment_id: order.equipment_id ?? '',
      start_date: order.start_date ?? '',
      end_date: order.end_date ?? '',
      notes: order.notes ?? '',
    });
    setEditDateRange(
      order.start_date && order.end_date
        ? { from: new Date(order.start_date), to: new Date(order.end_date) }
        : order.start_date
        ? { from: new Date(order.start_date), to: new Date(order.start_date) }
        : undefined
    );
    setEditFormError(null);
  };

  const confirmDelete = () => {
    if (!deleteDialogOrderId) return;
    const orderId = deleteDialogOrderId;
    setDeleteDialogOrderId(null);

    setFormError(null);
    startTransition(async () => {
      const result = await deleteOrder(orderId);
      if (!result.success) {
        setFormError(result.error ?? '删除订单失败');
        return;
      }

      setDisplayOrders((current) => current.filter((order) => order.id !== orderId));
      setTrackingInputs((prev) => {
        const next = { ...prev };
        delete next[orderId];
        return next;
      });
    });
  };

  const handleSaveEdit = () => {
    if (!editDialogOrder) return;
    const orderId = editDialogOrder.id;

    const resolvedStart = editDateRange?.from ? format(editDateRange.from, 'yyyy-MM-dd') : undefined;
    const resolvedEnd = editDateRange?.to ? format(editDateRange.to, 'yyyy-MM-dd') : undefined;

    setEditFormError(null);
    startTransition(async () => {
      const result = await updateOrderFields(orderId, {
        customer_name: editFormValues.customer_name.trim() || undefined,
        customer_phone: editFormValues.customer_phone.trim() || undefined,
        shipping_address: editFormValues.shipping_address.trim() || undefined,
        equipment_id: editFormValues.equipment_id || undefined,
        start_date: resolvedStart,
        end_date: resolvedEnd,
        notes: editFormValues.notes.trim() || undefined,
      });

      if (!result.success) {
        setEditFormError(result.error ?? '保存失败，请稍后重试');
        return;
      }

      setEditDialogOrder(null);
      setDisplayOrders((current) =>
        current.map((order) =>
          order.id === orderId
            ? {
                ...order,
                customer_name: editFormValues.customer_name || order.customer_name,
                customer_phone: editFormValues.customer_phone || order.customer_phone,
                shipping_address: editFormValues.shipping_address || order.shipping_address,
                equipment_id: editFormValues.equipment_id || order.equipment_id,
                start_date: resolvedStart || order.start_date,
                end_date: resolvedEnd || order.end_date,
                notes: editFormValues.notes.trim() || order.notes,
              }
            : order
        )
      );
      setSfToast({ type: 'success', message: '订单信息已更新' });
      setTimeout(() => setSfToast(null), 3000);
    });
  };

  const showToast = (type: 'success' | 'error', message: string) => {
    setSfToast({ type, message });
    setTimeout(() => setSfToast(null), 4000);
  };

  const handleSFOrderConfirm = async () => {
    if (!sfDialogOrderId) return;
    const orderId = sfDialogOrderId;

    setSfLoadingStates((prev) => ({ ...prev, [orderId]: true }));
    setSfDialogOrderId(null);

    try {
      const res = await fetch('/api/shipping/sf-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, pickupTime: sfPickupTime || undefined }),
      });

      const data = (await res.json()) as { success: boolean; tracking_number?: string; error?: string };

      if (data.success && data.tracking_number) {
        showToast('success', `顺丰下单成功，单号：${data.tracking_number}`);
        setDisplayOrders((current) => current.filter((order) => order.id !== orderId));
        setTrackingInputs((prev) => {
          const next = { ...prev };
          delete next[orderId];
          return next;
        });
      } else {
        showToast('error', data.error ?? '顺丰下单失败');
      }
    } catch {
      showToast('error', '网络异常，请稍后重试');
    } finally {
      setSfLoadingStates((prev) => {
        const next = { ...prev };
        delete next[orderId];
        return next;
      });
      setSfPickupTime('');
    }
  };

  const handleCreateOrder = () => {
    if (!dateRange?.from || !dateRange?.to) {
      setFormError('请选择完整的租赁期限');
      return;
    }
    setFormError(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.set('equipment_id', formValues.equipment_id);
      formData.set('customer_name', formValues.customer_name);
      formData.set('customer_phone', formValues.customer_phone);
      formData.set('shipping_address', formValues.shipping_address);
      formData.set('start_date', format(dateRange.from!, 'yyyy-MM-dd'));
      formData.set('end_date', format(dateRange.to!, 'yyyy-MM-dd'));
      formData.set('deposit_exemption', formValues.deposit_exemption);
      formData.set('total_price', formValues.total_price);

      const result = await createManualOrder(formData);
      if (!result.success) {
        setFormError(result.error ?? '创建订单失败');
        return;
      }
      closeModal();
    });
  };

  const handleExcelSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImportError(null);

    try {
      const buffer = await file.arrayBuffer();
      const workbook = read(buffer, { type: 'array', cellDates: true });
      const firstSheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[firstSheetName];
      const rows = utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
      const records = rows.map((row, index) => buildImportedOrderRecord(row, index));
      const hasContent = records.some((record) =>
        [record.customer_name, record.customer_phone, record.shipping_address, record.external_order_id, String(record.total_price)]
          .some((value) => value && value !== '0')
      );

      if (!hasContent) {
        setImportError('未解析到有效订单数据，请检查 Excel 表头与内容。');
        return;
      }

      setImportPreviewRecords(records);
      setIsImportPreviewOpen(true);
    } catch {
      setImportError('Excel 解析失败，请确认文件格式正确。');
    }
  };

  const handleBulkImport = () => {
    if (validImportRecords.length === 0) return;

    setImportError(null);
    startTransition(async () => {
      const payload = validImportRecords.map(({ ...record }) => record);
      const result = await bulkCreateOrders(payload);
      if (!result.success) {
        setImportError(result.error ?? '批量导入失败');
        return;
      }

      closeImportPreview();
    });
  };

  return (
    <>
      <SurfaceCard>
        <SectionHeader
          title="待发货订单"
          description="录入物流单号后即可发货。"
          meta={
            <div className="flex flex-wrap items-center gap-2.5">
              <StatBadge tone="slate">{displayOrders.length} 单</StatBadge>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={handleExcelSelect}
              />
              <SecondaryButton onClick={downloadTemplate} disabled={isPending}>
                <Download className="h-4 w-4" />下载模板
              </SecondaryButton>
              <SecondaryButton onClick={() => fileInputRef.current?.click()} disabled={isPending}>
                <FileSpreadsheet className="h-4 w-4" />批量导入 (Excel)
              </SecondaryButton>
              <PrimaryButton onClick={() => setIsModalOpen(true)}>
                <Plus className="h-4 w-4" />手动创建订单
              </PrimaryButton>
            </div>
          }
        />

        {formError ? (
          <div className="mt-5 rounded-[20px] border border-rose-200/80 bg-rose-50/80 px-4 py-3 text-sm text-rose-600">{formError}</div>
        ) : null}

        {importError && !isImportPreviewOpen ? (
          <div className="mt-5 rounded-[20px] border border-rose-200/80 bg-rose-50/80 px-4 py-3 text-sm text-rose-600">{importError}</div>
        ) : null}

        <TableShell>
          {displayOrders.length === 0 ? (
            <EmptyState>暂无待发货订单</EmptyState>
          ) : (
            <table className="w-full min-w-[980px] text-sm">
              <TableHead>
                <tr>
                  <Th>设备</Th>
                  <Th>平台 / 外部单号</Th>
                  <Th>客户信息</Th>
                  <Th>收货地址 / 物流</Th>
                  <Th>租用时段</Th>
                  <Th>订单金额</Th>
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
                    <Td>
                      <div className="space-y-1">
                        <StatBadge tone="slate">{order.platform_source || '手动录单'}</StatBadge>
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
                        <p className="max-w-[140px] truncate text-sm text-slate-700 sm:max-w-[200px]" title={order.shipping_address || '—'}>
                          {order.shipping_address || '—'}
                        </p>
                        <p className="text-xs text-slate-400">{order.shipping_method || '待确认发货方式'}</p>
                        {order.notes ? (
                          <p className="mt-1 flex max-w-[200px] items-start gap-1 truncate text-xs text-slate-400" title={order.notes}>
                            <MessageSquare className="mt-0.5 h-3 w-3 shrink-0 text-slate-300" />
                            <span className="truncate italic">{order.notes}</span>
                          </p>
                        ) : null}
                      </div>
                    </Td>
                    <Td className="text-slate-600">{formatDateRange(order.start_date, order.end_date)}</Td>
                    <Td className="font-semibold text-slate-900">{formatCurrency(order.total_price)}</Td>
                    <Td>
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-2">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  onClick={() => openEditDialog(order)}
                                  className="text-slate-500 hover:text-slate-900"
                                >
                                  <Edit2 className="h-3.5 w-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="left">编辑订单信息</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          <button
                            type="button"
                            onClick={() => { setSfDialogOrderId(order.id); setSfPickupTime(''); }}
                            disabled={sfLoadingStates[order.id] || isPending}
                            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {sfLoadingStates[order.id] ? (
                              <><svg className="h-3.5 w-3.5 animate-spin text-slate-400" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>下单中...</>
                            ) : (
                              <><Truck className="h-3.5 w-3.5 text-indigo-500" />顺丰一键下单</>
                            )}
                          </button>
                        </div>
                        <TextInput
                          type="text"
                          placeholder="运单号"
                          value={trackingInputs[order.id] ?? ''}
                          onChange={(e) => setTrackingInputs((prev) => ({ ...prev, [order.id]: e.target.value }))}
                          className="w-40 !py-2 text-xs"
                        />
                        <div className="flex items-center gap-2">
                          <PrimaryButton onClick={() => handleShip(order.id)} disabled={isPending} className="text-xs">
                            <Truck className="h-3.5 w-3.5" />发货
                          </PrimaryButton>
                          <DangerButton onClick={() => setDeleteDialogOrderId(order.id)} disabled={isPending}>删除</DangerButton>
                        </div>
                      </div>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </table>
          )}
        </TableShell>
      </SurfaceCard>

      <Modal
        open={isModalOpen}
        onClose={closeModal}
        eyebrow="Manual Order"
        icon={Package}
        title="手动创建订单"
        maxWidthClassName="max-w-3xl"
        footer={
          <div className="flex flex-wrap justify-end gap-3">
            {formError && (
              <div className="w-full rounded-[20px] border border-rose-200/80 bg-rose-50/80 px-4 py-3 text-sm text-rose-600">{formError}</div>
            )}
            <SecondaryButton onClick={closeModal} disabled={isPending}>取消</SecondaryButton>
            <PrimaryButton onClick={handleCreateOrder} disabled={isPending || equipmentList.length === 0}>{isPending ? '创建中...' : '确认创建'}</PrimaryButton>
          </div>
        }
      >
        <div className="grid gap-5 md:grid-cols-2">
          <FormField label="设备选择" className="md:col-span-2">
            <SelectInput
              value={formValues.equipment_id}
              onChange={(e) => setFormValues((p) => ({ ...p, equipment_id: e.target.value }))}
            >
              {equipmentList.map((equipment) => (
                <option key={equipment.id} value={equipment.id}>
                  {equipment.name}
                </option>
              ))}
            </SelectInput>
          </FormField>

          <FormField label="客户姓名">
            <TextInput
              type="text"
              placeholder="张三"
              value={formValues.customer_name}
              onChange={(e) => setFormValues((p) => ({ ...p, customer_name: e.target.value }))}
            />
          </FormField>

          <FormField label="联系电话">
            <TextInput
              type="text"
              placeholder="138xxxx8888"
              value={formValues.customer_phone}
              onChange={(e) => setFormValues((p) => ({ ...p, customer_phone: e.target.value }))}
            />
          </FormField>

          <FormField label="免押方式">
            <SelectInput
              value={formValues.deposit_exemption}
              onChange={(e) => setFormValues((p) => ({ ...p, deposit_exemption: e.target.value }))}
            >
              {depositOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </SelectInput>
          </FormField>

          <FormField label="收货地址" className="md:col-span-2">
            <TextInput
              type="text"
              placeholder="请输入完整收货地址"
              value={formValues.shipping_address}
              onChange={(e) => setFormValues((p) => ({ ...p, shipping_address: e.target.value }))}
            />
          </FormField>

          <FormField label="租赁期限" className="md:col-span-2">
            <DateRangePicker
              date={dateRange}
              onDateChange={setDateRange}
              placeholder="请选择租赁期限..."
            />
          </FormField>

          <FormField label="订单金额 (元)">
            <TextInput
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={formValues.total_price}
              onChange={(e) => setFormValues((p) => ({ ...p, total_price: e.target.value }))}
            />
          </FormField>
        </div>
      </Modal>

      <Modal
        open={isImportPreviewOpen}
        onClose={closeImportPreview}
        eyebrow="Excel Import"
        icon={Upload}
        title="确认导入订单数据"
        maxWidthClassName="max-w-6xl"
        footer={
          <div className="flex flex-wrap justify-end gap-3">
            {importError ? (
              <div className="w-full rounded-[20px] border border-rose-200/80 bg-rose-50/80 px-4 py-3 text-sm text-rose-600">{importError}</div>
            ) : null}
            <SecondaryButton onClick={closeImportPreview} disabled={isPending}>取消</SecondaryButton>
            <PrimaryButton onClick={handleBulkImport} disabled={isPending || validImportRecords.length === 0}>
              {isPending ? '导入中...' : `仅导入有效数据 (${validImportRecords.length})`}
            </PrimaryButton>
          </div>
        }
      >
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-[22px] border border-slate-200/70 bg-white/76 p-4">
            <p className="text-sm text-slate-500">总记录</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{importPreviewRecords.length}</p>
          </div>
          <div className="rounded-[22px] border border-emerald-200/70 bg-emerald-50/72 p-4">
            <p className="text-sm text-emerald-700">有效记录</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{validImportRecords.length}</p>
          </div>
          <div className="rounded-[22px] border border-amber-200/70 bg-amber-50/72 p-4">
            <p className="text-sm text-amber-700">无效记录</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{invalidImportRecords.length}</p>
          </div>
        </div>

        {invalidImportRecords.length > 0 ? (
          <div className="mt-4 rounded-[20px] border border-amber-200/80 bg-amber-50/80 px-4 py-3 text-sm text-amber-700">
            检测到 {invalidImportRecords.length} 条无效数据，提交时将自动跳过，仅导入有效行。
          </div>
        ) : null}

        <TableShell>
          <table className="w-full min-w-[980px] text-sm">
            <TableHead>
              <tr>
                <Th>Excel 行</Th>
                <Th>客户姓名</Th>
                <Th>联系电话</Th>
                <Th>收货地址</Th>
                <Th>租期</Th>
                <Th>金额</Th>
                <Th>校验结果</Th>
              </tr>
            </TableHead>
            <tbody>
              {importPreviewRecords.map((record) => (
                <Tr key={`${record.rowNumber}-${record.customer_name}-${record.customer_phone}`} className={record.issues.length > 0 ? 'bg-amber-50/38 hover:!bg-amber-50/55' : ''}>
                  <Td>第 {record.rowNumber} 行</Td>
                  <Td className="font-medium text-slate-900">{record.customer_name || '—'}</Td>
                  <Td>{record.customer_phone || '—'}</Td>
                  <Td className="max-w-[240px] truncate" title={record.shipping_address || '—'}>{record.shipping_address || '—'}</Td>
                  <Td>{formatDateRange(record.start_date, record.end_date)}</Td>
                  <Td className="font-semibold text-slate-900">{formatCurrency(record.total_price)}</Td>
                  <Td>
                    {record.issues.length === 0 ? (
                      <StatBadge tone="emerald">可导入</StatBadge>
                    ) : (
                      <div className="space-y-1">
                        <StatBadge tone="amber">需修正</StatBadge>
                        <p className="text-xs text-amber-700">{record.issues.join('；')}</p>
                      </div>
                    )}
                  </Td>
                </Tr>
              ))}
            </tbody>
          </table>
        </TableShell>
      </Modal>

      {sfToast && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-2xl border px-5 py-4 text-sm font-medium shadow-xl transition-all ${
            sfToast.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : 'border-rose-200 bg-rose-50 text-rose-700'
          }`}
        >
          <span className={`inline-block h-2 w-2 rounded-full ${sfToast.type === 'success' ? 'bg-emerald-400' : 'bg-rose-400'}`} />
          {sfToast.message}
        </div>
      )}

      <Modal
        open={sfDialogOrderId !== null}
        onClose={() => setSfDialogOrderId(null)}
        eyebrow="Express"
        icon={Truck}
        title="预约顺丰上门时间"
        maxWidthClassName="max-w-md"
        footer={
          <div className="flex flex-wrap justify-end gap-3">
            <SecondaryButton onClick={() => setSfDialogOrderId(null)} disabled={sfLoadingStates[sfDialogOrderId ?? '']}>
              取消
            </SecondaryButton>
            <PrimaryButton
              onClick={() => void handleSFOrderConfirm()}
              disabled={sfLoadingStates[sfDialogOrderId ?? '']}
            >
              {sfLoadingStates[sfDialogOrderId ?? ''] ? '下单中...' : '确认下单'}
            </PrimaryButton>
          </div>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            选择希望顺丰快递员上门取件的时间。留空则默认立即呼叫快递员。
          </p>
          <input
            type="datetime-local"
            value={sfPickupTime}
            onChange={(e) => setSfPickupTime(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 transition-colors focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
          />
          <div className="rounded-xl border border-amber-200/80 bg-amber-50/70 px-4 py-3 text-xs text-amber-700">
            💡 留空则默认为立即呼叫快递员上门
          </div>
        </div>
      </Modal>

      <Dialog open={editDialogOrder !== null} onOpenChange={(open) => !open && setEditDialogOrder(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>编辑订单信息</DialogTitle>
            <DialogDescription>
              修改后将实时同步到数据库，设备更换会自动更新库存状态。
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-5 py-2">
            <FormField label="客户姓名">
              <input
                type="text"
                value={editFormValues.customer_name}
                onChange={(e) => setEditFormValues((p) => ({ ...p, customer_name: e.target.value }))}
                placeholder="收货人姓名"
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 shadow-sm transition-all outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
              />
            </FormField>
            <FormField label="联系电话">
              <input
                type="tel"
                value={editFormValues.customer_phone}
                onChange={(e) => setEditFormValues((p) => ({ ...p, customer_phone: e.target.value }))}
                placeholder="手机号码"
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 shadow-sm transition-all outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
              />
            </FormField>
            <FormField label="详细地址" className="md:col-span-2">
              <textarea
                value={editFormValues.shipping_address}
                onChange={(e) => setEditFormValues((p) => ({ ...p, shipping_address: e.target.value }))}
                placeholder="省/市/区 + 详细门牌号"
                rows={3}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 shadow-sm transition-all outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100 resize-none"
              />
            </FormField>
            <FormField label="分配设备" className="md:col-span-2">
              <SelectInput
                value={editFormValues.equipment_id}
                onChange={(e) => setEditFormValues((p) => ({ ...p, equipment_id: e.target.value }))}
              >
                {equipmentList.map((eq) => (
                  <option key={eq.id} value={eq.id}>
                    {eq.name}{eq.serial_number ? ` · ${eq.serial_number}` : ''}
                  </option>
                ))}
              </SelectInput>
            </FormField>
            <FormField label="租赁期限" className="md:col-span-2">
              <DateRangePicker
                date={editDateRange}
                onDateChange={setEditDateRange}
                placeholder="请选择租赁期限..."
              />
            </FormField>
            <FormField label="订单备注">
              <textarea
                value={editFormValues.notes}
                onChange={(e) => setEditFormValues((p) => ({ ...p, notes: e.target.value }))}
                placeholder="填写客户特殊需求、注意事项等..."
                rows={3}
                className="w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 shadow-sm transition-all outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
              />
            </FormField>
          </div>
          <DialogFooter>
            {editFormError && (
              <div className="w-full rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">
                {editFormError}
              </div>
            )}
            <button
              type="button"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => setEditDialogOrder(null)}
              disabled={isPending}
            >
              取消
            </button>
            <button
              type="button"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-600 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => void handleSaveEdit()}
              disabled={isPending}
            >
              {isPending ? '保存中...' : '保存修改'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
