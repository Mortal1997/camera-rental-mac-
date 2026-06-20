'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  BadgeDollarSign,
  Boxes,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  Settings,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
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

type SidebarProps = {
  isCollapsed: boolean;
  isMobileOpen: boolean;
  onCollapsedChange: (v: boolean) => void;
  onMobileClose: () => void;
};

export default function AdminSidebar({ isCollapsed, isMobileOpen, onCollapsedChange, onMobileClose }: SidebarProps) {
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

  useEffect(() => {
    if (isMobileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isMobileOpen]);

  async function handleSignOut() {
    setSigningOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  const sidebarContent = (
    <div
      className={cn(
        'flex h-full shrink-0 flex-col border-r border-sidebar-border bg-sidebar transition-all duration-300',
        isCollapsed ? 'w-14' : 'w-56'
      )}
    >
      {/* Logo / brand header */}
      <div className={cn(
        'border-b border-sidebar-border shrink-0 flex items-center',
        isCollapsed ? 'h-20 justify-center' : 'h-20 px-2.5'
      )}>
        <Link
          href="/admin/dashboard"
          className={cn(
            'flex h-9 items-center rounded-xl hover:bg-sidebar-accent transition-all duration-300 overflow-hidden',
            isCollapsed ? 'justify-center' : 'gap-2.5 px-2 flex-1 min-w-0'
          )}
        >
          <Image
            src="/logo.png"
            alt="BANG BANG"
            width={32}
            height={32}
            style={{ width: 'auto', height: 'auto' }}
            className="object-contain shrink-0"
          />
          <div
            className={cn(
              'grid flex-1 text-left text-sm leading-tight transition-all duration-300 overflow-hidden min-w-0',
              isCollapsed ? 'opacity-0 w-0 p-0' : 'opacity-100'
            )}
          >
            <span className="truncate font-bold text-sidebar-foreground tracking-widest uppercase">BANG BANG</span>
            <span className="truncate text-[11px] text-sidebar-foreground/60 tracking-widest uppercase">Rental</span>
          </div>
        </Link>
        {/* Mobile close button */}
        <button
          onClick={onMobileClose}
          className="flex size-9 shrink-0 items-center justify-center rounded-lg text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground lg:hidden"
          aria-label="关闭菜单"
        >
          <X className="size-4" />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-2 overflow-y-auto">
        <p
          className={cn(
            'mb-1.5 px-2.5 text-[11px] font-medium uppercase tracking-widest text-sidebar-foreground/40 transition-all duration-300',
            isCollapsed ? 'opacity-0 h-0 mb-0 py-0 min-h-0 overflow-hidden' : ''
          )}
        >
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
                  onClick={onMobileClose}
                  className={cn(
                    'flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-[13px] transition-all',
                    isActive
                      ? 'bg-sidebar-primary font-medium text-sidebar-primary-foreground shadow-sm'
                      : 'text-sidebar-foreground/72 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                  )}
                >
                  <Icon className="size-4 shrink-0" />
                  <span
                    className={cn(
                      'transition-all duration-300 overflow-hidden whitespace-nowrap',
                      isCollapsed ? 'opacity-0 w-0' : 'opacity-100'
                    )}
                  >
                    {item.label}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>

        <p
          className={cn(
            'mb-1.5 mt-4 px-2.5 text-[11px] font-medium uppercase tracking-widest text-sidebar-foreground/40 transition-all duration-300',
            isCollapsed ? 'opacity-0 h-0 mb-0 py-0 min-h-0 overflow-hidden' : ''
          )}
        >
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
                  onClick={onMobileClose}
                  className={cn(
                    'flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-[13px] transition-all',
                    isActive
                      ? 'bg-sidebar-primary font-medium text-sidebar-primary-foreground shadow-sm'
                      : 'text-sidebar-foreground/72 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                  )}
                >
                  <Icon className="size-4 shrink-0" />
                  <span
                    className={cn(
                      'transition-all duration-300 overflow-hidden whitespace-nowrap',
                      isCollapsed ? 'opacity-0 w-0' : 'opacity-100'
                    )}
                  >
                    {item.label}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Collapse toggle button (desktop) */}
      <div className="hidden lg:flex shrink-0 border-t border-sidebar-border p-1.5">
        <button
          onClick={() => onCollapsedChange(!isCollapsed)}
          className="flex w-full h-9 items-center justify-center gap-2 rounded-lg px-2 text-[13px] text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-all"
          aria-label={isCollapsed ? '展开侧边栏' : '折叠侧边栏'}
        >
          <div className="flex size-4 shrink-0 items-center justify-center">
            {isCollapsed
              ? <ChevronRight className="size-4" />
              : <ChevronLeft className="size-4" />
            }
          </div>
          <span
            className={cn(
              'transition-all duration-300 overflow-hidden whitespace-nowrap',
              isCollapsed ? 'opacity-0 w-0' : 'opacity-100'
            )}
          >
            收起
          </span>
        </button>
      </div>

      {/* User card — pinned to bottom */}
      <div className="shrink-0 border-t border-sidebar-border p-1.5">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              disabled={signingOut}
              className={cn(
                'flex w-full h-9 items-center gap-2.5 rounded-lg px-2 text-left transition-all',
                'hover:bg-sidebar-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring',
                signingOut && 'opacity-50 pointer-events-none'
              )}
            >
              <Avatar size="sm" className="ring-1 ring-sidebar-border shrink-0">
                <AvatarFallback className="bg-sidebar-accent text-sidebar-foreground text-xs font-medium">
                  {user?.email ? getInitials(user.email) : '?'}
                </AvatarFallback>
              </Avatar>
              <div className={cn(
                'min-w-0 flex-1 transition-all duration-300 overflow-hidden',
                isCollapsed ? 'opacity-0 w-0' : 'opacity-100'
              )}>
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
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <div className="hidden lg:block shrink-0">
        {sidebarContent}
      </div>

      {/* Mobile overlay + drawer */}
      <div
        className={cn(
          'lg:hidden fixed inset-0 z-40 transition-all duration-300',
          isMobileOpen ? 'visible' : 'invisible pointer-events-none'
        )}
      >
        {/* Overlay */}
        <div
          className={cn(
            'absolute inset-0 bg-black/50 transition-opacity duration-300',
            isMobileOpen ? 'opacity-100' : 'opacity-0'
          )}
          onClick={onMobileClose}
          aria-hidden="true"
        />
        {/* Drawer */}
        <div
          className={cn(
            'absolute left-0 top-0 h-full z-50 max-w-[85vw] transition-transform duration-300',
            isMobileOpen ? 'translate-x-0' : '-translate-x-full'
          )}
        >
          {sidebarContent}
        </div>
      </div>
    </>
  );
}
