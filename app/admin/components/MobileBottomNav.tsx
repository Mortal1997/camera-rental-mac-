'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import {
  Boxes,
  ClipboardList,
  ListChecks,
  MoreHorizontal,
  ScanLine,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type MobileBottomNavProps = {
  isMoreOpen: boolean;
  onOpenMore: () => void;
};

const navItems = [
  { href: '/admin/operations', label: '工作台', icon: ListChecks, key: 'operations' },
  { href: '/admin/orders/dispatch', label: '订单', icon: ClipboardList, key: 'orders' },
  { href: '/admin/operations?scan=1', label: '扫码', icon: ScanLine, key: 'scan' },
  { href: '/admin/inventory', label: '仓库', icon: Boxes, key: 'inventory' },
] as const;

export default function MobileBottomNav({ isMoreOpen, onOpenMore }: MobileBottomNavProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isScanMode = pathname === '/admin/operations' && searchParams.get('scan') === '1';

  function isItemActive(key: (typeof navItems)[number]['key']) {
    if (key === 'scan') return isScanMode;
    if (key === 'operations') return pathname === '/admin/operations' && !isScanMode;
    if (key === 'orders') return pathname.startsWith('/admin/orders');
    return pathname.startsWith('/admin/inventory');
  }

  const hasPrimaryActive = navItems.some((item) => isItemActive(item.key));
  const isMoreActive = isMoreOpen || !hasPrimaryActive;

  return (
    <nav
      aria-label="手机端主要导航"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-border/70 bg-background/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_-18px_rgba(15,23,42,0.45)] backdrop-blur supports-[backdrop-filter]:bg-background/88 lg:hidden"
    >
      <div className="mx-auto grid h-16 max-w-lg grid-cols-5 px-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = isItemActive(item.key);

          return (
            <Link
              key={item.key}
              href={item.href}
              aria-label={item.label}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'group flex min-h-11 min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl px-1 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/25',
                isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <span
                className={cn(
                  'flex h-7 min-w-10 items-center justify-center rounded-full px-2 transition-colors',
                  isActive ? 'bg-primary/12 text-primary' : 'group-hover:bg-accent'
                )}
              >
                <Icon className="size-[18px]" aria-hidden />
              </span>
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}

        <button
          type="button"
          onClick={onOpenMore}
          aria-label="打开更多功能"
          aria-expanded={isMoreOpen}
          aria-current={isMoreActive ? 'page' : undefined}
          className={cn(
            'group flex min-h-11 min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl px-1 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/25',
            isMoreActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <span
            className={cn(
              'flex h-7 min-w-10 items-center justify-center rounded-full px-2 transition-colors',
              isMoreActive ? 'bg-primary/12 text-primary' : 'group-hover:bg-accent'
            )}
          >
            <MoreHorizontal className="size-[18px]" aria-hidden />
          </span>
          <span>更多</span>
        </button>
      </div>
    </nav>
  );
}
