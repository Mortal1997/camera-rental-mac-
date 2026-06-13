import crypto from 'crypto';
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';

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

function buildShippingAddress(order: GoofishOrder) {
  return `${order.receiver_name ? `${order.receiver_name} | ` : ''}${order.prov_name ?? ''}${order.city_name ?? ''}${order.area_name ?? ''}${order.address ?? ''}`;
}

type SyncPayload = {
  user_id: string;
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

async function buildSyncPayload(order: GoofishOrder, userId: string): Promise<BuildPayloadResult> {
  const createdAt = order.create_time
    ? new Date(order.create_time * 1000).toISOString()
    : new Date().toISOString();
  const shippingAddress = buildShippingAddress(order) || '待补充地址';
  const externalOrderId = typeof order.order_no === 'string' ? order.order_no.trim() : '';

  if (!externalOrderId) {
    return { ok: false, reason: '缺少 order_no', orderNo: null, rawOrder: order };
  }

  const totalPrice =
    typeof order.pay_amount === 'number' && Number.isFinite(order.pay_amount)
      ? order.pay_amount / 100
      : 0;

  return {
    ok: true,
    payload: {
      user_id: userId,
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
    const supabase = await createClient();

    // ── Step 1：获取当前登录用户 ──
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: '未登录或会话已过期，请重新登录' },
        { status: 401 }
      );
    }

    // ── Step 2：查询该用户的闲管家凭证 ──
    const { data: settings, error: settingsError } = await supabase
      .from('user_settings')
      .select('goofish_app_key, goofish_app_secret')
      .eq('user_id', user.id)
      .maybeSingle();

    if (settingsError) {
      console.error('[sync-orders] 查询用户配置失败:', settingsError);
      return NextResponse.json(
        { error: '读取用户配置失败，请稍后重试' },
        { status: 500 }
      );
    }

    if (!settings?.goofish_app_key || !settings?.goofish_app_secret) {
      return NextResponse.json(
        {
          error: '尚未配置闲管家 API 凭证',
          hint: '请前往「系统设置」填写 AppKey 和 AppSecret 后再同步',
        },
        { status: 400 }
      );
    }

    const { goofish_app_key: appKey, goofish_app_secret: appSecret } = settings;

    // ── Step 3：用用户凭证请求闲管家 API ──
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
    const formattedResults = await Promise.all(orderList.map((o) => buildSyncPayload(o, user.id)));
    const formattedOrders = formattedResults
      .flatMap((result) => (result.ok ? [result.payload] : []));
    const invalidOrders = formattedResults.flatMap((result) =>
      result.ok
        ? []
        : [{ order_no: result.orderNo, reason: result.reason, raw_order: result.rawOrder }]
    );

    if (formattedOrders.length === 0) {
      return NextResponse.json({
        success: true,
        message:
          invalidOrders.length === 0
            ? '当前没有待发货的订单需要同步'
            : '订单数据格式异常，未写入任何订单',
        inserted_count: 0,
        invalid_orders: invalidOrders,
      });
    }

    // ── Step 4：写入数据库 ──
    const { data: insertedData, error } = await supabase
      .from('orders')
      .upsert(formattedOrders, {
        onConflict: 'external_order_id',
        ignoreDuplicates: true,
      })
      .select('id');

    if (error) {
      console.error('[sync-orders] 数据库写入失败:', error);
      return NextResponse.json(
        { error: '数据库写入失败', details: error.message },
        { status: 500 }
      );
    }

    const insertedCount = insertedData?.length ?? 0;
    const insertedExternalOrderIds = insertedCount > 0
      ? formattedOrders.slice(0, insertedCount).map((order) => order.external_order_id)
      : [];

    revalidatePath('/admin/orders/dispatch');
    revalidatePath('/admin/orders');

    return NextResponse.json({
      success: true,
      message: `成功同步 ${insertedCount} 条闲管家待发货订单`,
      inserted_count: insertedCount,
      inserted_external_order_ids: insertedExternalOrderIds,
      fetched_count: formattedOrders.length,
      skipped_duplicates: formattedOrders.length - insertedCount,
      invalid_orders: invalidOrders,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '系统异常';
    console.error('[sync-orders] unhandled error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
