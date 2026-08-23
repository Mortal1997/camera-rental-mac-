import type { ComponentType, ReactNode } from 'react';
import type { LucideProps } from 'lucide-react';

export { Drawer, Modal } from './OverlayPanels';

export type IconType = ComponentType<LucideProps>;

export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

const cardSurface = 'rounded-3xl border border-border/70 bg-card shadow-sm';

export function PageHeader({
  eyebrow,
  title,
  description,
  meta,
}: {
  eyebrow: string;
  title: string;
  description: string;
  meta?: ReactNode;
}) {
  return (
    <div className={cn(cardSurface, 'p-4 sm:p-7 lg:p-8')}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-700 sm:text-xs">{eyebrow}</p>
        {meta ? <div className="hidden shrink-0 sm:block lg:hidden">{meta}</div> : null}
      </div>
      <div className="mt-2 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between sm:mt-3">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-[-0.03em] text-foreground sm:text-3xl lg:text-4xl">{title}</h1>
          <p className="mt-1.5 max-w-3xl text-[13px] leading-5 text-muted-foreground sm:mt-2 sm:text-sm sm:leading-6">{description}</p>
        </div>
        {meta ? <div className="w-full lg:w-auto">{meta}</div> : null}
      </div>
    </div>
  );
}

export function SurfaceCard({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn(cardSurface, 'p-4 sm:p-6 lg:p-7', className)}>{children}</div>;
}

export function FilterPanel({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('mt-4 grid gap-3 rounded-xl border border-border/70 bg-muted/50 p-3 sm:mt-6 sm:gap-4 sm:rounded-2xl sm:p-5', className)}>{children}</div>;
}

export function InfoTile({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('rounded-xl border border-border/70 bg-muted/55 px-3 py-2.5 sm:rounded-2xl sm:px-4 sm:py-3.5', className)}>{children}</div>;
}

export function SectionHeader({ title, description, meta }: { title: string; description?: string; meta?: ReactNode }) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
      <div className="min-w-0">
        <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-foreground sm:text-lg">{title}</h2>
        {description ? <p className="mt-0.5 text-xs leading-5 text-muted-foreground sm:mt-1 sm:text-sm sm:leading-6">{description}</p> : null}
      </div>
      {meta ? <div className="text-xs text-muted-foreground sm:text-sm sm:text-right">{meta}</div> : null}
    </div>
  );
}

export function MetricCard({
  icon: Icon,
  iconClassName,
  label,
  value,
  hint,
  valueClassName,
}: {
  icon?: IconType;
  iconClassName?: string;
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  valueClassName?: string;
}) {
  return (
    <SurfaceCard className="p-4 sm:p-6">
      <div className="flex items-center gap-2 sm:gap-2.5">
        {Icon ? (
          <div className={cn('flex h-9 w-9 items-center justify-center rounded-xl border border-border/70 bg-muted text-emerald-600 sm:h-10 sm:w-10 sm:rounded-2xl', iconClassName)}>
            <Icon className="h-4 w-4" />
          </div>
        ) : null}
        <p className="text-xs font-medium text-muted-foreground sm:text-[13px]">{label}</p>
      </div>
      <p className={cn('mt-3 text-[22px] font-semibold tracking-[-0.04em] text-foreground sm:mt-4 sm:text-[30px]', valueClassName)}>{value}</p>
      {hint ? <p className="mt-1.5 text-xs font-medium text-muted-foreground sm:mt-2 sm:text-[13px]">{hint}</p> : null}
    </SurfaceCard>
  );
}

export function StatBadge({ tone = 'slate', children, dot = false, className }: { tone?: 'slate' | 'blue' | 'emerald' | 'amber' | 'red' | 'indigo'; children: ReactNode; dot?: boolean; className?: string }) {
  const tones = {
    slate: 'bg-zinc-100 text-zinc-600',
    blue: 'bg-blue-50 text-blue-700',
    emerald: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-700',
    red: 'bg-rose-50 text-rose-700',
    indigo: 'bg-zinc-900 text-zinc-50',
  } as const;
  const dots = {
    slate: 'bg-zinc-400',
    blue: 'bg-blue-500',
    emerald: 'bg-emerald-500',
    amber: 'bg-amber-500',
    red: 'bg-rose-500',
    indigo: 'bg-emerald-400',
  } as const;

  return <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium', tones[tone], className)}>{dot ? <span className={cn('h-1.5 w-1.5 rounded-full', dots[tone])} /> : null}{children}</span>;
}

