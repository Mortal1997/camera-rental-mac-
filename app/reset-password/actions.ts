'use server';

import { createClient } from '@/lib/supabase/server';

export type UpdatePasswordResult =
  | { success: true }
  | { success: false; error: string };

export async function updatePassword(formData: FormData): Promise<UpdatePasswordResult> {
  const password = String(formData.get('password') ?? '');
  const confirmPassword = String(formData.get('confirmPassword') ?? '');

  if (!password || !confirmPassword) {
    return { success: false, error: '请填写新密码和确认密码。' };
  }

  if (password.length < 8) {
    return { success: false, error: '新密码至少需要 8 位。' };
  }

  if (password !== confirmPassword) {
    return { success: false, error: '两次输入的新密码不一致。' };
  }

  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    return { success: false, error: '重置登录状态已失效，请重新申请密码重置邮件。' };
  }

  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    console.warn('[auth] password update failed', {
      code: error.code ?? 'unknown',
      status: error.status ?? null,
      name: error.name,
    });

    if (error.code === 'weak_password') {
      return { success: false, error: '新密码强度不足，请组合使用字母、数字和符号。' };
    }

    if (error.code === 'same_password') {
      return { success: false, error: '新密码不能与当前密码相同。' };
    }

    if (error.code === 'over_request_rate_limit' || error.status === 429) {
      return { success: false, error: '操作过于频繁，请稍后再试。' };
    }

    return { success: false, error: '暂时无法更新密码，请重新申请重置邮件后再试。' };
  }

  await supabase.auth.signOut({ scope: 'global' });
  return { success: true };
}
