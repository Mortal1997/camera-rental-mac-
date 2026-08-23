'use client';

import { useState } from 'react';
import type { ReactNode } from 'react';
import { Menu } from 'lucide-react';
import type { AdminViewer } from '@/lib/auth/admin';
import AdminSidebar from './AdminSidebar';

export default function AdminShell({ children, viewer }: { children: ReactNode; viewer: AdminViewer }) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-gray-50">
      <AdminSidebar
        viewer={viewer}
        isCollapsed={isCollapsed}
        isMobileOpen={isMobileOpen}
        onCollapsedChange={setIsCollapsed}
        onMobileClose={() => setIsMobileOpen(false)}
      />

      <div className="flex flex-1 flex-col h-full overflow-hidden">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border/70 bg-background/96 px-3 z-30 lg:hidden">
          <button
            onClick={() => setIsMobileOpen(true)}
            className="flex size-11 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/20"
            aria-label="打开菜单"
          >
            <Menu className="size-5" />
          </button>
          <p className="text-sm font-semibold text-foreground">BANG BANG Rental</p>
        </header>

        <header className="hidden lg:flex h-[60px] shrink-0 items-center gap-3 border-b border-border/70 bg-background/96 px-4 lg:px-10 z-30">
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Admin Console</p>
          <span className="h-3 w-px bg-border/50" aria-hidden />
          <p className="text-sm font-semibold text-foreground">BANG BANG Rental</p>
        </header>

        <main className="flex-1 overflow-y-auto px-3 py-4 sm:px-6 sm:py-6 lg:px-10 lg:py-8">
          <div className="mx-auto flex w-full max-w-[1680px] flex-col gap-4 sm:gap-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
