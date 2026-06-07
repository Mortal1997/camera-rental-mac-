import { getAdminData } from '../actions/admin-actions';
import type { EquipmentWithOrders } from '../actions/types';
import GanttChart from './components/GanttChart';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const { equipment } = await getAdminData();

  return (
    <section className="flex flex-col gap-6">
      <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-indigo-600">
          Schedule Overview
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">
          排期看板
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          查看未来 30 天设备的预订与归还安排，快速掌握设备占用情况。
        </p>
      </div>

      <GanttChart equipment={equipment as EquipmentWithOrders[]} />
    </section>
  );
}
