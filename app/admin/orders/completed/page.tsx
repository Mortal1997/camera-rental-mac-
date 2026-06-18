import { getAdminData } from '../../../actions/admin-actions';
import CompletedOrders from '../../components/CompletedOrders';
import { buildAdminOrders } from '../../utils';

export const dynamic = 'force-dynamic';

export default async function CompletedPage() {
  const { equipment } = await getAdminData();
  const orders = buildAdminOrders(equipment).filter((order) => order.status === 'returned' || order.status === 'cancelled');

  return <CompletedOrders orders={orders} />;
}
