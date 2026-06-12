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

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    if (error.message.includes('Invalid login credentials')) {
      return { success: false, error: '邮箱或密码错误' };
    }
    return { success: false, error: error.message };
  }

  revalidatePath('/', 'layout');
  redirect('/admin');
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

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/admin`,
    },
  });

  if (error) {
    if (error.message.includes('already registered')) {
      return { success: false, error: '该邮箱已注册，请直接登录' };
    }
    return { success: false, error: error.message };
  }

  return { success: true };
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath('/', 'layout');
  redirect('/login');
}
