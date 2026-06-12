import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const SF_API_URL = 'https://sfapi.sf-express.com/std/service';
const SF_SERVICE_CODE = 'EXP_RECE_CREATE_ORDER';

type SfApiResponse = {
  success?: boolean;
  apiResultCode?: string;
  apiErrorMsg?: string;
  waybillNo?: string | string[];
  [key: string]: unknown;
};

type RequestBody = {
  orderId: string;
  pickupTime?: string;
};

type Order = {
  id: string;
  customer_name: string | null;
  customer_phone: string | null;
  shipping_address: string | null;
  tracking_number: string | null;
  status: string;
};

type UserSettings = {
  sf_partner_id: string | null;
  sf_check_word: string | null;
  sf_sender_name: string | null;
  sf_sender_phone: string | null;
  sf_sender_address: string | null;
};

function getRequiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`缺少环境变量：${name}`);
  return value;
}

function md5(value: string): string {
  return crypto.createHash('md5').update(value, 'utf8').digest('hex');
}

function base64(value: Buffer): string {
  return value.toString('base64');
}

function buildSfSignature(msgData: string, timestamp: string, checkWord: string): string {
  const raw = msgData + timestamp + checkWord;
  const encoded = encodeURIComponent(raw);
  return base64(Buffer.from(md5(encoded), 'hex'));
}

async function callSfApi(
  partnerId: string,
  msgData: string,
  timestamp: string,
  checkWord: string
): Promise<SfApiResponse> {
  const requestId = crypto.randomUUID();
  const msgDigest = buildSfSignature(msgData, timestamp, checkWord);

  const payload = {
    partnerID: partnerId,
    requestID: requestId,
    serviceCode: SF_SERVICE_CODE,
    timestamp,
    msgData,
    msgDigest,
  };

  const res = await fetch(SF_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json;charset=utf-8' },
    body: JSON.stringify(payload),
    cache: 'no-store',
  });

  if (!res.ok) {
    throw new Error(`顺丰接口 HTTP 异常：${res.status} ${res.statusText}`);
  }

  return (await res.json()) as SfApiResponse;
}

function buildSfMsgData(params: {
  orderId: string;
  senderName: string;
  senderPhone: string;
  senderAddress: string;
  receiverName: string;
  receiverPhone: string;
  receiverAddress: string;
  pickupTime?: string | null;
}) {
  const msgData: Record<string, unknown> = {
    language: 'zh-CN',
    orderId: params.orderId,
    expressTypeId: 1,
    payMethod: 2,
    cargoDetails: [
      {
        cargoName: '数码相机（大疆Pocket3租赁）',
        cargoCount: 1,
        cargoUnit: '台',
      },
    ],
    contactInfoList: [
      {
        contactType: 1,
        contactName: params.senderName,
        mobile: params.senderPhone,
        address: params.senderAddress,
      },
      {
        contactType: 2,
        contactName: params.receiverName,
        mobile: params.receiverPhone,
        address: params.receiverAddress,
      },
    ],
  };

  if (params.pickupTime) {
    msgData.sendStartTime = params.pickupTime;
  }

  return JSON.stringify(msgData);
}

function normalizeText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

