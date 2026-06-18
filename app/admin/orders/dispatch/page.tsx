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

  const { data: ordersData, error: ordersError } = await supabase
    .from('orders')
    .select('*')
    .is('equipment_id', null)
    .in('status', ['unprocessed', 'pending_payment'])
    .order('created_at', { ascending: false });

  const resolvedSearchParams = (await searchParams) ?? {};
  const highlightOrdersParam = Array.isArray(resolvedSearchParams.highlightOrders)
    ? resolvedSearchParams.highlightOrders[0]
    : resolvedSearchParams.highlightOrders;
  const highlightedExternalOrderIds = highlightOrdersParam
    ? highlightOrdersParam.split(',').map((item) => item.trim()).filter(Boolean)
    : [];

  if (ordersError) {
    throw new Error('Failed to fetch dispatch orders');
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
  const dispatchConsoleKey = orders.map((order) => `${order.id}:${order.status}:${order.equipment_id ?? 'unassigned'}`).join('|');

  return <DispatchConsole key={dispatchConsoleKey} orders={orders} equipmentList={equipmentList} highlightedExternalOrderIds={highlightedExternalOrderIds} userId={user.id} />;
}
