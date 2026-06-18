// =====================================================================
// 闲管家发货回传客户端（真实接入）
// ---------------------------------------------------------------------
// 协议源：闲管家"订单物流发货" OpenAPI
//   POST /api/open/order/ship
//   Query: appid / timestamp / sign  （seller_id 文档说自研 ERP 忽略）
//   Body:  { order_no, waybill_no, express_code, express_name, ...寄件方可选 }
//
// 寄件方（ship_*）我们一律不传，由用户在闲管家开放平台后台配置默认
// 发货地址。文档明确说："如以上参数均不传入，则需要用户在闲管家后
// 台填写默认发货地址"——这条就是为自研 ERP 准备的。
//
// 签名算法（已核对）：
//   sign = md5(`${appKey},${bodyMd5},${timestamp},${appSecret}`)
// 2026-06-18 用官方文档示例数（appKey=203413189371893, bodyMd5=2608f...,
// timestamp=1636087298, appSecret=o9wl81d...）验证：c26c8a48809141f3... ✅
// =====================================================================
//
// 跑腿/自提：闲管家只支持"快递"场景。我们对跑腿/自提直接短路返回
// { ok: true, skipped: 'no_carrier' }，不发起任何请求。
// =====================================================================

import crypto from 'node:crypto';

const GOOFISH_API_BASE = 'https://open.goofish.pro';
const SHIP_ENDPOINT = `${GOOFISH_API_BASE}/api/open/order/ship`;

// 跑腿/自提 闲管家不支持回传（无真实快递公司）
export const SHIPPING_METHODS = ['express', 'hainter', 'pickup'] as const;
export type ShippingMethod = (typeof SHIPPING_METHODS)[number];

export type PushDeliveryInput = {
  appKey: string;
  appSecret: string;
  externalOrderId: string;            // 闲鱼订单号
  trackingNumber?: string;            // 快递单号；跑腿/自提不传
  shippingMethod: ShippingMethod;
  // 快递公司（仅 shippingMethod === 'express' 时必填）
  expressCode?: string;               // 例如 'shunfeng'
  expressName?: string;               // 例如 '顺丰速运'
};

export type PushDeliveryResult =
  | { ok: true; mode: 'live'; raw?: unknown; skipped?: 'no_carrier' }
  | { ok: false; reason: string; details?: unknown; mode: 'live' };

function md5(value: string): string {
  return crypto.createHash('md5').update(value, 'utf8').digest('hex');
}

function buildSign(appKey: string, bodyMd5: string, timestamp: string, appSecret: string): string {
  return md5(`${appKey},${bodyMd5},${timestamp},${appSecret}`);
}

function buildRequestBody(input: PushDeliveryInput): Record<string, unknown> {
  // 寄件方（ship_*）一律不传，让用户在闲管家后台配默认发货地址
  return {
    order_no: input.externalOrderId,
    waybill_no: input.trackingNumber ?? '',
    express_code: input.expressCode ?? '',
    express_name: input.expressName ?? '',
  };
}

/**
 * 调用闲管家"订单物流发货" OpenAPI。
 *
 * 跑腿/自提：短路返回 { ok: true, skipped: 'no_carrier' }，不发起请求。
 *
 * 失败语义：调用方应把"回传失败"记为 warning 而非阻断发货——本地
 * 状态已经更新为 'using'，业务不会因为闲管家暂时抽风而卡住。
 */
export async function pushDelivery(input: PushDeliveryInput): Promise<PushDeliveryResult> {
  // 跑腿/自提：闲管家不支持，直接跳过
  if (input.shippingMethod !== 'express') {
    return { ok: true, mode: 'live', skipped: 'no_carrier' };
  }

  // 基础校验
  if (!input.appKey || !input.appSecret) {
    return { ok: false, reason: '缺少 appKey/appSecret', mode: 'live' };
  }
  if (!input.externalOrderId) {
    return { ok: false, reason: '缺少 externalOrderId', mode: 'live' };
  }
  if (!input.trackingNumber) {
    return { ok: false, reason: '快递方式必须提供运单号', mode: 'live' };
  }
  if (!input.expressCode || !input.expressName) {
    return { ok: false, reason: '快递方式必须提供快递公司（expressCode/expressName）', mode: 'live' };
  }

  const body = buildRequestBody(input);
  const bodyString = JSON.stringify(body);
  const bodyMd5 = md5(bodyString);
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const sign = buildSign(input.appKey, bodyMd5, timestamp, input.appSecret);
  const url = `${SHIP_ENDPOINT}?appid=${encodeURIComponent(input.appKey)}&timestamp=${timestamp}&sign=${sign}`;

  // 打结构化日志（appSecret 不打原文）
  console.log('[goofish/delivery] 即将请求闲管家发货回传', {
    url,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    signInputs: { appKey: input.appKey, bodyMd5, timestamp, appSecretTail: `***${input.appSecret.slice(-4)}` },
  });

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: bodyString,
      cache: 'no-store',
    });
    if (!response.ok) {
      return {
        ok: false,
        reason: `闲管家请求失败，状态码 ${response.status}`,
        mode: 'live',
      };
    }
    const data = (await response.json()) as { code?: number; msg?: string; data?: unknown };
    if (data.code !== 0) {
      return {
        ok: false,
        reason: `闲管家接口错误：code=${data.code}, msg=${data.msg ?? ''}`,
        details: data,
        mode: 'live',
      };
    }
    return { ok: true, mode: 'live', raw: data };
  } catch (error) {
    const message = error instanceof Error ? error.message : '网络异常';
    return { ok: false, reason: message, mode: 'live' };
  }
}
