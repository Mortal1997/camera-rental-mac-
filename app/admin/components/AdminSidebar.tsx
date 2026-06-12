'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  BadgeDollarSign,
  Boxes,
  CalendarDays,
  Camera,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  Settings,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  matchPrefix?: string;
};

const navigationItems: NavItem[] = [
  { href: '/admin/dashboard', label: '数据看板', icon: LayoutDashboard },
  { href: '/admin', label: '排期看板', icon: CalendarDays },
  { href: '/admin/orders/dispatch', label: '订单管理', icon: ClipboardList, matchPrefix: '/admin/orders' },
  { href: '/admin/inventory', label: '仓库管理', icon: Boxes },
  { href: '/admin/finance', label: '财务报表', icon: BadgeDollarSign },
];

const secondaryItems = [
  { href: '/admin/settings', label: '系统设置', icon: Settings },
] as const;

function isActivePath(pathname: string, href: string, matchPrefix?: string) {
  if (matchPrefix) return pathname.startsWith(matchPrefix);
  if (href === '/admin') return pathname === href;
  return pathname.startsWith(href);
}

function getInitials(email: string) {
  return email.charAt(0).toUpperCase();
}

export default function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<{ email?: string; fullName?: string } | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    async function loadUser() {
      const supabase = createClient();
      const { data } = await supabase.auth.getUser();
      if (data.user) {
        setUser({
          email: data.user.email,
          fullName: data.user.user_metadata?.full_name,
        });
      }
    }
    loadUser();
  }, []);

  async function handleSignOut() {
    setSigningOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <aside className="flex w-[260px] shrink-0 flex-col border-r border-sidebar-border bg-sidebar h-screen sticky top-0 overflow-y-auto">
      {/* Logo / brand header */}
      <div className="border-b border-sidebar-border px-3 py-3 shrink-0">
        <Link
          href="/admin/dashboard"
          className="flex h-auto items-center gap-3 rounded-2xl px-3 py-3 hover:bg-sidebar-accent"
        >
          <div className="flex aspect-square size-11 shrink-0 items-center justify-center rounded-2xl bg-sidebar-accent text-sidebar-foreground ring-1 ring-sidebar-border">
            <Camera className="size-5" />
          </div>
          <div className="grid flex-1 text-left text-sm leading-tight">
            <span className="truncate font-semibold text-sidebar-foreground">Camera Rental</span>
            <span className="truncate text-xs text-sidebar-foreground/60">后台管理系统</span>
          </div>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-3">
        <p className="mb-2 px-3 text-[11px] font-medium uppercase tracking-widest text-sidebar-foreground/40">
          控制台
        </p>
        <ul className="flex flex-col gap-0.5">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            const isActive = isActivePath(pathname, item.href, item.matchPrefix);

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    'flex h-11 items-center gap-3 rounded-xl px-3 text-sm transition-all',
                    isActive
                      ? 'bg-sidebar-primary font-medium text-sidebar-primary-foreground shadow-sm'
                      : 'text-sidebar-foreground/72 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                  )}
                >
                  <Icon className="size-4 shrink-0" />
                  <span>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>

        {/* Secondary nav — settings */}
        <p className="mb-2 mt-5 px-3 text-[11px] font-medium uppercase tracking-widest text-sidebar-foreground/40">
          账户
        </p>
        <ul className="flex flex-col gap-0.5">
          {secondaryItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    'flex h-11 items-center gap-3 rounded-xl px-3 text-sm transition-all',
                    isActive
                      ? 'bg-sidebar-primary font-medium text-sidebar-primary-foreground shadow-sm'
                      : 'text-sidebar-foreground/72 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                  )}
                >
                  <Icon className="size-4 shrink-0" />
                  <span>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* User card — pinned to bottom */}
      <div className="shrink-0 border-t border-sidebar-border p-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              disabled={signingOut}
              className={cn(
                'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all',
                'hover:bg-sidebar-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring',
                signingOut && 'opacity-50 pointer-events-none'
              )}
            >
              <Avatar size="sm" className="ring-1 ring-sidebar-border">
                <AvatarFallback className="bg-sidebar-accent text-sidebar-foreground text-xs font-medium">
                  {user?.email ? getInitials(user.email) : '?'}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium text-sidebar-foreground leading-tight">
                  {user?.fullName ?? user?.email ?? '加载中…'}
                </p>
                {user?.email && !user?.fullName && (
                  <p className="truncate text-[11px] text-sidebar-foreground/50 leading-tight">
                    {user.email}
                  </p>
                )}
              </div>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" className="w-52">
            <DropdownMenuItem
              onClick={() => router.push('/admin/settings')}
              className="cursor-pointer"
            >
              <Settings className="mr-2 size-4" />
              个人设置
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={handleSignOut}
              variant="destructive"
              className="cursor-pointer"
            >
              <LogOut className="mr-2 size-4" />
              退出登录
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  );
}
