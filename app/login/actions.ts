'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import type { AuthError } from '@supabase/supabase-js';

export type AuthResult =
  | { success: true }
  | { success: false; error: string };

function reportAuthError(context: string, error: AuthError) {
  console.warn(`[auth] ${context}`, {
    code: error.code ?? 'unknown',
    status: error.status ?? null,
    name: error.name,
  });
}

function getSignInErrorMessage(error: AuthError) {
  if (error.code === 'email_not_confirmed') {
    return '您的账号尚未通过确认或审核，请联系管理员。';
  }

  if (error.code === 'user_banned') {
    return '该账号当前已被限制登录，请联系管理员。';
  }

  if (error.code === 'over_request_rate_limit' || error.status === 429) {
    return '登录尝试过于频繁，请等待几分钟后再试。';
  }

  if (error.code === 'email_provider_disabled') {
    return '系统当前未启用邮箱密码登录，请联系管理员。';
  }

  if (error.code === 'unexpected_failure' || (error.status ?? 0) >= 500) {
    return '登录服务暂时不可用，请稍后重试。';
  }

  if (error.name === 'AuthRetryableFetchError') {
    return '暂时无法连接登录服务，请检查网络后重试。';
  }

  if (error.code === 'invalid_credentials' || error.code === 'user_not_found') {
    return '无法验证登录信息。请检查邮箱和密码，或使用“忘记密码”；第三方平台注册的账号请使用原登录方式。';
  }

  return '登录失败，请稍后重试；如果问题持续出现，请联系管理员。';
}

export async function signInWithPassword(formData: FormData): Promise<AuthResult> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const password = String(formData.get('password') ?? '');

  if (!email || !password) {
    return { success: false, error: '请填写邮箱和密码' };
  }

  const supabase = await createClient();

  const { data: { user }, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    reportAuthError('password sign-in failed', error);
    return { success: false, error: getSignInErrorMessage(error) };
  }

  if (!user) {
    console.warn('[auth] password sign-in returned no user');
    return { success: false, error: '登录服务未返回账号信息，请重试。' };
  }

  const { data: adminData, error: adminError } = await supabase
    .from('admin_users')
    .select('id')
    .eq('auth_user_id', user.id)
    .maybeSingle();

  if (adminError) {
    console.warn('[auth] admin authorization lookup failed', { code: adminError.code });
    await supabase.auth.signOut();
    return { success: false, error: '权限校验服务暂时不可用，请稍后重试。' };
  }

  if (adminData) {
    revalidatePath('/', 'layout');
    redirect('/admin');
  }

  const { data: approvedData, error: approvedError } = await supabase
    .from('approved_users')
    .select('id')
    .eq('auth_user_id', user.id)
    .maybeSingle();

  if (approvedError) {
    console.warn('[auth] approved user lookup failed', { code: approvedError.code });
    await supabase.auth.signOut();
    return { success: false, error: '权限校验服务暂时不可用，请稍后重试。' };
  }

  if (approvedData) {
    revalidatePath('/', 'layout');
    redirect('/admin');
  }

  await supabase.auth.signOut();
  return {
    success: false,
    error: '您的账号正在等待管理员审核，请耐心等待。',
  };
}

export async function signUp(formData: FormData): Promise<AuthResult> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const password = String(formData.get('password') ?? '');
  const confirmPassword = String(formData.get('confirmPassword') ?? '');

  if (!email || !password) {
    return { success: false, error: '请填写邮箱和密码' };
  }

  if (password.length < 8) {
    return { success: false, error: '密码至少需要 8 位' };
  }

  if (password !== confirmPassword) {
    return { success: false, error: '两次输入的密码不一致' };
  }

  const serviceClient = await createServiceClient();

  const { data: adminData, error: adminLookupError } = await serviceClient
    .from('admin_users')
    .select('id')
    .eq('email', email)
    .maybeSingle();

  if (adminLookupError) {
    return { success: false, error: '暂时无法提交注册申请，请稍后重试' };
  }

  if (adminData) {
    return { success: false, error: '管理员账号无需注册，请直接登录' };
  }

  const { data: approvedData, error: approvedLookupError } = await serviceClient
    .from('approved_users')
    .select('id')
    .eq('email', email)
    .maybeSingle();

  if (approvedLookupError) {
    return { success: false, error: '暂时无法提交注册申请，请稍后重试' };
  }

  if (approvedData) {
    return { success: false, error: '该邮箱已注册并通过审核，请直接登录' };
  }

  const { data: pendingData, error: pendingLookupError } = await serviceClient
    .from('pending_users')
    .select('id')
    .eq('email', email)
    .maybeSingle();

  if (pendingLookupError) {
    return { success: false, error: '暂时无法提交注册申请，请稍后重试' };
  }

  if (pendingData) {
    return { success: false, error: '该邮箱已提交注册申请，请耐心等待审核' };
  }

  const { data: createdUser, error: createError } = await serviceClient.auth.admin.createUser({
    email,
    password,
    email_confirm: false,
  });

  if (createError || !createdUser.user) {
    return {
      success: false,
      error: createError?.message.includes('already')
        ? '该邮箱已有账号或申请，请尝试登录或联系管理员'
        : '暂时无法创建注册申请，请稍后重试',
    };
  }

  const { error: insertError } = await serviceClient.from('pending_users').insert({
    email,
    auth_user_id: createdUser.user.id,
  });

  if (insertError) {
    await serviceClient.auth.admin.deleteUser(createdUser.user.id);
    return { success: false, error: '注册申请保存失败，请稍后重试' };
  }

  return { success: true };
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath('/', 'layout');
  redirect('/login');
}
