import { getAdminData } from '../../actions/admin-actions';
import { Boxes, ChartColumn, CircleDollarSign, PackageCheck } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState, StatBadge, TableHead, TableShell, Td, Th, Tr, cn } from '../components/ui';

export const dynamic = 'force-dynamic';

function parseDate(dateString?: string | null) {
  if (!dateString) return null;
  const [year, month, day] = dateString.split('-').map(Number);
  if (!year || !month || !day) return null;
  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? null : date;
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
  const monthLabel = `${currentYear} 年 ${currentMonth + 1} 月`;

  const monthlyOrders = orders.filter(
    (order) => isSameMonth(parseDate(order.start_date), currentYear, currentMonth) || isSameMonth(parseDate(order.created_at), currentYear, currentMonth)
  );
  const previousMonthOrders = orders.filter(
    (order) => isSameMonth(parseDate(order.start_date), previousYear, previousMonth) || isSameMonth(parseDate(order.created_at), previousYear, previousMonth)
  );

  const monthlyRevenue = monthlyOrders.reduce((sum, order) => sum + Number(order.total_price || 0), 0);
  const previousMonthRevenue = previousMonthOrders.reduce((sum, order) => sum + Number(order.total_price || 0), 0);

  const monthlyOrderCount = monthlyOrders.length;
  const previousMonthOrderCount = previousMonthOrders.length;

  // 活跃租赁状态集合：待发货 / 已确认 / 已发货 / 租用中
  const ACTIVE_STATUSES = new Set(['pending_payment', 'confirmed', 'shipped', 'using']);

  // 统计在外租赁机器数 = 有活跃订单关联的不重复 equipment_id 数
  const activeEquipmentIds = new Set<string>();
  for (const order of orders) {
    if (ACTIVE_STATUSES.has(order.status) && order.equipment_id) {
      activeEquipmentIds.add(order.equipment_id);
    }
  }

  // 统计维修中机器数（直接查 equipment.status）
  const maintenanceCount = equipment.filter((item) => item.status === 'maintenance').length;

  // 在外 + 维修中 + 在库 = 总数；闲置 = 总数 - 在外 - 维修中
  const outboundCount = activeEquipmentIds.size;
  const idleCount = equipment.length - outboundCount - maintenanceCount;

  const statusSummary = { idle: Math.max(0, idleCount), outbound: outboundCount, maintenance: maintenanceCount };

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
    <div className="p-6 bg-muted/30 min-h-screen space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-600">Dashboard</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.03em] text-foreground sm:text-4xl">数据看板</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">从全局视角查看 {monthLabel} 的营业情况、设备状态与单机创收表现。</p>
        </div>
        <StatBadge tone="slate">统计周期：{monthLabel}</StatBadge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-border/70 bg-emerald-50 text-emerald-700">
                <CircleDollarSign className="h-4 w-4" />
              </div>
              <p className="text-[12px] font-medium text-muted-foreground">当月总营业额</p>
            </div>
            <p className="mt-4 text-[28px] font-semibold tracking-[-0.04em] text-foreground">{formatCurrency(monthlyRevenue)}</p>
            <p className={cn('mt-1.5 text-[12px] font-medium', revenueDelta.tone)}>{revenueDelta.label}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-border/70 bg-sky-50 text-sky-700">
                <ChartColumn className="h-4 w-4" />
              </div>
              <p className="text-[12px] font-medium text-muted-foreground">当月订单总数</p>
            </div>
            <p className="mt-4 text-[28px] font-semibold tracking-[-0.04em] text-foreground">{monthlyOrderCount}</p>
            <p className={cn('mt-1.5 text-[12px] font-medium', orderDelta.tone)}>{orderDelta.label}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-border/70 bg-slate-100 text-slate-700">
                <PackageCheck className="h-4 w-4" />
              </div>
              <p className="text-[12px] font-medium text-muted-foreground">当前在外租赁</p>
            </div>
            <p className="mt-4 text-[28px] font-semibold tracking-[-0.04em] text-foreground">{statusSummary.outbound}</p>
            <p className="mt-1.5 text-[12px] font-medium text-muted-foreground">含待发货 / 已确认 / 使用中</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-border/70 bg-slate-100 text-slate-700">
                <Boxes className="h-4 w-4" />
              </div>
              <p className="text-[12px] font-medium text-muted-foreground">当前在库闲置</p>
            </div>
            <p className="mt-4 text-[28px] font-semibold tracking-[-0.04em] text-foreground">{statusSummary.idle}</p>
            <p className="mt-1.5 text-[12px] font-medium text-muted-foreground">不含维修中设备</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>型号库存概览</CardTitle>
            <CardDescription>共 {equipment.length} 台</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {categoryStats.length === 0 ? (
              <EmptyState>暂无数据</EmptyState>
            ) : (
              categoryStats.map((item) => (
                <div key={item.category} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-foreground">{item.category}</span>
                    <span className="text-muted-foreground">{item.count} 台</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full bg-foreground/60" style={{ width: `${(item.count / maxCategoryCount) * 100}%` }} />
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>当前状态占比</CardTitle>
            <CardDescription>总计 {totalStatus} 台</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {totalStatus === 0 ? (
              <EmptyState>暂无数据</EmptyState>
            ) : (
              [
                { label: '正常闲置', count: statusSummary.idle, bar: 'bg-emerald-500', text: 'text-foreground' },
                { label: '出租中 / 待发货', count: statusSummary.outbound, bar: 'bg-sky-500', text: 'text-foreground' },
                { label: '维修中', count: statusSummary.maintenance, bar: 'bg-rose-500', text: 'text-foreground' },
              ].map((item) => (
                <div key={item.label} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={cn('h-2.5 w-2.5 rounded-full', item.bar)} />
                      <span className="text-sm font-medium text-foreground">{item.label}</span>
                    </div>
                    <span className={cn('text-xl font-semibold', item.text)}>{item.count}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div className={cn('h-full rounded-full', item.bar)} style={{ width: `${(item.count / totalStatus) * 100}%` }} />
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-3">
          <div className="space-y-1">
            <CardTitle>本月单机创收榜</CardTitle>
            <CardDescription>按设备维度统计本月出租次数与累计创收金额</CardDescription>
          </div>
          <p className="text-sm text-muted-foreground shrink-0">{revenueRanking.length} 台上榜</p>
        </CardHeader>
        <CardContent>
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
                      <Td className="font-semibold text-muted-foreground">#{index + 1}</Td>
                      <Td className="font-medium text-foreground">{item.equipmentName}</Td>
                      <Td className="font-mono text-xs text-muted-foreground">{item.serialNumber}</Td>
                      <Td className="text-muted-foreground">{item.orderCount}</Td>
                      <Td className="font-semibold text-foreground">{formatCurrency(item.revenue)}</Td>
                    </Tr>
                  ))}
                </tbody>
              </table>
            )}
          </TableShell>
        </CardContent>
      </Card>
    </div>
  );
}
