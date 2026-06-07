import type { ReactNode } from 'react';
import AdminSidebar from './components/AdminSidebar';

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#effbff_0%,#f5fffc_52%,#f7fafc_100%)] text-slate-900">
      <div className="flex min-h-screen flex-col md:flex-row">
        <AdminSidebar />

        <div className="min-w-0 flex-1">
          <main className="min-h-screen px-4 py-5 sm:px-6 sm:py-8 lg:px-10 md:pl-6">
            <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-4 sm:gap-6">{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
}
