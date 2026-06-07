'use client';

import { useMemo, useRef, useState, useTransition } from 'react';
import { bulkCreateOrders, createManualOrder, deleteOrder, updateOrderStatus } from '../../actions/admin-actions';
import type { Equipment, Order } from '../../actions/types';
import { read, utils, writeFileXLSX } from 'xlsx';
import { Download, FileSpreadsheet, Package, Plus, Trash2, Truck, Upload } from 'lucide-react';
import { EmptyState, FormField, Modal, PrimaryButton, SecondaryButton, SectionHeader, SelectInput, SurfaceCard, TableHead, TableShell, Td, TextInput, Th, Tr } from './ui';

interface PendingOrdersProps {
  orders: Order[];
  equipmentList: Equipment[];
}

const depositOptions = ['芝麻信用', '押金双免', '支付押金', '熟人免押'];
const dangerButtonClassName = 'inline-flex items-center justify-center gap-2 rounded-md bg-red-50 px-3 py-1.5 text-sm text-red-600 transition-colors hover:bg-red-100 hover:text-red-800 disabled:cursor-not-allowed disabled:opacity-50';
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
  start_date: '',
  end_date: '',
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
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImportPreviewOpen, setIsImportPreviewOpen] = useState(false);
  const [importPreviewRecords, setImportPreviewRecords] = useState<ImportedOrderRecord[]>([]);
  const [formValues, setFormValues] = useState(() => ({
    ...initialFormState,
    equipment_id: equipmentList[0]?.id ?? '',
  }));
  const [formError, setFormError] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const validImportRecords = importPreviewRecords.filter((record) => record.issues.length === 0);
  const invalidImportRecords = importPreviewRecords.filter((record) => record.issues.length > 0);

  const closeModal = () => {
    setIsModalOpen(false);
    setFormError(null);
    setFormValues({ ...initialFormState, equipment_id: equipmentList[0]?.id ?? '' });
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

  const handleDelete = (orderId: string) => {
    if (!window.confirm('确定要永久删除这个订单吗？此操作无法撤销。')) return;

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

  const handleCreateOrder = () => {
    setFormError(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.set('equipment_id', formValues.equipment_id);
      formData.set('customer_name', formValues.customer_name);
      formData.set('customer_phone', formValues.customer_phone);
      formData.set('shipping_address', formValues.shipping_address);
      formData.set('start_date', formValues.start_date);
      formData.set('end_date', formValues.end_date);
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
            <div className="flex items-center gap-3">
              <span className="text-sm text-slate-400">{displayOrders.length} 单</span>
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
          <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{formError}</div>
        ) : null}

        {importError && !isImportPreviewOpen ? (
          <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{importError}</div>
        ) : null}

        <TableShell>
          {displayOrders.length === 0 ? (
            <EmptyState>暂无待发货订单</EmptyState>
          ) : (
            <table className="w-full min-w-[1160px] text-sm">
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
                      <div className="flex flex-col gap-2">
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
                          <button
                            type="button"
                            className={dangerButtonClassName}
                            onClick={() => handleDelete(order.id)}
                            disabled={isPending}
                          >
                            <Trash2 className="h-4 w-4" />删除
                          </button>
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
              <div className="w-full rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{formError}</div>
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
              placeholder="北京市朝阳区xxx"
              value={formValues.shipping_address}
              onChange={(e) => setFormValues((p) => ({ ...p, shipping_address: e.target.value }))}
            />
          </FormField>

          <FormField label="租用开始日期">
            <TextInput
              type="date"
              value={formValues.start_date}
              onChange={(e) => setFormValues((p) => ({ ...p, start_date: e.target.value }))}
            />
          </FormField>

          <FormField label="租用结束日期">
            <TextInput
              type="date"
              value={formValues.end_date}
              onChange={(e) => setFormValues((p) => ({ ...p, end_date: e.target.value }))}
            />
          </FormField>

          <FormField label="订单金额" className="md:col-span-2">
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
              <div className="w-full rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{importError}</div>
            ) : null}
            <SecondaryButton onClick={closeImportPreview} disabled={isPending}>取消</SecondaryButton>
            <PrimaryButton onClick={handleBulkImport} disabled={isPending || validImportRecords.length === 0}>
              {isPending ? '导入中...' : `仅导入有效数据 (${validImportRecords.length})`}
            </PrimaryButton>
          </div>
        }
      >
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4">
            <p className="text-sm text-slate-500">总记录</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{importPreviewRecords.length}</p>
          </div>
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4">
            <p className="text-sm text-emerald-700">有效记录</p>
            <p className="mt-2 text-2xl font-semibold text-emerald-700">{validImportRecords.length}</p>
          </div>
          <div className="rounded-2xl border border-amber-100 bg-amber-50/70 p-4">
            <p className="text-sm text-amber-700">无效记录</p>
            <p className="mt-2 text-2xl font-semibold text-amber-700">{invalidImportRecords.length}</p>
          </div>
        </div>

        {invalidImportRecords.length > 0 ? (
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            检测到 {invalidImportRecords.length} 条无效数据，提交时将自动跳过，仅导入有效行。
          </div>
        ) : null}

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {importPreviewRecords.map((record, index) => (
            <div
              key={`${record.rowNumber}-${record.customer_name}-${record.external_order_id}-${index}`}
              className={`rounded-2xl border p-4 shadow-sm ${
                record.issues.length > 0 ? 'border-amber-200 bg-amber-50/60' : 'border-slate-100 bg-white'
              }`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                  第 {record.rowNumber} 行
                </span>
                <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                  {record.platform_source || '未填写平台'}
                </span>
                <span className="text-xs text-slate-400">{record.external_order_id || '未填写外部单号'}</span>
              </div>
              <div className="mt-4 space-y-2 text-sm text-slate-600">
                <p><span className="font-medium text-slate-900">客户：</span>{record.customer_name || '—'}</p>
                <p><span className="font-medium text-slate-900">电话：</span>{record.customer_phone || '—'}</p>
                <p className="line-clamp-2"><span className="font-medium text-slate-900">地址：</span>{record.shipping_address || '—'}</p>
                <p><span className="font-medium text-slate-900">金额：</span><span className="font-semibold text-emerald-600">{formatCurrency(record.total_price)}</span></p>
                <p><span className="font-medium text-slate-900">租期：</span>{formatDateRange(record.start_date, record.end_date)}</p>
                <p><span className="font-medium text-slate-900">免押：</span>{record.deposit_exemption || '—'}</p>
                <p><span className="font-medium text-slate-900">发货：</span>{record.shipping_method || '—'}</p>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {record.issues.length === 0 ? (
                  <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">可导入</span>
                ) : (
                  record.issues.map((issue) => (
                    <span key={issue} className="inline-flex rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-700">
                      {issue}
                    </span>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      </Modal>
    </>
  );
}
