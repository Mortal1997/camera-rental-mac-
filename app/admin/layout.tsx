import type { ReactNode } from 'react';

import AdminSidebar from './components/AdminSidebar';

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen w-full">
      {/* Left: sidebar — sticky, never scrolls the page */}
      <AdminSidebar />

      {/* Right: main content area — takes all remaining space */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Header — sticky inside the right column only */}
        <header className="sticky top-0 z-30 flex h-[60px] shrink-0 items-center gap-3 border-b border-border/70 bg-background/96 px-4 sm:px-6 lg:px-10">
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Admin Console</p>
          <span className="h-3 w-px bg-border/50" aria-hidden />
          <p className="text-sm font-semibold text-foreground">小玄租赁运营后台</p>
        </header>

        {/* Page content */}
        <main className="flex-1 px-4 py-5 sm:px-6 sm:py-8 lg:px-10">
          <div className="mx-auto w-full max-w-[1680px] rounded-[30px] border border-border/70 bg-card/88 p-4 shadow-sm backdrop-blur-lg sm:p-6 lg:p-8">
            <div className="flex w-full flex-col gap-4 sm:gap-6">{children}</div>
          </div>
        </main>
      </div>
    </div>
  );
}
