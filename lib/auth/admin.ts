import { createClient as createSupabaseServerClient } from '@/lib/supabase/server';

export type AdminViewer = {
  userId: string;
  email: string;
  fullName?: string;
  isSuperAdmin: boolean;
};

function getDisplayName(metadata: Record<string, unknown> | undefined): string | undefined {
  const candidate = metadata?.full_name ?? metadata?.display_name ?? metadata?.name;
  return typeof candidate === 'string' && candidate.trim() ? candidate.trim() : undefined;
}

/**
 * 在 Next.js 服务端完成登录身份与权限识别。这样通过内网穿透访问网站时，
 * 浏览器只需要连接 Next.js，不需要再直接连接仅在内网开放的 Supabase。
 */
export async function getAdminViewer(
  supabase?: Awaited<ReturnType<typeof createSupabaseServerClient>>,
): Promise<AdminViewer | null> {
  const client = supabase ?? await createSupabaseServerClient();
  const { data: { user }, error: authError } = await client.auth.getUser();
  if (authError || !user) return null;

  const { data: admin } = await client
    .from('admin_users')
    .select('role')
    .eq('auth_user_id', user.id)
    .maybeSingle();

  if (!admin) {
    const { data: approved } = await client
      .from('approved_users')
      .select('id')
      .eq('auth_user_id', user.id)
      .maybeSingle();
    if (!approved) return null;
  }

  return {
    userId: user.id,
    email: user.email ?? '已登录账户',
    fullName: getDisplayName(user.user_metadata),
    isSuperAdmin: admin?.role === 'super_admin',
  };
}

export async function isAdmin(supabase?: Awaited<ReturnType<typeof createSupabaseServerClient>>): Promise<boolean> {
  const client = supabase ?? await createSupabaseServerClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) return false;

  const { data } = await client
    .from('admin_users')
    .select('id')
    .eq('auth_user_id', user.id)
    .maybeSingle();

  return !!data;
}

export async function isSuperAdmin(supabase?: Awaited<ReturnType<typeof createSupabaseServerClient>>): Promise<boolean> {
  const client = supabase ?? await createSupabaseServerClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) return false;

  const { data } = await client
    .from('admin_users')
    .select('role')
    .eq('auth_user_id', user.id)
    .maybeSingle();

  return data?.role === 'super_admin';
}

export async function isApproved(supabase?: Awaited<ReturnType<typeof createSupabaseServerClient>>): Promise<boolean> {
  const client = supabase ?? await createSupabaseServerClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) return false;

  const { data: admin } = await client
    .from('admin_users')
    .select('id')
    .eq('auth_user_id', user.id)
    .maybeSingle();
  if (admin) return true;

  const { data: approved } = await client
    .from('approved_users')
    .select('id')
    .eq('auth_user_id', user.id)
    .maybeSingle();

  return !!approved;
}
