'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export type AuthResult =
  | { success: true }
  | { success: false; error: string };

export async function signInWithPassword(formData: FormData): Promise<AuthResult> {
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;

  if (!email || !password) {
    return { success: false, error: '请填写邮箱和密码' };
  }

  const supabase = await createClient();

  const { data: { user }, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !user) {
    return { success: false, error: '邮箱或密码错误' };
  }

  const { data: adminData } = await supabase
    .from('admin_users')
    .select('id')
    .eq('email', user.email)
    .maybeSingle();

  if (adminData) {
    revalidatePath('/', 'layout');
    redirect('/admin');
  }

  const { data: approvedData } = await supabase
    .from('approved_users')
    .select('id')
    .eq('email', user.email)
    .maybeSingle();

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
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;
  const confirmPassword = formData.get('confirmPassword') as string;

  if (!email || !password) {
    return { success: false, error: '请填写邮箱和密码' };
  }

  if (password.length < 6) {
    return { success: false, error: '密码至少需要 6 位' };
  }

  if (password !== confirmPassword) {
    return { success: false, error: '两次输入的密码不一致' };
  }

  const supabase = await createClient();

  const { data: adminData } = await supabase
    .from('admin_users')
    .select('id')
    .eq('email', email)
    .maybeSingle();

  if (adminData) {
    return { success: false, error: '管理员账号无需注册，请直接登录' };
  }

  const { data: approvedData } = await supabase
    .from('approved_users')
    .select('id')
    .eq('email', email)
    .maybeSingle();

  if (approvedData) {
    return { success: false, error: '该邮箱已注册并通过审核，请直接登录' };
  }

  const { data: pendingData } = await supabase
    .from('pending_users')
    .select('id')
    .eq('email', email)
    .maybeSingle();

  if (pendingData) {
    return { success: false, error: '该邮箱已提交注册申请，请耐心等待审核' };
  }

  const { error: insertError } = await supabase.from('pending_users').insert({
    email,
    password_hash: password,
  });

  if (insertError) {
    return { success: false, error: insertError.message };
  }

  return { success: true };
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath('/', 'layout');
  redirect('/login');
}
