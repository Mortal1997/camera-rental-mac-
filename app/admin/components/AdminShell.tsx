'use client';

import { Suspense, useState } from 'react';
import type { ReactNode } from 'react';
import { Menu } from 'lucide-react';
import type { AdminViewer } from '@/lib/auth/admin';
import { usePathname } from 'next/navigation';
import AdminSidebar from './AdminSidebar';
import MobileBottomNav from './MobileBottomNav';

function getMobilePageTitle(pathname: string) {
  if (pathname.startsWith('/admin/operations')) return '今日工作台';
  if (pathname.startsWith('/admin/orders')) return '订单管理';
  if (pathname.startsWith('/admin/inventory')) return '仓库管理';
  if (pathname.startsWith('/admin/dashboard')) return '数据看板';
  if (pathname.startsWith('/admin/finance')) return '财务报表';
  if (pathname.startsWith('/admin/settings')) return '系统设置';
  if (pathname.startsWith('/Home/approval')) return '审批管理';
  return '排期看板';
}

export default function AdminShell({ children, viewer }: { children: ReactNode; viewer: AdminViewer }) {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const mobilePageTitle = getMobilePageTitle(pathname);

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
        <header className="z-30 shrink-0 border-b border-border/70 bg-background/96 pt-[env(safe-area-inset-top)] lg:hidden">
          <div className="flex h-12 items-center gap-2 px-1.5">
            <button
              type="button"
              onClick={() => setIsMobileOpen(true)}
              className="flex size-11 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/20"
              aria-label="打开菜单"
              aria-expanded={isMobileOpen}
            >
              <Menu className="size-5" aria-hidden />
            </button>
            <div className="flex min-w-0 items-center gap-2 text-sm text-foreground">
              <span className="shrink-0 text-[11px] font-bold uppercase tracking-[0.12em]">BANG BANG</span>
              <span className="h-3 w-px shrink-0 bg-border" aria-hidden />
              <h1 className="truncate font-semibold">{mobilePageTitle}</h1>
            </div>
          </div>
        </header>

        <header className="hidden lg:flex h-[60px] shrink-0 items-center gap-3 border-b border-border/70 bg-background/96 px-4 lg:px-10 z-30">
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Admin Console</p>
          <span className="h-3 w-px bg-border/50" aria-hidden />
          <p className="text-sm font-semibold text-foreground">BANG BANG Rental</p>
        </header>

        <main className="flex-1 overflow-y-auto px-3 pb-[calc(5rem+env(safe-area-inset-bottom))] pt-4 sm:px-6 sm:pt-6 lg:px-10 lg:py-8">
          <div className="mx-auto flex w-full max-w-[1680px] flex-col gap-4 sm:gap-6">
            {children}
          </div>
        </main>

        <Suspense fallback={null}>
          <MobileBottomNav
            isMoreOpen={isMobileOpen}
            onOpenMore={() => setIsMobileOpen(true)}
          />
        </Suspense>
      </div>
    </div>
  );
}
