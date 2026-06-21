'use server';

import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

export type PendingUser = {
  id: string;
  email: string;
  created_at: string;
};

export type ApprovedUser = {
  id: string;
  email: string;
  approved_at: string;
  approved_by: string | null;
};

export type ActivityLog = {
  id: string;
  email: string;
  action: 'approved' | 'rejected' | 'deleted';
  operator_email: string;
  operator_role: string;
  details: Record<string, unknown>;
  created_at: string;
};

async function getCurrentAdminEmail(): Promise<string> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user?.email ?? 'unknown';
}

export async function getPendingUsers(): Promise<PendingUser[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('pending_users')
    .select('id, email, created_at')
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getApprovedUsers(): Promise<ApprovedUser[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('approved_users')
    .select('id, email, approved_at, approved_by')
    .order('approved_at', { ascending: false });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getActivityLogs(): Promise<ActivityLog[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('user_activity_log')
    .select('id, email, action, operator_email, operator_role, details, created_at')
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) throw new Error(error.message);
  return data ?? [];
}

async function logActivity(
  email: string,
  action: 'approved' | 'rejected' | 'deleted',
  details: Record<string, unknown> = {}
) {
  const supabase = await createClient();
  const operatorEmail = await getCurrentAdminEmail();

  await supabase.from('user_activity_log').insert({
    email,
    action,
    operator_email: operatorEmail,
    details,
  });
}

export async function approveUser(
  pendingId: string,
  email: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const serviceClient = await createServiceClient();
  const operatorEmail = await getCurrentAdminEmail();

  const { data: pending, error: fetchError } = await supabase
    .from('pending_users')
    .select('password_hash')
    .eq('id', pendingId)
    .maybeSingle();

  if (fetchError || !pending) {
    return { success: false, error: fetchError?.message ?? '找不到该申请记录' };
  }

  const { error: createError } = await serviceClient.auth.admin.createUser({
    email,
    password: pending.password_hash,
    email_confirm: true,
  });

  if (createError) {
    if (createError.message.includes('already been registered')) {
      return { success: false, error: '该邮箱已在系统中注册，请直接登录' };
    }
    return { success: false, error: createError.message };
  }

  const { error: insertError } = await supabase.from('approved_users').insert({
    email,
    approved_by: operatorEmail,
  });

  if (insertError) {
    if (insertError.code === '23505') {
      return { success: false, error: '该用户已通过审核，无需重复操作' };
    }
    return { success: false, error: insertError.message };
  }

  await supabase.from('pending_users').delete().eq('id', pendingId);
  await logActivity(email, 'approved', { pending_id: pendingId });

  return { success: true };
}

export async function rejectUser(
  pendingId: string,
  email: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  const { error } = await supabase
    .from('pending_users')
    .delete()
    .eq('id', pendingId);

  if (error) {
    return { success: false, error: error.message };
  }

  await logActivity(email, 'rejected', { pending_id: pendingId });
  return { success: true };
}

export async function deleteUser(
  approvedId: string,
  email: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const serviceClient = await createServiceClient();

  const { error: authError } = await serviceClient.auth.admin.deleteUser(email);

  if (authError) {
    return { success: false, error: '删除 Auth 账户失败：' + authError.message };
  }

  const { error: dbError } = await supabase
    .from('approved_users')
    .delete()
    .eq('id', approvedId);

  if (dbError) {
    return { success: false, error: 'Auth 账户已删除，但本地记录删除失败：' + dbError.message };
  }

  await logActivity(email, 'deleted', { approved_id: approvedId });
  return { success: true };
}
