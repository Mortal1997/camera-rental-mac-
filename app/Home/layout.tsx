import { redirect } from 'next/navigation';
import { isApproved } from '@/lib/auth/admin';
import AdminShell from '@/app/admin/components/AdminShell';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const approved = await isApproved();

  if (!approved) {
    redirect('/login');
  }

  return (
    <AdminShell>
      {children}
    </AdminShell>
  );
}
