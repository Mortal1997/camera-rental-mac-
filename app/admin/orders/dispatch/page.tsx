import { supabase } from '../../../../lib/supabaseClient';
import type { Equipment, Order } from '../../../actions/types';
import DispatchConsole from '../../components/DispatchConsole';

export const dynamic = 'force-dynamic';

export default async function DispatchPage() {
  const { data: ordersData, error: ordersError } = await supabase
    .from('orders')
    .select('*')
    .eq('status', 'unprocessed')
    .order('id', { ascending: false });

  if (ordersError) {
    throw new Error('Failed to fetch unprocessed orders');
  }

  const { data: equipmentData, error: equipmentError } = await supabase
    .from('equipment')
    .select('*')
    .in('status', ['available', 'returned'])
    .order('name', { ascending: true });

  if (equipmentError) {
    throw new Error('Failed to fetch dispatch equipment');
  }

  const orders = (ordersData ?? []) as Order[];
  const equipmentList = (equipmentData ?? []) as Equipment[];

  return <DispatchConsole orders={orders} equipmentList={equipmentList} />;
}
