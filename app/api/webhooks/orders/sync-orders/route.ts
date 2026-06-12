import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const API_URL = 'https://open.goofish.pro/api/open/order/list';
const PENDING_SHIPMENT_STATUS = 12;
const PAGE_SIZE = 50;

type GoofishOrder = {
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

type GoofishResponse = {
  code?: number;
  msg?: string;
  data?: {
    list?: GoofishOrder[];
  };
};

function md5(value: string) {
  return crypto.createHash('md5').update(value, 'utf8').digest('hex');
}

function getRequiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`缺少环境变量：${name}`);
  }
  return value;
}

function buildShippingAddress(order: GoofishOrder) {
  return `${order.receiver_name ? `${order.receiver_name} | ` : ''}${order.prov_name ?? ''}${order.city_name ?? ''}${order.area_name ?? ''}${order.address ?? ''}`;
}

type SyncPayload = {
  external_order_id: string;
  customer_name: string;
  total_price: number;
  customer_phone: string;
  shipping_address: string;
  platform_source: string;
  created_at: string;
  expected_equipment_model: string;
  status: 'unprocessed';
  start_date: string;
  end_date: string;
  deposit_exemption: string;
  shipping_method: string;
  deposit_paid: number;
  metadata: GoofishOrder;
};

type BuildPayloadResult =
  | { ok: true; payload: SyncPayload }
  | { ok: false; reason: string; orderNo: string | null; rawOrder: GoofishOrder };

type OrdersTableQuery = {
  upsert: (values: SyncPayload[], options: { onConflict: string; ignoreDuplicates: boolean }) => { select: (columns: string) => Promise<{ data: Array<{ id: string }> | null; error: { message: string; code?: string | null; hint?: string | null; details?: string | null } | null }> };
  select: (columns: string) => { eq: (column: string, value: string) => { in: (column: string, values: string[]) => Promise<{ data: Array<{ external_order_id?: string | null }> | null; error: { message: string; code?: string | null; hint?: string | null; details?: string | null } | null }> } };
  insert: (values: SyncPayload[]) => { select: (columns: string) => Promise<{ data: Array<{ id: string }> | null; error: { message: string; code?: string | null; hint?: string | null; details?: string | null } | null }> };
};

async function insertOrdersWithFallback(
  getOrdersTable: () => OrdersTableQuery,
  formattedOrders: SyncPayload[]
) {
  const upsertResult = await getOrdersTable()
    .upsert(formattedOrders, {
      onConflict: 'platform_source,external_order_id',
      ignoreDuplicates: true,
    })
    .select('id');

  if (!upsertResult.error || upsertResult.error.code !== '42P10') {
    return {
      ...upsertResult,
      mode: 'upsert' as const,
      skippedDuplicates: 0,
    };
  }

  const externalOrderIds = formattedOrders.map((order) => order.external_order_id);
  const { data: existingOrders, error: existingOrdersError } = await getOrdersTable()
    .select('external_order_id')
    .eq('platform_source', '闲鱼')
    .in('external_order_id', externalOrderIds);

  if (existingOrdersError) {
    return {
      data: null,
      error: existingOrdersError,
      mode: 'fallback_lookup_failed' as const,
      skippedDuplicates: 0,
    };
  }

  const existingIds = new Set(
    ((existingOrders ?? []) as Array<{ external_order_id?: string | null }>)
      .map((order) => order.external_order_id)
      .filter((value): value is string => typeof value === 'string' && value.length > 0)
  );

  const newOrders = formattedOrders.filter((order) => !existingIds.has(order.external_order_id));

  if (newOrders.length === 0) {
    return {
      data: [],
      error: null,
      mode: 'fallback_noop' as const,
      skippedDuplicates: formattedOrders.length,
    };
  }

  const insertResult = await getOrdersTable()
    .insert(newOrders)
    .select('id');

  return {
    ...insertResult,
    mode: 'fallback_insert' as const,
    skippedDuplicates: formattedOrders.length - newOrders.length,
  };
}

