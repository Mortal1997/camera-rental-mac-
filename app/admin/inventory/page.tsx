import { getEquipmentList } from '../../actions/admin-actions';
import InventoryManager from '../components/InventoryManager';
import { PageHeader } from '../components/ui';

export const dynamic = 'force-dynamic';

export default async function InventoryPage() {
  const equipment = await getEquipmentList();

  return (
    <section className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Inventory"
        title="仓库设备管理"
        description="管理所有设备资产，支持新增、报修、删除、批量导入等操作。"
      />

      <InventoryManager equipment={equipment} />
    </section>
  );
}
