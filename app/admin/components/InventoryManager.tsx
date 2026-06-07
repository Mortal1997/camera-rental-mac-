'use client';

import { useRef, useState, useTransition } from 'react';
import { bulkCreateEquipment, createEquipment, deleteEquipment, updateEquipmentStatus } from '../../actions/admin-actions';
import type { Equipment } from '../../actions/types';
import { read, utils, writeFileXLSX } from 'xlsx';
import { Boxes, Download, FileSpreadsheet, Plus, Trash2, Upload, Wrench } from 'lucide-react';
import { DangerButton, EmptyState, FormField, Modal, PrimaryButton, SecondaryButton, SectionHeader, StatBadge, SurfaceCard, TableHead, TableShell, Td, TextInput, Th, Tr } from './ui';

interface InventoryManagerProps {
  equipment: Equipment[];
}

const statusConfig: Record<string, { label: string; tone: 'emerald' | 'red' | 'blue' }> = {
  available: { label: '正常', tone: 'emerald' },
  maintenance: { label: '维修中', tone: 'red' },
  rented: { label: '已租出', tone: 'blue' },
};

const initialForm = {
  name: '',
  category: '',
  serial_number: '',
  daily_fee: '',
  deposit: '',
  warranty_expire_date: '',
};

const equipmentTemplateRows = [
  {
    设备名称: 'Canon EOS R5',
    '型号/分类': '全画幅微单',
    SN号: 'R5-2026-001',
    日租金: 399,
    押金: 5000,
    质保到期日: '2027-12-31',
  },
];

type FormErrors = Partial<Record<keyof typeof initialForm, string>>;

type EquipmentImportRecord = {
  rowNumber: number;
  name: string;
  category: string;
  serial_number: string;
  daily_fee: number;
  deposit: number;
  warranty_expire_date: string | null;
  issues: string[];
};

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

function buildEquipmentImportRecord(row: Record<string, unknown>, index: number): EquipmentImportRecord {
  const name = normalizeText(row['设备名称']);
  const dailyFeeRaw = row['日租金'];
  const depositRaw = row['押金'];
  const daily_fee = normalizeNumber(dailyFeeRaw);
  const deposit = normalizeNumber(depositRaw);
  const warranty_expire_date = normalizeDate(row['质保到期日']);
  const issues: string[] = [];

  if (!name) issues.push('缺少设备名称');
  if (normalizeText(dailyFeeRaw) === '' || daily_fee < 0) issues.push('日租金无效');
  if (normalizeText(depositRaw) === '' || deposit < 0) issues.push('押金无效');
  if (normalizeText(row['质保到期日']) && !warranty_expire_date) issues.push('质保到期日格式无效');

  return {
    rowNumber: index + 2,
    name,
    category: normalizeText(row['型号/分类']),
    serial_number: normalizeText(row['SN号']),
    daily_fee,
    deposit,
    warranty_expire_date,
    issues,
  };
}

