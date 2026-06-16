"use server";

import { revalidatePath } from 'next/cache';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import type { Equipment, Order } from './types';

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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
    .order('name', { ascending: true });

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

  const equipmentList = equipmentData ?? [];
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
): Promise<{ success: boolean; error?: string }> {
  const user = await requireAuth();

  if (!Array.isArray(records) || records.length === 0) {
    return { success: false, error: '没有可导入的设备数据' };
  }

  const payload = records.map((record) => {
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
  return { success: true };
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
): Promise<{ success: boolean; error?: string }> {
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

  const { error } = await supabase.from('orders').insert({
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
  });

  if (error) {
    console.error('Error creating manual order:', error);
    return { success: false, error: error.message };
  }

  revalidatePath('/admin');
  revalidatePath('/admin/pending');
  return { success: true };
}

export async function bulkCreateOrders(
  records: Array<Record<string, unknown>>
): Promise<{ success: boolean; error?: string }> {
  const user = await requireAuth();

  if (!Array.isArray(records) || records.length === 0) {
    return { success: false, error: '没有可导入的订单数据' };
  }

  const payload = records.map((record) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { issues, rowNumber, ...clean } = record;
    return { ...clean, status: 'confirmed', user_id: user.id };
  });

  const { error } = await supabaseAdmin.from('orders').insert(payload);

  if (error) {
    console.error('Error bulk creating orders:', error);
    return { success: false, error: error.message };
  }

  revalidatePath('/admin');
  revalidatePath('/admin/orders');
  revalidatePath('/admin/orders/pending');
  return { success: true };
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
  equipmentId?: string
): Promise<{ success: boolean; error?: string }> {
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
  }
): Promise<{ success: boolean; error?: string }> {
  await requireAuth();
  const { error } = await supabaseAdmin
    .from('orders')
    .update(fields)
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
