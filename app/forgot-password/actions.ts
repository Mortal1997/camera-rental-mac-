'use server';

import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';

export type PasswordResetRequestResult =
  | { success: true; message: string }
  | { success: false; error: string };

function getSiteOrigin(requestOrigin: string | null) {
  const configuredOrigin = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  const candidate = configuredOrigin || requestOrigin;

  if (!candidate) return null;

  try {
    const url = new URL(candidate);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return url.origin;
  } catch {
    return null;
  }
}

export async function requestPasswordReset(formData: FormData): Promise<PasswordResetRequestResult> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();

  if (!email) {
    return { success: false, error: '请输入需要重置密码的邮箱。' };
  }

  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { success: false, error: '请输入有效的邮箱地址。' };
  }

  const requestHeaders = await headers();
  const origin = getSiteOrigin(requestHeaders.get('origin'));

  if (!origin) {
    return { success: false, error: '系统地址配置不完整，请联系管理员。' };
  }

  const redirectTo = new URL('/auth/callback?next=/reset-password', origin).toString();
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });

  if (error) {
    console.warn('[auth] password recovery request failed', {
      code: error.code ?? 'unknown',
      status: error.status ?? null,
      name: error.name,
    });

    if (error.code === 'over_email_send_rate_limit' || error.code === 'over_request_rate_limit' || error.status === 429) {
      return { success: false, error: '重置邮件发送过于频繁，请稍后再试。' };
    }

    if (error.code === 'email_address_not_authorized') {
      return { success: false, error: '当前邮件服务无法向该地址发送邮件，请联系管理员。' };
    }

    if (error.name === 'AuthRetryableFetchError') {
      return { success: false, error: '暂时无法连接邮件服务，请检查网络后重试。' };
    }

    return { success: false, error: '暂时无法发送重置邮件，请稍后重试。' };
  }

  return {
    success: true,
    message: '如果该邮箱已注册，重置邮件已发送。请检查收件箱和垃圾邮件。',
  };
}
