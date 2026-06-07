'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import {
  BadgeDollarSign,
  BookOpenText,
  Boxes,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  LayoutDashboard,
  Menu,
  X,
} from 'lucide-react';
import { cn } from './ui';

const navigationItems = [
  { href: '/admin/dashboard', label: '数据看板', icon: LayoutDashboard },
  { href: '/admin', label: '排期看板', icon: CalendarDays },
  { href: '/admin/orders/dispatch', label: '订单管理', icon: ClipboardList, matchPrefix: '/admin/orders' },
  { href: '/admin/webhook-wiki', label: 'Webhook Wiki', icon: BookOpenText },
  { href: '/admin/inventory', label: '仓库管理', icon: Boxes },
  { href: '/admin/finance', label: '财务报表', icon: BadgeDollarSign },
];

const collapseStorageKey = 'admin-sidebar-collapsed';

function isActivePath(pathname: string, href: string, matchPrefix?: string) {
  if (matchPrefix) return pathname.startsWith(matchPrefix);
  if (href === '/admin') return pathname === href;
  return pathname.startsWith(href);
}

export default function AdminSidebar() {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  useEffect(() => {
    const storedValue = window.localStorage.getItem(collapseStorageKey);
    if (storedValue === 'true') {
      setIsCollapsed(true);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(collapseStorageKey, String(isCollapsed));
  }, [isCollapsed]);

  const activeLabel = useMemo(() => {
    return navigationItems.find((item) => isActivePath(pathname, item.href, item.matchPrefix))?.label ?? '导航';
  }, [pathname]);

  const sidebarContent = (
    <>
      <div className="flex items-center justify-between gap-3">
        <div
          className={cn(
            'flex min-h-14 flex-1 items-center rounded-[24px] border border-cyan-200/55 bg-white/38 px-3 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.42),0_12px_30px_rgba(14,165,233,0.08)] backdrop-blur-xl',
            isCollapsed ? 'justify-center px-2' : 'justify-between'
          )}
        >
          <div className={cn('min-w-0', isCollapsed && 'hidden')}>
            <div className="h-2.5 w-16 rounded-full bg-cyan-500/38" />
            <div className="mt-2 h-2.5 w-24 rounded-full bg-teal-400/22" />
          </div>
          <div
            className={cn(
              'rounded-[18px] border border-dashed border-cyan-200/55 bg-white/46 shadow-[0_10px_30px_rgba(14,165,233,0.1)] backdrop-blur-md',
              isCollapsed ? 'h-9 w-9' : 'h-10 w-10 shrink-0'
            )}
            aria-hidden="true"
          />
        </div>

        <button
          type="button"
          onClick={() => setIsMobileOpen(false)}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-cyan-200/60 bg-white/40 text-cyan-800/70 transition-colors hover:bg-white/58 md:hidden"
          aria-label="关闭导航"
        >
          <X className="h-4 w-4" strokeWidth={1.9} />
        </button>
      </div>

      <nav className="mt-5 flex flex-1 flex-col gap-1.5 md:mt-7">
        {navigationItems.map((item) => {
          const isActive = isActivePath(pathname, item.href, item.matchPrefix);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setIsMobileOpen(false)}
              className={cn(
                'group flex items-center gap-2.5 rounded-[18px] px-2.5 py-2.5 text-[12px] font-medium transition-all duration-200 backdrop-blur-sm',
                isCollapsed ? 'justify-center px-2' : 'justify-start',
                isActive
                  ? 'border border-cyan-200/60 bg-[linear-gradient(135deg,rgba(255,255,255,0.68),rgba(224,242,254,0.62))] text-cyan-950 shadow-[0_12px_28px_rgba(14,165,233,0.12)]'
                  : 'text-cyan-900/66 hover:bg-white/34 hover:text-cyan-950'
              )}
              aria-label={item.label}
              title={item.label}
            >
              <span
                className={cn(
                  'flex h-7 w-7 shrink-0 items-center justify-center rounded-[14px] transition-all duration-200',
                  isActive
                    ? 'bg-white/70 text-cyan-700 shadow-[0_8px_18px_rgba(14,165,233,0.12)]'
                    : 'bg-white/34 text-cyan-700/58 group-hover:bg-white/48 group-hover:text-cyan-800'
                )}
              >
                <Icon className="h-3.5 w-3.5" strokeWidth={1.9} />
              </span>
              <span className={cn('truncate', isCollapsed && 'hidden')}>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <button
        type="button"
        onClick={() => setIsCollapsed((value) => !value)}
        className="mt-3 hidden items-center justify-center gap-2 rounded-full border border-cyan-200/60 bg-white/34 px-2.5 py-2 text-[12px] font-medium text-cyan-900/68 transition-colors hover:bg-white/54 hover:text-cyan-950 md:flex"
        aria-label={isCollapsed ? '展开侧边栏' : '折叠侧边栏'}
      >
        {isCollapsed ? <ChevronRight className="h-3.5 w-3.5" strokeWidth={1.9} /> : <ChevronLeft className="h-3.5 w-3.5" strokeWidth={1.9} />}
        <span className={cn(isCollapsed && 'hidden')}>{isCollapsed ? '展开导航' : '折叠导航'}</span>
      </button>
    </>
  );

  return (
    <>
      <div className="sticky top-0 z-30 border-b border-cyan-100/70 bg-white/70 px-4 py-3 backdrop-blur-xl md:hidden">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setIsMobileOpen(true)}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-cyan-100/80 bg-white/76 text-cyan-700 shadow-[0_6px_18px_rgba(14,165,233,0.08)] backdrop-blur-sm"
            aria-label="打开导航"
          >
            <Menu className="h-4 w-4" strokeWidth={1.9} />
          </button>
          <div className="min-w-0 flex-1 text-right">
            <p className="text-[11px] font-medium text-cyan-700/55">当前页面</p>
            <p className="truncate text-[14px] font-semibold tracking-[-0.01em] text-slate-900">{activeLabel}</p>
          </div>
        </div>
      </div>

      {isMobileOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-cyan-950/12 backdrop-blur-[2px] md:hidden"
          onClick={() => setIsMobileOpen(false)}
          aria-label="关闭导航遮罩"
        />
      ) : null}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex h-full w-[208px] max-w-[78vw] flex-col border-r border-cyan-200/60 bg-[linear-gradient(180deg,rgba(255,255,255,0.52)_0%,rgba(224,242,254,0.46)_55%,rgba(204,251,241,0.44)_100%)] px-3 py-4 shadow-[0_22px_60px_rgba(14,165,233,0.12)] backdrop-blur-2xl transition-transform duration-300 md:sticky md:top-0 md:z-20 md:min-h-screen md:max-w-none md:py-5',
          isCollapsed ? 'md:w-[76px]' : 'md:w-[188px]',
          isMobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        )}
      >
        {sidebarContent}
      </aside>
    </>
  );
}
