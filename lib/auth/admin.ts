import { createClient as createSupabaseServerClient } from '@/lib/supabase/server';

export async function isAdmin(supabase?: Awaited<ReturnType<typeof createSupabaseServerClient>>): Promise<boolean> {
  const client = supabase ?? await createSupabaseServerClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user?.email) return false;

  const { data } = await client
    .from('admin_users')
    .select('id')
    .eq('email', user.email)
    .maybeSingle();

  return !!data;
}

export async function isSuperAdmin(supabase?: Awaited<ReturnType<typeof createSupabaseServerClient>>): Promise<boolean> {
  const client = supabase ?? await createSupabaseServerClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user?.email) return false;

  const { data } = await client
    .from('admin_users')
    .select('role')
    .eq('email', user.email)
    .maybeSingle();

  return data?.role === 'super_admin';
}

export async function isApproved(supabase?: Awaited<ReturnType<typeof createSupabaseServerClient>>): Promise<boolean> {
  const client = supabase ?? await createSupabaseServerClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user?.email) return false;

  const { data: admin } = await client
    .from('admin_users')
    .select('id')
    .eq('email', user.email)
    .maybeSingle();
  if (admin) return true;

  const { data: approved } = await client
    .from('approved_users')
    .select('id')
    .eq('email', user.email)
    .maybeSingle();

  return !!approved;
}
