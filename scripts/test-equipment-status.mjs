import { getEffectiveEquipmentStatus } from '../lib/equipment-status.ts';

const today = new Date(2026, 5, 20); // 本地时区 2026-06-20

const eq = (id, item, expected) => {
  const got = getEffectiveEquipmentStatus(item, today);
  const status = got === expected ? 'PASS' : 'FAIL';
  console.log(`[${status}] ${id}: got=${got} expected=${expected}`);
  if (got !== expected) process.exitCode = 1;
};

const daysFrom = (offset) => {
  const d = new Date(today);
  d.setDate(d.getDate() + offset);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

eq('1. maintenance wins over all', {
  id: 'eq-1',
  status: 'maintenance',
  orders: [
    { id: 'o-1', status: 'using', start_date: daysFrom(-1), end_date: daysFrom(3) },
  ],
}, 'maintenance');

eq('2. rented today (within using range)', {
  id: 'eq-2',
  status: 'available',
  orders: [
    { id: 'o-1', status: 'using', start_date: daysFrom(-2), end_date: daysFrom(2) },
  ],
}, 'rented');

eq('3. rented when start_date is today', {
  id: 'eq-3',
  status: 'available',
  orders: [
    { id: 'o-1', status: 'using', start_date: daysFrom(0), end_date: daysFrom(3) },
  ],
}, 'rented');

eq('4. **next-day pending → pending (not available)**', {
  id: 'eq-4',
  status: 'available',
  orders: [
    { id: 'o-1', status: 'confirmed', start_date: daysFrom(1), end_date: daysFrom(3) },
  ],
}, 'pending');

eq('5. **next-month pending → pending (not available)**', {
  id: 'eq-5',
  status: 'available',
  orders: [
    { id: 'o-1', status: 'pending_payment', start_date: daysFrom(15), end_date: daysFrom(20) },
  ],
}, 'pending');

eq('6. rented wins over pending (today using + future pending)', {
  id: 'eq-6',
  status: 'available',
  orders: [
    { id: 'o-1', status: 'using', start_date: daysFrom(-1), end_date: daysFrom(2) },
    { id: 'o-2', status: 'confirmed', start_date: daysFrom(5), end_date: daysFrom(8) },
  ],
}, 'rented');

eq('7. pending future + past returned order → pending', {
  id: 'eq-7',
  status: 'available',
  orders: [
    { id: 'o-1', status: 'returned', start_date: daysFrom(-10), end_date: daysFrom(-5) },
    { id: 'o-2', status: 'confirmed', start_date: daysFrom(2), end_date: daysFrom(5) },
  ],
}, 'pending');

eq('8. only past orders → available (idle)', {
  id: 'eq-8',
  status: 'available',
  orders: [
    { id: 'o-1', status: 'returned', start_date: daysFrom(-10), end_date: daysFrom(-5) },
  ],
}, 'available');

eq('9. no orders at all → available', {
  id: 'eq-9',
  status: 'available',
  orders: [],
}, 'available');

eq('10. cancelled future order → available (cancelled not active)', {
  id: 'eq-10',
  status: 'available',
  orders: [
    { id: 'o-1', status: 'cancelled', start_date: daysFrom(2), end_date: daysFrom(5) },
  ],
}, 'available');

eq('11. **using order starting tomorrow → pending** (not rented yet, but booked)', {
  id: 'eq-11',
  status: 'available',
  orders: [
    { id: 'o-1', status: 'using', start_date: daysFrom(1), end_date: daysFrom(5) },
  ],
}, 'pending');

eq('12. **overdue: using but end_date is yesterday (1 day overdue)**', {
  id: 'eq-12',
  status: 'available',
  orders: [
    { id: 'o-1', status: 'using', start_date: daysFrom(-5), end_date: daysFrom(-1) },
  ],
}, 'overdue');

eq('13. **overdue: using but end_date is 30 days ago (严重逾期)**', {
  id: 'eq-13',
  status: 'available',
  orders: [
    { id: 'o-1', status: 'using', start_date: daysFrom(-40), end_date: daysFrom(-30) },
  ],
}, 'overdue');

eq('14. overdue wins over maintenance? no, maintenance still highest', {
  id: 'eq-14',
  status: 'maintenance',
  orders: [
    { id: 'o-1', status: 'using', start_date: daysFrom(-5), end_date: daysFrom(-1) },
  ],
}, 'maintenance');

eq('15. overdue + future pending → overdue (rented 子状态优先)', {
  id: 'eq-15',
  status: 'available',
  orders: [
    { id: 'o-1', status: 'using',     start_date: daysFrom(-10), end_date: daysFrom(-3) },
    { id: 'o-2', status: 'confirmed', start_date: daysFrom(2),   end_date: daysFrom(5) },
  ],
}, 'overdue');

console.log(process.exitCode ? '\n*** Some tests FAILED ***' : '\nAll tests PASSED');