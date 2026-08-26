import { getAdminData } from '@/app/actions/admin-actions';
import type { EquipmentWithOrders } from '@/app/actions/types';
import OperationsWorkbench from '@/app/admin/components/OperationsWorkbench';
import { buildOperationsSnapshot } from '@/lib/operations';

export const dynamic = 'force-dynamic';

export default async function OperationsPage({
  searchParams,
}: {
  searchParams: Promise<{ scan?: string }>;
}) {
  const { scan } = await searchParams;
  const { equipment, equipmentList, orders } = await getAdminData();
  const snapshot = buildOperationsSnapshot(equipment as EquipmentWithOrders[], orders);

  return (
    <OperationsWorkbench
      snapshot={snapshot}
      equipment={equipmentList}
      orders={orders}
      initialScanOpen={scan === '1'}
    />
  );
}
