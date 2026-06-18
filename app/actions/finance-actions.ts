"use server";

import { supabase } from '../../lib/supabaseClient';
import type { OrderWithEquipment } from './types';

export type FinancialMonthlySummary = {
  month: string;
  orderCount: number;
  totalRevenue: number;
};

export type FinancialReport = {
  startDate: string;
  endDate: string;
  totalRevenue: number;
  totalOrders: number;
  monthlySummary: FinancialMonthlySummary[];
  orders: OrderWithEquipment[];
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
    };

    current.orderCount += 1;
    current.totalRevenue += Number(order.total_price || 0);
    monthlyMap.set(month, current);
  }

  const monthlySummary = Array.from(monthlyMap.values()).sort((a, b) => b.month.localeCompare(a.month));

  const returnedOrders = orders.filter((order) => order.status === 'returned');

  return {
    startDate: rangeStart,
    endDate: rangeEnd,
    totalRevenue,
    totalOrders: returnedOrders.length,
    monthlySummary,
    orders: returnedOrders,
  };
}
