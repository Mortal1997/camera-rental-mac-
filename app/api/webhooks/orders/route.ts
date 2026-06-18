// =====================================================================
// PLACEHOLDER IMPLEMENTATION — Goofish / 闲管家 订单推送通知
// ---------------------------------------------------------------------
// 协议源：open.goofish.pro "订单推送通知" OpenAPI
// 真实路径由商家在闲管家开放平台填入；本路由挂在 /api/webhooks/orders
// 上游 POST 表单/JSON 格式：appid / timestamp / sign 走 query，
//  body 是单个订单对象（seller_id, user_name, order_no, order_type,
//  order_status, refund_status, modify_time, product_id, item_id）。
//
// 上线前必须人工核对：
//   1) sign 拼接顺序：当前实现为 MD5(appid + timestamp + appsecret)
//      ——闲管家官方签名说明若不一致，需调整 computeSignature()
//   2) appsecret 来源：当前从 user_settings.goofish_app_secret 读；
//      若官方要求 header 透传 secret，调整 fetchTenantSettings()
//   3) timestamp 单位：当前按"秒"处理（与文档示例 1636077365 一致）
//
// 重试：上游失败最多 3 次；本端 3 秒内必须返回响应，所以业务逻辑尽量精简。
// =====================================================================

import { createClient as createAdminClient } from '@supabase/supabase-js';
import { createHash } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// ---------------------------------------------------------------------
// 类型：闲管家推送的订单 body（顶层就是订单，无 data.list 包装）
// ---------------------------------------------------------------------
type GoofishOrderType = 1 | 2 | 3 | 4 | 7 | 8 | 9 | 10;
type GoofishOrderStatus = 11 | 12 | 21 | 22 | 23 | 24;
type GoofishRefundStatus = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 8;

type GoofishOrderPayload = {
  seller_id?: number | string;
  user_name?: string;
  order_no?: string;
  order_type?: GoofishOrderType | number;
  order_status?: GoofishOrderStatus | number;
  refund_status?: GoofishRefundStatus | number;
  modify_time?: number;
  product_id?: number;
  item_id?: number;
  [key: string]: unknown;
};

// 与 orders 表 status 字段对齐
type OrderStatus =
  | 'unprocessed'
  | 'pending_payment'
  | 'confirmed'
  | 'using'
  | 'returned'
  | 'cancelled';

type OrderRow = {
  user_id: string;
  external_order_id: string;
  platform_source: '闲鱼';
  customer_name: string;
  customer_phone: string;
  total_price: number;
  shipping_address: string;
  expected_equipment_model: string;
  status: OrderStatus;
  start_date: string;
  end_date: string;
  deposit_exemption: string;
  shipping_method: string;
  deposit_paid: number;
  metadata: GoofishOrderPayload;
};

// 文档 order_status 枚举 → 内部 status
const ORDER_STATUS_MAP: Record<number, OrderStatus> = {
  11: 'pending_payment', // 待付款
  12: 'unprocessed',     // 待发货 → 进入派单池
  21: 'using',           // 已发货 → 履约中
  22: 'returned',        // 已完成
  23: 'cancelled',       // 已退款
  24: 'cancelled',       // 已关闭
};

// ---------------------------------------------------------------------
// 签名校验：MD5(appid + timestamp + appsecret) — 上线前需核对官方算法
// ---------------------------------------------------------------------
function md5(input: string): string {
  return createHash('md5').update(input, 'utf8').digest('hex');
}

function computeSignature(appid: string, timestamp: string, appSecret: string): string {
  return md5(`${appid}${timestamp}${appSecret}`);
}

function safeTimingEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const FIVE_MINUTES_SEC = 5 * 60;

function isTimestampFresh(timestampRaw: string | null, nowSec = Math.floor(Date.now() / 1000)): boolean {
  if (!timestampRaw) return false;
  const ts = Number(timestampRaw);
  if (!Number.isFinite(ts)) return false;
  return Math.abs(nowSec - ts) <= FIVE_MINUTES_SEC;
}

