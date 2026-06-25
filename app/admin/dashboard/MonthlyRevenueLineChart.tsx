'use client';

import { useMemo, useState } from 'react';
import { TrendingUp } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '../components/ui';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts';
import { formatCurrency } from './_format';

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export type MonthlyRevenuePoint = {
  /** 1..12 月份编号（按自然年） */
  month: number;
  /** 0 时也保留点位（折线在底部仍可见） */
  revenue: number;
  /** 该月订单数（用于 tooltip） */
  orderCount: number;
};

export type MonthlyRevenueLineChartProps = {
  year: number;
  /** 当前月份（1-12）；折线只画到这一月，后续月份不显示 */
  currentMonth: number;
  points: MonthlyRevenuePoint[]; // 期望长度 12
};

const CHART_CONFIG: ChartConfig = {
  revenue: { label: '月度营收', color: '#10b981' },
};

const MONTH_LABELS = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];

function formatShortCurrency(value: number) {
  if (value >= 10000) return `${(value / 10000).toFixed(1)}万`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
  return `${value}`;
}

export function MonthlyRevenueLineChart({ year, currentMonth, points }: MonthlyRevenueLineChartProps) {
  const [reducedMotion, setReducedMotion] = useState(prefersReducedMotion());

  if (typeof window !== 'undefined') {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (!reducedMotion && mq.matches) setReducedMotion(true);
  }

  // 只画到当前月（currentMonth，1-12）；未到的月份不画
  const endMonth = Math.min(Math.max(currentMonth, 1), 12);

  const chartData = useMemo(() => {
    const byMonth = new Map(points.map((p) => [p.month, p]));
    return Array.from({ length: endMonth }, (_, i) => {
      const month = i + 1;
      const p = byMonth.get(month);
      return {
        month,
        label: MONTH_LABELS[i],
        revenue: p?.revenue ?? 0,
        orderCount: p?.orderCount ?? 0,
      };
    });
  }, [points, endMonth]);

  const hasAnyRevenue = chartData.some((d) => d.revenue > 0);

  const { yearTotal, peakMonth, peakRevenue } = useMemo(() => {
    let total = 0;
    let peak = 1;
    let peakValue = -Infinity;
    for (const d of chartData) {
      total += d.revenue;
      if (d.revenue > peakValue) {
        peakValue = d.revenue;
        peak = d.month;
      }
    }
    return { yearTotal: total, peakMonth: peak, peakRevenue: peakValue < 0 ? 0 : peakValue };
  }, [chartData]);

  // 用 max 的 1.15 给最高点留 headroom；全 0 时 domain = [0, 1] 防止崩
  const yMax = Math.max(peakRevenue, 1);

  // 固定 Y 轴刻度数量 = 5（均匀 5 等分：0/25%/50%/75%/100%）
  // 不论数据大小，每段视觉距离都一致；
  // 当 1k 时 25% 高，10k 时 100% 满，但刻度间距永远相同
  const Y_TICK_COUNT = 5;
  const ticks = Array.from({ length: Y_TICK_COUNT + 1 }, (_, i) =>
    Math.round((yMax * 1.15 * i) / Y_TICK_COUNT),
  );

  return (
    <Card className="flex h-full min-h-[420px] flex-col overflow-hidden">
      <CardHeader className="flex-row items-start justify-between gap-3">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-emerald-600" />
            {year} 年度营收趋势
          </CardTitle>
          <CardDescription>
            每月总营业额折线 · 截至 {MONTH_LABELS[endMonth - 1]}
          </CardDescription>
        </div>
        {/* 汇总指标 */}
        <div className="text-right">
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">年度合计</p>
          <p className="mt-0.5 font-mono text-base font-semibold tabular-nums text-foreground">
            {formatCurrency(yearTotal)}
          </p>
          {hasAnyRevenue && (
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              峰值 {MONTH_LABELS[peakMonth - 1]} · {formatCurrency(peakRevenue)}
            </p>
          )}
        </div>
      </CardHeader>

<CardContent className="flex-1">
        {!hasAnyRevenue ? (
          <EmptyState>{year} 年暂无营收数据</EmptyState>
        ) : (
          <ChartContainer
            config={CHART_CONFIG}
            className="h-[260px] w-full"
            initialDimension={{ width: 720, height: 260 }}
          >
              <LineChart
                data={chartData}
                margin={{ top: 12, right: 16, left: 8, bottom: 8 }}
              >
                <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  interval={0}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v: number) => formatShortCurrency(Number(v))}
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  width={48}
                  domain={[0, yMax * 1.15]}
                  ticks={ticks}
                  allowDecimals={false}
                />
                <ChartTooltip
                  cursor={{ stroke: '#cbd5e1', strokeWidth: 1, strokeDasharray: '4 3' }}
                  content={
                    <ChartTooltipContent
                      hideIndicator
                      labelFormatter={(_, payload) => {
                        const item = payload?.[0]?.payload as { label?: string; month?: number } | undefined;
                        return (
                          <div className="font-medium text-foreground">
                            {item?.month ? `${year} 年 ${item.month} 月` : '—'}
                          </div>
                        );
                      }}
                      formatter={(value, _name, item) => {
                        const num = Number(value);
                        const orderCount = (item?.payload as { orderCount?: number } | undefined)?.orderCount ?? 0;
                        return (
                          <div className="space-y-0.5">
                            <div className="flex flex-1 items-center justify-between gap-3">
                              <span className="text-muted-foreground">营收</span>
                              <span className="font-mono font-medium text-foreground tabular-nums">
                                {formatCurrency(num)}
                              </span>
                            </div>
                            <div className="flex flex-1 items-center justify-between gap-3">
                              <span className="text-muted-foreground">订单数</span>
                              <span className="font-mono font-medium text-foreground tabular-nums">
                                {orderCount}
                              </span>
                            </div>
                          </div>
                        );
                      }}
                    />
                  }
                />
                <Line
                  type="monotone"
                  dataKey="revenue"
                  stroke="var(--color-revenue)"
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: '#10b981', strokeWidth: 2, stroke: '#fff' }}
                  activeDot={{ r: 6, strokeWidth: 2, stroke: '#fff' }}
                  isAnimationActive={!reducedMotion}
                  animationDuration={1200}
                  animationBegin={0}
                  animationEasing="ease-out"
                />
</LineChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
