"use server";

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { pushDelivery, type ShippingMethod } from '@/lib/goofish/delivery';
import type { Equipment, Order } from './types';

function extractTrailingNumber(name: string): number | null {
  const match = name.match(/-(\d+)$/);
  return match ? parseInt(match[1], 10) : null;
}

async function requireAuth() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    throw new Error('UNAUTHORIZED');
  }
  return user;
}

export type AdminData = {
  equipment: (Equipment & {
    orders: Order[];
  })[];
  equipmentList: Equipment[];
  orders: Order[];
};

export async function getAdminData(): Promise<AdminData> {
  const supabase = await createClient();

  const { data: equipmentData, error: equipmentError } = await supabase
    .from('equipment')
    .select('*')
    .order('created_at', { ascending: true });

  if (equipmentError) {
    console.error('Error fetching equipment:', equipmentError);
    throw new Error('Failed to fetch equipment data');
  }

  const { data: ordersData, error: ordersError } = await supabase
    .from('orders')
    .select('*')
    .order('start_date', { ascending: true });

  if (ordersError) {
    console.error('Error fetching orders:', ordersError);
    throw new Error('Failed to fetch orders data');
  }

  const equipmentList = (equipmentData ?? []).sort((a, b) => {
    // 优先按设备类型排序（null/空排在最后），其次按设备名称末尾的序号自然排序
    const catA = a.category ?? '\uffff';
    const catB = b.category ?? '\uffff';
    if (catA !== catB) {
      return catA.localeCompare(catB);
    }
    const numA = extractTrailingNumber(a.name);
    const numB = extractTrailingNumber(b.name);
    if (numA !== null && numB !== null) return numA - numB;
    if (numA !== null) return -1;
    if (numB !== null) return 1;
    return a.name.localeCompare(b.name);
  });

  const orders = ordersData ?? [];

  const equipmentWithOrders = equipmentList.map((eq) => ({
    ...eq,
    orders: orders.filter((order) => order.equipment_id === eq.id),
  }));

  return {
    equipment: equipmentWithOrders,
    equipmentList,
    orders,
  };
}

export async function getEquipmentList(): Promise<Equipment[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('equipment')
    .select('*')
    .order('name', { ascending: true });

  if (error) {
    console.error('Error fetching equipment list:', error);
    throw new Error('Failed to fetch equipment list');
  }

  return data ?? [];
}

export async function createEquipment(
  formData: FormData
): Promise<{ success: boolean; error?: string }> {
  const user = await requireAuth();
  const supabase = await createClient();

  const name = String(formData.get('name') ?? '').trim();
  const category = String(formData.get('category') ?? '').trim();
  const serial_number = String(formData.get('serial_number') ?? '').trim();
  const daily_fee_raw = String(formData.get('daily_fee') ?? '').trim();
  const deposit_raw = String(formData.get('deposit') ?? '').trim();
  const warranty_expire_date = String(formData.get('warranty_expire_date') ?? '').trim();

  const daily_fee = Number(daily_fee_raw);
  const deposit = Number(deposit_raw);

  if (
    !name ||
    !daily_fee_raw ||
    Number.isNaN(daily_fee) ||
    !deposit_raw ||
    Number.isNaN(deposit)
  ) {
    return { success: false, error: '请填写必填字段：设备名称、日租金、押金' };
  }

  const payload: Record<string, unknown> = {
    name,
    daily_fee,
    deposit,
    status: 'available',
    user_id: user.id,
  };

  if (category) payload.category = category;
  if (serial_number) payload.serial_number = serial_number;
  if (warranty_expire_date) payload.warranty_expire_date = warranty_expire_date;

  const { error } = await supabase.from('equipment').insert(payload);

  if (error) {
    console.error('Error creating equipment:', error);
    return { success: false, error: error.message };
  }

  revalidatePath('/admin');
  revalidatePath('/admin/inventory');
  return { success: true };
}

export async function deleteEquipment(
  equipmentId: string
): Promise<{ success: boolean; error?: string }> {
  // 先将与该设备关联的订单的 equipment_id 置空，再删除设备
  // 这样避免外键约束（ON DELETE RESTRICT）导致的删除失败
  const supabaseAdmin = await createServiceClient();
  const { error: clearError } = await supabaseAdmin
    .from('orders')
    .update({ equipment_id: null })
    .eq('equipment_id', equipmentId);

  if (clearError) {
    console.error('Error clearing equipment_id from orders:', clearError);
    return { success: false, error: clearError.message };
  }

  const { error } = await supabaseAdmin
    .from('equipment')
    .delete()
    .eq('id', equipmentId);

  if (error) {
    console.error('Error deleting equipment:', error);
    return { success: false, error: error.message };
  }

  revalidatePath('/admin');
  revalidatePath('/admin/inventory');
  return { success: true };
}

