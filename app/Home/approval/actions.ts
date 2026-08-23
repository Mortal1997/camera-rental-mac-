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

export type ApprovalDashboardData = {
  pendingUsers: PendingUser[];
  approvedUsers: ApprovedUser[];
  activityLogs: ActivityLog[];
};

async function requireSuperAdmin() {
  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user?.email) {
    throw new Error('登录状态已失效，请重新登录');
  }

  const { data: admin, error: adminError } = await supabase
    .from('admin_users')
    .select('role')
    .eq('auth_user_id', user.id)
    .maybeSingle();

  if (adminError || admin?.role !== 'super_admin') {
    throw new Error('您没有执行此操作的权限');
  }

  return { supabase, operatorEmail: user.email };
}

export async function getPendingUsers(): Promise<PendingUser[]> {
  const { supabase } = await requireSuperAdmin();
  const { data, error } = await supabase
    .from('pending_users')
    .select('id, email, created_at')
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getApprovedUsers(): Promise<ApprovedUser[]> {
  const { supabase } = await requireSuperAdmin();
  const { data, error } = await supabase
    .from('approved_users')
    .select('id, email, approved_at, approved_by')
    .order('approved_at', { ascending: false });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getActivityLogs(): Promise<ActivityLog[]> {
  const { supabase } = await requireSuperAdmin();
  const { data, error } = await supabase
    .from('user_activity_log')
    .select('id, email, action, operator_email, operator_role, details, created_at')
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getApprovalDashboardData(): Promise<ApprovalDashboardData> {
  const { supabase } = await requireSuperAdmin();
  const [pendingResult, approvedResult, logsResult] = await Promise.all([
    supabase
      .from('pending_users')
      .select('id, email, created_at')
      .order('created_at', { ascending: false }),
    supabase
      .from('approved_users')
      .select('id, email, approved_at, approved_by')
      .order('approved_at', { ascending: false }),
    supabase
      .from('user_activity_log')
      .select('id, email, action, operator_email, operator_role, details, created_at')
      .order('created_at', { ascending: false })
      .limit(100),
  ]);

  const error = pendingResult.error ?? approvedResult.error ?? logsResult.error;
  if (error) throw new Error(error.message);

  return {
    pendingUsers: pendingResult.data ?? [],
    approvedUsers: approvedResult.data ?? [],
    activityLogs: (logsResult.data ?? []) as ActivityLog[],
  };
}

async function logActivity(
  supabase: Awaited<ReturnType<typeof createClient>>,
  operatorEmail: string,
  email: string,
  action: 'approved' | 'rejected' | 'deleted',
  details: Record<string, unknown> = {}
) {
  await supabase.from('user_activity_log').insert({
    email,
    action,
    operator_email: operatorEmail,
    details,
  });
}

export async function approveUser(pendingId: string): Promise<{ success: boolean; error?: string }> {
  let context: Awaited<ReturnType<typeof requireSuperAdmin>>;
  try {
    context = await requireSuperAdmin();
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : '无权执行该操作' };
  }

  const { supabase, operatorEmail } = context;
  const serviceClient = await createServiceClient();

  const { data: pending, error: fetchError } = await supabase
    .from('pending_users')
    .select('email, auth_user_id')
    .eq('id', pendingId)
    .maybeSingle();

  if (fetchError || !pending) {
    return { success: false, error: fetchError?.message ?? '找不到该申请记录' };
  }

  if (!pending.auth_user_id) {
    return { success: false, error: '这是旧版申请，请拒绝后让用户重新提交注册申请' };
  }

  const { error: confirmError } = await serviceClient.auth.admin.updateUserById(
    pending.auth_user_id,
    { email_confirm: true }
  );

  if (confirmError) {
    return { success: false, error: '确认 Auth 账户失败：' + confirmError.message };
  }

  const { error: insertError } = await supabase.from('approved_users').insert({
    email: pending.email,
    auth_user_id: pending.auth_user_id,
    approved_by: operatorEmail,
  });

  if (insertError) {
    if (insertError.code === '23505') {
      return { success: false, error: '该用户已通过审核，无需重复操作' };
    }
    return { success: false, error: insertError.message };
  }

  await supabase.from('pending_users').delete().eq('id', pendingId);
  await logActivity(supabase, operatorEmail, pending.email, 'approved', { pending_id: pendingId });

  return { success: true };
}

export async function rejectUser(pendingId: string): Promise<{ success: boolean; error?: string }> {
  let context: Awaited<ReturnType<typeof requireSuperAdmin>>;
  try {
    context = await requireSuperAdmin();
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : '无权执行该操作' };
  }

  const { supabase, operatorEmail } = context;
  const serviceClient = await createServiceClient();

  const { data: pending, error: fetchError } = await supabase
    .from('pending_users')
    .select('email, auth_user_id')
    .eq('id', pendingId)
    .maybeSingle();

  if (fetchError || !pending) {
    return { success: false, error: fetchError?.message ?? '找不到该申请记录' };
  }

  if (pending.auth_user_id) {
    const { error: authError } = await serviceClient.auth.admin.deleteUser(pending.auth_user_id);
    if (authError) {
      return { success: false, error: '删除 Auth 申请账户失败：' + authError.message };
    }
  }

  const { error } = await supabase
    .from('pending_users')
    .delete()
    .eq('id', pendingId);

  if (error) {
    return { success: false, error: error.message };
  }

  await logActivity(supabase, operatorEmail, pending.email, 'rejected', { pending_id: pendingId });
  return { success: true };
}

export async function deleteUser(approvedId: string): Promise<{ success: boolean; error?: string }> {
  let context: Awaited<ReturnType<typeof requireSuperAdmin>>;
  try {
    context = await requireSuperAdmin();
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : '无权执行该操作' };
  }

  const { supabase, operatorEmail } = context;
  const serviceClient = await createServiceClient();

  const { data: approved, error: fetchError } = await supabase
    .from('approved_users')
    .select('email, auth_user_id')
    .eq('id', approvedId)
    .maybeSingle();

  if (fetchError || !approved) {
    return { success: false, error: fetchError?.message ?? '找不到该用户记录' };
  }

  if (!approved.auth_user_id) {
    return { success: false, error: '找不到关联的 Auth 用户，请先执行最新数据库迁移' };
  }

  const { error: authError } = await serviceClient.auth.admin.deleteUser(approved.auth_user_id);

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

  await logActivity(supabase, operatorEmail, approved.email, 'deleted', { approved_id: approvedId });
  return { success: true };
}
