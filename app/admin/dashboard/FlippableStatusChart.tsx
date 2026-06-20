'use client';

import { useState } from 'react';
import { ArrowLeftRight, CheckCircle2, PackageCheck, Truck, Wrench, AlertTriangle, type LucideIcon } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState, cn } from '../components/ui';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import { Pie, PieChart, Cell } from 'recharts';

type Slice = {
  key: 'idle' | 'pending' | 'using' | 'overdue' | 'maintenance';
  label: string;
  count: number;
  color: string;       // tailwind bg class
  chartColor: string;  // actual color for recharts
  icon: LucideIcon;
};

const SLICES: Slice[] = [
  { key: 'idle',        label: '正常闲置', count: 0, color: 'bg-emerald-500', chartColor: '#10b981', icon: CheckCircle2 },
  { key: 'pending',     label: '待发货',   count: 0, color: 'bg-sky-500',     chartColor: '#0ea5e9', icon: Truck },
  { key: 'using',       label: '出租中',   count: 0, color: 'bg-amber-500',   chartColor: '#f59e0b', icon: PackageCheck },
  { key: 'overdue',     label: '逾期未还', count: 0, color: 'bg-rose-600',    chartColor: '#e11d48', icon: AlertTriangle },
  { key: 'maintenance', label: '维修中',   count: 0, color: 'bg-rose-500',    chartColor: '#f43f5e', icon: Wrench },
];

const CHART_CONFIG: ChartConfig = {
  count: { label: '台数' },
  idle:        { label: '正常闲置', color: '#10b981' },
  pending:     { label: '待发货',   color: '#0ea5e9' },
  using:       { label: '出租中',   color: '#f59e0b' },
  overdue:     { label: '逾期未还', color: '#e11d48' },
  maintenance: { label: '维修中',   color: '#f43f5e' },
};

export type FlippableStatusChartProps = {
  total: number;
  counts: {
    idle: number;
    pending: number;
    using: number;
    overdue: number;
    maintenance: number;
  };
};

export function FlippableStatusChart({ total, counts }: FlippableStatusChartProps) {
  const [flipped, setFlipped] = useState(false);

  const slices: Slice[] = SLICES.map((s) => ({ ...s, count: counts[s.key] }));
  const pieData = slices.filter((s) => s.count > 0);
  const hasData = total > 0;

  return (
    <Card className="flex h-full min-h-[420px] flex-col overflow-hidden">
      <CardHeader className="flex-row items-start justify-between gap-3">
        <div className="space-y-1">
          <CardTitle>当前状态占比</CardTitle>
          <CardDescription>总计 {total} 台</CardDescription>
        </div>
        <button
          type="button"
          onClick={() => setFlipped((f) => !f)}
          aria-label={flipped ? '查看饼图' : '查看详细数据'}
          className="inline-flex items-center gap-1.5 rounded-md border border-border/70 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-slate-900"
        >
          <ArrowLeftRight className="h-3.5 w-3.5" />
          {flipped ? '查看饼图' : '查看明细'}
        </button>
      </CardHeader>

      <CardContent className="flex-1">
        {!hasData ? (
          <EmptyState>暂无设备数据</EmptyState>
        ) : (
          <div
            className="relative h-full min-h-[280px] [perspective:1200px]"
            style={{ perspective: '1200px' }}
          >
            <div
              className={cn(
                'relative w-full transition-transform duration-500 [transform-style:preserve-3d]',
                flipped && '[transform:rotateY(180deg)]',
              )}
            >
              {/* FRONT — pie chart */}
              <div
                className="[backface-visibility:hidden]"
                style={{ backfaceVisibility: 'hidden' }}
              >
                <ChartContainer
                  config={CHART_CONFIG}
                  className="mx-auto aspect-square h-[260px]"
                >
                  <PieChart>
                    <ChartTooltip
                      cursor={false}
                      content={
                        <ChartTooltipContent
                          hideLabel
                          nameKey="key"
                          formatter={(value, name) => {
                            const slice = slices.find((s) => s.key === name);
                            const pct = total > 0 ? ((Number(value) / total) * 100).toFixed(1) : '0';
                            return (
                              <div className="flex flex-1 items-center justify-between gap-3">
                                <div className="flex items-center gap-2 text-muted-foreground">
                                  <span className={cn('h-2.5 w-2.5 rounded-full', slice?.color)} />
                                  {slice?.label ?? name}
                                </div>
                                <span className="font-mono font-medium text-foreground tabular-nums">
                                  {value} 台 · {pct}%
                                </span>
                              </div>
                            );
                          }}
                        />
                      }
                    />
                    <Pie
                      data={pieData}
                      dataKey="count"
                      nameKey="key"
                      innerRadius={62}
                      outerRadius={110}
                      paddingAngle={2}
                      strokeWidth={2}
                      stroke="#fff"
                    >
                      {pieData.map((entry) => (
                        <Cell key={entry.key} fill={entry.chartColor} />
                      ))}
                    </Pie>
                  </PieChart>
                </ChartContainer>

                {/* center label */}
                <div className="mt-3 flex flex-col items-center">
                  <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">设备总数</p>
                  <p className="text-2xl font-semibold tracking-[-0.04em] text-foreground">{total}</p>
                </div>
              </div>

              {/* BACK — detailed table */}
              <div
                className="absolute inset-0 z-10 [backface-visibility:hidden] [transform:rotateY(180deg)]"
                style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
              >
                <div className="space-y-2 rounded-lg border border-slate-100 bg-slate-50/50 p-2.5">
                  {slices.map((s) => {
                    const Icon = s.icon;
                    const pct = total > 0 ? (s.count / total) * 100 : 0;
                    const isOverdueRow = s.key === 'overdue' && s.count > 0;
                    return (
                      <div
                        key={s.key}
                        className={cn(
                          'rounded-md border bg-white p-2.5 shadow-sm',
                          isOverdueRow ? 'border-rose-200' : 'border-slate-100',
                        )}
                      >
                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <span
                              className={cn(
                                'flex h-6 w-6 items-center justify-center rounded-md',
                                s.color,
                                'text-white',
                              )}
                            >
                              <Icon className="h-3.5 w-3.5" />
                            </span>
                            <span className="font-medium text-foreground">{s.label}</span>
                          </div>
                          <div className="text-right">
                            <span
                              className={cn(
                                'text-lg font-semibold tabular-nums',
                                isOverdueRow ? 'text-rose-700' : 'text-foreground',
                              )}
                            >
                              {s.count}
                            </span>
                            <span className="ml-1 text-[11px] text-muted-foreground">台</span>
                            <span className="ml-2 font-mono text-[11px] text-muted-foreground tabular-nums">
                              {pct.toFixed(1)}%
                            </span>
                          </div>
                        </div>
                        <div className="mt-1.5 h-1.5 rounded-full bg-slate-100">
                          <div
                            className={cn('h-full rounded-full transition-all', s.color)}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
                <p className="mt-3 text-center text-[11px] text-muted-foreground">
                  点击「查看饼图」按钮返回图表视图
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
