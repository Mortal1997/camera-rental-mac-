import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const REQUIRED_FIELDS = ['platform_source', 'customer_name', 'customer_phone'] as const;

type WebhookPayload = {
  platform_source?: unknown;
  customer_name?: unknown;
  customer_phone?: unknown;
  external_order_id?: unknown;
  order_id?: unknown;
  shipping_address?: unknown;
  expected_equipment_model?: unknown;
  start_date?: unknown;
  end_date?: unknown;
  total_price?: unknown;
  deposit_paid?: unknown;
  shipping_method?: unknown;
  deposit_exemption?: unknown;
  metadata?: unknown;
  [key: string]: unknown;
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

function normalizeText(value: unknown) {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}

function normalizeNullableDate(value: unknown) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

function normalizeNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function extractBearerToken(authorizationHeader: string | null) {
  if (!authorizationHeader) return null;
  const match = authorizationHeader.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

function verifyGoofishSignature(request: Request, bodyString: string) {
  const appKey = process.env.GOOFISH_APP_KEY?.trim();
  const appSecret = process.env.GOOFISH_APP_SECRET?.trim();
  const { searchParams } = new URL(request.url);
  const appId = searchParams.get('appid');
  const timestamp = searchParams.get('timestamp');
  const sign = searchParams.get('sign');

  if (!appId && !timestamp && !sign) {
    return { verified: false, checked: false, errorResponse: null as NextResponse | null };
  }

  if (!appKey || !appSecret) {
    return {
      verified: false,
      checked: true,
      errorResponse: NextResponse.json({ success: false, error: '服务端未配置闲管家签名密钥' }, { status: 500 }),
    };
  }

  if (!appId || !timestamp || !sign || appId !== appKey) {
    return {
      verified: false,
      checked: true,
      errorResponse: NextResponse.json({ success: false, error: '签名参数缺失或无效' }, { status: 401 }),
    };
  }

  const bodyMd5 = md5(bodyString);
  const expectedSign = md5(`${appKey},${bodyMd5},${timestamp},${appSecret}`);

  if (expectedSign !== sign) {
    return {
      verified: false,
      checked: true,
      errorResponse: NextResponse.json({ success: false, error: '签名校验失败' }, { status: 401 }),
    };
  }

  return { verified: true, checked: true, errorResponse: null as NextResponse | null };
}

function verifyWebhookSecret(request: Request) {
  const configuredSecret = process.env.ORDER_WEBHOOK_SECRET?.trim();
  if (!configuredSecret) {
    return null;
  }

  const bearerToken = extractBearerToken(request.headers.get('authorization'));
  const headerSecret = request.headers.get('x-webhook-secret')?.trim() || null;
  const providedSecret = bearerToken || headerSecret;

  if (providedSecret !== configuredSecret) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  return null;
}

export async function POST(request: Request) {
  try {
    const supabaseUrl = getRequiredEnv('NEXT_PUBLIC_SUPABASE_URL');
    const supabaseServiceRoleKey = getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY');
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    const bodyString = await request.text();
    const signatureCheck = verifyGoofishSignature(request, bodyString);
    if (signatureCheck.errorResponse) {
      return signatureCheck.errorResponse;
    }

    const secretError = verifyWebhookSecret(request);
    if (secretError) {
      return secretError;
    }

    let payload: WebhookPayload;
    try {
      payload = JSON.parse(bodyString || '{}') as WebhookPayload;
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid JSON payload' }, { status: 400 });
    }

    const platformSource = normalizeText(payload.platform_source);
    const customerName = normalizeText(payload.customer_name);
    const customerPhone = normalizeText(payload.customer_phone);

    if (!platformSource || !customerName || !customerPhone) {
      return NextResponse.json(
        {
          success: false,
          error: `required fields missing: ${REQUIRED_FIELDS.join(', ')}`,
        },
        { status: 400 }
      );
    }

    const externalOrderId = normalizeText(payload.external_order_id) ?? normalizeText(payload.order_id);

    if (externalOrderId) {
      const { data: existingOrder, error: existingOrderError } = await supabase
        .from('orders')
        .select('id, status')
        .eq('platform_source', platformSource)
        .eq('external_order_id', externalOrderId)
        .maybeSingle();

      if (existingOrderError) {
        return NextResponse.json({ success: false, error: existingOrderError.message }, { status: 500 });
      }

      if (existingOrder) {
        return NextResponse.json({
          success: true,
          duplicated: true,
          orderId: existingOrder.id,
          status: existingOrder.status,
        });
      }
    }

    const insertPayload = {
      platform_source: platformSource,
      customer_name: customerName,
      customer_phone: customerPhone,
      external_order_id: externalOrderId ?? null,
      shipping_address: normalizeText(payload.shipping_address) ?? null,
      expected_equipment_model: normalizeText(payload.expected_equipment_model) ?? null,
      start_date: normalizeNullableDate(payload.start_date),
      end_date: normalizeNullableDate(payload.end_date),
      total_price: normalizeNumber(payload.total_price),
      deposit_paid: normalizeNumber(payload.deposit_paid),
      shipping_method: normalizeText(payload.shipping_method) ?? null,
      deposit_exemption: normalizeText(payload.deposit_exemption) ?? null,
      metadata: typeof payload.metadata === 'undefined' ? payload : payload.metadata,
      status: 'unprocessed' as const,
    };

    const { data: insertedOrder, error: insertError } = await supabase
      .from('orders')
      .insert(insertPayload)
      .select('id, status')
      .single();

    if (insertError) {
      const isDuplicateConflict = insertError.code === '23505';
      if (isDuplicateConflict && externalOrderId) {
        const { data: conflictedOrder } = await supabase
          .from('orders')
          .select('id, status')
          .eq('platform_source', platformSource)
          .eq('external_order_id', externalOrderId)
          .maybeSingle();

        return NextResponse.json({
          success: true,
          duplicated: true,
          orderId: conflictedOrder?.id ?? null,
          status: conflictedOrder?.status ?? 'unprocessed',
        });
      }

      return NextResponse.json({ success: false, error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      duplicated: false,
      orderId: insertedOrder.id,
      status: insertedOrder.status,
      sourceVerified: signatureCheck.verified,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '系统异常';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
