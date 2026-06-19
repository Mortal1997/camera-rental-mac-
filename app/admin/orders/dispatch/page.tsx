import { createClient } from '../../../../lib/supabase/server';
import type { Equipment, Order } from '../../../actions/types';
import DispatchConsole from '../../components/DispatchConsole';

export const dynamic = 'force-dynamic';

export default async function DispatchPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    throw new Error('未登录或会话已过期，请重新登录');
  }

  const resolvedSearchParams = (await searchParams) ?? {};
  const highlightOrdersParam = Array.isArray(resolvedSearchParams.highlightOrders)
    ? resolvedSearchParams.highlightOrders[0]
    : resolvedSearchParams.highlightOrders;
  const highlightedExternalOrderIds = highlightOrdersParam
    ? highlightOrdersParam.split(',').map((item) => item.trim()).filter(Boolean)
    : [];

  // 待调度的订单（未分配设备的）
  const { data: ordersData, error: ordersError } = await supabase
    .from('orders')
    .select('*')
    .is('equipment_id', null)
    .in('status', ['unprocessed', 'pending_payment'])
    .order('created_at', { ascending: false });

  if (ordersError) {
    throw new Error('Failed to fetch dispatch orders');
  }

  // 所有活跃订单（用于设备冲突检测：正在租用 + 待发货）
  const { data: activeOrdersData, error: activeOrdersError } = await supabase
    .from('orders')
    .select('id, start_date, end_date, status, equipment_id')
    .in('status', ['confirmed', 'using', 'pending'])
    .not('start_date', 'is', null)
    .not('end_date', 'is', null);

  if (activeOrdersError) {
    throw new Error('Failed to fetch active orders for equipment conflict check');
  }

  const { data: equipmentData, error: equipmentError } = await supabase
    .from('equipment')
    .select('*')
    .order('name', { ascending: true });

  if (equipmentError) {
    throw new Error('Failed to fetch dispatch equipment');
  }

  const orders = (ordersData ?? []) as Order[];
  const equipmentList = (equipmentData ?? []) as Equipment[];
  const activeOrders = (activeOrdersData ?? []) as Pick<Order, 'id' | 'start_date' | 'end_date' | 'status' | 'equipment_id'>[];
  const dispatchConsoleKey = orders.map((order) => `${order.id}:${order.status}:${order.equipment_id ?? 'unassigned'}`).join('|');

  return (
    <DispatchConsole
      key={dispatchConsoleKey}
      orders={orders}
      equipmentList={equipmentList}
      activeOrders={activeOrders}
      highlightedExternalOrderIds={highlightedExternalOrderIds}
      userId={user.id}
    />
  );
}
