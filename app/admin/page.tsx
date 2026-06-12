import { getAdminData } from '../actions/admin-actions';
import type { EquipmentWithOrders } from '../actions/types';
import GanttChart from './components/GanttChart';
import SyncOrdersButton from './components/SyncOrdersButton';
import { PageHeader } from './components/ui';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const { equipment, equipmentList } = await getAdminData();

  return (
    <section className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Schedule Overview"
        title="智能租赁管理中控台"
        description="查看未来 30 天设备的预订与归还安排，快速掌握设备占用情况，并一键同步闲管家待发货订单。"
        meta={<SyncOrdersButton />}
      />

      <GanttChart equipment={equipment as EquipmentWithOrders[]} equipmentList={equipmentList} />
    </section>
  );
}
