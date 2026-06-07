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
    <div className="flex flex-wrap items-center gap-3 rounded-[26px] border border-white/70 bg-white/76 px-3 py-2.5 shadow-[0_14px_36px_rgba(15,23,42,0.045)] backdrop-blur-xl">
      {tabs.map((tab) => {
        const isActive = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        const count = counts[tab.href as keyof typeof counts];

        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              'inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-sm font-medium transition-all',
              isActive
                ? 'bg-slate-900 text-white shadow-[0_10px_22px_rgba(15,23,42,0.12)]'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            )}
          >
            <span>{tab.label}</span>
            {typeof count === 'number' ? (
              <span
                className={cn(
                  'rounded-full px-2 py-0.5 text-xs font-semibold leading-5',
                  isActive ? 'bg-white/18 text-white' : tab.badgeTone ? badgeClassNames[tab.badgeTone] : 'border border-slate-200/75 bg-white/70 text-slate-600'
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
