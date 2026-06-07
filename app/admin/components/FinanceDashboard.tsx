'use client';

import { useMemo, useState, useTransition } from 'react';
import { getFinancialReport, type FinancialReport } from '../../actions/finance-actions';
import { BarChart3, Calendar, RefreshCw, Search } from 'lucide-react';
import { EmptyState, FilterPanel, InfoTile, MetricCard, PageHeader, PrimaryButton, SecondaryButton, SectionHeader, StatBadge, SurfaceCard, TableHead, TableShell, Td, TextInput, Th, Tr } from './ui';

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
const defaultYearRange = {
  startDate: `${today.getFullYear()}-01-01`,
  endDate: `${today.getFullYear()}-12-31`,
};

export default function FinanceDashboard({ initialReport }: FinanceDashboardProps) {
  const [report, setReport] = useState(initialReport);
  const [startDate, setStartDate] = useState(initialReport.startDate);
  const [endDate, setEndDate] = useState(initialReport.endDate);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const averageOrderValue = useMemo(() => {
    if (report.totalOrders === 0) return 0;
    return report.totalRevenue / report.totalOrders;
  }, [report.totalOrders, report.totalRevenue]);

  const handleQuery = () => {
    setError(null);
    if (!startDate || !endDate) {
      setError('请选择开始日期和结束日期');
      return;
    }
    if (startDate > endDate) {
      setError('开始日期不能晚于结束日期');
      return;
    }

    startTransition(async () => {
      try {
        const nextReport = await getFinancialReport(startDate, endDate);
        setReport(nextReport);
      } catch {
        setError('查询失败，请稍后重试');
      }
    });
  };

  const handleReset = () => {
    setError(null);
    setStartDate(defaultYearRange.startDate);
    setEndDate(defaultYearRange.endDate);

    startTransition(async () => {
      try {
        const nextReport = await getFinancialReport();
        setReport(nextReport);
      } catch {
        setError('重置失败，请稍后重试');
      }
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader eyebrow="Finance Report" title="财务报表" description="按自定义时间范围查看已完成订单收入、月度汇总和回款明细。" />

      <FilterPanel className="xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end">
        <div className="grid gap-4 md:grid-cols-2 xl:min-w-[420px] xl:flex-1">
          <label className="flex flex-col gap-2 text-[13px] font-medium text-slate-600">
            开始日期
            <div className="relative">
              <Calendar className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <TextInput type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="py-3 pl-10 pr-4" />
            </div>
          </label>
          <label className="flex flex-col gap-2 text-[13px] font-medium text-slate-600">
            结束日期
            <div className="relative">
              <Calendar className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <TextInput type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="py-3 pl-10 pr-4" />
            </div>
          </label>
        </div>

        <div className="flex flex-wrap gap-3 xl:self-end">
          <PrimaryButton onClick={handleQuery} disabled={isPending}><Search className="h-4 w-4" />{isPending ? '查询中...' : '查询'}</PrimaryButton>
          <SecondaryButton onClick={handleReset} disabled={isPending}><RefreshCw className="h-4 w-4" />重置</SecondaryButton>
        </div>

        {error ? <div className="rounded-[20px] border border-rose-200/80 bg-rose-50/80 px-4 py-3 text-sm text-rose-600 md:col-span-2">{error}</div> : null}
      </FilterPanel>

      <div className="grid gap-4 lg:grid-cols-3">
        <MetricCard icon={BarChart3} iconClassName="bg-emerald-50/75 text-emerald-700" label="所选期间总营业额" value={formatCurrency(report.totalRevenue)} valueClassName="text-slate-900" />
        <MetricCard icon={BarChart3} iconClassName="bg-sky-50/75 text-sky-700" label="已完成订单总数" value={report.totalOrders} />
        <MetricCard icon={BarChart3} iconClassName="bg-slate-100 text-slate-700" label="客单价" value={formatCurrency(averageOrderValue)} />
      </div>

      <SurfaceCard>
        <SectionHeader title="按月汇总" description="按订单开始时间聚合已完成订单收入与数量。" meta={`${report.monthlySummary.length} 个自然月`} />
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {report.monthlySummary.length === 0 ? (
            <EmptyState>暂无数据</EmptyState>
          ) : (
            report.monthlySummary.map((item) => (
              <InfoTile key={item.month} className="p-5">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-900">{formatMonthLabel(item.month)}</p>
                  <StatBadge tone="slate">{item.orderCount} 单</StatBadge>
                </div>
                <p className="mt-4 text-[26px] font-semibold tracking-[-0.04em] text-slate-900">{formatCurrency(item.totalRevenue)}</p>
              </InfoTile>
            ))
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