export async function bulkCreateEquipment(
  records: Array<Record<string, unknown>>
): Promise<{ success: boolean; error?: string; skippedCount?: number; importedCount?: number }> {
  const user = await requireAuth();

  if (!Array.isArray(records) || records.length === 0) {
    return { success: false, error: '没有可导入的设备数据' };
  }

  const supabaseAdmin = await createServiceClient();

  // 提取导入数据中的所有序列号
  const serialNumbers = records
    .map((r) => (r.serial_number as string) || null)
    .filter(Boolean) as string[];

  // 查询数据库中已存在的序列号
  let existingSerials: Set<string> = new Set();
  if (serialNumbers.length > 0) {
    const { data: existingData } = await supabaseAdmin
      .from('equipment')
      .select('serial_number')
      .in('serial_number', serialNumbers);

    if (existingData) {
      existingSerials = new Set(existingData.map((e) => e.serial_number));
    }
  }

  // 过滤掉已存在的设备
  const newRecords = records.filter((record) => {
    const serial = (record.serial_number as string) || '';
    return serial && !existingSerials.has(serial);
  });

  const skippedCount = records.length - newRecords.length;

  if (newRecords.length === 0) {
    return {
      success: false,
      error: `所有 ${skippedCount} 条记录均已存在，无需导入`,
      skippedCount,
      importedCount: 0
    };
  }

  const payload = newRecords.map((record) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { issues, rowNumber, ...clean } = record;
    return { ...clean, status: 'available', user_id: user.id };
  });

  const { error } = await supabaseAdmin.from('equipment').insert(payload);

  if (error) {
    console.error('Error bulk creating equipment:', error);
    return { success: false, error: error.message };
  }

  revalidatePath('/admin');
  revalidatePath('/admin/inventory');
  return { success: true, importedCount: payload.length, skippedCount };
}

export async function updateEquipmentStatus(
  equipmentId: string,
  newStatus: string
): Promise<{ success: boolean; error?: string }> {
  await requireAuth();
  const supabase = await createClient();

  const { error } = await supabase
    .from('equipment')
    .update({ status: newStatus })
    .eq('id', equipmentId);

  if (error) {
    console.error('Error updating equipment status:', error);
    return { success: false, error: error.message };
  }

  revalidatePath('/admin');
  revalidatePath('/admin/inventory');
  return { success: true };
}

export async function updateEquipment(
  equipmentId: string,
  fields: {
    name?: string;
    category?: string | null;
    serial_number?: string | null;
    daily_fee?: number;
    deposit?: number;
    warranty_expire_date?: string | null;
  }
): Promise<{ success: boolean; error?: string }> {
  await requireAuth();
  const supabase = await createClient();

  const updates: Record<string, unknown> = {};

  if (fields.name !== undefined) {
    const trimmed = String(fields.name).trim();
    if (!trimmed) {
      return { success: false, error: '设备名称不能为空' };
    }
    updates.name = trimmed;
  }

  if (fields.category !== undefined) {
    updates.category = fields.category ? String(fields.category).trim() : null;
  }

  if (fields.serial_number !== undefined) {
    updates.serial_number = fields.serial_number ? String(fields.serial_number).trim() : null;
  }

  if (fields.daily_fee !== undefined) {
    const dailyFee = Number(fields.daily_fee);
    if (Number.isNaN(dailyFee) || dailyFee < 0) {
      return { success: false, error: '日租金必须是有效数字且不能为负数' };
    }
    updates.daily_fee = dailyFee;
  }

  if (fields.deposit !== undefined) {
    const deposit = Number(fields.deposit);
    if (Number.isNaN(deposit) || deposit < 0) {
      return { success: false, error: '押金必须是有效数字且不能为负数' };
    }
    updates.deposit = deposit;
  }

  if (fields.warranty_expire_date !== undefined) {
    updates.warranty_expire_date = fields.warranty_expire_date ? String(fields.warranty_expire_date).trim() : null;
  }

  if (Object.keys(updates).length === 0) {
    return { success: false, error: '没有要更新的字段' };
  }

  const { error } = await supabase
    .from('equipment')
    .update(updates)
    .eq('id', equipmentId);

  if (error) {
    console.error('Error updating equipment:', error);
    return { success: false, error: error.message };
  }

  revalidatePath('/admin');
  revalidatePath('/admin/inventory');
  return { success: true };
}

