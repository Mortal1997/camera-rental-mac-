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
  red: 'bg-red-500 text-white',
  amber: 'bg-amber-500 text-white',
  blue: 'bg-blue-500 text-white',
} as const;

export default function ClientTabs({ dispatchCount, pendingCount, activeCount }: ClientTabsProps) {
  const pathname = usePathname();
  const counts = {
    '/admin/orders/dispatch': dispatchCount,
    '/admin/orders/pending': pendingCount,
    '/admin/orders/active': activeCount,
  } as const;

  return (
    <div className="flex flex-wrap items-center gap-6">
      {tabs.map((tab) => {
        const isActive = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        const count = counts[tab.href as keyof typeof counts];

        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              'inline-flex items-center gap-2 border-b-2 px-1 pb-3 text-sm font-medium transition-colors',
              isActive
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            )}
          >
            <span>{tab.label}</span>
            {typeof count === 'number' ? (
              <span
                className={cn(
                  'rounded-full px-2 py-0.5 text-xs font-semibold leading-5',
                  tab.badgeTone ? badgeClassNames[tab.badgeTone] : ''
                )}
              >
                {count}
              </span>
            ) : null}
          </Link>
        );
      })}
    </div>
  );
}