// ---------------------------------------------------------------------
// Payload 映射
// ---------------------------------------------------------------------
function mapOrderStatus(raw: number | undefined): OrderStatus {
  if (raw === undefined) return 'unprocessed';
  return ORDER_STATUS_MAP[raw] ?? 'unprocessed';
}

function buildOrderRow(payload: GoofishOrderPayload, userId: string): OrderRow {
  const modifyTime = typeof payload.modify_time === 'number' ? payload.modify_time : null;
  const createdAt = modifyTime
    ? new Date(modifyTime * 1000).toISOString()
    : new Date().toISOString();

  const externalOrderId =
    typeof payload.order_no === 'string' ? payload.order_no.trim() : '';

  return {
    user_id: userId,
    external_order_id: externalOrderId,
    platform_source: '闲鱼',
    customer_name: payload.user_name || '未知买家',
    customer_phone: '待补充电话',           // 文档未提供收货人电话，留待后续接口补
    total_price: 0,                          // 文档未提供金额
    shipping_address: '待补充地址',          // 文档未提供收货地址
    expected_equipment_model: '未知设备',    // 文档未提供商品名（只有 product_id / item_id）
    status: mapOrderStatus(payload.order_status as number | undefined),
    start_date: createdAt.slice(0, 10),
    end_date: createdAt.slice(0, 10),
    deposit_exemption: '待确认',
    shipping_method: '待确认',
    deposit_paid: 0,
    metadata: payload,
  };
}

// ---------------------------------------------------------------------
// 幂等 upsert：以 modify_time 大小决定是否覆盖，避免重试把新状态刷旧
// ---------------------------------------------------------------------
// 注：项目尚未生成 Database 类型（supabase typescript output），这里用
// 宽松的 client 类型并在调用点做 narrow cast，风格与 app/actions/
// finance-actions.ts 中的 (data ?? []) as OrderWithEquipment[] 一致。
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AdminClient = any;

async function upsertOrderAtomic(
  supabaseAdmin: AdminClient,
  row: OrderRow,
): Promise<{ action: 'inserted' | 'updated' | 'skipped'; error?: string }> {
  const incomingModifyTime = (row.metadata.modify_time as number | undefined) ?? 0;

  // 1) 先查现有行 + 现有 modify_time（按 user_id + 平台 + 订单号定位）
  const { data: existing, error: selectError } = await supabaseAdmin
    .from('orders')
    .select('id, metadata')
    .eq('user_id', row.user_id)
    .eq('platform_source', row.platform_source)
    .eq('external_order_id', row.external_order_id)
    .maybeSingle();

  if (selectError) return { action: 'skipped', error: selectError.message };

  if (!existing) {
    // 全新订单：插入
    const { error: insertError } = await supabaseAdmin
      .from('orders')
      .insert(row as never);
    if (insertError) return { action: 'skipped', error: insertError.message };
    return { action: 'inserted' };
  }

  const existingRow = existing as { id: string; metadata: { modify_time?: number } | null };
  const existingModifyTime =
    typeof existingRow.metadata?.modify_time === 'number'
      ? existingRow.metadata.modify_time
      : 0;

  if (incomingModifyTime < existingModifyTime) {
    // 重试/补推送送来的旧事件，跳过
    return { action: 'skipped' };
  }

  // 新事件或同 modify_time：覆盖（id 不变，触发 RLS 校验 user_id）
  const { error: updateError } = await supabaseAdmin
    .from('orders')
    .update(row as never)
    .eq('id', existingRow.id);

  if (updateError) return { action: 'skipped', error: updateError.message };
  return { action: 'updated' };
}

