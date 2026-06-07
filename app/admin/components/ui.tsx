import type { ComponentType, ReactNode } from 'react';
import type { LucideProps } from 'lucide-react';
import { X } from 'lucide-react';

export type IconType = ComponentType<LucideProps>;

export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

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
    <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-indigo-600">{eyebrow}</p>
      <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">{title}</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>
        </div>
        {meta ? <div>{meta}</div> : null}
      </div>
    </div>
  );
}

export function SurfaceCard({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('rounded-2xl border border-slate-100 bg-white p-6 shadow-sm', className)}>{children}</div>;
}

export function SectionHeader({ title, description, meta }: { title: string; description?: string; meta?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div>
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
        {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
      </div>
      {meta ? <span className="text-sm text-slate-400">{meta}</span> : null}
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
    <SurfaceCard className="p-5">
      <div className="flex items-center gap-2">
        {Icon ? (
          <div className={cn('flex h-9 w-9 items-center justify-center rounded-xl bg-slate-50', iconClassName)}>
            <Icon className="h-4.5 w-4.5" />
          </div>
        ) : null}
        <p className="text-xs font-medium text-slate-500">{label}</p>
      </div>
      <p className={cn('mt-4 text-3xl font-bold tracking-tight text-slate-900', valueClassName)}>{value}</p>
      {hint ? <p className="mt-2 text-xs font-medium text-slate-400">{hint}</p> : null}
    </SurfaceCard>
  );
}

export function StatBadge({ tone = 'slate', children, dot = false }: { tone?: 'slate' | 'blue' | 'emerald' | 'amber' | 'red' | 'indigo'; children: ReactNode; dot?: boolean }) {
  const tones = {
    slate: 'bg-slate-100 text-slate-700',
    blue: 'bg-blue-50 text-blue-700',
    emerald: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-700',
    red: 'bg-red-50 text-red-700',
    indigo: 'bg-indigo-50 text-indigo-700',
  } as const;
  const dots = {
    slate: 'bg-slate-400',
    blue: 'bg-blue-500',
    emerald: 'bg-emerald-500',
    amber: 'bg-amber-500',
    red: 'bg-red-500',
    indigo: 'bg-indigo-500',
  } as const;

  return <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium', tones[tone])}>{dot ? <span className={cn('h-1.5 w-1.5 rounded-full', dots[tone])} /> : null}{children}</span>;
}

export function StatusBadge({ label, tone, dot }: { label: string; tone: 'blue' | 'emerald' | 'amber' | 'red' | 'slate' | 'indigo'; dot?: boolean }) {
  return <StatBadge tone={tone} dot={dot}>{label}</StatBadge>;
}

export function TableShell({ children }: { children: ReactNode }) {
  return <div className="mt-6 overflow-x-auto rounded-2xl border border-slate-100">{children}</div>;
}

export function TableHead({ children }: { children: ReactNode }) {
  return <thead className="bg-slate-50/80">{children}</thead>;
}

export function Th({ children, className }: { children: ReactNode; className?: string }) {
  return <th className={cn('px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500', className)}>{children}</th>;
}

export function Tr({ children, className }: { children: ReactNode; className?: string }) {
  return <tr className={cn('border-b border-slate-50 transition-colors hover:bg-slate-50/50', className)}>{children}</tr>;
}

export function Td({ children, className }: { children: ReactNode; className?: string }) {
  return <td className={cn('px-4 py-4 text-slate-600', className)}>{children}</td>;
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm text-slate-400">{children}</div>;
}

export function PrimaryButton({ className, children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button {...props} className={cn('inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-all hover:bg-slate-800 disabled:opacity-50', className)}>{children}</button>;
}

export function SecondaryButton({ className, children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button {...props} className={cn('inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50', className)}>{children}</button>;
}

export function DangerButton({ className, children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button {...props} className={cn('inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-100 disabled:opacity-50', className)}>{children}</button>;
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const { className, ...rest } = props;
  return <input {...rest} className={cn('w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm transition-all outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-900/10', className)} />;
}

export function SelectInput(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  const { className, children, ...rest } = props;
  return <select {...rest} className={cn('w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm transition-all outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-900/10', className)}>{children}</select>;
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
    <label className={cn('flex flex-col gap-2 text-sm font-medium text-slate-700', className)}>
      {label}
      {children}
      {error ? <p className="text-xs text-red-500">{error}</p> : null}
    </label>
  );
}

export function Modal({
  open,
  onClose,
  title,
  eyebrow,
  icon: Icon,
  maxWidthClassName = 'max-w-2xl',
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  eyebrow?: string;
  icon?: IconType;
  maxWidthClassName?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4 py-8 backdrop-blur-sm">
      <div className={cn('w-full rounded-3xl bg-white shadow-2xl', maxWidthClassName)}>
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
          <div>
            {eyebrow ? (
              <div className="inline-flex items-center gap-2 rounded-lg bg-slate-100 px-2.5 py-1">
                {Icon ? <Icon className="h-3.5 w-3.5 text-slate-500" /> : null}
                <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">{eyebrow}</p>
              </div>
            ) : null}
            <h3 className="mt-2 text-2xl font-semibold text-slate-900">{title}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-6 py-6">{children}</div>
        {footer ? <div className="border-t border-slate-100 px-6 py-5">{footer}</div> : null}
      </div>
    </div>
  );
}
