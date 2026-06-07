import type { EquipmentWithOrders, OrderWithEquipment } from '../actions/types';

export function buildAdminOrders(equipment: EquipmentWithOrders[]): OrderWithEquipment[] {
  return equipment.flatMap((item) =>
    item.orders.map((order) => ({
      ...order,
      equipment: {
        id: item.id,
        name: item.name,
        daily_fee: item.daily_fee,
        deposit: item.deposit,
        status: item.status,
      },
    }))
  );
}
