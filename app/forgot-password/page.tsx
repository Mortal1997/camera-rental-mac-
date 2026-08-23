'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { ArrowLeft, Loader2, Mail } from 'lucide-react';
import { AuthPageShell } from '@/components/auth/AuthPageShell';
import { Label } from '@/components/ui/label';
import { requestPasswordReset, type PasswordResetRequestResult } from './actions';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      const result: PasswordResetRequestResult = await requestPasswordReset(formData);
      if (result.success) {
        setSuccess(result.message);
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <AuthPageShell>
      <div className="mb-6 text-center">
        <div className="mx-auto mb-4 flex size-11 items-center justify-center rounded-2xl bg-muted text-foreground">
          <Mail className="size-5" aria-hidden />
        </div>
        <h2 className="text-lg font-semibold text-foreground">找回密码</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          输入注册邮箱，我们会发送一封安全的密码重置邮件。
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email" className="text-sm font-medium text-foreground/80">邮箱</Label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="your@email.com"
            required
            className="h-11 w-full rounded-xl border border-input bg-background px-4 py-3 text-[15px] text-foreground shadow-sm outline-none transition-all placeholder:text-muted-foreground focus:border-foreground/30 focus:ring-2 focus:ring-foreground/10"
          />
        </div>

        {error && (
          <p role="alert" aria-live="assertive" className="rounded-xl border border-rose-200/60 bg-rose-50/60 px-4 py-3 text-[13px] leading-5 text-rose-700">
            {error}
          </p>
        )}

        {success && (
          <p role="status" aria-live="polite" className="rounded-xl border border-emerald-200/60 bg-emerald-50/60 px-4 py-3 text-[13px] leading-5 text-emerald-700">
            {success}
          </p>
        )}

        <button
          type="submit"
          disabled={isPending}
          aria-busy={isPending}
          className="relative h-11 w-full rounded-xl bg-foreground text-[15px] font-medium text-background shadow-sm transition-all hover:bg-foreground/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/30 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <span className={isPending ? 'opacity-0' : 'opacity-100'}>发送重置邮件</span>
          {isPending && (
            <span className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="size-4 animate-spin" aria-hidden />
              <span className="sr-only">正在发送</span>
            </span>
          )}
        </button>
      </form>

      <Link
        href="/login"
        className="mt-4 flex min-h-11 items-center justify-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/20"
      >
        <ArrowLeft className="size-4" aria-hidden />
        返回登录
      </Link>
    </AuthPageShell>
  );
}