export async function checkEquipmentConflict(
  supabase: Awaited<ReturnType<typeof createClient>>,
  equipmentId: string,
  startDate: string,
  endDate: string,
  excludeOrderId?: string
): Promise<{ hasConflict: boolean; conflictingOrder?: { customer_name: string; start_date: string; end_date: string } }> {
  const { data, error } = await supabase
    .from('orders')
    .select('customer_name, start_date, end_date')
    .eq('equipment_id', equipmentId)
    .in('status', ['pending_payment', 'confirmed', 'using'])
    .gte('end_date', startDate);

  if (error || !data || data.length === 0) {
    return { hasConflict: false };
  }

  const MS_2_DAYS = 2 * 24 * 60 * 60 * 1000;

  for (const order of data) {
    if (excludeOrderId) {
      const { data: excludeData } = await supabase
        .from('orders')
        .select('id')
        .eq('id', excludeOrderId)
        .maybeSingle();
      if (excludeData) continue;
    }

    const existingStart = new Date(order.start_date);
    const existingEnd = new Date(new Date(order.end_date).getTime() + MS_2_DAYS);
    const selectedStart = new Date(startDate);
    const selectedEnd = new Date(endDate);

    if (existingStart <= selectedEnd && existingEnd >= selectedStart) {
      return {
        hasConflict: true,
        conflictingOrder: {
          customer_name: order.customer_name ?? '未知客户',
          start_date: order.start_date,
          end_date: order.end_date,
        },
      };
    }
  }

  return { hasConflict: false };
}

export async function createManualOrder(
  formData: FormData
): Promise<{ success: boolean; error?: string; order?: Order }> {
  const user = await requireAuth();
  const supabase = await createClient();

  const equipment_id = String(formData.get('equipment_id') ?? '').trim();
  const customer_name = String(formData.get('customer_name') ?? '').trim();
  const customer_phone = String(formData.get('customer_phone') ?? '').trim();
  const shipping_address = String(formData.get('shipping_address') ?? '').trim();
  const start_date = String(formData.get('start_date') ?? '').trim();
  const end_date = String(formData.get('end_date') ?? '').trim();
  const deposit_exemption = String(formData.get('deposit_exemption') ?? '').trim();
  const total_price_raw = String(formData.get('total_price') ?? '').trim();
  const total_price = Number(total_price_raw);

  if (
    !equipment_id ||
    !customer_name ||
    !customer_phone ||
    !shipping_address ||
    !start_date ||
    !end_date ||
    !deposit_exemption ||
    !total_price_raw ||
    Number.isNaN(total_price)
  ) {
    return { success: false, error: '请完整填写订单信息' };
  }

  const conflict = await checkEquipmentConflict(supabase, equipment_id, start_date, end_date);
  if (conflict.hasConflict && conflict.conflictingOrder) {
    return {
      success: false,
      error: `设备排期冲突：与「${conflict.conflictingOrder.customer_name}」的订单（${conflict.conflictingOrder.start_date} ~ ${conflict.conflictingOrder.end_date}）重叠。上一单结束后需强制休息 2 天，请调整租期。`,
    };
  }

  const { data, error } = await supabase
    .from('orders')
    .insert({
      equipment_id,
      customer_name,
      customer_phone,
      shipping_address,
      start_date,
      end_date,
      deposit_exemption,
      total_price,
      deposit_paid: 0,
      status: 'pending_payment',
      user_id: user.id,
    })
    .select('*')
    .single();

  if (error) {
    console.error('Error creating manual order:', error);
    return { success: false, error: error.message };
  }

  revalidatePath('/admin');
  revalidatePath('/admin/orders');
  revalidatePath('/admin/orders/pending');
  return { success: true, order: (data ?? null) as Order | undefined };
}

export async function bulkCreateOrders(
  records: Array<Record<string, unknown>>
): Promise<{ success: boolean; error?: string; orders?: Order[] }> {
  const user = await requireAuth();

  if (!Array.isArray(records) || records.length === 0) {
    return { success: false, error: '没有可导入的订单数据' };
  }

  const payload = records.map((record) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { issues, rowNumber, ...clean } = record;
    return { ...clean, status: 'confirmed', user_id: user.id };
  });

  const supabaseAdmin = await createServiceClient();
  const { data, error } = await supabaseAdmin
    .from('orders')
    .insert(payload)
    .select('*');

  if (error) {
    console.error('Error bulk creating orders:', error);
    return { success: false, error: error.message };
  }

  revalidatePath('/admin');
  revalidatePath('/admin/orders');
  revalidatePath('/admin/orders/pending');
  return { success: true, orders: (data ?? []) as Order[] };
}

