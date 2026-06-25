'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeftRight, ChevronLeft, ChevronRight, Package2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { EmptyState, cn } from '../components/ui';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent, type ChartConfig } from '@/components/ui/chart';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { formatCurrency } from './_format';

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export type SeriesRow = {
  equipmentId: string;
  name: string;
  serialNumber: string;
  current: number;
  previous: number;
};

export type OrderSummary = {
  id: string;
  equipmentId: string | null;
  equipmentName: string | null;
  customer_name: string | null;
  start_date: string | null;
  end_date: string | null;
  status: string;
  total_price: number;
  bucket: 'current' | 'previous';
};

export type EquipmentRevenueSeriesChartProps = {
  currentLabel: string;
  previousLabel: string;
  rows: SeriesRow[];                 // 全部设备（按 equipment 顺序）
  totalEquipmentCount: number;       // 总数（用于文案提示）
  orders?: OrderSummary[];           // 当月 + 上月所有订单明细（用于翻转）
};

const CHART_CONFIG: ChartConfig = {
  current:  { label: '当月营收', color: '#10b981' },
  previous: { label: '上月营收', color: '#94a3b8' },
};

const STATUS_LABEL: Record<string, string> = {
  pending_payment: '待付款',
  confirmed: '待发货',
  using: '出租中',
  returned: '已归还',
  completed: '已完成',
  cancelled: '已取消',
  unprocessed: '未处理',
};

// 阈值：<= 该值时图表占满卡片宽度；> 该值时横向滚动
const SCROLL_THRESHOLD = 20;
const SLOT_PX = 56; // 滚动模式下每台占用的最小宽度

function truncateLabel(name: string, max = 8) {
  if (name.length <= max) return name;
  return `${name.slice(0, max - 1)}…`;
}

function formatShortCurrency(value: number) {
  if (value >= 10000) return `${(value / 10000).toFixed(1)}万`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
  return `${value}`;
}

