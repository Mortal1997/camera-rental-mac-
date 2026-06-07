import { getAdminData } from '../../actions/admin-actions';
import ClientTabs from '../components/ClientTabs';
import type { ReactNode } from 'react';

export const dynamic = 'force-dynamic';

export default async function OrdersLayout({ children }: { children: ReactNode }) {
  const { equipment, orders } = await getAdminData();
  const assignedOrders = equipment.flatMap((item) => item.orders);

  const dispatchCount = orders.filter((order) => order.status === 'unprocessed').length;
  const pendingCount = assignedOrders.filter(
    (order) => order.status === 'pending_payment' || order.status === 'confirmed'
  ).length;
  const activeCount = assignedOrders.filter((order) => order.status === 'using').length;

  return (
    <section className="flex flex-col gap-0 rounded-2xl border border-slate-100 bg-white shadow-sm">
      <div className="border-b border-gray-200 px-6 pt-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-indigo-600">
            Order Management
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">
            订单管理
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            统一查看订单从调度、待发货、租用中到已完成的全生命周期，并通过横向标签快速切换状态分组。
          </p>
        </div>
        <div className="mt-6">
          <ClientTabs
            dispatchCount={dispatchCount}
            pendingCount={pendingCount}
            activeCount={activeCount}
          />
        </div>
      </div>
      <div className="px-6 py-6">{children}</div>
    </section>
  );
}
