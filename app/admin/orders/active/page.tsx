import { getAdminData } from '../../../actions/admin-actions';
import ActiveOrders from '../../components/ActiveOrders';
import { buildAdminOrders } from '../../utils';

export const dynamic = 'force-dynamic';

export default async function ActivePage() {
  const { equipment } = await getAdminData();
  const orders = buildAdminOrders(equipment).filter((order) => order.status === 'using');

  return <ActiveOrders orders={orders} />;
}