export default function InventoryManager({ equipment }: InventoryManagerProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formValues, setFormValues] = useState(initialForm);
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [previewRecords, setPreviewRecords] = useState<EquipmentImportRecord[]>([]);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const validPreviewRecords = previewRecords.filter((record) => record.issues.length === 0);
  const invalidPreviewRecords = previewRecords.filter((record) => record.issues.length > 0);

  const closeModal = () => {
    setIsModalOpen(false);
    setFormErrors({});
    setServerError(null);
    setFormValues(initialForm);
  };

  const closePreviewModal = () => {
    setIsPreviewOpen(false);
    setPreviewError(null);
    setPreviewRecords([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const downloadTemplate = () => {
    const worksheet = utils.json_to_sheet(equipmentTemplateRows);
    const workbook = utils.book_new();
    utils.book_append_sheet(workbook, worksheet, '设备导入模板');
    writeFileXLSX(workbook, '设备批量导入模板.xlsx');
  };

  const validateForm = (): boolean => {
    const errors: FormErrors = {};
    if (!formValues.name.trim()) errors.name = '请输入设备名称';
    if (!formValues.daily_fee.trim()) {
      errors.daily_fee = '请输入日租金';
    } else if (Number(formValues.daily_fee) < 0) {
      errors.daily_fee = '日租金不能为负数';
    }
    if (!formValues.deposit.trim()) {
      errors.deposit = '请输入押金';
    } else if (Number(formValues.deposit) < 0) {
      errors.deposit = '押金不能为负数';
    }
    if (formValues.warranty_expire_date) {
      const today = new Date().toISOString().slice(0, 10);
      if (formValues.warranty_expire_date < today) {
        errors.warranty_expire_date = '质保到期日不能早于今天';
      }
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCreate = () => {
    setServerError(null);
    if (!validateForm()) return;
    startTransition(async () => {
      const formData = new FormData();
      formData.set('name', formValues.name.trim());
      formData.set('category', formValues.category.trim());
      formData.set('serial_number', formValues.serial_number.trim());
      formData.set('daily_fee', formValues.daily_fee.trim());
      formData.set('deposit', formValues.deposit.trim());
      formData.set('warranty_expire_date', formValues.warranty_expire_date.trim());

      const result = await createEquipment(formData);
      if (!result.success) {
        setServerError(result.error ?? '创建失败');
        return;
      }
      setSuccessMsg('设备创建成功');
      setTimeout(() => setSuccessMsg(null), 3000);
      closeModal();
    });
  };

  const handleToggleStatus = (eq: Equipment) => {
    startTransition(async () => {
      const nextStatus = eq.status === 'available' ? 'maintenance' : 'available';
      const result = await updateEquipmentStatus(eq.id, nextStatus);
      if (result.success) {
        setSuccessMsg(`「${eq.name}」已标记为${nextStatus === 'maintenance' ? '维修中' : '正常'}`);
        setTimeout(() => setSuccessMsg(null), 3000);
      }
    });
  };

  const handleDelete = (eq: Equipment) => {
    if (!confirm(`确定要删除设备「${eq.name}」吗？此操作不可撤销。`)) return;
    startTransition(async () => {
      const result = await deleteEquipment(eq.id);
      if (result.success) {
        setSuccessMsg(`「${eq.name}」已删除`);
        setTimeout(() => setSuccessMsg(null), 3000);
      }
    });
  };

  const handleExcelSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setPreviewError(null);

    try {
      const buffer = await file.arrayBuffer();
      const workbook = read(buffer, { type: 'array', cellDates: true });
      const firstSheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[firstSheetName];
      const rows = utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
      const records = rows.map((row, index) => buildEquipmentImportRecord(row, index));
      const hasContent = records.some((record) =>
        [record.name, record.category, record.serial_number, String(record.daily_fee), String(record.deposit), record.warranty_expire_date ?? '']
          .some((value) => value && value !== '0')
      );

      if (!hasContent) {
        setPreviewError('未解析到有效设备数据，请检查 Excel 表头与内容。');
        return;
      }

      setPreviewRecords(records);
      setIsPreviewOpen(true);
    } catch {
      setPreviewError('Excel 解析失败，请确认文件格式正确。');
    }
  };

  const handleBulkImport = () => {
    if (validPreviewRecords.length === 0) return;

    setPreviewError(null);
    startTransition(async () => {
      const payload = validPreviewRecords.map(({ ...record }) => record);
      const result = await bulkCreateEquipment(payload);
      if (!result.success) {
        setPreviewError(result.error ?? '批量导入失败');
        return;
      }

      setSuccessMsg(`已成功导入 ${validPreviewRecords.length} 台设备`);
      setTimeout(() => setSuccessMsg(null), 3000);
      closePreviewModal();
    });
  };

  return (
    <>
      {successMsg && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-[24px] border border-emerald-200/75 bg-white/90 px-5 py-3.5 text-sm font-medium text-slate-700 shadow-[0_18px_48px_rgba(15,23,42,0.10)] backdrop-blur-xl">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-400/85 text-white">
            <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" className="h-3 w-3">
              <polyline points="2,6 5,9 10,3" />
            </svg>
          </span>
          {successMsg}
        </div>
      )}

      <SurfaceCard className="p-0">
        <div className="border-b border-slate-100 px-4 py-4 sm:px-6 sm:py-5">
          <SectionHeader
            title="设备列表"
            description="管理设备资产与状态。"
            meta={
              <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
                <StatBadge tone="slate">{equipment.length} 台</StatBadge>
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
                  <Plus className="h-4 w-4" />创建库存
                </PrimaryButton>
              </div>
            }
          />
          {previewError ? (
            <div className="mt-4 rounded-[20px] border border-rose-200/80 bg-rose-50/80 px-4 py-3 text-sm text-rose-600">{previewError}</div>
          ) : null}
        </div>

        <div className="px-4 pb-4 pt-4 sm:px-6 sm:pb-6">
          <TableShell>
            {equipment.length === 0 ? (
              <EmptyState>暂无设备，请点击右上角「+ 创建库存」添加</EmptyState>
            ) : (
              <table className="w-full min-w-[820px] text-sm">
                <TableHead>
                  <tr>
                    <Th>设备名称</Th>
                    <Th>型号 / 分类</Th>
                    <Th>SN号</Th>
                    <Th>日租金</Th>
                    <Th>押金</Th>
                    <Th>状态</Th>
                    <Th>质保到期</Th>
                    <Th>操作</Th>
                  </tr>
                </TableHead>
                <tbody>
                  {equipment.map((eq) => {
                    const cfg = statusConfig[eq.status] ?? statusConfig.available;
                    return (
                      <Tr key={eq.id}>
                        <Td className="font-medium text-slate-900">{eq.name}</Td>
                        <Td>{eq.category || '—'}</Td>
                        <Td className="font-mono text-xs text-slate-500">{eq.serial_number || '—'}</Td>
                        <Td className="font-semibold text-slate-900">¥{Number(eq.daily_fee).toFixed(2)}</Td>
                        <Td className="font-semibold text-slate-900">¥{Number(eq.deposit).toFixed(2)}</Td>
                        <Td>
                          <StatBadge tone={cfg.tone} dot>{cfg.label}</StatBadge>
                        </Td>
                        <Td>{eq.warranty_expire_date || '—'}</Td>
                        <Td>
                          <div className="flex items-center gap-2">
                            <SecondaryButton onClick={() => handleToggleStatus(eq)} disabled={isPending} className="text-xs !py-1.5">
                              <Wrench className="h-3 w-3" />{eq.status === 'available' ? '报修' : '恢复'}
                            </SecondaryButton>
                            <DangerButton onClick={() => handleDelete(eq)} disabled={isPending} className="text-xs !py-1.5">
                              <Trash2 className="h-3 w-3" />删除
                            </DangerButton>
                          </div>
                        </Td>
                      </Tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </TableShell>
        </div>
      </SurfaceCard>

      <Modal
        open={isModalOpen}
        onClose={closeModal}
        eyebrow="Inventory"
        icon={Boxes}
        title="创建库存"
        footer={
          <div className="flex flex-wrap justify-end gap-3">
            {serverError && (
              <div className="w-full rounded-[20px] border border-rose-200/80 bg-rose-50/80 px-4 py-3 text-sm text-rose-600">{serverError}</div>
            )}
            <SecondaryButton onClick={closeModal} disabled={isPending}>取消</SecondaryButton>
            <PrimaryButton onClick={handleCreate} disabled={isPending}>{isPending ? '创建中...' : '确认创建'}</PrimaryButton>
          </div>
        }
      >
        <div className="grid gap-5 md:grid-cols-2">
          <FormField label="设备名称" error={formErrors.name}>
            <TextInput
              type="text"
              placeholder="如：Canon EOS R5"
              value={formValues.name}
              onChange={(e) => setFormValues((p) => ({ ...p, name: e.target.value }))}
            />
          </FormField>

          <FormField label="型号 / 分类" error={formErrors.category}>
            <TextInput
              type="text"
              placeholder="如：全画幅微单"
              value={formValues.category}
              onChange={(e) => setFormValues((p) => ({ ...p, category: e.target.value }))}
            />
          </FormField>

          <FormField label="SN号" error={formErrors.serial_number}>
            <TextInput
              type="text"
              placeholder="机身序列号"
              value={formValues.serial_number}
              onChange={(e) => setFormValues((p) => ({ ...p, serial_number: e.target.value }))}
            />
          </FormField>

          <FormField label="日租金 (元)" error={formErrors.daily_fee}>
            <TextInput
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={formValues.daily_fee}
              onChange={(e) => setFormValues((p) => ({ ...p, daily_fee: e.target.value }))}
            />
          </FormField>

          <FormField label="押金 (元)" error={formErrors.deposit}>
            <TextInput
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={formValues.deposit}
              onChange={(e) => setFormValues((p) => ({ ...p, deposit: e.target.value }))}
            />
          </FormField>

          <FormField label="质保到期日" error={formErrors.warranty_expire_date}>
            <TextInput
              type="date"
              value={formValues.warranty_expire_date}
              onChange={(e) => setFormValues((p) => ({ ...p, warranty_expire_date: e.target.value }))}
            />
          </FormField>
        </div>
      </Modal>

      <Modal
        open={isPreviewOpen}
        onClose={closePreviewModal}
        eyebrow="Excel Import"
        icon={Upload}
        title="确认导入设备数据"
        maxWidthClassName="max-w-6xl"
        footer={
          <div className="flex flex-wrap justify-end gap-3">
            {previewError ? (
              <div className="w-full rounded-[20px] border border-rose-200/80 bg-rose-50/80 px-4 py-3 text-sm text-rose-600">{previewError}</div>
            ) : null}
            <SecondaryButton onClick={closePreviewModal} disabled={isPending}>取消</SecondaryButton>
            <PrimaryButton onClick={handleBulkImport} disabled={isPending || validPreviewRecords.length === 0}>
              {isPending ? '导入中...' : `仅导入有效数据 (${validPreviewRecords.length})`}
            </PrimaryButton>
          </div>
        }
      >
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-[22px] border border-slate-200/70 bg-white/76 p-4">
            <p className="text-sm text-slate-500">总记录</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{previewRecords.length}</p>
          </div>
          <div className="rounded-[22px] border border-emerald-200/70 bg-emerald-50/72 p-4">
            <p className="text-sm text-emerald-700">有效记录</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{validPreviewRecords.length}</p>
          </div>
          <div className="rounded-[22px] border border-amber-200/70 bg-amber-50/72 p-4">
            <p className="text-sm text-amber-700">无效记录</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{invalidPreviewRecords.length}</p>
          </div>
        </div>

        {invalidPreviewRecords.length > 0 ? (
          <div className="mt-4 rounded-[20px] border border-amber-200/80 bg-amber-50/80 px-4 py-3 text-sm text-amber-700">
            检测到 {invalidPreviewRecords.length} 条无效数据，提交时将自动跳过，仅导入有效行。
          </div>
        ) : null}

        <TableShell>
          <table className="w-full min-w-[980px] text-sm">
            <TableHead>
              <tr>
                <Th>Excel 行</Th>
                <Th>设备名称</Th>
                <Th>型号 / 分类</Th>
                <Th>SN号</Th>
                <Th>日租金</Th>
                <Th>押金</Th>
                <Th>质保到期</Th>
                <Th>校验结果</Th>
              </tr>
            </TableHead>
            <tbody>
              {previewRecords.map((record) => (
                <Tr key={`${record.rowNumber}-${record.name}-${record.serial_number}`} className={record.issues.length > 0 ? 'bg-amber-50/38 hover:!bg-amber-50/55' : ''}>
                  <Td>第 {record.rowNumber} 行</Td>
                  <Td className="font-medium text-slate-900">{record.name || '—'}</Td>
                  <Td>{record.category || '—'}</Td>
                  <Td className="font-mono text-xs text-slate-500">{record.serial_number || '—'}</Td>
                  <Td className="font-semibold text-slate-900">¥{record.daily_fee.toFixed(2)}</Td>
                  <Td className="font-semibold text-slate-900">¥{record.deposit.toFixed(2)}</Td>
                  <Td>{record.warranty_expire_date || '—'}</Td>
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
    </>
  );
}
