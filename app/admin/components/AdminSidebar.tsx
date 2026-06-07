'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BadgeDollarSign,
  BookOpenText,
  Boxes,
  CalendarDays,
  ClipboardList,
  LayoutDashboard,
} from 'lucide-react';
import { cn, SurfaceCard } from './ui';

const navigationItems = [
  { href: '/admin/dashboard', label: '数据看板', icon: LayoutDashboard },
  { href: '/admin', label: '排期看板', icon: CalendarDays },
  { href: '/admin/orders/dispatch', label: '订单管理', icon: ClipboardList, matchPrefix: '/admin/orders' },
  { href: '/admin/webhook-wiki', label: 'Webhook Wiki', icon: BookOpenText },
  { href: '/admin/inventory', label: '仓库管理', icon: Boxes },
  { href: '/admin/finance', label: '财务报表', icon: BadgeDollarSign },
];

function isActivePath(pathname: string, href: string, matchPrefix?: string) {
  if (matchPrefix) return pathname.startsWith(matchPrefix);
  if (href === '/admin') return pathname === href;
  return pathname.startsWith(href);
}

export default function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 flex min-h-screen w-64 shrink-0 flex-col border-r border-slate-200 bg-white/90 px-4 py-6 backdrop-blur-xl">
      <SurfaceCard className="border-slate-200 bg-slate-50/80 p-4 shadow-none">
        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-indigo-600">XIAOXUAN RENTAL</p>
        <h1 className="mt-3 text-xl font-bold tracking-tight text-slate-900">
          <span className="text-2xl">小玄</span>租赁
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">智能租赁管理中台</p>
      </SurfaceCard>

      <nav className="mt-8 flex flex-1 flex-col gap-1.5">
        {navigationItems.map((item) => {
          const isActive = isActivePath(pathname, item.href, item.matchPrefix);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'group flex items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-medium transition-all duration-200',
                isActive
                  ? 'bg-indigo-50 text-indigo-600 shadow-sm ring-1 ring-inset ring-indigo-100'
                  : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
              )}
            >
              <span
                className={cn(
                  'flex h-9 w-9 items-center justify-center rounded-lg transition-all duration-200',
                  isActive
                    ? 'bg-white text-indigo-600 shadow-sm'
                    : 'bg-slate-100 text-slate-400 group-hover:bg-white group-hover:text-slate-700'
                )}
              >
                <Icon className="h-4.5 w-4.5" strokeWidth={2.1} />
              </span>
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
