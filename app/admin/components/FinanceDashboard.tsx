'use client';

import { format } from 'date-fns';
import { utils, writeFile } from 'xlsx';
import { useMemo, useState, useTransition } from 'react';
import { type DateRange } from 'react-day-picker';
import { getFinancialReport, type FinancialReport } from '../../actions/finance-actions';
import { getExportableOrders } from '../../actions/export-actions';
import {
  createExpenseItem,
  deleteExpenseItem,
} from '../../actions/expense-actions';
import {
  EXPENSE_CATEGORIES,
  type ExpenseCategory,
  type ExpenseItem,
} from '../../actions/expense-shared';
import { BarChart3, Download, Plus, Receipt, RefreshCw, Search, Trash2 } from 'lucide-react';
import { EmptyState, FilterPanel, InfoTile, MetricCard, PageHeader, PrimaryButton, SecondaryButton, SectionHeader, StatBadge, SurfaceCard, TableHead, TableShell, Td, Th, Tr, cn } from './ui';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { Input } from '@/components/ui/input';
import { FinanceMonthlyTrendChart, type FinanceMonthlyPoint } from './FinanceMonthlyTrendChart';
import { EquipmentDailyRentChart, type EquipmentDailyRentChartProps } from './EquipmentDailyRentChart';

interface FinanceDashboardProps {
  initialReport: FinancialReport;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatMonthLabel(month: string) {
  const [year, monthNumber] = month.split('-');
  return `${year}年${Number(monthNumber)}月`;
}

const today = new Date();

const currentMonthKey = format(today, 'yyyy-MM');

const CATEGORY_LABEL = new Map(EXPENSE_CATEGORIES.map((c) => [c.value, c.label]));

export default function FinanceDashboard({ initialReport }: FinanceDashboardProps) {
  const [report, setReport] = useState(initialReport);
  const [dateRange, setDateRange] = useState<DateRange | undefined>(
    initialReport.startDate && initialReport.endDate
      ? { from: new Date(initialReport.startDate), to: new Date(initialReport.endDate) }
      : undefined
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const [expenseMonth, setExpenseMonth] = useState<string>(currentMonthKey);
  const [expenseCategory, setExpenseCategory] = useState<ExpenseCategory>('rent');
  const [expenseAmount, setExpenseAmount] = useState<string>('');
  const [expenseNote, setExpenseNote] = useState<string>('');
  const [expenseError, setExpenseError] = useState<string | null>(null);
  const [expensePending, startExpenseTransition] = useTransition();

  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const averageOrderValue = useMemo(() => {
    if (report.totalOrders === 0) return 0;
    return report.totalRevenue / report.totalOrders;
  }, [report.totalOrders, report.totalRevenue]);

  const marginPercent = useMemo(() => {
    if (report.totalRevenue <= 0) return report.netProfit < 0 ? -1 : 0;
    return (report.netProfit / report.totalRevenue) * 100;
  }, [report.totalRevenue, report.netProfit]);

  // 月度折线图数据：升序
  const trendPoints: FinanceMonthlyPoint[] = useMemo(
    () =>
      [...report.monthlySummary]
        .sort((a, b) => a.month.localeCompare(b.month))
        .map((m) => ({
          month: m.month,
          revenue: m.totalRevenue,
          cost: m.totalCost,
          netProfit: m.netProfit,
          orderCount: m.orderCount,
          marginPercent: m.marginPercent,
        })),
    [report.monthlySummary],
  );
  const trendStartMonth = trendPoints[0]?.month ?? report.startDate.slice(0, 7);
  const trendEndMonth = trendPoints[trendPoints.length - 1]?.month ?? report.endDate.slice(0, 7);

  // 设备日租金均值数据
  const equipmentDailyRentData = useMemo(() => {
    return report.equipmentDailyRentTrend ?? [];
  }, [report.equipmentDailyRentTrend]);

  const handleQuery = () => {
    setError(null);
    if (!dateRange?.from || !dateRange?.to) {
      setError('请选择完整的时间范围');
      return;
    }
    if (dateRange.from > dateRange.to) {
      setError('开始日期不能晚于结束日期');
      return;
    }

    startTransition(async () => {
      try {
        const nextReport = await getFinancialReport(
          format(dateRange.from!, 'yyyy-MM-dd'),
          format(dateRange.to!, 'yyyy-MM-dd')
        );
        setReport(nextReport);
      } catch {
        setError('查询失败，请稍后重试');
      }
    });
  };

  const handleReset = () => {
    setError(null);
    const defaultStart = new Date(today.getFullYear(), 0, 1);
    const defaultEnd = new Date(today.getFullYear(), 11, 31);
    setDateRange({ from: defaultStart, to: defaultEnd });

    startTransition(async () => {
      try {
        const nextReport = await getFinancialReport();
        setReport(nextReport);
      } catch {
        setError('重置失败，请稍后重试');
      }
    });
  };

  const handleExport = () => {
    if (!dateRange?.from || !dateRange?.to) {
      setExportError('请先选择时间范围');
      return;
    }
    setExportError(null);
    setExporting(true);
    const startStr = format(dateRange.from, 'yyyy-MM-dd');
    const endStr = format(dateRange.to, 'yyyy-MM-dd');

    void getExportableOrders(startStr, endStr)
      .then((orders) => {
        const rows = orders.map((o) => ({
          订单号: o.id,
          外部订单号: o.external_order_id ?? '',
          创建时间: o.created_at ? format(new Date(o.created_at), 'yyyy-MM-dd HH:mm:ss') : '',
          租赁开始: o.start_date ?? '',
          租赁结束: o.end_date ?? '',
          客户姓名: o.customer_name ?? '',
          客户电话: o.customer_phone ?? '',
          平台来源: o.platform_source ?? '',
          设备名称: o.equipment?.name ?? '',
          设备编号: o.equipment?.serial_number ?? '',
          日租金: o.equipment?.daily_fee ?? 0,
          押金: o.equipment?.deposit ?? 0,
          订单总金额: o.total_price ?? 0,
          已付押金: o.deposit_paid ?? 0,
          订单状态: o.status,
          物流单号: o.tracking_number ?? '',
          收货方式: o.shipping_method ?? '',
          收货地址: o.shipping_address ?? '',
          备注: o.notes ?? '',
        }));

        const worksheet = utils.json_to_sheet(rows);
        worksheet['!cols'] = [
          { wch: 36 }, { wch: 20 }, { wch: 19 }, { wch: 12 }, { wch: 12 },
          { wch: 12 }, { wch: 15 }, { wch: 12 }, { wch: 20 }, { wch: 18 },
          { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 12 },
          { wch: 18 }, { wch: 12 }, { wch: 40 }, { wch: 30 },
        ];
        const workbook = utils.book_new();
        utils.book_append_sheet(workbook, worksheet, '订单明细');
        const filename = `财务报表_${startStr}_至_${endStr}.xlsx`;
        writeFile(workbook, filename);
      })
      .catch((err) => {
        console.error('Export failed:', err);
        setExportError('导出失败，请稍后重试');
      })
      .finally(() => setExporting(false));
  };

  const handleCreateExpense = (e: React.FormEvent) => {
    e.preventDefault();
    setExpenseError(null);
    const amount = Number(expenseAmount);
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(expenseMonth)) {
      setExpenseError('请选择月份');
      return;
    }
    if (!Number.isFinite(amount) || amount < 0) {
      setExpenseError('请输入有效的金额');
      return;
    }

    startExpenseTransition(async () => {
      try {
        await createExpenseItem({
          month: expenseMonth,
          category: expenseCategory,
          amount,
          note: expenseNote.trim() || undefined,
        });
        setExpenseAmount('');
        setExpenseNote('');
        // 刷新报表
        const nextReport = await getFinancialReport(report.startDate, report.endDate);
        setReport(nextReport);
      } catch (err) {
        setExpenseError(err instanceof Error ? err.message : '录入失败，请稍后重试');
      }
    });
  };

  const handleDeleteExpense = (id: string) => {
    startExpenseTransition(async () => {
      try {
        await deleteExpenseItem(id);
        const nextReport = await getFinancialReport(report.startDate, report.endDate);
        setReport(nextReport);
      } catch {
        setExpenseError('删除失败，请稍后重试');
      }
    });
  };

  const expensesInRange = report.expenses;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader eyebrow="Finance Report" title="财务报表" description="按自定义时间范围查看已完成订单收入、月度汇总和回款明细。" />

      <FilterPanel className="xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end">
        <div className="grid gap-4 md:grid-cols-1 xl:min-w-[340px] xl:flex-1">
          <label className="flex flex-col gap-2 text-[13px] font-medium text-slate-600">
            时间范围
            <DateRangePicker
              date={dateRange}
              onDateChange={setDateRange}
              placeholder="请选择时间范围..."
            />
          </label>
        </div>

        <div className="flex flex-wrap gap-3 xl:self-end">
          <PrimaryButton onClick={handleQuery} disabled={isPending}><Search className="h-4 w-4" />{isPending ? '查询中...' : '查询'}</PrimaryButton>
          <SecondaryButton onClick={handleReset} disabled={isPending}><RefreshCw className="h-4 w-4" />重置</SecondaryButton>
          <SecondaryButton onClick={handleExport} disabled={exporting || isPending}>
            <Download className="h-4 w-4" />
            {exporting ? '导出中...' : '导出 Excel'}
          </SecondaryButton>
        </div>

        {error ? <div className="rounded-[20px] border border-rose-200/80 bg-rose-50/80 px-4 py-3 text-sm text-rose-600 md:col-span-2">{error}</div> : null}
        {exportError ? <div className="rounded-[20px] border border-rose-200/80 bg-rose-50/80 px-4 py-3 text-sm text-rose-600 md:col-span-2">{exportError}</div> : null}
      </FilterPanel>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <MetricCard icon={BarChart3} iconClassName="bg-emerald-50/75 text-emerald-700" label="所选期间总营业额" value={formatCurrency(report.totalRevenue)} valueClassName="text-slate-900" />
        <MetricCard icon={BarChart3} iconClassName="bg-sky-50/75 text-sky-700" label="已完成订单总数" value={report.totalOrders} />
        <MetricCard icon={BarChart3} iconClassName="bg-slate-100 text-slate-700" label="客单价" value={formatCurrency(averageOrderValue)} />
        <MetricCard
          icon={Receipt}
          iconClassName="bg-amber-50/75 text-amber-700"
          label="成本合计"
          value={formatCurrency(report.totalCost)}
        />
        <MetricCard
          icon={BarChart3}
          iconClassName={report.netProfit >= 0 ? 'bg-emerald-50/75 text-emerald-700' : 'bg-rose-50/75 text-rose-700'}
          label="净利润"
          value={formatCurrency(report.netProfit)}
          valueClassName={report.netProfit >= 0 ? 'text-emerald-700' : 'text-rose-700'}
          hint={marginPercent === -1 ? '亏损' : `毛利率 ${marginPercent.toFixed(1)}%`}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-1">
        <FinanceMonthlyTrendChart
          points={trendPoints}
          startMonth={trendStartMonth}
          endMonth={trendEndMonth}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-1">
        <EquipmentDailyRentChart
          data={equipmentDailyRentData}
          startMonth={trendStartMonth}
          endMonth={trendEndMonth}
        />
      </div>

      <SurfaceCard>
        <SectionHeader
          title="成本录入"
          description="手动录入运营成本（房租、人员、税费等），按自然月归档，会与订单营收合并计算净利润。"
          meta={`当前区间共 ${expensesInRange.length} 条`}
        />
        <form onSubmit={handleCreateExpense} className="mt-6 grid gap-3 md:grid-cols-12">
          <label className="md:col-span-3 flex flex-col gap-2 text-[13px] font-medium text-slate-600">
            月份
            <Input
              type="month"
              value={expenseMonth}
              onChange={(e) => setExpenseMonth(e.target.value)}
              required
            />
          </label>
          <label className="md:col-span-3 flex flex-col gap-2 text-[13px] font-medium text-slate-600">
            类目
            <select
              value={expenseCategory}
              onChange={(e) => setExpenseCategory(e.target.value as ExpenseCategory)}
              className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-slate-400"
            >
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </label>
          <label className="md:col-span-2 flex flex-col gap-2 text-[13px] font-medium text-slate-600">
            金额
            <Input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={expenseAmount}
              onChange={(e) => setExpenseAmount(e.target.value)}
              placeholder="0.00"
              required
            />
          </label>
          <label className="md:col-span-3 flex flex-col gap-2 text-[13px] font-medium text-slate-600">
            备注
            <Input
              type="text"
              value={expenseNote}
              onChange={(e) => setExpenseNote(e.target.value)}
              placeholder="可选"
            />
          </label>
          <div className="md:col-span-1 flex items-end">
            <PrimaryButton type="submit" disabled={expensePending} className="w-full">
              <Plus className="h-4 w-4" />
              {expensePending ? '录入中' : '录入'}
            </PrimaryButton>
          </div>
          {expenseError ? <div className="md:col-span-12 rounded-[14px] border border-rose-200/80 bg-rose-50/80 px-3 py-2 text-[13px] text-rose-600">{expenseError}</div> : null}
        </form>

        <div className="mt-6">
          <TableShell>
            {expensesInRange.length === 0 ? (
              <EmptyState>当前区间暂无成本记录</EmptyState>
            ) : (
              <table className="w-full min-w-[640px] text-sm">
                <TableHead>
                  <tr>
                    <Th>月份</Th>
                    <Th>类目</Th>
                    <Th className="text-right">金额</Th>
                    <Th>备注</Th>
                    <Th className="w-16">操作</Th>
                  </tr>
                </TableHead>
                <tbody>
                  {expensesInRange.map((e: ExpenseItem) => (
                    <Tr key={e.id}>
                      <Td>{formatMonthLabel(e.month)}</Td>
                      <Td>
                        <StatBadge tone="amber">{CATEGORY_LABEL.get(e.category) ?? e.category}</StatBadge>
                      </Td>
                      <Td className={cn('text-right font-semibold tabular-nums text-amber-700')}>
                        {formatCurrency(e.amount)}
                      </Td>
                      <Td className="text-slate-600">{e.note || '—'}</Td>
                      <Td>
                        <button
                          type="button"
                          onClick={() => handleDeleteExpense(e.id)}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                          aria-label="删除"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </table>
            )}
          </TableShell>
        </div>
      </SurfaceCard>

      <SurfaceCard>
        <SectionHeader title="按月汇总" description="按订单开始时间聚合已完成订单收入与数量。" meta={`${report.monthlySummary.length} 个自然月`} />
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {report.monthlySummary.length === 0 ? (
            <EmptyState>暂无数据</EmptyState>
          ) : (
            report.monthlySummary.map((item) => {
              const isLoss = item.totalRevenue <= 0 && item.totalCost > 0;
              const profitTone = item.netProfit >= 0 ? 'text-emerald-700' : 'text-rose-700';
              const marginTone = item.netProfit >= 0 ? 'text-emerald-700' : 'text-rose-700';
              return (
                <InfoTile key={item.month} className="p-5">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-slate-900">{formatMonthLabel(item.month)}</p>
                    <StatBadge tone="slate">{item.orderCount} 单</StatBadge>
                  </div>
                  <p className="mt-4 text-[26px] font-semibold tracking-[-0.04em] text-slate-900">{formatCurrency(item.totalRevenue)}</p>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-[12px] text-slate-500">
                    <div>
                      <span className="block text-slate-400">成本</span>
                      <span className="font-mono text-slate-700 tabular-nums">{formatCurrency(item.totalCost)}</span>
                    </div>
                    <div>
                      <span className="block text-slate-400">净利润</span>
                      <span className={cn('font-mono font-semibold tabular-nums', profitTone)}>{formatCurrency(item.netProfit)}</span>
                    </div>
                  </div>
                  <p className={cn('mt-2 text-[12px]', marginTone)}>
                    毛利率 {item.marginPercent === -1 ? '亏损' : `${item.marginPercent.toFixed(1)}%`}
                  </p>
                  {isLoss ? <p className="mt-1 text-[11px] text-rose-500">该月仅有成本、无收入</p> : null}
                </InfoTile>
              );
            })
          )}
        </div>
      </SurfaceCard>

      <SurfaceCard>
        <SectionHeader title="流水明细" description="展示所选区间内全部已完成订单的财务入账明细。" meta={`共 ${report.orders.length} 条`} />
        <TableShell>
          {report.orders.length === 0 ? (
            <EmptyState>当前筛选区间暂无已完成订单</EmptyState>
          ) : (
            <table className="w-full min-w-[720px] text-sm">
              <TableHead>
                <tr>
                  <Th>完成时间</Th>
                  <Th>设备名称</Th>
                  <Th>客户姓名</Th>
                  <Th>免押方式</Th>
                  <Th>实收金额</Th>
                </tr>
              </TableHead>
              <tbody>
                {report.orders.map((order) => (
                  <Tr key={order.id}>
                    <Td>{order.end_date || '—'}</Td>
                    <Td className="font-medium text-slate-900">{order.equipment?.name || '未知设备'}</Td>
                    <Td>{order.customer_name || '—'}</Td>
                    <Td>{order.deposit_exemption || '—'}</Td>
                    <Td className="font-semibold text-slate-900">{formatCurrency(Number(order.total_price || 0))}</Td>
                  </Tr>
                ))}
              </tbody>
            </table>
          )}
        </TableShell>
      </SurfaceCard>
    </div>
  );
}
