import assert from 'node:assert/strict';
import { orderConflictsWithRange, rentalDateRangesOverlap } from '../lib/order-scheduling.ts';

const existingStart = '2026-08-19';
const existingEnd = '2026-08-24';

const overlapCases = [
  ['two days later is available', '2026-08-26', '2026-08-26', false],
  ['next day is available', '2026-08-25', '2026-08-25', false],
  ['shared end day conflicts', '2026-08-24', '2026-08-24', true],
  ['contained range conflicts', '2026-08-20', '2026-08-21', true],
  ['covering range conflicts', '2026-08-18', '2026-08-25', true],
  ['shared start day conflicts', '2026-08-18', '2026-08-19', true],
];

for (const [name, candidateStart, candidateEnd, expected] of overlapCases) {
  assert.equal(
    rentalDateRangesOverlap(existingStart, existingEnd, candidateStart, candidateEnd),
    expected,
    name,
  );
}

assert.equal(
  rentalDateRangesOverlap(existingStart, existingEnd, new Date(2026, 7, 25), new Date(2026, 7, 25)),
  false,
  'Date objects use their local calendar day without timezone drift',
);

const activeOrder = {
  id: 'order-1',
  status: 'confirmed',
  start_date: existingStart,
  end_date: existingEnd,
};

assert.equal(orderConflictsWithRange(activeOrder, '2026-08-24', '2026-08-24'), true);
assert.equal(orderConflictsWithRange(activeOrder, '2026-08-24', '2026-08-24', 'order-1'), false);
assert.equal(orderConflictsWithRange({ ...activeOrder, status: 'returned' }, '2026-08-20', '2026-08-20'), false);
assert.equal(orderConflictsWithRange({ ...activeOrder, status: 'cancelled' }, '2026-08-20', '2026-08-20'), false);
assert.equal(orderConflictsWithRange({ ...activeOrder, status: 'pending_payment' }, '2026-08-20', '2026-08-20'), true);
assert.equal(orderConflictsWithRange({ ...activeOrder, status: 'using' }, '2026-08-20', '2026-08-20'), true);

console.log('All scheduling conflict tests passed');
