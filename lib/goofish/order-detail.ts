// =====================================================================
// 闲管家订单详情查询客户端
// ---------------------------------------------------------------------
// 用途：闲管家「订单推送通知」OpenAPI 只携带 user_name / order_no /
// order_status / modify_time 等关键字段，不含收货地址 / 电话 / 金额 /
// 商品标题。要拿到这些数据，必须主动调
//   POST /api/open/order/list
// 拿到原始订单对象，再用 order_no 定位（同一 order_no 一定唯一）。
//
// 签名算法（已核对，和 webhook / delivery 一致）：
//   sign = md5(`${appKey},${bodyMd5},${timestamp},${appSecret}`)
//   query: appid / timestamp / sign
//   body:  { page_no, page_size, order_status?, order_no? }
//
// 失败语义：detail 接口失败不能让订单消失——webhook 已成功收到推送，
// 占位符订单必须保留（不要因为一个网络抖动就丢了订单）。所以这里
// 失败返回 null 而不是 throw，调用方继续走占位符落库。
// =====================================================================

import crypto from 'node:crypto';

const GOOFISH_API_BASE = 'https://open.goofish.pro';
const ORDER_LIST_ENDPOINT = `${GOOFISH_API_BASE}/api/open/order/list`;

export type GoofishOrderDetail = {
  order_no?: string;
  buyer_nick?: string;
  pay_amount?: number;
  receiver_mobile?: string;
  receiver_name?: string;
  prov_name?: string;
  city_name?: string;
  area_name?: string;
  address?: string;
  create_time?: number;
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

  const body = {
    page_no: 1,
    page_size: 50,
    order_no: input.orderNo,
  };
  const bodyString = JSON.stringify(body);
  const bodyMd5 = md5(bodyString);
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const sign = buildSign(input.appKey, bodyMd5, timestamp, input.appSecret);
  const url = `${ORDER_LIST_ENDPOINT}?appid=${encodeURIComponent(input.appKey)}&timestamp=${timestamp}&sign=${sign}`;

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
      data?: { list?: GoofishOrderDetail[] };
    };

    if (data.code !== 0) {
      return {
        ok: false,
        reason: `闲管家接口错误：code=${data.code}, msg=${data.msg ?? ''}`,
      };
    }

    const list = Array.isArray(data.data?.list) ? data.data.list : [];
    const found = list.find((o) => o?.order_no === input.orderNo) ?? null;
    return { ok: true, order: found };
  } catch (error) {
    const message = error instanceof Error ? error.message : '网络异常';
    return { ok: false, reason: message };
  }
}