export function StatusBadge({ label, tone, dot }: { label: string; tone: 'blue' | 'emerald' | 'amber' | 'red' | 'slate' | 'indigo'; dot?: boolean }) {
  return <StatBadge tone={tone} dot={dot}>{label}</StatBadge>;
}

export function TableShell({ children }: { children: ReactNode }) {
  return <div className="mt-4 overflow-x-auto rounded-xl border border-border/70 bg-card shadow-sm sm:mt-6 sm:rounded-3xl">{children}</div>;
}

export function TableHead({ children }: { children: ReactNode }) {
  return <thead className="bg-muted/55">{children}</thead>;
}

export function Th({ children, className }: { children: ReactNode; className?: string }) {
  return <th className={cn('px-3 py-2.5 text-left text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground sm:px-4 sm:py-3.5 sm:text-xs', className)}>{children}</th>;
}

export function Tr({ children, className }: { children: ReactNode; className?: string }) {
  return <tr className={cn('border-b border-border/60 transition-colors hover:bg-muted/40', className)}>{children}</tr>;
}

export function Td({ children, className, title }: { children: ReactNode; className?: string; title?: string }) {
  return <td className={cn('px-3 py-3 text-[13px] text-foreground sm:px-4 sm:py-4.5 sm:text-[14px]', className)} title={title}>{children}</td>;
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <div className="rounded-xl border border-border/70 bg-muted/55 px-4 py-8 text-center text-xs leading-6 text-muted-foreground sm:rounded-2xl sm:px-5 sm:py-11 sm:text-sm">{children}</div>;
}

export function PrimaryButton({ className, children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button {...props} className={cn('inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-foreground px-4 py-2.5 text-sm font-medium text-background shadow-sm transition-all duration-200 hover:scale-[0.98] hover:bg-foreground/80 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/25 focus-visible:ring-offset-2 disabled:opacity-50', className)}>{children}</button>;
}

export function SecondaryButton({ className, children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button {...props} className={cn('inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-border/80 bg-card px-4 py-2.5 text-sm font-medium text-foreground shadow-sm transition-all duration-200 hover:scale-[0.98] hover:bg-muted/55 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/20 focus-visible:ring-offset-2 disabled:opacity-50', className)}>{children}</button>;
}

export function DangerButton({ className, children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button {...props} className={cn('inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-border/80 bg-muted px-4 py-2.5 text-sm font-medium text-foreground transition-all duration-200 hover:scale-[0.98] hover:bg-muted/80 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/20 focus-visible:ring-offset-2 disabled:opacity-50', className)}>{children}</button>;
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const { className, suppressHydrationWarning, ...rest } = props;
  return <input suppressHydrationWarning={suppressHydrationWarning} {...rest} className={cn('min-h-11 w-full rounded-2xl border border-input bg-background px-4 py-2.5 text-sm text-foreground shadow-sm transition-all outline-none placeholder:text-muted-foreground focus:border-foreground/30 focus:ring-2 focus:ring-foreground/10', className)} />;
}

export function SelectInput(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  const { className, children, ...rest } = props;
  return <select {...rest} className={cn('min-h-11 w-full rounded-2xl border border-input bg-background px-4 py-2.5 text-sm text-foreground shadow-sm transition-all outline-none focus:border-foreground/30 focus:ring-2 focus:ring-foreground/10', className)}>{children}</select>;
}

export function FormField({
  label,
  error,
  className,
  children,
}: {
  label: string;
  error?: string | null;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label className={cn('flex flex-col gap-2 text-[13px] font-medium text-foreground', className)}>
      {label}
      {children}
      {error ? <p className="text-xs text-rose-500">{error}</p> : null}
    </label>
  );
}
