import { createClient } from '@/lib/supabase/server';
import ResetPasswordForm from './ResetPasswordForm';

type ResetPasswordPageProps = {
  searchParams: Promise<{ error?: string }>;
};

const RECOVERY_ERRORS: Record<string, string> = {
  'invalid-link': '重置链接无效，请重新申请密码重置邮件。',
  'expired-link': '重置链接已失效或已被使用，请重新申请。',
};

export default async function ResetPasswordPage({ searchParams }: ResetPasswordPageProps) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const initialError = params.error
    ? RECOVERY_ERRORS[params.error] ?? '无法验证重置链接，请重新申请。'
    : user
      ? undefined
      : '请先通过密码重置邮件中的链接进入此页面。';

  return <ResetPasswordForm canReset={Boolean(user)} initialError={initialError} />;
}
