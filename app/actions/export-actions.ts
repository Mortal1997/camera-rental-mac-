"use server";

import { createClient } from '@/lib/supabase/server';
import type { OrderWithEquipment } from './types';

/**
 * 拉取指定时间范围内的全部订单，按 `created_at` 过滤。
 * 用于财务报表 Excel 导出；不限订单状态。
 */
export async function getExportableOrders(
  startDate: string,
  endDate: string,
): Promise<OrderWithEquipment[]> {
  const supabase = await createClient();
  // created_at 是 timestamptz；为了包含 endDate 整天，止端 +1 天再 < 过滤
  const endExclusive = new Date(`${endDate}T00:00:00.000Z`);
  endExclusive.setUTCDate(endExclusive.getUTCDate() + 1);
  const endExclusiveStr = endExclusive.toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from('orders')
    .select('*, equipment(*)')
    .gte('created_at', `${startDate}T00:00:00.000Z`)
    .lt('created_at', `${endExclusiveStr}T00:00:00.000Z`)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching exportable orders:', error);
    throw new Error('Failed to fetch exportable orders');
  }

  return (data ?? []) as OrderWithEquipment[];
}
