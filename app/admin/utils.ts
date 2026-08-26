import type { EquipmentWithOrders, Order } from '../actions/types';

function toTimestamp(value?: string | null) {
  if (!value) return 0;
  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

export function buildAdminOrders(equipment: EquipmentWithOrders[], orders: Order[]): Order[] {
  const equipmentById = new Map(equipment.map((item) => [item.id, item]));

  return orders
    .map((order) => {
      const item = order.equipment_id ? equipmentById.get(order.equipment_id) : undefined;
      if (!item) return order;

      return {
        ...order,
        equipment: {
          id: item.id,
          name: item.name,
          serial_number: item.serial_number,
          category: item.category,
          daily_fee: item.daily_fee,
          deposit: item.deposit,
          status: item.status,
          warranty_expire_date: item.warranty_expire_date,
        },
      };
    })
    .sort((a, b) => toTimestamp(a.start_date) - toTimestamp(b.start_date) || a.id.localeCompare(b.id));
}
