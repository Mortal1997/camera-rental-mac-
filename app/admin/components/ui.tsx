import type { ComponentType, ReactNode } from 'react';
import type { LucideProps } from 'lucide-react';
import { X } from 'lucide-react';

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
    <div className={cn(cardSurface, 'p-6 sm:p-8')}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-600">{eyebrow}</p>
      <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-[-0.03em] text-foreground sm:text-4xl">{title}</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">{description}</p>
        </div>
        {meta ? <div className="w-full lg:w-auto">{meta}</div> : null}
      </div>
    </div>
  );
}

export function SurfaceCard({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn(cardSurface, 'p-6 sm:p-7', className)}>{children}</div>;
}

export function FilterPanel({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('mt-6 grid gap-4 rounded-2xl border border-border/70 bg-muted/50 p-4 sm:p-5', className)}>{children}</div>;
}

export function InfoTile({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('rounded-2xl border border-border/70 bg-muted/55 px-4 py-3.5', className)}>{children}</div>;
}

export function SectionHeader({ title, description, meta }: { title: string; description?: string; meta?: ReactNode }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h2 className="text-lg font-semibold tracking-[-0.01em] text-foreground">{title}</h2>
        {description ? <p className="mt-1.5 text-sm leading-6 text-muted-foreground">{description}</p> : null}
      </div>
      {meta ? <div className="text-sm text-muted-foreground sm:text-right">{meta}</div> : null}
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
          <div className={cn('flex h-10 w-10 items-center justify-center rounded-2xl border border-border/70 bg-muted text-emerald-600', iconClassName)}>
            <Icon className="h-4 w-4" />
          </div>
        ) : null}
        <p className="text-[12px] font-medium text-muted-foreground">{label}</p>
      </div>
      <p className={cn('mt-4 text-[30px] font-semibold tracking-[-0.04em] text-foreground', valueClassName)}>{value}</p>
      {hint ? <p className="mt-2 text-[12px] font-medium text-muted-foreground">{hint}</p> : null}
    </SurfaceCard>
  );
}

export function StatBadge({ tone = 'slate', children, dot = false }: { tone?: 'slate' | 'blue' | 'emerald' | 'amber' | 'red' | 'indigo'; children: ReactNode; dot?: boolean }) {
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

  return <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium', tones[tone])}>{dot ? <span className={cn('h-1.5 w-1.5 rounded-full', dots[tone])} /> : null}{children}</span>;
}

export function StatusBadge({ label, tone, dot }: { label: string; tone: 'blue' | 'emerald' | 'amber' | 'red' | 'slate' | 'indigo'; dot?: boolean }) {
  return <StatBadge tone={tone} dot={dot}>{label}</StatBadge>;
}

export function TableShell({ children }: { children: ReactNode }) {
  return <div className="mt-6 overflow-x-auto rounded-3xl border border-border/70 bg-card shadow-sm">{children}</div>;
}

export function TableHead({ children }: { children: ReactNode }) {
  return <thead className="bg-muted/55">{children}</thead>;
}

export function Th({ children, className }: { children: ReactNode; className?: string }) {
  return <th className={cn('px-4 py-3.5 text-left text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground', className)}>{children}</th>;
}

export function Tr({ children, className }: { children: ReactNode; className?: string }) {
  return <tr className={cn('border-b border-border/60 transition-colors hover:bg-muted/40', className)}>{children}</tr>;
}

export function Td({ children, className, title }: { children: ReactNode; className?: string; title?: string }) {
  return <td className={cn('px-4 py-4.5 text-[14px] text-foreground', className)} title={title}>{children}</td>;
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <div className="rounded-2xl border border-border/70 bg-muted/55 px-5 py-11 text-center text-sm leading-6 text-muted-foreground">{children}</div>;
}

