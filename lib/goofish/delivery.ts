// =====================================================================
// 闲管家发货回传客户端
// ---------------------------------------------------------------------
// 协议源：open.goofish.pro "发货回传" OpenAPI（待人工核对文档）
// 现状：本文件是占位实现（STUB），签名风格与 lib 现有的 sync-orders
// 路由保持一致（md5(appKey, bodyMd5, timestamp, appSecret)），但
// 具体的 endpoint URL、body 字段、回执 code 语义需核对官方文档后
// 调整 pushDelivery()。
//
// 之所以采用 stub：闲管家"发货回传"的接口名称/参数/回执码不在我
// 的训练数据中，业务确认协议前贸然上线可能导致：
//   1) 调用了不存在的接口 → 502
//   2) 字段名错位 → 闲管家 200 但实际未发货
//   3) 签名串拼接错误 → 闲管家签名校验失败
//
// 上线前必须人工核对：
//   1) 真实 endpoint 路径（占位为 /api/open/order/delivery）
//   2) body 必填字段（占位为 order_no + waybill_no + waybill_type）
//   3) 成功响应 code 语义（占位为 code === 0）
// =====================================================================

import crypto from 'node:crypto';

const GOOFISH_API_BASE = 'https://open.goofish.pro';
// TODO：核对真实 endpoint。当前占位是 /api/open/order/delivery。
const DELIVERY_ENDPOINT = `${GOOFISH_API_BASE}/api/open/order/delivery`;

// 跑腿/自提 闲管家可能不支持回传（无运单号），这里用占位常量；
// 上线前需要核对：是否需要把 pickup / hainter 映射为特殊 type
// 或者根本不需要回传给闲管家。
export const SHIPPING_METHODS = ['express', 'hainter', 'pickup'] as const;
export type ShippingMethod = (typeof SHIPPING_METHODS)[number];

export type PushDeliveryInput = {
  appKey: string;
  appSecret: string;
  externalOrderId: string;        // 闲鱼订单号
  trackingNumber?: string;        // 快递/跑腿 单号；自提可不填
  shippingMethod: ShippingMethod; // 三选一
};

export type PushDeliveryResult =
  | { ok: true; mode: 'live' | 'stub'; raw?: unknown }
  | { ok: false; reason: string; details?: unknown; mode: 'live' | 'stub' };

function md5(value: string): string {
  return crypto.createHash('md5').update(value, 'utf8').digest('hex');
}

function buildSign(appKey: string, bodyMd5: string, timestamp: string, appSecret: string): string {
  // 与 sync-orders 路由保持一致的拼接方式：md5(appKey, bodyMd5, timestamp, appSecret)
  // 注意：四个值以英文逗号拼接，顺序与数量与 sync-orders 一致
  return md5(`${appKey},${bodyMd5},${timestamp},${appSecret}`);
}

function buildRequestBody(input: PushDeliveryInput): Record<string, unknown> {
  // TODO：核对闲管家"发货回传" body 真实字段名。当前占位：
  //   order_no        闲鱼订单号
  //   waybill_no      运单号（自提场景留空）
  //   waybill_type    express / hainter / pickup
  return {
    order_no: input.externalOrderId,
    waybill_no: input.trackingNumber ?? '',
    waybill_type: input.shippingMethod,
  };
}

/**
 * 调用闲管家"发货回传" OpenAPI。
 *
 * 当前为 STUB：真实协议未核对，本函数
 *   - 不发起网络请求
 *   - 构造期望的 request 形状（method/headers/body/sign/url）并打日志
 *   - 始终返回 { ok: true, mode: 'stub' }
 *
 * 协议核对完毕后，把 __STUB__ 标志改为 false 即可真正发起 fetch。
 *
 * 失败语义：调用方应把"回传失败"记为 warning 而非阻断发货——本地
 * 状态已经更新为 'using'，业务不会因为闲管家暂时抽风而卡住。后续
 * 可加一个离线队列重试。
 */
export async function pushDelivery(input: PushDeliveryInput): Promise<PushDeliveryResult> {
  // 基础校验
  if (!input.appKey || !input.appSecret) {
    return { ok: false, reason: '缺少 appKey/appSecret', mode: 'stub' };
  }
  if (!input.externalOrderId) {
    return { ok: false, reason: '缺少 externalOrderId', mode: 'stub' };
  }
  if (input.shippingMethod === 'express' && !input.trackingNumber) {
    return { ok: false, reason: '快递方式必须提供运单号', mode: 'stub' };
  }

  const body = buildRequestBody(input);
  const bodyString = JSON.stringify(body);
  const bodyMd5 = md5(bodyString);
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const sign = buildSign(input.appKey, bodyMd5, timestamp, input.appSecret);
  const url = `${DELIVERY_ENDPOINT}?appid=${encodeURIComponent(input.appKey)}&timestamp=${timestamp}&sign=${sign}`;

  // 打结构化日志，方便协议核对时直接复用
  console.log('[goofish/delivery] STUB 即将请求闲管家发货回传（当前未真实发送）', {
    url,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    signInputs: { appKey: input.appKey, bodyMd5, timestamp, appSecretTail: `***${input.appSecret.slice(-4)}` },
  });

  // ============================================================
  // STUB 标志：把下面这一段打开就是真实网络调用
  // ============================================================
  const __STUB__ = true;
  if (__STUB__) {
    return { ok: true, mode: 'stub' };
  }

  // 真实调用（协议核对后启用）
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