export function EquipmentRevenueSeriesChart({
  currentLabel,
  previousLabel,
  rows,
  totalEquipmentCount,
  orders = [],
}: EquipmentRevenueSeriesChartProps) {
  const [flipped, setFlipped] = useState(false);
  const [drillDown, setDrillDown] = useState<OrderSummary | null>(null);

  const hasData = rows.length > 0;
  const totalCurrent = useMemo(() => rows.reduce((s, r) => s + r.current, 0), [rows]);
  const totalPrevious = useMemo(() => rows.reduce((s, r) => s + r.previous, 0), [rows]);

  const chartData = useMemo(
    () =>
      rows.map((r) => ({
        equipmentId: r.equipmentId,
        name: r.name,
        displayName: truncateLabel(r.name, 8),
        current: r.current,
        previous: r.previous,
      })),
    [rows],
  );

  const maxValue = useMemo(
    () => Math.max(...rows.flatMap((r) => [r.current, r.previous]), 0),
    [rows],
  );

  // ≤ 20 台：图表占满容器（不滚动）
  // > 20 台：图表宽度 = rows.length × SLOT_PX，外层 overflow-x-auto
  const needsScroll = rows.length > SCROLL_THRESHOLD;
  const scrollRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState<number>(0);

  // 减少动画/禁用动画的阈值：数据量超过此值时关闭动画
  const ANIM_THRESHOLD = 60;
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    setReducedMotion(prefersReducedMotion() || rows.length > ANIM_THRESHOLD);
  }, [rows.length]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 0;
      setContainerWidth(w);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const scrollByPage = (direction: 'left' | 'right') => {
    const el = scrollRef.current;
    if (!el) return;
    const delta = el.clientWidth * 0.8;
    el.scrollBy({ left: direction === 'left' ? -delta : delta, behavior: 'smooth' });
  };

  // 翻转面：所有订单（按设备名+开始日期排序）
  const sortedOrders = useMemo(
    () =>
      [...orders].sort((a, b) => {
        if (a.bucket !== b.bucket) {
          return a.bucket === 'current' ? -1 : 1;
        }
        if (a.start_date && b.start_date && a.start_date !== b.start_date) {
          return b.start_date.localeCompare(a.start_date);
        }
        return (a.equipmentName ?? '').localeCompare(b.equipmentName ?? '');
      }),
    [orders],
  );

  const handleBarClick = (data: unknown) => {
    const payload = (data as { payload?: { equipmentId?: string } } | undefined)?.payload;
    const equipmentId = payload?.equipmentId;
    if (!equipmentId) return;
    const order = orders.find((o) => o.equipmentId === equipmentId);
    if (order) setDrillDown(order);
  };

  // 决定 chartContainer 宽度
  const chartStyle: React.CSSProperties = needsScroll
    ? { width: `${rows.length * SLOT_PX}px` }
    : { width: '100%' };

  const initialDimension = needsScroll
    ? { width: rows.length * SLOT_PX, height: 360 }
    : { width: containerWidth || 900, height: 360 };

  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex-row items-start justify-between gap-3">
        <div className="space-y-1">
          <CardTitle>单机营收柱状对比</CardTitle>
          <CardDescription>
            {previousLabel} vs {currentLabel} · 按设备顺序展示（共 {totalEquipmentCount} 台）
            {needsScroll ? ` · 横向可滚动查看全部 ${rows.length} 台` : ''}
          </CardDescription>
        </div>
        <button
          type="button"
          onClick={() => setFlipped((f) => !f)}
          aria-label={flipped ? '查看柱状图' : '查看订单明细'}
          className="inline-flex items-center gap-1.5 rounded-md border border-border/70 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-slate-900"
        >
          <ArrowLeftRight className="h-3.5 w-3.5" />
          {flipped ? '查看柱状图' : '查看明细'}
        </button>
      </CardHeader>

      <CardContent>
        {!hasData ? (
          <EmptyState>当月与上月暂无设备数据</EmptyState>
        ) : (
          <div className="relative min-h-[420px]" style={{ perspective: '1200px' }}>
            <div
              className={cn(
                'relative w-full transition-transform duration-500 [transform-style:preserve-3d]',
                flipped && '[transform:rotateY(180deg)]',
              )}
            >
              {/* FRONT — bar chart */}
              <div
                className="w-full [backface-visibility:hidden]"
                style={{ backfaceVisibility: 'hidden' }}
              >
                <div className="mb-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" />
                    <span className="text-muted-foreground">{currentLabel}合计</span>
                    <span className="font-mono font-semibold text-foreground tabular-nums">{formatCurrency(totalCurrent)}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-sm bg-slate-400" />
                    <span className="text-muted-foreground">{previousLabel}合计</span>
                    <span className="font-mono font-semibold text-foreground tabular-nums">{formatCurrency(totalPrevious)}</span>
                  </div>
                </div>

                <div className="relative">
                  {/* 左右翻页按钮（仅在滚动模式显示） */}
                  {needsScroll && (
                    <>
                      <button
                        type="button"
                        onClick={() => scrollByPage('left')}
                        aria-label="向左滚动"
                        className="absolute left-0 top-1/2 z-10 -translate-y-1/2 inline-flex h-9 w-9 items-center justify-center rounded-full border border-border/70 bg-white/90 text-slate-600 shadow-md backdrop-blur transition hover:bg-white hover:text-slate-900"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => scrollByPage('right')}
                        aria-label="向右滚动"
                        className="absolute right-0 top-1/2 z-10 -translate-y-1/2 inline-flex h-9 w-9 items-center justify-center rounded-full border border-border/70 bg-white/90 text-slate-600 shadow-md backdrop-blur transition hover:bg-white hover:text-slate-900"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </>
                  )}

                  <div
                    ref={scrollRef}
                    className={cn(
                      needsScroll && 'overflow-x-auto overflow-y-hidden',
                      needsScroll && 'pl-10 pr-10', // 给左右按钮留出空间
                    )}
                  >
                    <ChartContainer
                      config={CHART_CONFIG}
                      className="min-h-[360px] w-full"
                      style={chartStyle}
                      initialDimension={initialDimension}
                    >
                      <BarChart
                        data={chartData}
                        margin={{ top: 12, right: 8, left: 8, bottom: 8 }}
                        barCategoryGap={needsScroll ? '20%' : '25%'}
                      >
                        <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis
                          dataKey="displayName"
                          tickLine={false}
                          axisLine={false}
                          tick={{ fontSize: 10, fill: '#64748b' }}
                          interval={0}
                          angle={-35}
                          textAnchor="end"
                          height={64}
                        />
                        <YAxis
                          tickLine={false}
                          axisLine={false}
                          tickFormatter={(v: number) => formatShortCurrency(Number(v))}
                          tick={{ fontSize: 10, fill: '#94a3b8' }}
                          width={48}
                          domain={[0, maxValue * 1.15 || 1]}
                        />
                        <ChartTooltip
                          cursor={{ fill: '#f1f5f9', opacity: 0.6 }}
                          content={
                            <ChartTooltipContent
                              hideIndicator
                              labelFormatter={(_, payload) => {
                                const item = payload?.[0]?.payload as { name?: string } | undefined;
                                return <div className="font-medium text-foreground">{item?.name ?? '—'}</div>;
                              }}
                              formatter={(value, name) => {
                                const num = Number(value);
                                const label = name === 'current' ? currentLabel : previousLabel;
                                return (
                                  <div className="flex flex-1 items-center justify-between gap-3">
                                    <span className="text-muted-foreground">{label}</span>
                                    <span className="font-mono font-medium text-foreground tabular-nums">{formatCurrency(num)}</span>
                                  </div>
                                );
                              }}
                            />
                          }
                        />
                        <ChartLegend
                          content={<ChartLegendContent nameKey="key" />}
                          verticalAlign="top"
                        />
                        <Bar
                          dataKey="previous"
                          name="previous"
                          fill="var(--color-previous)"
                          radius={[3, 3, 0, 0]}
                          cursor="pointer"
                          onClick={handleBarClick}
                          isAnimationActive={!reducedMotion && !needsScroll}
                          animationDuration={1000}
                          animationBegin={0}
                          animationEasing="ease-out"
                        />
                        <Bar
                          dataKey="current"
                          name="current"
                          fill="var(--color-current)"
                          radius={[3, 3, 0, 0]}
                          cursor="pointer"
                          onClick={handleBarClick}
                          isAnimationActive={!reducedMotion && !needsScroll}
                          animationDuration={1000}
                          animationBegin={200}
                          animationEasing="ease-out"
                        />
                      </BarChart>
                    </ChartContainer>
                  </div>
                </div>

                <p className="mt-2 text-center text-[11px] text-muted-foreground">
                  {needsScroll
                    ? `设备超过 ${SCROLL_THRESHOLD} 台，可左右滚动查看 · 点击柱体查看订单 · 「查看明细」翻转查看所有订单`
                    : '点击柱体查看该设备订单 · 点击「查看明细」翻转查看所有订单'}
                </p>
              </div>

              {/* BACK — orders table */}
              <div
                className="absolute inset-0 z-10 [backface-visibility:hidden] [transform:rotateY(180deg)]"
                style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
              >
                <OrderList
                  orders={sortedOrders}
                  currentLabel={currentLabel}
                  previousLabel={previousLabel}
                />
                <p className="mt-3 text-center text-[11px] text-muted-foreground">
                  点击「查看柱状图」返回图表视图
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>

      <Dialog open={!!drillDown} onOpenChange={(open) => !open && setDrillDown(null)}>
        <DialogContent className="max-w-md">
          {drillDown && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Package2 className="h-4 w-4 text-slate-500" />
                  {drillDown.equipmentName ?? '未知设备'}
                </DialogTitle>
                <DialogDescription>
                  客户 {drillDown.customer_name ?? '匿名'} · {STATUS_LABEL[drillDown.status] ?? drillDown.status}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-2 rounded-lg border border-slate-100 bg-slate-50/50 p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">租期</span>
                  <span className="font-mono text-foreground">{drillDown.start_date} ~ {drillDown.end_date}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">金额</span>
                  <span className="font-mono font-semibold text-foreground tabular-nums">{formatCurrency(drillDown.total_price)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">所属月份</span>
                  <span className="text-foreground">{drillDown.bucket === 'current' ? currentLabel : previousLabel}</span>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function OrderList({
  orders,
  currentLabel,
  previousLabel,
}: {
  orders: OrderSummary[];
  currentLabel: string;
  previousLabel: string;
}) {
  const currentOrders = orders.filter((o) => o.bucket === 'current');
  const previousOrders = orders.filter((o) => o.bucket === 'previous');
  const currentTotal = currentOrders.reduce((s, o) => s + o.total_price, 0);
  const previousTotal = previousOrders.reduce((s, o) => s + o.total_price, 0);

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      <OrderColumn
        title={`${currentLabel}（${currentOrders.length} 单）`}
        orders={currentOrders}
        total={currentTotal}
      />
      <OrderColumn
        title={`${previousLabel}（${previousOrders.length} 单）`}
        orders={previousOrders}
        total={previousTotal}
      />
    </div>
  );
}

function OrderColumn({
  title, orders, total,
}: {
  title: string;
  orders: OrderSummary[];
  total: number;
}) {
  return (
    <div className="rounded-lg border border-slate-100">
      <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
        <p className="text-xs font-medium text-muted-foreground">{title}</p>
        <p className="text-xs font-mono font-semibold text-foreground tabular-nums">{formatCurrency(total)}</p>
      </div>
      {orders.length === 0 ? (
        <p className="px-3 py-6 text-center text-xs text-muted-foreground">无订单</p>
      ) : (
        <ul className="max-h-[420px] divide-y divide-slate-100 overflow-y-auto">
          {orders.map((o) => (
            <li key={o.id} className="flex items-center justify-between gap-3 px-3 py-2 text-xs">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-foreground">
                  {o.equipmentName ?? '未知设备'} · {o.customer_name ?? '匿名'}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {o.start_date} ~ {o.end_date} · {STATUS_LABEL[o.status] ?? o.status}
                </p>
              </div>
              <p className="shrink-0 font-mono font-semibold text-foreground tabular-nums">
                {formatCurrency(o.total_price)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
