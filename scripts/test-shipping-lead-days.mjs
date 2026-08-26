import assert from 'node:assert/strict';
import { getShippingLeadDays } from '../lib/shipping-method.ts';

for (const method of ['邮寄', '快递', 'express', '待确认', '', undefined]) {
  assert.equal(getShippingLeadDays(method), 2, `${String(method)} 应提前 2 天`);
}

for (const method of ['跑腿', '同城跑腿', '闪送', '自提', '到店自取', 'hainter', 'pickup']) {
  assert.equal(getShippingLeadDays(method), 1, `${method} 应提前 1 天`);
}

console.log('Shipping lead-day rules passed.');