export async function processExternalOrder(
  orderId: string,
  formData: FormData
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  const equipment_id = String(formData.get('equipment_id') ?? '').trim();
  const shipping_address = String(formData.get('shipping_address') ?? '').trim();
  const start_date = String(formData.get('start_date') ?? '').trim();
  const end_date = String(formData.get('end_date') ?? '').trim();
  const deposit_exemption = String(formData.get('deposit_exemption') ?? '').trim();
  const shipping_method = String(formData.get('shipping_method') ?? '').trim();

  if (!equipment_id || !shipping_address || !start_date || !end_date || !deposit_exemption || !shipping_method) {
    return { success: false, error: '请完整填写接单信息' };
  }

  const conflict = await checkEquipmentConflict(supabase, equipment_id, start_date, end_date, orderId);
  if (conflict.hasConflict && conflict.conflictingOrder) {
    return {
      success: false,
      error: `设备排期冲突：与「${conflict.conflictingOrder.customer_name}」的订单（${conflict.conflictingOrder.start_date} ~ ${conflict.conflictingOrder.end_date}）重叠。上一单结束后需强制休息 2 天，请调整租期。`,
    };
  }

  const { error } = await supabase
    .from('orders')
    .update({
      equipment_id,
      shipping_address,
      start_date,
      end_date,
      deposit_exemption,
      shipping_method,
      status: 'confirmed',
    })
    .eq('id', orderId);

  if (error) {
    console.error('Error processing external order:', error);
    return { success: false, error: error.message };
  }

  const { error: equipmentError } = await supabase
    .from('equipment')
    .update({ status: 'rented' })
    .eq('id', equipment_id);

  if (equipmentError) {
    console.error('Error updating equipment during dispatch:', equipmentError);
    return { success: false, error: equipmentError.message };
  }

  revalidatePath('/admin/dispatch');
  revalidatePath('/admin/pending');
  revalidatePath('/admin');
  return { success: true };
}

export async function deleteOrder(
  orderId: string
): Promise<{ success: boolean; error?: string }> {
  const supabaseAdmin = await createServiceClient();
  const { error } = await supabaseAdmin
    .from('orders')
    .delete()
    .eq('id', orderId);

  if (error) {
    console.error('Error deleting order:', error);
    return { success: false, error: error.message };
  }

  revalidatePath('/admin/orders');
  revalidatePath('/admin/orders/dispatch');
  revalidatePath('/admin/orders/pending');
  revalidatePath('/admin/orders/active');
  revalidatePath('/admin/orders/completed');
  revalidatePath('/admin');
  return { success: true };
}

