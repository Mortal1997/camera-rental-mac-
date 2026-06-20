import type { EquipmentWithOrders } from '../app/actions/types';

export type EffectiveEquipmentStatus = 'available' | 'maintenance' | 'rented' | 'pending' | 'overdue';

export function getStartOfDay(dateLike: string | Date): Date {
  const date = new Date(dateLike);
  date.setHours(0, 0, 0, 0);
  return date;
}

export function getDateDiffInDays(start: Date, end: Date): number {
  return Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
}

// 设备当前状态判定（按未来订单前瞻式分类）：
// 每台设备有且仅有一个状态（不会出现"待发货+出租中"双重状态）：
//   1. equipment.status === 'maintenance'  → 维修中（最高优先）
//   2. 订单状态是 using：
//      - end_date < 今天（end_date 已过但未归还）→ 逾期未还（overdue）
//      - start_date <= 今天 <= end_date       → 出租中（rented，正常在租）
//   3. 未来任意时间有 start_date >= 今天、状态为 pending_payment / confirmed
//      的订单 → 待发货（pending）
//      - 含义：机器虽然今天没在用，但后面有活儿，所以不算闲置
//   4. 都没有 → 闲置（available）
//
// overdue 是 rented 的子分支——区分"在租"和"超期未还"两个细分子状态：
//   - rented    = 正常在租期内
//   - overdue   = 客户应在 end_date 归还但至今未还（机器仍在客户手上）
export function getEffectiveEquipmentStatus(
  item: EquipmentWithOrders,
  today: Date = getStartOfDay(new Date()),
): EffectiveEquipmentStatus {
  if (item.status === 'maintenance') return 'maintenance';

  const todayKey = getStartOfDay(today).getTime();

  let isRented = false;
  let isOverdue = false;
  let hasUpcomingPending = false;

  for (const order of item.orders) {
    if (!order.start_date) continue;
    const startKey = getStartOfDay(order.start_date).getTime();

    if (order.status === 'using') {
      const endKey = order.end_date ? getStartOfDay(order.end_date).getTime() : null;
      const isInRentalPeriod = startKey <= todayKey && (endKey === null || todayKey <= endKey);
      const isOverdueWindow = endKey !== null && todayKey > endKey;

      if (isInRentalPeriod) {
        isRented = true;
        continue;
      }
      if (isOverdueWindow) {
        // 已是逾期未还：今天 > end_date，但状态还是 using
        isOverdue = true;
        continue;
      }

      // 提前标记 using 但还没到 start_date（如发货前先标记）
      // → 视为待发货（数据脏的兜底）
      if (startKey > todayKey && startKey - todayKey <= 24 * 60 * 60 * 1000 * 7) {
        hasUpcomingPending = true;
        continue;
      }
    }

    const isActivePending =
      (order.status === 'pending_payment' || order.status === 'confirmed') &&
      startKey >= todayKey;
    if (isActivePending) hasUpcomingPending = true;
  }

  if (isOverdue) return 'overdue';
  if (isRented) return 'rented';
  if (hasUpcomingPending) return 'pending';
  return 'available';
}
