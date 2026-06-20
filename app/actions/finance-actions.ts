"use server";

import { createClient } from '@/lib/supabase/server';
import { listExpenseItems } from './expense-actions';
import type { ExpenseItem } from './expense-shared';
import type { OrderWithEquipment } from './types';

export type FinancialMonthlySummary = {
  month: string;
  orderCount: number;
  totalRevenue: number;
  totalCost: number;
  netProfit: number;
  marginPercent: number; // 0..100, -1 表示负（亏损）
};

export type FinancialReport = {
  startDate: string;
  endDate: string;
  totalRevenue: number;
  totalOrders: number;
  totalCost: number;
  netProfit: number;
  monthlySummary: FinancialMonthlySummary[];
  orders: OrderWithEquipment[];
  expenses: ExpenseItem[];
};

function getDefaultRange() {
  const now = new Date();
  const year = now.getFullYear();
  return {
    startDate: `${year}-01-01`,
    endDate: `${year}-12-31`,
  };
}

function formatMonthKey(dateString: string) {
  return dateString.slice(0, 7);
}

export async function getFinancialReport(
  startDate?: string,
  endDate?: string
): Promise<FinancialReport> {
  const supabase = await createClient();
  const fallbackRange = getDefaultRange();
  const rangeStart = startDate?.trim() || fallbackRange.startDate;
  const rangeEnd = endDate?.trim() || fallbackRange.endDate;

  let query = supabase
    .from('orders')
    .select('*, equipment(*)')
    .eq('status', 'returned')
    .order('end_date', { ascending: false });

  query = query.gte('start_date', rangeStart).lte('end_date', rangeEnd);

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching financial report:', error);
    throw new Error('Failed to fetch financial report');
  }

  const orders = (data ?? []) as OrderWithEquipment[];
  const totalRevenue = orders.reduce((sum, order) => sum + Number(order.total_price || 0), 0);

  const monthlyMap = new Map<string, FinancialMonthlySummary>();
  for (const order of orders) {
    const month = formatMonthKey(order.start_date ?? order.end_date ?? new Date().toISOString().slice(0, 10));
    const current = monthlyMap.get(month) ?? {
      month,
      orderCount: 0,
      totalRevenue: 0,
      totalCost: 0,
      netProfit: 0,
      marginPercent: 0,
    };

    current.orderCount += 1;
    current.totalRevenue += Number(order.total_price || 0);
    monthlyMap.set(month, current);
  }

  // 拉取所选月份区间内所有手工录入成本，按月累加到月度汇总
  const startMonth = formatMonthKey(rangeStart);
  const endMonth = formatMonthKey(rangeEnd);
  const expenses = await listExpenseItems({ startMonth, endMonth });

  const expenseTotal = expenses.reduce((sum, e) => sum + e.amount, 0);
  for (const expense of expenses) {
    const current = monthlyMap.get(expense.month) ?? {
      month: expense.month,
      orderCount: 0,
      totalRevenue: 0,
      totalCost: 0,
      netProfit: 0,
      marginPercent: 0,
    };
    current.totalCost += expense.amount;
    monthlyMap.set(expense.month, current);
  }

  // 计算月度净利润 / 毛利率（毛利率 < 0 时存 -1 表示亏损）
  for (const item of monthlyMap.values()) {
    item.netProfit = item.totalRevenue - item.totalCost;
    if (item.totalRevenue > 0) {
      item.marginPercent = (item.netProfit / item.totalRevenue) * 100;
    } else if (item.netProfit < 0) {
      item.marginPercent = -1;
    }
  }

  const monthlySummary = Array.from(monthlyMap.values()).sort((a, b) => b.month.localeCompare(a.month));

  const returnedOrders = orders.filter((order) => order.status === 'returned');

  return {
    startDate: rangeStart,
    endDate: rangeEnd,
    totalRevenue,
    totalOrders: returnedOrders.length,
    totalCost: expenseTotal,
    netProfit: totalRevenue - expenseTotal,
    monthlySummary,
    orders: returnedOrders,
    expenses,
  };
}