export async function POST(request: Request) {
  try {
    // TODO: 后续接入真实 session 后，从 session 中获取 userId
    const TEST_USER_ID = '00000000-0000-0000-0000-000000000000';
    const userId = TEST_USER_ID;

    let body: RequestBody;
    try {
      body = (await request.json()) as RequestBody;
    } catch {
      return NextResponse.json({ success: false, error: '请求体必须是合法 JSON' }, { status: 400 });
    }

    const { orderId, pickupTime } = body;
    if (!orderId || typeof orderId !== 'string') {
      return NextResponse.json({ success: false, error: '缺少 orderId 参数' }, { status: 400 });
    }

    const supabaseUrl = getRequiredEnv('NEXT_PUBLIC_SUPABASE_URL');
    const supabaseServiceRoleKey = getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY');
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // 查询用户顺丰密钥
    const { data: settings, error: settingsError } = await supabase
      .from('user_settings')
      .select(
        'sf_partner_id, sf_check_word, sf_sender_name, sf_sender_phone, sf_sender_address'
      )
      .eq('user_id', userId)
      .maybeSingle<UserSettings>();

    if (settingsError) {
      console.error('[sf-order] 查询 user_settings 失败:', settingsError);
      return NextResponse.json({ success: false, error: '读取配置失败，请稍后重试' }, { status: 500 });
    }

    const sfPartnerId = normalizeText(settings?.sf_partner_id);
    const sfCheckWord = normalizeText(settings?.sf_check_word);
    const sfSenderName = normalizeText(settings?.sf_sender_name);
    const sfSenderPhone = normalizeText(settings?.sf_sender_phone);
    const sfSenderAddress = normalizeText(settings?.sf_sender_address);

    if (!sfPartnerId || !sfCheckWord || !sfSenderName || !sfSenderPhone || !sfSenderAddress) {
      return NextResponse.json(
        { success: false, error: '请先前往设置页面配置顺丰 API 密钥' },
        { status: 400 }
      );
    }

    // 查询订单
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, customer_name, customer_phone, shipping_address, tracking_number, status')
      .eq('id', orderId)
      .maybeSingle<Order>();

    if (orderError) {
      console.error('[sf-order] 查询 orders 失败:', orderError);
      return NextResponse.json({ success: false, error: '读取订单失败，请稍后重试' }, { status: 500 });
    }

    if (!order) {
      return NextResponse.json({ success: false, error: '订单不存在' }, { status: 404 });
    }

    if (order.tracking_number) {
      return NextResponse.json({
        success: false,
        error: `该订单已有运单号：${order.tracking_number}`,
      }, { status: 409 });
    }

    const receiverName = normalizeText(order.customer_name);
    const receiverPhone = normalizeText(order.customer_phone);
    const receiverAddress = normalizeText(order.shipping_address);

    if (!receiverName || !receiverPhone || !receiverAddress) {
      return NextResponse.json(
        { success: false, error: '订单缺少收件人姓名、电话或收货地址，无法发货' },
        { status: 400 }
      );
    }

    // 构建顺丰请求
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const msgData = buildSfMsgData({
      orderId: order.id,
      senderName: sfSenderName,
      senderPhone: sfSenderPhone,
      senderAddress: sfSenderAddress,
      receiverName,
      receiverPhone,
      receiverAddress,
      pickupTime,
    });

    // 调用顺丰 API
    const sfResponse = await callSfApi(sfPartnerId, msgData, timestamp, sfCheckWord);

    if (sfResponse.apiResultCode !== 'A1000') {
      return NextResponse.json(
        {
          success: false,
          error: sfResponse.apiErrorMsg ?? '顺丰返回未知错误',
        },
        { status: 400 }
      );
    }

    // 提取运单号
    const waybillNo = sfResponse.waybillNo;
    const waybillNoStr = Array.isArray(waybillNo) ? waybillNo[0] : (waybillNo as string | undefined);

    if (!waybillNoStr) {
      return NextResponse.json(
        { success: false, error: '顺丰返回成功但未提供运单号，请联系管理员' },
        { status: 500 }
      );
    }

    // 回写数据库
    const { error: updateError } = await supabase
      .from('orders')
      .update({
        tracking_number: waybillNoStr,
        status: 'shipped',
      })
      .eq('id', orderId);

    if (updateError) {
      console.error('[sf-order] 更新订单运单号失败:', updateError);
      return NextResponse.json(
        { success: false, error: '顺丰下单成功，但更新运单号失败，请联系管理员' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      tracking_number: waybillNoStr,
      message: '发货成功',
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : '系统异常';
    console.error('[sf-order] 未捕获异常:', err);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
