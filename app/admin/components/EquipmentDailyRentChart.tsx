'use client';

import { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, type ChartConfig } from '@/components/ui/chart';
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts';
import { EmptyState } from '../components/ui';
import type { EquipmentMonthlyRentPoint } from '../../actions/finance-actions';

export type EquipmentDailyRentChartProps = {
  /** 设备月度日租金数据 */
  data: EquipmentMonthlyRentPoint[];
  /** 区间内首月与末月（YYYY-MM），用于标题 */
  startMonth: string;
  endMonth: string;
};

// 预定义颜色调色板
const COLORS = [
  '#10b981', // emerald
  '#3b82f6', // blue
  '#f59e0b', // amber
  '#8b5cf6', // violet
  '#ef4444', // red
  '#06b6d4', // cyan
  '#ec4899', // pink
  '#84cc16', // lime
  '#f97316', // orange
  '#6366f1', // indigo
];

function formatAxisCurrency(v: number) {
  const n = Number(v);
  if (!Number.isFinite(n)) return '0';
  if (Math.abs(n) >= 10000) return `${(n / 10000).toFixed(1)}万`;
  if (Math.abs(n) >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return `¥${Math.round(n)}`;
}

function formatPointCurrency(v: number) {
  return `¥${Math.round(v).toLocaleString('zh-CN')}`;
}

export function EquipmentDailyRentChart({ data, startMonth, endMonth }: EquipmentDailyRentChartProps) {
  // 将数据转换为透视表格式：{ month: '2024-01', '全画幅微单': 100, '航拍无人机': 150, ... }
  const { chartData, chartConfig, categories } = useMemo(() => {
    if (!data || data.length === 0) {
      return { chartData: [], chartConfig: {}, categories: [] };
    }

    // 获取所有分类名称
    const uniqueCategories = [...new Set(data.map((d) => d.category))];
    const categories = uniqueCategories.slice(0, 10); // 最多显示10个分类

    // 按月份分组
    const monthMap = new Map<string, Record<string, string | number>>();
    for (const item of data) {
      if (!monthMap.has(item.month)) {
        monthMap.set(item.month, { month: item.month });
      }
      const monthData = monthMap.get(item.month)!;
      monthData[item.category] = item.avgDailyRent;
    }

    // 转换为数组并排序
    const chartData = Array.from(monthMap.values()).sort((a, b) =>
      String(a.month).localeCompare(String(b.month))
    );

    // 生成配置
    const config: Record<string, ChartConfig[string]> = {};
    categories.forEach((name, index) => {
      config[name] = {
        label: name,
        color: COLORS[index % COLORS.length],
      };
    });

    return { chartData, chartConfig: config, categories };
  }, [data]);

  const hasData = chartData.length > 0 && categories.length > 0;

  return (
    <Card className="flex h-full min-h-[440px] flex-col overflow-hidden">
      <CardHeader>
        <CardTitle>分类日租金均值趋势</CardTitle>
        <CardDescription>
          每月各型号/分类的日租金均值对比 · {startMonth} 至 {endMonth}
        </CardDescription>
      </CardHeader>

      <CardContent className="flex-1">
        {!hasData ? (
          <EmptyState>所选区间暂无数据</EmptyState>
        ) : (
          <div className="h-[360px] w-full">
            <ChartContainer config={chartConfig} className="h-full w-full">
              <LineChart
                data={chartData}
                margin={{ top: 12, right: 24, left: 8, bottom: 8 }}
              >
                <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#e2e8f0" />

                <XAxis
                  dataKey="month"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  interval={0}
                  tickFormatter={(value) => {
                    const [year, month] = value.split('-');
                    return `${Number(month)}月`;
                  }}
                />

                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={formatAxisCurrency}
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  width={56}
                  allowDecimals={false}
                />

                <ChartTooltip
                  cursor={{ stroke: '#cbd5e1', strokeWidth: 1, strokeDasharray: '4 3' }}
                  content={
                    <ChartTooltipContent
                      hideIndicator
                      labelFormatter={(label) => {
                        const [year, month] = String(label).split('-');
                        return `${year}年${Number(month)}月`;
                      }}
                      formatter={(value, name) => {
                        const num = Number(value);
                        if (!Number.isFinite(num)) {
                          return ['暂无数据', String(name)];
                        }
                        return [formatPointCurrency(num), String(name)];
                      }}
                    />
                  }
                />

                <ChartLegend
                  verticalAlign="top"
                  height={36}
                  iconType="plainline"
                  wrapperStyle={{ fontSize: 11, color: '#475569', paddingBottom: 8 }}
                />

                {categories.map((name, index) => (
                  <Line
                    key={name}
                    type="monotone"
                    dataKey={name}
                    name={name}
                    stroke={COLORS[index % COLORS.length]}
                    strokeWidth={2.5}
                    dot={{ r: 3.5, fill: COLORS[index % COLORS.length], strokeWidth: 2, stroke: '#fff' }}
                    activeDot={{ r: 5, strokeWidth: 2, stroke: '#fff' }}
                    connectNulls
                    isAnimationActive
                    animationDuration={1100}
                    animationBegin={index * 100}
                    animationEasing="ease-out"
                  />
                ))}
              </LineChart>
            </ChartContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
