'use client';

import { useState } from 'react';
import type { ReactNode } from 'react';
import { Menu } from 'lucide-react';
import AdminSidebar from './components/AdminSidebar';

export default function AdminLayout({ children }: { children: ReactNode }) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-gray-50">
      {/* Sidebar */}
      <AdminSidebar
        isCollapsed={isCollapsed}
        isMobileOpen={isMobileOpen}
        onCollapsedChange={setIsCollapsed}
        onMobileClose={() => setIsMobileOpen(false)}
      />

      {/* Right: main content area */}
      <div className="flex flex-1 flex-col h-full overflow-hidden">
        {/* Mobile navbar */}
        <header className="flex md:hidden h-16 shrink-0 items-center gap-3 border-b border-border/70 bg-background/96 px-4 z-30">
          <button
            onClick={() => setIsMobileOpen(true)}
            className="flex size-9 items-center justify-center rounded-xl text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
            aria-label="打开菜单"
          >
            <Menu className="size-5" />
          </button>
          <p className="text-sm font-semibold text-foreground">小玄租赁运营后台</p>
        </header>

        {/* Desktop header */}
        <header className="hidden md:flex h-[60px] shrink-0 items-center gap-3 border-b border-border/70 bg-background/96 px-4 lg:px-10 z-30">
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Admin Console</p>
          <span className="h-3 w-px bg-border/50" aria-hidden />
          <p className="text-sm font-semibold text-foreground">小玄租赁运营后台</p>
        </header>

        {/* Scrollable page content */}
        <main className="flex-1 overflow-y-auto p-4 py-5 sm:px-6 sm:py-8 lg:px-10">
          <div className="mx-auto w-full max-w-[1680px] rounded-[30px] border border-border/70 bg-card/88 p-4 shadow-sm backdrop-blur-lg sm:p-6 lg:p-8">
            <div className="flex w-full flex-col gap-4 sm:gap-6">{children}</div>
          </div>
        </main>
      </div>
    </div>
  );
}
