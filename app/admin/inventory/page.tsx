import { getEquipmentList } from '../../actions/admin-actions';
import InventoryManager from '../components/InventoryManager';

export const dynamic = 'force-dynamic';

export default async function InventoryPage() {
  const equipment = await getEquipmentList();

  return (
    <section className="flex flex-col gap-6">
      <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-indigo-600">
          Inventory
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">
          仓库设备管理
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          管理所有设备资产，支持新增、报修、删除等操作。
        </p>
      </div>

      <InventoryManager equipment={equipment} />
    </section>
  );
}
