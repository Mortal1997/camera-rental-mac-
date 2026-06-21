import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function ApprovalPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) redirect('/login');

  const { data } = await supabase
    .from('admin_users')
    .select('role')
    .eq('email', user.email)
    .maybeSingle();

  if (data?.role !== 'super_admin') {
    redirect('/forbidden');
  }

  const ApprovalManager = (await import('./ApprovalManager')).default;
  return <ApprovalManager />;
}