// ---------------------------------------------------------------------
// 路由
// ---------------------------------------------------------------------
export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const log = (msg: string, data?: unknown) => {
    console.log(`[webhook/orders][${requestId}] ${msg}`, data ?? '');
  };

  const fail = (msg: string, httpStatus = 200): NextResponse =>
    NextResponse.json({ result: 'fail', msg }, { status: httpStatus });

  const ok = (msg = '接收成功'): NextResponse =>
    NextResponse.json({ result: 'success', msg }, { status: 200 });

  try {
    log('Webhook 请求开始');

    // -------- 1. 取 query 参数 --------
    const appid = request.nextUrl.searchParams.get('appid')?.trim() ?? '';
    const timestamp = request.nextUrl.searchParams.get('timestamp')?.trim() ?? '';
    const sign = request.nextUrl.searchParams.get('sign')?.trim() ?? '';

    if (!appid || !sign) {
      log('缺少必要 query 参数', { hasAppid: !!appid, hasSign: !!sign });
      return fail('缺少 appid 或 sign');
    }

    // -------- 2. timestamp 5 分钟有效期（防重放） --------
    if (!isTimestampFresh(timestamp)) {
      log('timestamp 校验失败', { timestamp, now: Math.floor(Date.now() / 1000) });
      return fail('timestamp 无效或已过期');
    }

    // -------- 3. 解析 body（必须顶层就是订单对象） --------
    let payload: GoofishOrderPayload;
    try {
      payload = (await request.json()) as GoofishOrderPayload;
    } catch {
      log('解析 JSON 失败');
      return fail('无效的 JSON 数据', 400);
    }

    if (!payload || typeof payload !== 'object') {
      return fail('body 必须为 JSON 对象');
    }

    if (!payload.order_no || typeof payload.order_no !== 'string') {
      log('缺少 order_no');
      return fail('缺少 order_no');
    }

    // -------- 4. 查租户（顺带拿 app_secret 做签名校验） --------
    // 用 service_role（不走用户 RLS）查 user_settings，
    // 所以 service_role key 绝不能走 NEXT_PUBLIC_*，否则会进客户端 bundle。
    const supabaseAdmin = createAdminClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    const { data: settings, error: settingsError } = await supabaseAdmin
      .from('user_settings')
      .select('user_id, goofish_app_key, goofish_app_secret')
      .eq('goofish_app_key', appid)
      .maybeSingle();

    if (settingsError) {
      log('查询 user_settings 失败', settingsError);
      return fail('查询租户配置失败');
    }

    if (!settings) {
      log('未找到匹配的租户配置', { appid });
      return fail('未找到对应的租户配置');
    }

    if (!settings.goofish_app_secret) {
      log('租户未配置 app_secret', { userId: settings.user_id });
      return fail('租户未配置 app_secret');
    }

    // -------- 5. 签名校验 --------
    const expected = computeSignature(appid, timestamp, settings.goofish_app_secret);
    if (!safeTimingEqual(expected.toLowerCase(), sign.toLowerCase())) {
      log('签名校验失败', { appid, timestamp });
      return fail('签名校验失败');
    }

    log('签名校验通过', { userId: settings.user_id, orderNo: payload.order_no });

    // -------- 6. 映射 + 幂等 upsert --------
    const row = buildOrderRow(payload, settings.user_id);
    const result = await upsertOrderAtomic(supabaseAdmin, row);

    if (result.error) {
      log('DB 写入失败', { error: result.error, orderNo: payload.order_no });
      return fail(result.error);
    }

    log('订单处理完成', { orderNo: payload.order_no, action: result.action });

    // -------- 7. 失效缓存（非阻塞尽力而为） --------
    try {
      revalidatePath('/admin/orders/dispatch');
      revalidatePath('/admin/orders');
      revalidatePath('/admin/orders/completed');
    } catch (e) {
      log('revalidatePath 失败（忽略）', e);
    }

    return ok();
  } catch (error) {
    const message = error instanceof Error ? error.message : '内部处理失败';
    console.error(`[webhook/orders][${requestId}] unhandled error:`, message);
    // 仍返回 success：上游重试 3 次也是浪费；内部错误应依赖监控告警而非重试风暴
    // 但为安全起见按文档惯例仍返 fail
    return fail(message);
  }
}