export function PrimaryButton({ className, children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button {...props} className={cn('inline-flex items-center justify-center gap-2 rounded-full bg-foreground px-4 py-2.5 text-[13px] font-medium text-background shadow-sm transition-all duration-200 hover:scale-[0.98] hover:bg-foreground/80 hover:shadow-md disabled:opacity-50', className)}>{children}</button>;
}

export function SecondaryButton({ className, children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button {...props} className={cn('inline-flex items-center justify-center gap-2 rounded-full border border-border/80 bg-card px-4 py-2.5 text-[13px] font-medium text-foreground shadow-sm transition-all duration-200 hover:scale-[0.98] hover:bg-muted/55 hover:shadow-md disabled:opacity-50', className)}>{children}</button>;
}

export function DangerButton({ className, children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button {...props} className={cn('inline-flex items-center justify-center gap-2 rounded-full bg-muted border border-border/80 px-4 py-2.5 text-[13px] font-medium text-foreground transition-all duration-200 hover:scale-[0.98] hover:bg-muted/80 hover:shadow-sm disabled:opacity-50', className)}>{children}</button>;
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const { className, ...rest } = props;
  return <input {...rest} className={cn('w-full rounded-2xl border border-input bg-background px-4 py-3 text-[14px] text-foreground shadow-sm transition-all outline-none placeholder:text-muted-foreground focus:border-foreground/30 focus:ring-2 focus:ring-foreground/10', className)} />;
}

export function SelectInput(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  const { className, children, ...rest } = props;
  return <select {...rest} className={cn('w-full rounded-2xl border border-input bg-background px-4 py-3 text-[14px] text-foreground shadow-sm transition-all outline-none focus:border-foreground/30 focus:ring-2 focus:ring-foreground/10', className)}>{children}</select>;
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/18 px-3 py-4 backdrop-blur-md sm:px-4 sm:py-8">
      <div className={cn('max-h-[calc(100vh-2rem)] w-full overflow-hidden rounded-[32px] border border-border/70 bg-card shadow-sm sm:max-h-[calc(100vh-4rem)]', maxWidthClassName)}>
        <div className="flex items-start justify-between gap-4 border-b border-border/70 px-4 py-4 sm:px-6 sm:py-5">
          <div className="min-w-0 flex-1">
            {eyebrow ? (
              <div className="inline-flex items-center gap-2 rounded-full bg-muted px-2.5 py-1">
                {Icon ? <Icon className="h-3.5 w-3.5 text-foreground" /> : null}
                <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-foreground">{eyebrow}</p>
              </div>
            ) : null}
            <h3 className="mt-2 text-[24px] font-semibold tracking-[-0.03em] text-foreground sm:text-[28px]">{title}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-border/70 bg-muted/55 p-2 text-muted-foreground shadow-sm transition-all duration-200 hover:scale-95 hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[calc(100vh-9rem)] overflow-y-auto px-4 py-5 sm:max-h-[calc(100vh-11rem)] sm:px-6 sm:py-6">{children}</div>
        {footer ? <div className="border-t border-border/70 px-4 py-4 sm:px-6 sm:py-5">{footer}</div> : null}
      </div>
    </div>
  );
}

export function Drawer({
  open,
  onClose,
  title,
  eyebrow,
  icon: Icon,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  eyebrow?: string;
  icon?: IconType;
  children: ReactNode;
  footer?: ReactNode;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/18 backdrop-blur-sm">
      <button type="button" aria-label="关闭抽屉遮罩" className="flex-1" onClick={onClose} />
      <div className="relative flex h-screen w-full max-w-3xl flex-col overflow-hidden border-l border-border/70 bg-card shadow-2xl">
        <div className="shrink-0 border-b border-border/70 bg-card/96 px-4 py-4 backdrop-blur-sm sm:px-6 sm:py-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              {eyebrow ? (
                <div className="inline-flex items-center gap-2 rounded-full bg-muted px-2.5 py-1">
                  {Icon ? <Icon className="h-3.5 w-3.5 text-foreground" /> : null}
                  <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-foreground">{eyebrow}</p>
                </div>
              ) : null}
              <h3 className="mt-2 text-[22px] font-semibold tracking-[-0.03em] text-foreground sm:text-[26px]">{title}</h3>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-border/70 bg-muted/55 p-2 text-muted-foreground shadow-sm transition-all duration-200 hover:scale-95 hover:text-foreground"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto bg-muted/25 px-4 py-5 sm:px-6 sm:py-6">{children}</div>
        {footer ? (
          <div className="sticky bottom-0 shrink-0 border-t border-border/70 bg-card/96 px-4 py-4 backdrop-blur-sm sm:px-6 sm:py-5">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}
