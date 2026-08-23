import assert from 'node:assert/strict';
import {
  chooseSyncedOrderAmount,
  getGoofishFinalAmount,
} from '../lib/goofish/order-amount.ts';

assert.deepEqual(
  getGoofishFinalAmount({ pay_amount: 10_000, total_amount: 7_600 }),
  { amount: 100, source: 'pay_amount' },
  '改价后必须以实际成交金额为准',
);

assert.deepEqual(
  getGoofishFinalAmount({ pay_amount: 7_600, total_amount: 7_600 }),
  { amount: 76, source: 'pay_amount' },
  '未改价订单应正确换算分为元',
);

assert.deepEqual(
  getGoofishFinalAmount({ pay_amount: 0, total_amount: 10_000 }),
  { amount: 100, source: 'total_amount' },
  '旧接口缺少有效 pay_amount 时允许回退总金额',
);

assert.equal(getGoofishFinalAmount({ pay_amount: Number.NaN }), null);
assert.equal(chooseSyncedOrderAmount(76, 100), 100, '新成交价必须覆盖旧价格');
assert.equal(chooseSyncedOrderAmount(76, 0), 76, '上游没有有效金额时保留本地价格');

console.log('Goofish order amount tests passed.');
