import { getAdminData } from '../../actions/admin-actions';
import type { EquipmentWithOrders } from '../../actions/types';
import { getEffectiveEquipmentStatus } from '../../../lib/equipment-status';
import { AlertTriangle, Boxes, ChartColumn, CircleDollarSign, PackageCheck, Truck } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { StatBadge, cn } from '../components/ui';
import { FlippableStatusChart } from './FlippableStatusChart';
import { MonthlyRevenueLineChart, type MonthlyRevenuePoint } from './MonthlyRevenueLineChart';
import { EquipmentRevenueSeriesChart } from './EquipmentRevenueSeriesChart';
import Link from 'next/link';

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

  // 状态统计：对每台设备做一次 getEffectiveEquipmentStatus，结果唯一（不重复计数）
  //   - 与排期看板共享同一份规则：以今天横切排期表
  //   - 每台设备只能属于 闲置 / 待发货 / 出租中 / 维修中 其一
  const equipmentWithOrders: EquipmentWithOrders[] = (equipment as EquipmentWithOrders[]).map((item) => ({
    ...item,
    orders: orders.filter((order) => order.equipment_id === item.id),
  }));
  const statusSummary = {
    idle: 0,
    pending: 0,
    using: 0,
    overdue: 0,
    maintenance: 0,
  };
  for (const item of equipmentWithOrders) {
    const status = getEffectiveEquipmentStatus(item, now);
    if (status === 'available') statusSummary.idle += 1;
    else if (status === 'pending') statusSummary.pending += 1;
    else if (status === 'rented') statusSummary.using += 1;
    else if (status === 'overdue') statusSummary.overdue += 1;
    else if (status === 'maintenance') statusSummary.maintenance += 1;
  }

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

  // 当年 12 个月营收折线图数据（按 start_date / created_at 落到月份桶）
  // 即使某月为 0 也保留点位（折线在底部仍可见）
  const monthlyRevenueByMonth: MonthlyRevenuePoint[] = (() => {
    const buckets = Array.from({ length: 12 }, () => ({ revenue: 0, orderCount: 0 }));
    for (const order of orders) {
      const startDate = parseDate(order.start_date);
      const createdDate = parseDate(order.created_at);
      // 优先 start_date；都为空时跳过
      const date = startDate ?? createdDate;
      if (!date) continue;
      if (date.getFullYear() !== currentYear) continue;
      const monthIdx = date.getMonth(); // 0..11
      buckets[monthIdx].revenue += Number(order.total_price || 0);
      buckets[monthIdx].orderCount += 1;
    }
    return buckets.map((b, i) => ({ month: i + 1, revenue: b.revenue, orderCount: b.orderCount }));
  })();

  // 柱状图数据：所有设备按 equipment 数组顺序（默认按 name 升序）
  // 即使两月都为 0 也保留设备（在 0 轴上占位，体现"全设备"的完整性）
  // 前端组件负责：≤20 占满卡片，>20 横向滚动
  const previousRevenueMap = new Map<string, number>();
  for (const order of previousMonthOrders) {
    const equipmentId = order.equipment_id;
    if (!equipmentId) continue;
    previousRevenueMap.set(
      equipmentId,
      (previousRevenueMap.get(equipmentId) ?? 0) + Number(order.total_price || 0),
    );
  }
  const inCurrentMonth = (order: { start_date?: string | null; created_at?: string | null }) =>
    isSameMonth(parseDate(order.start_date), currentYear, currentMonth) ||
    isSameMonth(parseDate(order.created_at), currentYear, currentMonth);
  const inPreviousMonth = (order: { start_date?: string | null; created_at?: string | null }) =>
    isSameMonth(parseDate(order.start_date), previousYear, previousMonth) ||
    isSameMonth(parseDate(order.created_at), previousYear, previousMonth);
  const revenueSeries = equipment.map((item) => ({
    equipmentId: item.id,
    name: item.name,
    serialNumber: item.serial_number ?? '—',
    current: revenueMap.get(item.id)?.revenue ?? 0,
    previous: previousRevenueMap.get(item.id) ?? 0,
  }));

  // 翻转面的「所有订单」：当月 + 上月内全部设备的所有订单（不限 20）
  const equipmentNameMap = new Map(equipment.map((e) => [e.id, e.name]));
  const seriesOrders = orders
    .filter((order) => inCurrentMonth(order) || inPreviousMonth(order))
    .map((order) => ({
      id: order.id,
      equipmentId: order.equipment_id ?? null,
      equipmentName: order.equipment_id ? (equipmentNameMap.get(order.equipment_id) ?? null) : null,
      customer_name: order.customer_name ?? null,
      start_date: order.start_date ?? null,
      end_date: order.end_date ?? null,
      status: order.status,
      total_price: Number(order.total_price || 0),
      bucket: inCurrentMonth(order) ? ('current' as const) : ('previous' as const),
    }));

  const totalStatus = statusSummary.idle + statusSummary.pending + statusSummary.using + statusSummary.overdue + statusSummary.maintenance;

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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
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

        <Link href="/admin/orders/pending" className="block">
          <Card className="transition-colors hover:border-sky-300 hover:bg-sky-50/30">
            <CardContent className="pt-5">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-border/70 bg-sky-50 text-sky-700">
                  <Truck className="h-4 w-4" />
                </div>
                <p className="text-[12px] font-medium text-muted-foreground">当前待发货</p>
              </div>
              <p className="mt-4 text-[28px] font-semibold tracking-[-0.04em] text-foreground">{statusSummary.pending}</p>
              <p className="mt-1.5 text-[12px] font-medium text-muted-foreground">含已确认 / 待付款</p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/admin/orders/active" className="block">
          <Card className="transition-colors hover:border-amber-300 hover:bg-amber-50/30">
            <CardContent className="pt-5">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-border/70 bg-amber-50 text-amber-700">
                  <PackageCheck className="h-4 w-4" />
                </div>
                <p className="text-[12px] font-medium text-muted-foreground">当前出租中</p>
              </div>
              <p className="mt-4 text-[28px] font-semibold tracking-[-0.04em] text-foreground">{statusSummary.using}</p>
              <p className="mt-1.5 text-[12px] font-medium text-muted-foreground">已发货正在使用</p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/admin/orders/active" className="block">
          <Card className={cn(
            'transition-colors hover:border-rose-300',
            statusSummary.overdue > 0 ? 'border-rose-200 bg-rose-50/50 hover:bg-rose-50/70' : 'hover:bg-rose-50/30',
          )}>
            <CardContent className="pt-5">
              <div className="flex items-center gap-2.5">
                <div className={cn(
                  'flex h-9 w-9 items-center justify-center rounded-xl border',
                  statusSummary.overdue > 0
                    ? 'border-rose-200 bg-rose-100 text-rose-700'
                    : 'border-border/70 bg-slate-100 text-slate-700',
                )}>
                  <AlertTriangle className="h-4 w-4" />
                </div>
                <p className="text-[12px] font-medium text-muted-foreground">逾期未还</p>
              </div>
              <p className={cn(
                'mt-4 text-[28px] font-semibold tracking-[-0.04em]',
                statusSummary.overdue > 0 ? 'text-rose-700' : 'text-foreground',
              )}>
                {statusSummary.overdue}
              </p>
              <p className="mt-1.5 text-[12px] font-medium text-muted-foreground">已过 end_date 未归还</p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/admin/orders/completed" className="block">
          <Card className="transition-colors hover:border-slate-300 hover:bg-slate-50/50">
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
        </Link>
      </div>

      <div className="grid grid-cols-1 items-stretch lg:grid-cols-2 gap-4">
        <MonthlyRevenueLineChart
          year={currentYear}
          currentMonth={currentMonth + 1}
          points={monthlyRevenueByMonth}
        />

        <FlippableStatusChart
          total={totalStatus}
          counts={{
            idle: statusSummary.idle,
            pending: statusSummary.pending,
            using: statusSummary.using,
            overdue: statusSummary.overdue,
            maintenance: statusSummary.maintenance,
          }}
        />
      </div>

      <EquipmentRevenueSeriesChart
        currentLabel={`${currentYear} 年 ${currentMonth + 1} 月`}
        previousLabel={`${previousYear} 年 ${previousMonth + 1} 月`}
        rows={revenueSeries}
        totalEquipmentCount={equipment.length}
        orders={seriesOrders}
      />
    </div>
  );
}
