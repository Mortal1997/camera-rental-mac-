import { redirect } from 'next/navigation';
import { isAdmin, isApproved } from '@/lib/auth/admin';
import AdminShell from './components/AdminShell';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await isAdmin();
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
