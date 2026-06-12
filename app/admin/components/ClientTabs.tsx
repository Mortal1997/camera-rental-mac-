'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from './ui';

type ClientTabsProps = {
  dispatchCount: number;
  pendingCount: number;
  activeCount: number;
};

type TabItem = {
  href: string;
  label: string;
  badgeTone?: 'red' | 'amber' | 'blue';
  count?: number;
};

const tabs: TabItem[] = [
  { href: '/admin/orders/dispatch', label: '调度中心', badgeTone: 'red' },
  { href: '/admin/orders/pending', label: '待发货', badgeTone: 'amber' },
  { href: '/admin/orders/active', label: '租用中', badgeTone: 'blue' },
  { href: '/admin/orders/completed', label: '已完成' },
];

const badgeClassNames = {
  red: 'border border-rose-200/75 bg-rose-50/75 text-rose-700',
  amber: 'border border-amber-200/75 bg-amber-50/75 text-amber-700',
  blue: 'border border-sky-200/75 bg-sky-50/75 text-sky-700',
} as const;

export default function ClientTabs({ dispatchCount, pendingCount, activeCount }: ClientTabsProps) {
  const pathname = usePathname();
  const counts = {
    '/admin/orders/dispatch': dispatchCount,
    '/admin/orders/pending': pendingCount,
    '/admin/orders/active': activeCount,
  } as const;

  return (
    <nav className="flex items-center gap-1 rounded-2xl border border-border/70 bg-card p-1 shadow-sm">
      {tabs.map((tab) => {
        const isActive = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        const count = counts[tab.href as keyof typeof counts];

        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              'inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-all duration-200',
              isActive
                ? 'bg-zinc-900 text-zinc-50 shadow-sm'
                : 'text-foreground hover:bg-muted/60'
            )}
          >
            <span>{tab.label}</span>
            {typeof count === 'number' ? (
              <span
                className={cn(
                  'rounded-full px-2 py-0.5 text-[11px] font-semibold leading-4',
                  isActive ? 'bg-white/15 text-white' : tab.badgeTone ? badgeClassNames[tab.badgeTone] : 'border border-border/70 bg-muted/40 text-muted-foreground'
                )}
              >
                {count}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
