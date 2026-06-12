import { getAdminData } from '../../actions/admin-actions';
import ClientTabs from '../components/ClientTabs';
import SyncOrdersButton from '../components/SyncOrdersButton';
import type { ReactNode } from 'react';
import { PageHeader, SurfaceCard } from '../components/ui';

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
    <section className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Order Management"
        title="订单管理"
        description="统一查看订单从调度、待发货、租用中到已完成的全生命周期，并通过悬浮视图菜单快速切换状态分组。"
        meta={<SyncOrdersButton />}
      />

      <SurfaceCard className="p-0">
        <div className="border-b border-border/70 px-6 py-5">
          <ClientTabs
            dispatchCount={dispatchCount}
            pendingCount={pendingCount}
            activeCount={activeCount}
          />
        </div>
        <div className="px-6 py-6">{children}</div>
      </SurfaceCard>
    </section>
  );
}
