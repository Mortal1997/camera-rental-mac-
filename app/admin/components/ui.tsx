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
    <div className="rounded-[28px] border border-white/85 bg-[linear-gradient(135deg,rgba(255,255,255,0.92),rgba(236,254,255,0.82))] p-5 shadow-[0_18px_52px_rgba(14,116,144,0.07)] backdrop-blur-xl sm:p-7">
      <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-cyan-500/70">{eyebrow}</p>
      <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-[28px] font-semibold tracking-[-0.03em] text-slate-900 sm:text-[34px]">{title}</h1>
          <p className="mt-2 max-w-3xl text-[14px] leading-6 text-slate-600">{description}</p>
        </div>
        {meta ? <div className="w-full lg:w-auto">{meta}</div> : null}
      </div>
    </div>
  );
}

export function SurfaceCard({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div
      className={cn(
        'rounded-[28px] border border-white/85 bg-[linear-gradient(160deg,rgba(255,255,255,0.9),rgba(240,253,250,0.8))] p-6 shadow-[0_16px_44px_rgba(6,182,212,0.06)] backdrop-blur-xl',
        className
      )}
    >
      {children}
    </div>
  );
}

export function FilterPanel({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div
      className={cn(
        'mt-6 grid gap-4 rounded-[24px] border border-cyan-100/80 bg-[linear-gradient(135deg,rgba(240,249,255,0.84),rgba(236,253,245,0.8))] p-4 backdrop-blur-sm sm:p-5',
        className
      )}
    >
      {children}
    </div>
  );
}

export function InfoTile({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('rounded-[22px] border border-cyan-100/75 bg-[linear-gradient(135deg,rgba(255,255,255,0.84),rgba(236,254,255,0.72))] px-4 py-3.5 backdrop-blur-sm', className)}>{children}</div>;
}

export function SectionHeader({ title, description, meta }: { title: string; description?: string; meta?: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-slate-900">{title}</h2>
        {description ? <p className="mt-1 text-[13px] leading-6 text-slate-600">{description}</p> : null}
      </div>
      {meta ? <div className="text-[13px] text-cyan-700/55 sm:text-right">{meta}</div> : null}
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
    <SurfaceCard className="p-5 sm:p-6">
      <div className="flex items-center gap-2.5">
        {Icon ? (
          <div
            className={cn(
              'flex h-9 w-9 items-center justify-center rounded-2xl border border-cyan-100/80 bg-[linear-gradient(135deg,rgba(240,249,255,0.9),rgba(236,253,245,0.82))] text-cyan-700',
              iconClassName
            )}
          >
            <Icon className="h-4 w-4" />
          </div>
        ) : null}
        <p className="text-[12px] font-medium text-slate-500">{label}</p>
      </div>
      <p className={cn('mt-4 text-[30px] font-semibold tracking-[-0.04em] text-slate-900', valueClassName)}>{value}</p>
      {hint ? <p className="mt-2 text-[12px] font-medium text-cyan-700/55">{hint}</p> : null}
    </SurfaceCard>
  );
}

export function StatBadge({ tone = 'slate', children, dot = false }: { tone?: 'slate' | 'blue' | 'emerald' | 'amber' | 'red' | 'indigo'; children: ReactNode; dot?: boolean }) {
  const tones = {
    slate: 'border border-cyan-100/80 bg-white/85 text-slate-600',
    blue: 'border border-sky-200/70 bg-sky-50/80 text-sky-700',
    emerald: 'border border-emerald-200/70 bg-emerald-50/78 text-emerald-700',
    amber: 'border border-amber-200/70 bg-amber-50/82 text-amber-700',
    red: 'border border-rose-200/70 bg-rose-50/82 text-rose-700',
    indigo: 'border border-cyan-100/80 bg-cyan-50/80 text-cyan-800',
  } as const;
  const dots = {
    slate: 'bg-cyan-400',
    blue: 'bg-sky-400',
    emerald: 'bg-emerald-400',
    amber: 'bg-amber-400',
    red: 'bg-rose-400',
    indigo: 'bg-cyan-500',
  } as const;

  return <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium backdrop-blur-sm', tones[tone])}>{dot ? <span className={cn('h-1.5 w-1.5 rounded-full', dots[tone])} /> : null}{children}</span>;
}

export function StatusBadge({ label, tone, dot }: { label: string; tone: 'blue' | 'emerald' | 'amber' | 'red' | 'slate' | 'indigo'; dot?: boolean }) {
  return <StatBadge tone={tone} dot={dot}>{label}</StatBadge>;
}

export function TableShell({ children }: { children: ReactNode }) {
  return <div className="mt-6 overflow-x-auto rounded-[24px] border border-white/85 bg-[linear-gradient(180deg,rgba(255,255,255,0.9),rgba(236,254,255,0.8))] shadow-[0_12px_32px_rgba(6,182,212,0.05)] backdrop-blur-xl">{children}</div>;
}

export function TableHead({ children }: { children: ReactNode }) {
  return <thead className="bg-cyan-50/65">{children}</thead>;
}

