import type { Equipment, EquipmentWithOrders, Order } from '@/app/actions/types';
import { getEffectiveEquipmentStatus } from '@/lib/equipment-status';
import { orderConflictsWithRange } from '@/lib/order-scheduling';
import { getShippingLeadDays } from '@/lib/shipping-method';

const DAY_MS = 24 * 60 * 60 * 1000;

export type WorkbenchTaskLevel = 'urgent' | 'today' | 'upcoming' | 'attention';

export type WorkbenchTask = {
  id: string;
  entityId: string;
  entityType: 'order' | 'equipment';
  level: WorkbenchTaskLevel;
  title: string;
  description: string;
  customerName?: string;
  equipmentName?: string;
  dueLabel: string;
  href: string;
  orderId?: string;
};

export type EquipmentRecommendation = {
  equipmentId: string;
  name: string;
  serialNumber: string;
  score: number;
  reasons: string[];
};

export type OperationsSnapshot = {
  generatedAt: string;
  todayLabel: string;
  tasks: WorkbenchTask[];
  metrics: {
    urgent: number;
    today: number;
    unassigned: number;
    available: number;
  };
  recommendationsByOrder: Record<string, EquipmentRecommendation[]>;
};

function parseDateKey(value?: string | null): number | null {
  if (!value) return null;
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  if (!year || !month || !day) return null;
  return Date.UTC(year, month - 1, day) / DAY_MS;
}

function getLocalDateKey(date: Date): number {
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY_MS;
}

function formatDate(value?: string | null): string {
  if (!value) return '日期待补充';
  const [, month, day] = value.slice(0, 10).split('-');
  return `${Number(month)}月${Number(day)}日`;
}

function formatDateKey(dateKey: number): string {
  const date = new Date(dateKey * DAY_MS);
  return `${date.getUTCMonth() + 1}月${date.getUTCDate()}日`;
}

function normalizeModel(value?: string | null): string {
  return (value ?? '').toLocaleLowerCase('zh-CN').replace(/[\s\-_]+/g, '');
}

function getOrderHref(order: Order): string {
  if (!order.equipment_id || order.status === 'unprocessed') {
    const highlight = order.external_order_id
      ? `?highlightOrders=${encodeURIComponent(order.external_order_id)}`
      : '';
    return `/admin/orders/dispatch${highlight}`;
  }
  if (order.status === 'using') return '/admin/orders/active';
  if (order.status === 'returned' || order.status === 'cancelled') return '/admin/orders/completed';
  return '/admin/orders/pending';
}

function orderRangesConflict(candidate: Order, existing: Order): boolean {
  if (!candidate.start_date || !candidate.end_date) return false;
  return orderConflictsWithRange(existing, candidate.start_date, candidate.end_date, candidate.id);
}

function getRecommendations(
  order: Order,
  equipment: EquipmentWithOrders[],
  today: Date,
): EquipmentRecommendation[] {
  if (!order.start_date || !order.end_date) return [];

  const expectedModel = normalizeModel(order.expected_equipment_model);

  return equipment
    .filter((item) => item.status !== 'maintenance')
    .filter((item) => !item.orders.some((existing) => orderRangesConflict(order, existing)))
    .map((item) => {
      const itemName = normalizeModel(item.name);
      const itemCategory = normalizeModel(item.category);
      const effectiveStatus = getEffectiveEquipmentStatus(item, today);
      const recentOrderCount = item.orders.filter((existing) => {
        const startKey = parseDateKey(existing.start_date);
        const todayKey = getLocalDateKey(today);
        return startKey !== null && startKey >= todayKey - 30 && startKey <= todayKey + 30;
      }).length;

      let score = 100 - Math.min(recentOrderCount * 6, 30);
      const reasons: string[] = [];

      if (expectedModel) {
        if (itemName === expectedModel || itemCategory === expectedModel) {
          score += 60;
          reasons.push('型号完全匹配');
        } else if (
          itemName.includes(expectedModel) ||
          (itemCategory.length > 0 && itemCategory.includes(expectedModel)) ||
          (itemCategory.length > 0 && expectedModel.includes(itemCategory))
        ) {
          score += 35;
          reasons.push('型号高度匹配');
        }
      }

      if (effectiveStatus === 'available') {
        score += 20;
        reasons.push('当前在库闲置');
      } else {
        reasons.push('目标租期可用');
      }

      reasons.push(recentOrderCount === 0 ? '近期排期宽松' : `近60天 ${recentOrderCount} 单`);
      if (item.serial_number) score += 3;

      return {
        equipmentId: item.id,
        name: item.name,
        serialNumber: item.serial_number ?? '未录入 SN',
        score,
        reasons,
      };
    })
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, 'zh-CN'))
    .slice(0, 3);
}

