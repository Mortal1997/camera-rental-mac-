import { createClient as createAdminClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';

type GoofishWebhookOrder = {
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

type WebhookPayload = {
  app_key?: string;
  appid?: string;
  seller_id?: string;
  code?: number;
  msg?: string;
  data?: {
    list?: GoofishWebhookOrder[];
  };
  event_type?: string;
  timestamp?: number;
  [key: string]: unknown;
};

type OrderPayload = {
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
  metadata: GoofishWebhookOrder;
};

type BuildResult =
  | { ok: true; payload: OrderPayload }
  | { ok: false; reason: string; orderNo: string | null; rawOrder: GoofishWebhookOrder };

function buildShippingAddress(order: GoofishWebhookOrder) {
  return `${order.receiver_name ? `${order.receiver_name} | ` : ''}${order.prov_name ?? ''}${order.city_name ?? ''}${order.area_name ?? ''}${order.address ?? ''}`;
}

function buildOrderPayload(order: GoofishWebhookOrder, userId: string): BuildResult {
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

function extractMerchantIdentifier(payload: WebhookPayload): string | null {
  return (
    payload.app_key ||
    payload.appid ||
    payload.seller_id ||
    (payload as Record<string, unknown>).appId as string ||
    (payload as Record<string, unknown>).sellerId as string ||
    null
  );
}

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const log = (msg: string, data?: unknown) => {
    console.log(`[webhook/orders][${requestId}] ${msg}`, data ?? '');
  };

  try {
    log('Webhook 请求开始');

    const supabaseAdmin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    let payload: WebhookPayload;
    try {
      payload = await request.json();
    } catch {
      log('解析 JSON 失败');
      return NextResponse.json({ error: '无效的 JSON 数据' }, { status: 400 });
    }

    log('Payload 解析成功', { code: payload.code, hasData: !!payload.data });

    if (payload.code !== 0 && payload.code !== undefined) {
      log('闲管家推送错误', { code: payload.code, msg: payload.msg });
      return NextResponse.json(
        { error: payload.msg || '闲管家推送错误', code: payload.code },
        { status: 400 }
      );
    }

    const merchantId = extractMerchantIdentifier(payload);

    if (!merchantId) {
      log('无法提取商户标识', payload);
      return NextResponse.json(
        {
          error: '无法识别商户身份',
          hint: 'Webhook payload 中缺少 app_key / appid / seller_id 字段',
          received_fields: Object.keys(payload),
        },
        { status: 400 }
      );
    }

    log('提取到商户标识', { merchantId });

    const { data: settings, error: settingsError } = await supabaseAdmin
      .from('user_settings')
      .select('user_id, goofish_app_key')
      .eq('goofish_app_key', merchantId)
      .maybeSingle();

    if (settingsError) {
      log('查询 user_settings 失败', settingsError);
      return NextResponse.json({ error: '查询租户配置失败' }, { status: 500 });
    }

    if (!settings) {
      log('未找到匹配的租户配置', { merchantId });
      return NextResponse.json(
        {
          error: '未找到对应的租户配置',
          hint: `系统中未配置 app_key: ${merchantId}，请在系统设置中绑定闲管家凭证`,
          code: 'TENANT_NOT_FOUND',
        },
        { status: 404 }
      );
    }

    const userId = settings.user_id;
    log('找到租户', { userId });

    const orderList = Array.isArray(payload.data?.list) ? payload.data.list : [];

    if (orderList.length === 0) {
      log('推送数据为空');
      return NextResponse.json({
        success: true,
        message: '推送数据为空',
        processed_count: 0,
      });
    }

    const formattedResults = orderList.map((order) => buildOrderPayload(order, userId));
    const validOrders = formattedResults
      .flatMap((result) => (result.ok ? [result.payload] : []));
    const invalidOrders = formattedResults.flatMap((result) =>
      result.ok
        ? []
        : { order_no: result.orderNo, reason: result.reason, raw_order: result.rawOrder }
    );

    if (validOrders.length === 0) {
      log('订单数据格式异常，未写入', { invalidCount: invalidOrders.length });
      return NextResponse.json({
        success: true,
        message: '订单数据格式异常，未写入任何订单',
        invalid_orders: invalidOrders,
      });
    }

    log('写入数据库', { orderCount: validOrders.length });

    const { data: upsertedData, error: upsertError } = await supabaseAdmin
      .from('orders')
      .upsert(validOrders, {
        onConflict: 'platform_source,external_order_id',
        ignoreDuplicates: true,
      })
      .select('id');

    if (upsertError) {
      log('数据库写入失败', upsertError);
      return NextResponse.json({ error: '数据库写入失败', details: upsertError.message }, { status: 500 });
    }

    const insertedCount = upsertedData?.length ?? 0;
    const skippedCount = validOrders.length - insertedCount;

    log('处理完成', { insertedCount, skippedCount });

    revalidatePath('/admin/orders/dispatch');
    revalidatePath('/admin/orders');

    return NextResponse.json({
      success: true,
      message: `处理完成：写入 ${insertedCount} 条，跳过 ${skippedCount} 条重复订单`,
      processed_count: orderList.length,
      inserted_count: insertedCount,
      skipped_duplicates: skippedCount,
      invalid_orders: invalidOrders,
      tenant_id: userId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '系统异常';
    console.error(`[webhook/orders][${requestId}] unhandled error:`, message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