function buildSyncPayload(order: GoofishOrder): BuildPayloadResult {
  const createdAt = order.create_time ? new Date(order.create_time * 1000).toISOString() : new Date().toISOString();
  const shippingAddress = buildShippingAddress(order) || '待补充地址';
  const externalOrderId = typeof order.order_no === 'string' ? order.order_no.trim() : '';

  if (!externalOrderId) {
    return {
      ok: false,
      reason: '缺少 order_no',
      orderNo: null,
      rawOrder: order,
    };
  }

  const totalPrice = typeof order.pay_amount === 'number' && Number.isFinite(order.pay_amount)
    ? order.pay_amount / 100
    : 0;

  return {
    ok: true,
    payload: {
      external_order_id: externalOrderId,
      customer_name: order.buyer_nick || order.receiver_name || '未知买家',
      total_price: totalPrice,
      customer_phone: order.receiver_mobile || '待补充电话',
      shipping_address: shippingAddress,
      platform_source: '闲鱼',
      created_at: createdAt,
      expected_equipment_model: order.goods?.title || '未知设备',
      status: 'unprocessed',
      start_date: createdAt.slice(0, 10),
      end_date: createdAt.slice(0, 10),
      deposit_exemption: '待确认',
      shipping_method: '待确认',
      deposit_paid: 0,
      metadata: order,
    },
  };
}

export async function GET() {
  try {
    const appKey = getRequiredEnv('GOOFISH_APP_KEY');
    const appSecret = getRequiredEnv('GOOFISH_APP_SECRET');
    const supabaseUrl = getRequiredEnv('NEXT_PUBLIC_SUPABASE_URL');
    const supabaseServiceRoleKey = getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY');
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    const requestBody = {
      page_no: 1,
      page_size: PAGE_SIZE,
      order_status: PENDING_SHIPMENT_STATUS,
    };

    const bodyString = JSON.stringify(requestBody);
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const bodyMd5 = md5(bodyString);
    const sign = md5(`${appKey},${bodyMd5},${timestamp},${appSecret}`);
    const targetUrl = `${API_URL}?appid=${appKey}&timestamp=${timestamp}&sign=${sign}`;

    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: bodyString,
      cache: 'no-store',
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `闲管家请求失败，状态码 ${response.status}` },
        { status: 502 }
      );
    }

    const data = (await response.json()) as GoofishResponse;

    if (data.code !== 0 || data.msg !== 'OK') {
      return NextResponse.json(
        { error: '闲管家接口错误', details: data },
        { status: 500 }
      );
    }

    const orderList = Array.isArray(data.data?.list) ? data.data.list : [];
    const formattedResults = orderList.map(buildSyncPayload);
    const formattedOrders = formattedResults.flatMap((result) => (result.ok ? [result.payload] : []));
    const invalidOrders = formattedResults.flatMap((result) => (
      result.ok
        ? []
        : [{ order_no: result.orderNo, reason: result.reason, raw_order: result.rawOrder }]
    ));

    if (formattedOrders.length === 0) {
      return NextResponse.json({
        success: invalidOrders.length === 0,
        message: invalidOrders.length === 0 ? '当前没有待发货的订单需要同步' : '订单数据格式异常，未写入任何订单',
        inserted_count: 0,
        invalid_orders: invalidOrders,
      });
    }

    const writeResult = await insertOrdersWithFallback(
      () => supabase.from('orders') as unknown as OrdersTableQuery,
      formattedOrders
    );
    const { data: insertedData, error } = writeResult;

    if (error) {
      console.error('sync-orders database write failed', {
        message: error.message,
        code: error.code ?? null,
        hint: error.hint ?? null,
        details: error.details ?? null,
        mode: writeResult.mode,
        skipped_duplicates: writeResult.skippedDuplicates,
        sample_order: formattedOrders[0] ?? null,
      });

      return NextResponse.json(
        {
          error: '数据库写入失败',
          details: error.message,
          code: error.code ?? null,
          hint: error.hint ?? null,
        },
        { status: 500 }
      );
    }

    const insertedCount = insertedData?.length ?? 0;
    const insertedExternalOrderIds = insertedCount > 0
      ? formattedOrders.slice(0, insertedCount).map((order) => order.external_order_id)
      : [];

    return NextResponse.json({
      success: true,
      message: `成功同步 ${insertedCount} 条闲管家待发货订单`,
      inserted_count: insertedCount,
      inserted_external_order_ids: insertedExternalOrderIds,
      fetched_count: formattedOrders.length,
      skipped_duplicates: writeResult.skippedDuplicates,
      sync_mode: writeResult.mode,
      invalid_orders: invalidOrders,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '系统异常';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
