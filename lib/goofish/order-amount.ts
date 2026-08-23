export type GoofishAmountSource = 'pay_amount' | 'total_amount';

export type GoofishAmountFields = {
  pay_amount?: unknown;
  total_amount?: unknown;
};

export type GoofishFinalAmount = {
  amount: number;
  source: GoofishAmountSource;
};

function amountInYuan(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return null;
  }

  return value / 100;
}

/**
 * 闲管家的金额单位为分。pay_amount 是改价后的实际成交金额，优先级最高；
 * 旧数据缺少 pay_amount 时才回退到 total_amount。
 */
export function getGoofishFinalAmount(order: GoofishAmountFields): GoofishFinalAmount | null {
  const paidAmount = amountInYuan(order.pay_amount);
  if (paidAmount !== null) {
    return { amount: paidAmount, source: 'pay_amount' };
  }

  const totalAmount = amountInYuan(order.total_amount);
  if (totalAmount !== null) {
    return { amount: totalAmount, source: 'total_amount' };
  }

  return null;
}

/** 新同步到了有效成交价时覆盖旧价；上游没有有效金额时保留本地值。 */
export function chooseSyncedOrderAmount(existingAmount: number, upstreamAmount: number): number {
  return Number.isFinite(upstreamAmount) && upstreamAmount > 0
    ? upstreamAmount
    : existingAmount;
}
