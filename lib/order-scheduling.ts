import type { Order } from '@/app/actions/types';

export const ACTIVE_SCHEDULING_STATUSES = ['pending_payment', 'confirmed', 'using'] as const;

type ActiveSchedulingStatus = (typeof ACTIVE_SCHEDULING_STATUSES)[number];
type RentalDateValue = string | Date;
type SchedulingOrder = Pick<Order, 'id' | 'start_date' | 'end_date' | 'status'>;

const ACTIVE_SCHEDULING_STATUS_SET = new Set<string>(ACTIVE_SCHEDULING_STATUSES);
const DAY_MS = 24 * 60 * 60 * 1000;

function toRentalDay(value: RentalDateValue): number | null {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return Date.UTC(value.getFullYear(), value.getMonth(), value.getDate()) / DAY_MS;
  }

  const dateKey = value.slice(0, 10);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const timestamp = Date.UTC(year, month - 1, day);
  const normalized = new Date(timestamp).toISOString().slice(0, 10);
  return normalized === dateKey ? timestamp / DAY_MS : null;
}

export function isActiveSchedulingStatus(status: Order['status']): status is ActiveSchedulingStatus {
  return ACTIVE_SCHEDULING_STATUS_SET.has(status);
}

/**
 * Rental dates are inclusive calendar days. Adjacent ranges do not conflict:
 * an order ending on 2026-08-24 leaves the equipment available on 2026-08-25.
 */
export function rentalDateRangesOverlap(
  firstStart: RentalDateValue,
  firstEnd: RentalDateValue,
  secondStart: RentalDateValue,
  secondEnd: RentalDateValue,
): boolean {
  const firstStartDay = toRentalDay(firstStart);
  const firstEndDay = toRentalDay(firstEnd);
  const secondStartDay = toRentalDay(secondStart);
  const secondEndDay = toRentalDay(secondEnd);

  if (
    firstStartDay === null ||
    firstEndDay === null ||
    secondStartDay === null ||
    secondEndDay === null ||
    firstStartDay > firstEndDay ||
    secondStartDay > secondEndDay
  ) {
    return false;
  }

  return firstStartDay <= secondEndDay && secondStartDay <= firstEndDay;
}

export function orderConflictsWithRange(
  order: SchedulingOrder,
  candidateStart: RentalDateValue,
  candidateEnd: RentalDateValue,
  excludeOrderId?: string,
): boolean {
  if (order.id === excludeOrderId || !isActiveSchedulingStatus(order.status)) return false;
  if (!order.start_date || !order.end_date) return false;

  return rentalDateRangesOverlap(candidateStart, candidateEnd, order.start_date, order.end_date);
}
