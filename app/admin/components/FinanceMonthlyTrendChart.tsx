'use client';

import { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import { CartesianGrid, Legend, Line, LineChart, XAxis, YAxis } from 'recharts';
import { EmptyState } from '../components/ui';

export type FinanceMonthlyPoint = {
  /** 'YYYY-MM' */
  month: string;
  /** 该月营收 */
  revenue: number;
  /** 该月手动成本合计 */
  cost: number;
  /** 净利润 = revenue - cost */
  netProfit: number;
  /** 该月已完结订单数 */
  orderCount: number;
  /** 毛利率 0..100，亏损时为 -1 */
  marginPercent: number;
};

export type FinanceMonthlyTrendChartProps = {
  /** 报表区间所跨自然月，期望按月份升序 */
  points: FinanceMonthlyPoint[];
  /** 区间内首月与末月（YYYY-MM），用于标题 */
  startMonth: string;
  endMonth: string;
};

const CHART_CONFIG: ChartConfig = {
  revenue: { label: '营收', color: '#10b981' },
  cost: { label: '成本', color: '#f59e0b' },
  netProfit: { label: '净利润', color: '#3b82f6' },
  orderCount: { label: '订单数', color: '#8b5cf6' },
  marginPercent: { label: '毛利率', color: '#ef4444' },
};

function formatAxisCurrency(v: number) {
  const n = Number(v);
  if (!Number.isFinite(n)) return '0';
  if (Math.abs(n) >= 10000) return `${(n / 10000).toFixed(1)}万`;
  if (Math.abs(n) >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return `${Math.round(n)}`;
}

function formatPointCurrency(v: number) {
  return `¥${Math.round(v).toLocaleString('zh-CN')}`;
}

export function FinanceMonthlyTrendChart({ points, startMonth, endMonth }: FinanceMonthlyTrendChartProps) {
  const data = useMemo(
    () =>
      points.map((p) => ({
        ...p,
        label: p.month,
      })),
    [points],
  );

  // 计算左轴（金额）域：营收/成本/净利润的最大值
  const yLeftMax = useMemo(() => {
    const m = Math.max(0, ...points.map((p) => Math.max(p.revenue, p.cost, p.netProfit)));
    if (m <= 0) return 1;
    return Math.ceil(m * 1.15);
  }, [points]);

  // 左轴 5 等分刻度
  const yLeftTicks = useMemo(() => {
    const count = 5;
    return Array.from({ length: count + 1 }, (_, i) => Math.round((yLeftMax * i) / count));
  }, [yLeftMax]);

  // 计算右轴（订单数 / 毛利率）域：取订单数与 100 中的较大者，保证毛利率 0..100% 完整可见
  const yRightMax = useMemo(() => {
    const maxOrders = Math.max(0, ...points.map((p) => p.orderCount));
    return Math.max(maxOrders, 100);
  }, [points]);

  const yRightTicks = useMemo(() => {
    const count = 5;
    return Array.from({ length: count + 1 }, (_, i) => Math.round((yRightMax * i) / count));
  }, [yRightMax]);

  const hasData = points.length > 0 && points.some(
    (p) => p.revenue > 0 || p.cost > 0 || p.netProfit !== 0 || p.orderCount > 0,
  );

  return (
    <Card className="flex h-full min-h-[440px] flex-col overflow-hidden">
      <CardHeader>
        <CardTitle>月度财务趋势</CardTitle>
        <CardDescription>
          5 项核心指标月度折线对比 · {startMonth} 至 {endMonth}
        </CardDescription>
      </CardHeader>

      <CardContent className="flex-1">
        {!hasData ? (
          <EmptyState>所选区间暂无数据</EmptyState>
        ) : (
          <ChartContainer
            config={CHART_CONFIG}
            className="h-[320px] w-full"
            initialDimension={{ width: 720, height: 320 }}
          >
            <LineChart
              data={data}
              margin={{ top: 12, right: 24, left: 8, bottom: 8 }}
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
                yAxisId="left"
                orientation="left"
                tickLine={false}
                axisLine={false}
                tickFormatter={formatAxisCurrency}
                tick={{ fontSize: 11, fill: '#94a3b8' }}
                width={56}
                domain={[0, yLeftMax]}
                ticks={yLeftTicks}
                allowDecimals={false}
              />

              <YAxis
                yAxisId="right"
                orientation="right"
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `${v}`}
                tick={{ fontSize: 11, fill: '#94a3b8' }}
                width={40}
                domain={[0, yRightMax]}
                ticks={yRightTicks}
                allowDecimals={false}
              />

              <ChartTooltip
                cursor={{ stroke: '#cbd5e1', strokeWidth: 1, strokeDasharray: '4 3' }}
                content={
                  <ChartTooltipContent
                    hideIndicator
                    labelFormatter={(_, payload) => {
                      const item = payload?.[0]?.payload as { month?: string } | undefined;
                      return (
                        <div className="font-medium text-foreground">
                          {item?.month ?? '—'}
                        </div>
                      );
                    }}
                    formatter={(value, name) => {
                      const num = Number(value);
                      const key = String(name);
                      if (key === '营收' || key === '成本' || key === '净利润') {
                        return (
                          <span className="font-mono font-medium text-foreground tabular-nums">
                            {formatPointCurrency(num)}
                          </span>
                        );
                      }
                      if (key === '订单数') {
                        return (
                          <span className="font-mono font-medium text-foreground tabular-nums">
                            {Math.round(num)} 单
                          </span>
                        );
                      }
                      if (key === '毛利率') {
                        const display = num < 0 ? '亏损' : `${num.toFixed(1)}%`;
                        return (
                          <span className="font-mono font-medium text-foreground tabular-nums">
                            {display}
                          </span>
                        );
                      }
                      return (
                        <span className="font-mono font-medium text-foreground tabular-nums">
                          {String(value)}
                        </span>
                      );
                    }}
                  />
                }
              />

              <Legend
                verticalAlign="top"
                height={32}
                iconType="plainline"
                wrapperStyle={{ fontSize: 12, color: '#475569' }}
              />

              <Line
                yAxisId="left"
                type="monotone"
                dataKey="revenue"
                name="营收"
                stroke="var(--color-revenue)"
                strokeWidth={2.5}
                dot={{ r: 3.5, fill: '#10b981', strokeWidth: 2, stroke: '#fff' }}
                activeDot={{ r: 5, strokeWidth: 2, stroke: '#fff' }}
                connectNulls
                isAnimationActive
                animationDuration={1100}
                animationBegin={0}
                animationEasing="ease-out"
              />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="cost"
                name="成本"
                stroke="var(--color-cost)"
                strokeWidth={2.5}
                dot={{ r: 3.5, fill: '#f59e0b', strokeWidth: 2, stroke: '#fff' }}
                activeDot={{ r: 5, strokeWidth: 2, stroke: '#fff' }}
                connectNulls
                isAnimationActive
                animationDuration={1100}
                animationBegin={150}
                animationEasing="ease-out"
              />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="netProfit"
                name="净利润"
                stroke="var(--color-netProfit)"
                strokeWidth={2.5}
                dot={{ r: 3.5, fill: '#3b82f6', strokeWidth: 2, stroke: '#fff' }}
                activeDot={{ r: 5, strokeWidth: 2, stroke: '#fff' }}
                connectNulls
                isAnimationActive
                animationDuration={1100}
                animationBegin={300}
                animationEasing="ease-out"
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="orderCount"
                name="订单数"
                stroke="var(--color-orderCount)"
                strokeWidth={2}
                strokeDasharray="6 3"
                dot={{ r: 3, fill: '#8b5cf6', strokeWidth: 2, stroke: '#fff' }}
                activeDot={{ r: 5, strokeWidth: 2, stroke: '#fff' }}
                connectNulls
                isAnimationActive
                animationDuration={1100}
                animationBegin={450}
                animationEasing="ease-out"
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="marginPercent"
                name="毛利率"
                stroke="var(--color-marginPercent)"
                strokeWidth={2}
                strokeDasharray="2 3"
                dot={{ r: 3, fill: '#ef4444', strokeWidth: 2, stroke: '#fff' }}
                activeDot={{ r: 5, strokeWidth: 2, stroke: '#fff' }}
                connectNulls
                isAnimationActive
                animationDuration={1100}
                animationBegin={600}
                animationEasing="ease-out"
              />
            </LineChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
