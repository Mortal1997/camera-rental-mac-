"use server";

import { createClient } from '@/lib/supabase/server';
import type { OrderWithEquipment } from './types';

/**
 * 拉取指定时间范围内已归还的订单，按完结日期 `end_date` 过滤。
 * 与财务报表页面的统计口径保持一致。
 */
export async function getExportableOrders(
  startDate: string,
  endDate: string,
): Promise<OrderWithEquipment[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('orders')
    .select('*, equipment(*)')
    .eq('status', 'returned')
    .gte('end_date', startDate)
    .lte('end_date', endDate)
    .order('end_date', { ascending: false });

  if (error) {
    console.error('Error fetching exportable orders:', error);
    throw new Error('Failed to fetch exportable orders');
  }

  return (data ?? []) as OrderWithEquipment[];
}