function addOrderTask(
  tasks: WorkbenchTask[],
  order: Order,
  level: WorkbenchTaskLevel,
  type: string,
  title: string,
  description: string,
  dueLabel: string,
  equipmentMap: Map<string, Equipment>,
) {
  tasks.push({
    id: `${type}:${order.id}`,
    entityId: order.id,
    entityType: 'order',
    level,
    title,
    description,
    customerName: order.customer_name || '客户待补充',
    equipmentName: order.equipment_id ? equipmentMap.get(order.equipment_id)?.name ?? '未知设备' : undefined,
    dueLabel,
    href: getOrderHref(order),
    orderId: order.id,
  });
}

export function buildOperationsSnapshot(
  equipment: EquipmentWithOrders[],
  orders: Order[],
  now = new Date(),
): OperationsSnapshot {
  const todayKey = getLocalDateKey(now);
  const equipmentMap = new Map(equipment.map((item) => [item.id, item]));
  const tasks: WorkbenchTask[] = [];
  const recommendationsByOrder: Record<string, EquipmentRecommendation[]> = {};

  for (const order of orders) {
    if (order.status === 'returned' || order.status === 'cancelled') continue;

    const startKey = parseDateKey(order.start_date);
    const endKey = parseDateKey(order.end_date);
    const isUnassigned = !order.equipment_id && ['unprocessed', 'pending_payment', 'confirmed'].includes(order.status);

    if (isUnassigned) {
      const level: WorkbenchTaskLevel = startKey !== null && startKey <= todayKey + 1 ? 'urgent' : 'attention';
      addOrderTask(
        tasks,
        order,
        level,
        'unassigned',
        '待分配设备',
        order.expected_equipment_model
          ? `客户期望 ${order.expected_equipment_model}，系统已按型号与排期生成推荐。`
          : '尚未绑定设备，建议尽快确认型号与可用库存。',
        startKey === null ? '租期待补充' : `${formatDate(order.start_date)} 开始`,
        equipmentMap,
      );
      recommendationsByOrder[order.id] = getRecommendations(order, equipment, now);
    }

    if (order.status === 'using' && endKey !== null) {
      const daysUntilReturn = endKey - todayKey;
      if (daysUntilReturn < 0) {
        addOrderTask(
          tasks,
          order,
          'urgent',
          'overdue-return',
          `逾期 ${Math.abs(daysUntilReturn)} 天未归还`,
          '订单仍处于出租中状态，需要联系客户并确认续租或归还。',
          `应于 ${formatDate(order.end_date)} 归还`,
          equipmentMap,
        );
      } else if (daysUntilReturn === 0) {
        addOrderTask(
          tasks,
          order,
          'today',
          'return-today',
          '今日应归还',
          '建议提前确认归还方式，归还后扫码核验设备和配件。',
          '今天到期',
          equipmentMap,
        );
      } else if (daysUntilReturn <= 2) {
        addOrderTask(
          tasks,
          order,
          'upcoming',
          'return-upcoming',
          `${daysUntilReturn} 天后归还`,
          '可提前发送归还提醒，避免影响下一笔订单。',
          `${formatDate(order.end_date)} 到期`,
          equipmentMap,
        );
      }
    }

    if ((order.status === 'pending_payment' || order.status === 'confirmed') && order.equipment_id && startKey !== null) {
      const shippingLeadDays = getShippingLeadDays(order.shipping_method);
      const shippingDateKey = startKey - shippingLeadDays;
      const daysUntilShip = shippingDateKey - todayKey;
      const shippingRuleDescription = shippingLeadDays === 2
        ? '邮寄或待确认订单按租期开始前 2 天发货。'
        : '跑腿、闪送或自提订单按租期开始前 1 天交付。';

      if (daysUntilShip < 0) {
        addOrderTask(
          tasks,
          order,
          'urgent',
          'late-shipment',
          `已超过应发货日 ${Math.abs(daysUntilShip)} 天`,
          order.status === 'pending_payment'
            ? `订单仍待付款，请先确认收款状态。${shippingRuleDescription}`
            : `订单已确认，需要立即处理发货。${shippingRuleDescription}`,
          `应于 ${formatDateKey(shippingDateKey)} 发货`,
          equipmentMap,
        );
      } else if (daysUntilShip === 0) {
        addOrderTask(
          tasks,
          order,
          'today',
          'ship-today',
          '今日需要发货',
          order.status === 'pending_payment'
            ? `尚未确认付款，发货前请核实款项。${shippingRuleDescription}`
            : `设备已分配，可进入待发货页面完成出库。${shippingRuleDescription}`,
          `${formatDate(order.start_date)} 开始租赁`,
          equipmentMap,
        );
      } else if (daysUntilShip <= 2) {
        addOrderTask(
          tasks,
          order,
          'upcoming',
          'ship-upcoming',
          `${daysUntilShip} 天后需要发货`,
          `建议提前完成设备、配件与物流信息核对。${shippingRuleDescription}`,
          `${formatDateKey(shippingDateKey)} 发货`,
          equipmentMap,
        );
      }
    }

    const needsShippingDetails =
      (order.status === 'pending_payment' || order.status === 'confirmed') &&
      startKey !== null &&
      startKey <= todayKey + 3 &&
      (!order.customer_phone || (!order.shipping_address && order.shipping_method !== 'pickup'));

    if (needsShippingDetails) {
      addOrderTask(
        tasks,
        order,
        'attention',
        'missing-details',
        '订单资料不完整',
        !order.customer_phone ? '缺少客户联系电话，可能影响发货与催还。' : '缺少收货地址，请在发货前补充。',
        '发货前补齐',
        equipmentMap,
      );
    }
  }

  for (const item of equipment) {
    if (item.status === 'maintenance') {
      tasks.push({
        id: `maintenance:${item.id}`,
        entityId: item.id,
        entityType: 'equipment',
        level: 'attention',
        title: '设备维修中',
        description: item.serial_number ? `SN：${item.serial_number}，请跟进维修进度。` : '尚未录入 SN，请跟进维修进度。',
        equipmentName: item.name,
        dueLabel: '维修跟进',
        href: '/admin/inventory',
      });
    }

    const warrantyKey = parseDateKey(item.warranty_expire_date);
    if (warrantyKey !== null && warrantyKey >= todayKey && warrantyKey - todayKey <= 30) {
      tasks.push({
        id: `warranty:${item.id}`,
        entityId: item.id,
        entityType: 'equipment',
        level: 'attention',
        title: '质保即将到期',
        description: `建议在 ${formatDate(item.warranty_expire_date)} 前完成设备检查。`,
        equipmentName: item.name,
        dueLabel: `${warrantyKey - todayKey} 天后到期`,
        href: '/admin/inventory',
      });
    }
  }

  const levelOrder: Record<WorkbenchTaskLevel, number> = {
    urgent: 0,
    today: 1,
    upcoming: 2,
    attention: 3,
  };
  tasks.sort((a, b) => levelOrder[a.level] - levelOrder[b.level] || a.title.localeCompare(b.title, 'zh-CN'));

  const available = equipment.filter((item) => getEffectiveEquipmentStatus(item, now) === 'available').length;
  const unassigned = tasks.filter((task) => task.id.startsWith('unassigned:')).length;

  return {
    generatedAt: now.toISOString(),
    todayLabel: new Intl.DateTimeFormat('zh-CN', {
      month: 'long',
      day: 'numeric',
      weekday: 'long',
    }).format(now),
    tasks,
    metrics: {
      urgent: tasks.filter((task) => task.level === 'urgent').length,
      today: tasks.filter((task) => task.level === 'today').length,
      unassigned,
      available,
    },
    recommendationsByOrder,
  };
}
