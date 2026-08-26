const ONE_DAY_DELIVERY_METHODS = new Set(['hainter', 'pickup']);

/**
 * 发货准备时间：邮寄/快递提前 2 天，跑腿/闪送/自提提前 1 天。
 * 历史数据中同时存在中英文值；未知或待确认方式按邮寄处理，优先避免漏发。
 */
export function getShippingLeadDays(shippingMethod?: string | null): 1 | 2 {
  const normalized = (shippingMethod ?? '').trim().toLocaleLowerCase('zh-CN');

  if (
    ONE_DAY_DELIVERY_METHODS.has(normalized) ||
    normalized.includes('跑腿') ||
    normalized.includes('闪送') ||
    normalized.includes('自提') ||
    normalized.includes('自取')
  ) {
    return 1;
  }

  return 2;
}
