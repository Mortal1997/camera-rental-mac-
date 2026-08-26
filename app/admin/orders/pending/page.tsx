import { getAdminData } from '../../../actions/admin-actions';
import PendingOrders from '../../components/PendingOrders';
import { buildAdminOrders } from '../../utils';

export const dynamic = 'force-dynamic';

export default async function PendingPage() {
  const { equipment, equipmentList, orders: allOrders } = await getAdminData();
  const orders = buildAdminOrders(equipment, allOrders).filter(
    (order) => order.status === 'pending_payment' || order.status === 'confirmed'
  );

  return <PendingOrders orders={orders} equipmentList={equipmentList} />;
}
