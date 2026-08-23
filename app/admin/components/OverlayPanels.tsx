'use client';

import type { ComponentType, ReactNode } from 'react';
import type { LucideProps } from 'lucide-react';
import { X } from 'lucide-react';
import { Dialog as DialogPrimitive } from 'radix-ui';
import { cn } from '@/lib/utils';

type IconType = ComponentType<LucideProps>;

type OverlayPanelProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  eyebrow?: string;
  icon?: IconType;
  children: ReactNode;
  footer?: ReactNode;
};

function PanelHeading({ title, eyebrow, icon: Icon }: Pick<OverlayPanelProps, 'title' | 'eyebrow' | 'icon'>) {
  return (
    <div className="min-w-0 flex-1">
      {eyebrow ? (
        <div className="inline-flex items-center gap-2 rounded-full bg-muted px-2.5 py-1">
          {Icon ? <Icon className="h-3.5 w-3.5 text-foreground" aria-hidden /> : null}
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-foreground">{eyebrow}</p>
        </div>
      ) : null}
      <DialogPrimitive.Title className="mt-1.5 text-lg font-semibold tracking-[-0.02em] text-foreground sm:text-xl">
        {title}
      </DialogPrimitive.Title>
    </div>
  );
}

function CloseButton({ label }: { label: string }) {
  return (
    <DialogPrimitive.Close asChild>
      <button
        type="button"
        aria-label={label}
        className="flex size-11 shrink-0 items-center justify-center rounded-full border border-border/70 bg-muted/55 text-muted-foreground shadow-sm transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/25 sm:size-10"
      >
        <X className="h-5 w-5" aria-hidden />
      </button>
    </DialogPrimitive.Close>
  );
}

export function Modal({
  open,
  onClose,
  title,
  eyebrow,
  icon,
  maxWidthClassName = 'max-w-2xl',
  children,
  footer,
}: OverlayPanelProps & { maxWidthClassName?: string }) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/25 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className={cn(
            'fixed inset-0 z-50 flex h-dvh w-full flex-col overflow-hidden border border-border/70 bg-card shadow-2xl outline-none',
            'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0',
            'sm:inset-auto sm:left-1/2 sm:top-1/2 sm:h-auto sm:max-h-[85dvh] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-3xl sm:data-[state=open]:zoom-in-95 sm:data-[state=closed]:zoom-out-95',
            maxWidthClassName,
          )}
        >
          <div className="flex shrink-0 items-start justify-between gap-4 border-b border-border/70 px-4 py-3 sm:px-6 sm:py-4">
            <PanelHeading title={title} eyebrow={eyebrow} icon={icon} />
            <CloseButton label="关闭弹窗" />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">{children}</div>
          {footer ? <div className="shrink-0 border-t border-border/70 bg-card px-4 py-3 sm:px-6 sm:py-4">{footer}</div> : null}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

export function Drawer({ open, onClose, title, eyebrow, icon, children, footer }: OverlayPanelProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/25 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className="fixed inset-y-0 right-0 z-50 flex h-dvh w-full max-w-3xl flex-col overflow-hidden border-l border-border/70 bg-card shadow-2xl outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:slide-in-from-right data-[state=closed]:slide-out-to-right"
        >
          <div className="flex shrink-0 items-start justify-between gap-4 border-b border-border/70 bg-card/96 px-4 py-4 backdrop-blur-sm sm:px-6 sm:py-5">
            <PanelHeading title={title} eyebrow={eyebrow} icon={icon} />
            <CloseButton label="关闭抽屉" />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto bg-muted/25 px-4 py-5 sm:px-6 sm:py-6">{children}</div>
          {footer ? <div className="shrink-0 border-t border-border/70 bg-card/96 px-4 py-4 backdrop-blur-sm sm:px-6 sm:py-5">{footer}</div> : null}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
