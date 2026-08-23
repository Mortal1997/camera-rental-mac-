// =====================================================================
// 闲管家订单详情查询客户端
// ---------------------------------------------------------------------
// 用途：闲管家「订单推送通知」OpenAPI 只携带 user_name / order_no /
// order_status / modify_time 等关键字段，不含收货地址 / 电话 / 金额 /
// 商品标题。要拿到这些数据，必须主动调
//   POST /api/open/order/detail
// 直接按 order_no 获取最新订单对象。
//
// 签名算法（已核对，和 webhook / delivery 一致）：
//   sign = md5(`${appKey},${bodyMd5},${timestamp},${appSecret}`)
//   query: appid / timestamp / sign
//   body:  { order_no }
//
// 失败语义：detail 接口失败不能让订单消失——webhook 已成功收到推送，
// 占位符订单必须保留（不要因为一个网络抖动就丢了订单）。所以这里
// 失败返回 null 而不是 throw，调用方继续走占位符落库。
// =====================================================================

import crypto from 'node:crypto';

const GOOFISH_API_BASE = 'https://open.goofish.pro';
const ORDER_DETAIL_ENDPOINT = `${GOOFISH_API_BASE}/api/open/order/detail`;

export type GoofishOrderDetail = {
  order_no?: string;
  buyer_nick?: string;
  pay_amount?: number;
  total_amount?: number;
  receiver_mobile?: string;
  receiver_name?: string;
  prov_name?: string;
  city_name?: string;
  area_name?: string;
  address?: string;
  create_time?: number;
  update_time?: number;
  goods?: {
    title?: string;
  };
  [key: string]: unknown;
};

export type FetchOrderDetailInput = {
  appKey: string;
  appSecret: string;
  orderNo: string;
};

export type FetchOrderDetailResult =
  | { ok: true; order: GoofishOrderDetail | null }
  | { ok: false; reason: string; status?: number };

function md5(value: string): string {
  return crypto.createHash('md5').update(value, 'utf8').digest('hex');
}

function buildSign(appKey: string, bodyMd5: string, timestamp: string, appSecret: string): string {
  return md5(`${appKey},${bodyMd5},${timestamp},${appSecret}`);
}

/**
 * 按 order_no 拉取闲管家订单详情。
 * 返回 ok=true 时 order 可能为 null（接口正常但没找到），调用方应继续走占位符。
 * 返回 ok=false 时说明网络 / 鉴权 / 协议错误，调用方也应继续走占位符。
 */
export async function fetchOrderDetailByNo(
  input: FetchOrderDetailInput,
): Promise<FetchOrderDetailResult> {
  if (!input.appKey || !input.appSecret) {
    return { ok: false, reason: '缺少 appKey/appSecret' };
  }
  if (!input.orderNo) {
    return { ok: false, reason: '缺少 orderNo' };
  }

  const body = { order_no: input.orderNo };
  const bodyString = JSON.stringify(body);
  const bodyMd5 = md5(bodyString);
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const sign = buildSign(input.appKey, bodyMd5, timestamp, input.appSecret);
  const url = `${ORDER_DETAIL_ENDPOINT}?appid=${encodeURIComponent(input.appKey)}&timestamp=${timestamp}&sign=${sign}`;

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
        status: response.status,
      };
    }

    const data = (await response.json()) as {
      code?: number;
      msg?: string;
      data?: GoofishOrderDetail;
    };

    if (data.code !== 0) {
      return {
        ok: false,
        reason: `闲管家接口错误：code=${data.code}, msg=${data.msg ?? ''}`,
      };
    }

    const order = data.data && typeof data.data === 'object' ? data.data : null;
    if (order?.order_no && order.order_no !== input.orderNo) {
      return { ok: false, reason: '闲管家返回了不匹配的订单号' };
    }

    return { ok: true, order };
  } catch (error) {
    const message = error instanceof Error ? error.message : '网络异常';
    return { ok: false, reason: message };
  }
}
