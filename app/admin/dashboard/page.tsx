import { getAdminData } from '../../actions/admin-actions';
import { Boxes, ChartColumn, CircleDollarSign, PackageCheck } from 'lucide-react';
import { EmptyState, MetricCard, PageHeader, SectionHeader, SurfaceCard, TableHead, TableShell, Td, Th, Tr } from '../components/ui';

export const dynamic = 'force-dynamic';

function parseDate(dateString?: string | null) {
  if (!dateString) return null;
  const [year, month, day] = dateString.split('-').map(Number);
  if (!year || !month || !day) return null;
  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toLocalDateKey(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function isSameMonth(date: Date | null, year: number, month: number) {
  return Boolean(date && date.getFullYear() === year && date.getMonth() === month);
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function getDeltaText(current: number, previous: number, suffix = '') {
  if (previous === 0) {
    if (current === 0) return { label: '与上月持平', tone: 'text-slate-400' };
    return { label: `较上月新增 ${current}${suffix}`, tone: 'text-emerald-600' };
  }

  const diff = current - previous;
  if (diff === 0) return { label: '与上月持平', tone: 'text-slate-400' };

  const trend = diff > 0 ? '增长' : '下降';
  const tone = diff > 0 ? 'text-emerald-600' : 'text-amber-600';
  const percent = Math.abs((diff / previous) * 100).toFixed(1);
  return { label: `较上月${trend} ${percent}%`, tone };
}

export default async function DashboardPage() {
  const { equipment, orders } = await getAdminData();

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const previousMonthDate = new Date(currentYear, currentMonth - 1, 1);
  const previousYear = previousMonthDate.getFullYear();
  const previousMonth = previousMonthDate.getMonth();
  const todayKey = toLocalDateKey(now);
  const monthLabel = `${currentYear} 年 ${currentMonth + 1} 月`;

  const monthlyOrders = orders.filter((order) => isSameMonth(parseDate(order.start_date), currentYear, currentMonth));
  const previousMonthOrders = orders.filter((order) => isSameMonth(parseDate(order.start_date), previousYear, previousMonth));

  const monthlyRevenue = monthlyOrders.reduce((sum, order) => sum + Number(order.total_price || 0), 0);
  const previousMonthRevenue = previousMonthOrders.reduce((sum, order) => sum + Number(order.total_price || 0), 0);

  const monthlyOrderCount = monthlyOrders.length;
  const previousMonthOrderCount = previousMonthOrders.length;

  const statusSummary = equipment.reduce(
    (acc, item) => {
      const hasActiveOrder = item.orders.some((order) => {
        const startKey = order.start_date;
        const endKey = order.end_date;
        const isActiveStatus = order.status === 'using' || order.status === 'pending_payment' || order.status === 'confirmed';
        return Boolean(isActiveStatus && startKey && endKey && startKey <= todayKey && endKey >= todayKey);
      });

      if (item.status === 'maintenance') acc.maintenance += 1;
      else if (hasActiveOrder) acc.outbound += 1;
      else acc.idle += 1;
      return acc;
    },
    { idle: 0, outbound: 0, maintenance: 0 }
  );

  const categoryMap = new Map<string, number>();
  for (const item of equipment) {
    const key = item.category?.trim() || '未分类';
    categoryMap.set(key, (categoryMap.get(key) ?? 0) + 1);
  }

  const categoryStats = Array.from(categoryMap.entries())
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count || a.category.localeCompare(b.category));

  const equipmentMap = new Map(equipment.map((item) => [item.id, item]));
  const revenueMap = new Map<string, { equipmentName: string; serialNumber: string; revenue: number; orderCount: number }>();

  for (const order of monthlyOrders) {
    const equipmentId = order.equipment_id ?? 'unassigned';
    const equipmentItem = order.equipment_id ? equipmentMap.get(order.equipment_id) : undefined;
    const current = revenueMap.get(equipmentId) ?? {
      equipmentName: equipmentItem?.name ?? '未知设备',
      serialNumber: equipmentItem?.serial_number ?? '—',
      revenue: 0,
      orderCount: 0,
    };

    current.revenue += Number(order.total_price || 0);
    current.orderCount += 1;
    revenueMap.set(equipmentId, current);
  }

  const revenueRanking = Array.from(revenueMap.entries())
    .map(([equipmentId, value]) => ({ equipmentId, ...value }))
    .sort((a, b) => b.revenue - a.revenue || b.orderCount - a.orderCount || a.equipmentName.localeCompare(b.equipmentName));

  const maxCategoryCount = Math.max(...categoryStats.map((item) => item.count), 1);
  const totalStatus = statusSummary.idle + statusSummary.outbound + statusSummary.maintenance;

  const revenueDelta = getDeltaText(monthlyRevenue, previousMonthRevenue, ' 元');
  const orderDelta = getDeltaText(monthlyOrderCount, previousMonthOrderCount, ' 单');

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Dashboard"
        title="数据看板"
        description={`从全局视角查看 ${monthLabel} 的营业情况、设备状态与单机创收表现。`}
        meta={<div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-medium text-slate-600">统计周期：{monthLabel}</div>}
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={CircleDollarSign} iconClassName="bg-emerald-50 text-emerald-600" label="当月总营业额" value={formatCurrency(monthlyRevenue)} valueClassName="text-emerald-600" hint={<span className={revenueDelta.tone}>{revenueDelta.label}</span>} />
        <MetricCard icon={ChartColumn} iconClassName="bg-blue-50 text-blue-600" label="当月订单总数" value={monthlyOrderCount} hint={<span className={orderDelta.tone}>{orderDelta.label}</span>} />
        <MetricCard icon={PackageCheck} iconClassName="bg-indigo-50 text-indigo-600" label="当前在外租赁机器数" value={statusSummary.outbound} valueClassName="text-blue-600" hint="含待发货 / 已确认 / 使用中设备" />
        <MetricCard icon={Boxes} iconClassName="bg-violet-50 text-violet-600" label="当前在库闲置数" value={statusSummary.idle} valueClassName="text-violet-600" hint="不含维修中设备" />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <SurfaceCard>
          <SectionHeader title="型号库存概览" meta={`共 ${equipment.length} 台`} />
          <div className="mt-6 space-y-5">
            {categoryStats.length === 0 ? (
              <EmptyState>暂无数据</EmptyState>
            ) : (
              categoryStats.map((item) => (
                <div key={item.category} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-slate-700">{item.category}</span>
                    <span className="text-slate-400">{item.count} 台</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-slate-100">
                    <div className="h-1.5 rounded-full bg-indigo-500" style={{ width: `${(item.count / maxCategoryCount) * 100}%` }} />
                  </div>
                </div>
              ))
            )}
          </div>
        </SurfaceCard>

        <SurfaceCard>
          <SectionHeader title="当前状态占比" meta={`总计 ${totalStatus} 台`} />
          <div className="mt-6 space-y-4">
            {totalStatus === 0 ? (
              <EmptyState>暂无数据</EmptyState>
            ) : (
              [
                { label: '正常闲置', count: statusSummary.idle, bar: 'bg-emerald-500', text: 'text-emerald-600' },
                { label: '出租中 / 待发货', count: statusSummary.outbound, bar: 'bg-blue-500', text: 'text-blue-600' },
                { label: '维修中', count: statusSummary.maintenance, bar: 'bg-red-500', text: 'text-red-600' },
              ].map((item) => (
                <div key={item.label} className="rounded-xl border border-slate-100 p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`h-2.5 w-2.5 rounded-full ${item.bar}`} />
                      <span className="text-sm font-medium text-slate-700">{item.label}</span>
                    </div>
                    <span className={`text-xl font-semibold ${item.text}`}>{item.count}</span>
                  </div>
                  <div className="mt-3 h-1.5 rounded-full bg-slate-100">
                    <div className={`h-1.5 rounded-full ${item.bar}`} style={{ width: `${totalStatus === 0 ? 0 : (item.count / totalStatus) * 100}%` }} />
                  </div>
                </div>
              ))
            )}
          </div>
        </SurfaceCard>
      </div>

      <SurfaceCard>
        <SectionHeader title="本月单机创收榜" description="按设备维度统计本月出租次数与累计创收金额。" meta={`${revenueRanking.length} 台上榜`} />
        <TableShell>
          {revenueRanking.length === 0 ? (
            <EmptyState>暂无数据</EmptyState>
          ) : (
            <table className="w-full min-w-[720px] text-sm">
              <TableHead>
                <tr>
                  <Th>排名</Th>
                  <Th>设备名称</Th>
                  <Th>SN号</Th>
                  <Th>本月出租次数</Th>
                  <Th>本月累计创收金额</Th>
                </tr>
              </TableHead>
              <tbody>
                {revenueRanking.map((item, index) => (
                  <Tr key={item.equipmentId}>
                    <Td className="font-semibold text-slate-500">#{index + 1}</Td>
                    <Td className="font-medium text-slate-900">{item.equipmentName}</Td>
                    <Td className="font-mono text-xs text-slate-500">{item.serialNumber}</Td>
                    <Td>{item.orderCount}</Td>
                    <Td className="font-semibold text-emerald-600">{formatCurrency(item.revenue)}</Td>
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
