import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { supabase } from '../../../../lib/supabaseClient';

export const dynamic = 'force-dynamic';

type ExternalOrderWebhookPayload = {
  external_order_id?: string;
  order_id?: string;
  platform_source?: string;
  customer_name?: string;
  customer_phone?: string;
  shipping_address?: string;
  expected_equipment_model?: string;
  start_date?: string;
  end_date?: string;
  total_price?: number | string;
  deposit_paid?: number | string;
  shipping_method?: string;
  deposit_exemption?: string;
  metadata?: Record<string, unknown>;
};

function getBearerToken(header: string | null) {
  if (!header) return null;
  const [scheme, token] = header.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) return null;
  return token.trim();
}

function normalizeNumber(value: number | string | undefined, fallback = 0) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : fallback;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

function normalizeDate(value: string | undefined) {
  const normalized = String(value ?? '').trim();
  return normalized || null;
}

function buildInsertPayload(payload: ExternalOrderWebhookPayload) {
  const customer_name = String(payload.customer_name ?? '').trim();
  const customer_phone = String(payload.customer_phone ?? '').trim();
  const shipping_address = String(payload.shipping_address ?? '').trim();
  const platform_source = String(payload.platform_source ?? '').trim();
  const expected_equipment_model = String(payload.expected_equipment_model ?? '').trim();
  const start_date = normalizeDate(payload.start_date);
  const end_date = normalizeDate(payload.end_date);
  const shipping_method = String(payload.shipping_method ?? '').trim();
  const deposit_exemption = String(payload.deposit_exemption ?? '').trim();
  const external_order_id = String(payload.external_order_id ?? payload.order_id ?? '').trim();

  if (!customer_name || !customer_phone || !platform_source) {
    return {
      error: NextResponse.json(
        { success: false, error: 'customer_name, customer_phone, and platform_source are required' },
        { status: 400 }
      ),
    };
  }

  const insertPayload: Record<string, unknown> = {
    status: 'unprocessed',
    customer_name,
    customer_phone,
    platform_source,
    total_price: normalizeNumber(payload.total_price, 0),
    deposit_paid: normalizeNumber(payload.deposit_paid, 0),
    start_date,
    end_date,
  };

  if (shipping_address) insertPayload.shipping_address = shipping_address;
  if (expected_equipment_model) insertPayload.expected_equipment_model = expected_equipment_model;
  if (shipping_method) insertPayload.shipping_method = shipping_method;
  if (deposit_exemption) insertPayload.deposit_exemption = deposit_exemption;
  if (external_order_id) insertPayload.external_order_id = external_order_id;
  if (payload.metadata && typeof payload.metadata === 'object') insertPayload.metadata = payload.metadata;

  return {
    insertPayload,
    external_order_id,
    platform_source,
  };
}

export async function POST(request: Request) {
  const webhookSecret = process.env.ORDER_WEBHOOK_SECRET?.trim();
  if (webhookSecret) {
    const bearerToken = getBearerToken(request.headers.get('authorization'));
    const signatureToken = request.headers.get('x-webhook-secret')?.trim() || null;
    const providedSecret = bearerToken || signatureToken;

    if (!providedSecret || providedSecret !== webhookSecret) {
      return NextResponse.json({ success: false, error: 'Unauthorized webhook request' }, { status: 401 });
    }
  }

  let payload: ExternalOrderWebhookPayload;
  try {
    payload = (await request.json()) as ExternalOrderWebhookPayload;
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON payload' }, { status: 400 });
  }

  const result = buildInsertPayload(payload);
  if ('error' in result) {
    return result.error;
  }

  const { insertPayload, external_order_id, platform_source } = result;

  if (external_order_id) {
    const { data: existingOrder, error: existingOrderError } = await supabase
      .from('orders')
      .select('id, status')
      .eq('platform_source', platform_source)
      .eq('external_order_id', external_order_id)
      .maybeSingle();

    if (existingOrderError) {
      console.error('Error checking duplicate external order:', existingOrderError);
      return NextResponse.json({ success: false, error: existingOrderError.message }, { status: 500 });
    }

    if (existingOrder) {
      return NextResponse.json(
        {
          success: true,
          duplicated: true,
          orderId: existingOrder.id,
          status: existingOrder.status,
        },
        { status: 200 }
      );
    }
  }

  const { data, error } = await supabase.from('orders').insert(insertPayload).select('id').single();

  if (error) {
    const isDuplicate = error.code === '23505';
    if (isDuplicate && external_order_id) {
      const { data: duplicateOrder } = await supabase
        .from('orders')
        .select('id, status')
        .eq('platform_source', platform_source)
        .eq('external_order_id', external_order_id)
        .maybeSingle();

      if (duplicateOrder) {
        return NextResponse.json(
          {
            success: true,
            duplicated: true,
            orderId: duplicateOrder.id,
            status: duplicateOrder.status,
          },
          { status: 200 }
        );
      }
    }

    console.error('Error inserting external webhook order:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  revalidatePath('/admin/orders/dispatch');
  revalidatePath('/admin/orders/pending');

  return NextResponse.json({
    success: true,
    duplicated: false,
    orderId: data.id,
    status: 'unprocessed',
  });
}