export function Th({ children, className }: { children: ReactNode; className?: string }) {
  return <th className={cn('px-4 py-3.5 text-left text-[11px] font-medium uppercase tracking-[0.14em] text-cyan-700/55', className)}>{children}</th>;
}

export function Tr({ children, className }: { children: ReactNode; className?: string }) {
  return <tr className={cn('border-b border-cyan-100/65 transition-colors hover:bg-cyan-50/42', className)}>{children}</tr>;
}

export function Td({ children, className }: { children: ReactNode; className?: string }) {
  return <td className={cn('px-4 py-4.5 text-[14px] text-slate-600', className)}>{children}</td>;
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <div className="rounded-[22px] border border-dashed border-cyan-200/80 bg-[linear-gradient(135deg,rgba(255,255,255,0.82),rgba(236,254,255,0.76))] px-5 py-11 text-center text-sm leading-6 text-cyan-800/50 backdrop-blur-sm">{children}</div>;
}

export function PrimaryButton({ className, children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button {...props} className={cn('inline-flex items-center justify-center gap-2 rounded-full bg-[linear-gradient(135deg,#0ea5e9,#14b8a6)] px-4 py-2.5 text-[13px] font-medium text-white shadow-[0_12px_24px_rgba(14,165,233,0.22)] transition-all hover:brightness-[1.03] disabled:opacity-50', className)}>{children}</button>;
}

export function SecondaryButton({ className, children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button {...props} className={cn('inline-flex items-center justify-center gap-2 rounded-full border border-cyan-100/85 bg-white/82 px-4 py-2.5 text-[13px] font-medium text-cyan-900/78 backdrop-blur-sm transition-colors hover:border-cyan-200/90 hover:bg-cyan-50/70 disabled:opacity-50', className)}>{children}</button>;
}

export function DangerButton({ className, children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button {...props} className={cn('inline-flex items-center justify-center gap-2 rounded-full border border-rose-200/80 bg-[linear-gradient(135deg,rgba(255,241,242,0.92),rgba(255,247,237,0.8))] px-4 py-2.5 text-[13px] font-medium text-rose-600 transition-colors hover:bg-rose-100/80 disabled:opacity-50', className)}>{children}</button>;
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const { className, ...rest } = props;
  return <input {...rest} className={cn('w-full rounded-2xl border border-cyan-100/85 bg-white/84 px-4 py-3 text-[14px] text-slate-900 shadow-[0_6px_18px_rgba(14,165,233,0.05)] transition-all outline-none backdrop-blur-sm placeholder:text-cyan-900/32 focus:border-sky-300 focus:bg-white focus:ring-2 focus:ring-sky-400/10', className)} />;
}

export function SelectInput(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  const { className, children, ...rest } = props;
  return <select {...rest} className={cn('w-full rounded-2xl border border-cyan-100/85 bg-white/84 px-4 py-3 text-[14px] text-slate-900 shadow-[0_6px_18px_rgba(14,165,233,0.05)] transition-all outline-none backdrop-blur-sm focus:border-sky-300 focus:bg-white focus:ring-2 focus:ring-sky-400/10', className)}>{children}</select>;
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
    <label className={cn('flex flex-col gap-2 text-[13px] font-medium text-slate-700', className)}>
      {label}
      {children}
      {error ? <p className="text-xs text-rose-500">{error}</p> : null}
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-cyan-950/12 px-3 py-4 backdrop-blur-md sm:px-4 sm:py-8">
      <div className={cn('max-h-[calc(100vh-2rem)] w-full overflow-hidden rounded-[32px] border border-white/85 bg-[linear-gradient(160deg,rgba(255,255,255,0.92),rgba(236,254,255,0.84))] shadow-[0_26px_80px_rgba(14,165,233,0.16)] backdrop-blur-2xl sm:max-h-[calc(100vh-4rem)]', maxWidthClassName)}>
        <div className="flex items-start justify-between gap-4 border-b border-cyan-100/75 px-4 py-4 sm:px-6 sm:py-5">
          <div className="min-w-0 flex-1">
            {eyebrow ? (
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-100/85 bg-white/80 px-2.5 py-1 backdrop-blur-sm">
                {Icon ? <Icon className="h-3.5 w-3.5 text-cyan-700/70" /> : null}
                <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-cyan-600/70">{eyebrow}</p>
              </div>
            ) : null}
            <h3 className="mt-2 text-[24px] font-semibold tracking-[-0.03em] text-slate-900 sm:text-[28px]">{title}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-cyan-100/85 bg-white/86 p-2 text-cyan-700/55 transition-colors hover:bg-white hover:text-cyan-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[calc(100vh-9rem)] overflow-y-auto px-4 py-5 sm:max-h-[calc(100vh-11rem)] sm:px-6 sm:py-6">{children}</div>
        {footer ? <div className="border-t border-cyan-100/75 px-4 py-4 sm:px-6 sm:py-5">{footer}</div> : null}
      </div>
    </div>
  );
}
