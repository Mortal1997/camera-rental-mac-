import { redirect } from 'next/navigation';
import { getAdminViewer } from '@/lib/auth/admin';
import AdminShell from '@/app/admin/components/AdminShell';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const viewer = await getAdminViewer();

  if (!viewer) {
    redirect('/login');
  }

  return (
    <AdminShell viewer={viewer}>
      {children}
    </AdminShell>
  );
}