export async function updateOrderStatus(
  orderId: string,
  newStatus: string,
  trackingNumber?: string,
  shippingMethod?: 'express' | 'hainter' | 'pickup',
  equipmentId?: string,
  options?: {
    pushToGoofish?: boolean;
    // 快递公司（仅 shippingMethod === 'express' 时必填）
    expressCode?: string;
    expressName?: string;
  }
): Promise<{ success: boolean; error?: string; goofishPush?: 'ok' | 'skipped' | 'failed' | 'no_source' | 'no_carrier' }> {
  await requireAuth();
  const supabase = await createClient();

  const updates: Record<string, unknown> = { status: newStatus };
  if (trackingNumber !== undefined) {
    updates.tracking_number = trackingNumber;
  }
  if (shippingMethod !== undefined) {
    updates.shipping_method = shippingMethod;
  }

  const { error } = await supabase
    .from('orders')
    .update(updates)
    .eq('id', orderId);

  if (error) {
    console.error('Error updating order status:', error);
    return { success: false, error: error.message };
  }

  if (equipmentId) {
    const nextEquipmentStatus = newStatus === 'returned' ? 'available' : newStatus === 'using' ? 'rented' : null;

    if (nextEquipmentStatus) {
      const { error: equipmentError } = await supabase
        .from('equipment')
        .update({ status: nextEquipmentStatus })
        .eq('id', equipmentId);

      if (equipmentError) {
        console.error('Error syncing equipment status:', equipmentError);
        return { success: false, error: equipmentError.message };
      }
    }
  }

  revalidatePath('/admin');
  revalidatePath('/admin/inventory');

  // -------- 发货回传闲管家（非阻塞尽力而为） --------
  // 触发条件：调用方显式要求 pushToGoofish=true；
  //           newStatus='using'（发货动作）；
  //           订单平台来源是闲鱼。
  // 失败语义：本地状态已落库，发货回传失败不阻断业务。返回 goofishPush='failed'
  //           让前端可选地展示警告。
  if (options?.pushToGoofish && newStatus === 'using') {
    try {
      // 1) 查订单：拿 external_order_id + platform_source + user_id
      const { data: orderRow, error: orderError } = await supabase
        .from('orders')
        .select('external_order_id, platform_source, user_id')
        .eq('id', orderId)
        .maybeSingle();

      if (orderError) {
        console.warn('[ship] 查询订单平台来源失败，跳过闲管家回传', orderError);
        return { success: true, goofishPush: 'failed' };
      }

      if (!orderRow?.external_order_id) {
        // 本地手建订单（非闲鱼），不触发回传
        return { success: true, goofishPush: 'no_source' };
      }

      if (orderRow.platform_source !== '闲鱼') {
        return { success: true, goofishPush: 'no_source' };
      }

      // 2) 查该用户闲管家凭证
      const { data: settings, error: settingsError } = await supabase
        .from('user_settings')
        .select('goofish_app_key, goofish_app_secret')
        .eq('user_id', orderRow.user_id)
        .maybeSingle();

      if (settingsError || !settings?.goofish_app_key || !settings?.goofish_app_secret) {
        console.warn('[ship] 闲管家凭证缺失，跳过回传', {
          orderId,
          hasError: !!settingsError,
          hasKey: !!settings?.goofish_app_key,
          hasSecret: !!settings?.goofish_app_secret,
        });
        return { success: true, goofishPush: 'skipped' };
      }

      // 3) 调回传（用 service_role 仅是后续可能要做签名/审计日志预留）
      //    当前 pushDelivery 内部只做签名 + fetch，不读库，所以普通 client 即可
      const pushResult = await pushDelivery({
        appKey: settings.goofish_app_key,
        appSecret: settings.goofish_app_secret,
        externalOrderId: orderRow.external_order_id,
        trackingNumber,
        shippingMethod: (shippingMethod ?? 'express') as ShippingMethod,
        expressCode: options?.expressCode,
        expressName: options?.expressName,
      });

      if (pushResult.ok) {
        if (pushResult.skipped === 'no_carrier') {
          return { success: true, goofishPush: 'no_carrier' };
        }
        return { success: true, goofishPush: 'ok' };
      }

      console.warn('[ship] 闲管家回传失败（不阻断发货）', {
        orderId,
        reason: pushResult.reason,
      });
      return { success: true, goofishPush: 'failed' };
    } catch (e) {
      console.error('[ship] 闲管家回传异常（不阻断发货）', e);
      return { success: true, goofishPush: 'failed' };
    }
  }

  return { success: true };
}

export async function updateOrderFields(
  orderId: string,
  fields: {
    customer_name?: string;
    customer_phone?: string;
    shipping_address?: string;
    equipment_id?: string;
    start_date?: string;
    end_date?: string;
    notes?: string;
    total_price?: number | null;
  }
): Promise<{ success: boolean; error?: string }> {
  await requireAuth();

  const normalizedFields: Record<string, unknown> = { ...fields };
  if (normalizedFields.total_price !== undefined) {
    const raw = Number(normalizedFields.total_price);
    normalizedFields.total_price = Number.isFinite(raw) && raw >= 0 ? raw : null;
  }

  const supabaseAdmin = await createServiceClient();
  const { error } = await supabaseAdmin
    .from('orders')
    .update(normalizedFields)
    .eq('id', orderId);

  if (error) {
    console.error('Error updating order fields:', error);
    return { success: false, error: error.message };
  }

  revalidatePath('/admin');
  revalidatePath('/admin/inventory');
  revalidatePath('/admin/orders');
  return { success: true };
}

export async function getCurrentUserGoofishCredentials(): Promise<{
  appKey: string | null;
  appSecret: string | null;
}> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { appKey: null, appSecret: null };

  const { data } = await supabase
    .from('user_settings')
    .select('goofish_app_key, goofish_app_secret')
    .eq('user_id', user.id)
    .maybeSingle();

  return {
    appKey: data?.goofish_app_key ?? null,
    appSecret: data?.goofish_app_secret ?? null,
  };
}
