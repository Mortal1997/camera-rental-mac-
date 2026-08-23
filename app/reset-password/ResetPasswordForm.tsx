'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { Eye, EyeOff, KeyRound, Loader2 } from 'lucide-react';
import { AuthPageShell } from '@/components/auth/AuthPageShell';
import { Label } from '@/components/ui/label';
import { updatePassword, type UpdatePasswordResult } from './actions';

function PasswordField({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-sm font-medium text-foreground/80">{label}</Label>
      <div className="relative">
        <input
          id={id}
          name={id}
          type={visible ? 'text' : 'password'}
          autoComplete="new-password"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="至少 8 位"
          required
          minLength={8}
          className="h-11 w-full rounded-xl border border-input bg-background px-4 py-3 pr-12 text-[15px] text-foreground shadow-sm outline-none transition-all placeholder:text-muted-foreground focus:border-foreground/30 focus:ring-2 focus:ring-foreground/10"
        />
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          aria-label={visible ? '隐藏密码' : '显示密码'}
          aria-pressed={visible}
          className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-xl text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-foreground/20"
        >
          {visible ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
        </button>
      </div>
    </div>
  );
}

export default function ResetPasswordForm({ canReset, initialError }: { canReset: boolean; initialError?: string }) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      const result: UpdatePasswordResult = await updatePassword(formData);
      if (result.success) {
        window.sessionStorage.setItem('authNotice', '密码已更新，请使用新密码登录。');
        window.location.assign('/login');
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <AuthPageShell>
      <div className="mb-6 text-center">
        <div className="mx-auto mb-4 flex size-11 items-center justify-center rounded-2xl bg-muted text-foreground">
          <KeyRound className="size-5" aria-hidden />
        </div>
        <h2 className="text-lg font-semibold text-foreground">设置新密码</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          使用至少 8 位的新密码，并避免与其他网站重复。
        </p>
      </div>

      {error && (
        <p role="alert" aria-live="assertive" className="mb-4 rounded-xl border border-rose-200/60 bg-rose-50/60 px-4 py-3 text-[13px] leading-5 text-rose-700">
          {error}
        </p>
      )}

      {canReset ? (
        <form onSubmit={handleSubmit} className="space-y-4">
          <PasswordField id="password" label="新密码" value={password} onChange={setPassword} />
          <PasswordField id="confirmPassword" label="确认新密码" value={confirmPassword} onChange={setConfirmPassword} />
          <button
            type="submit"
            disabled={isPending}
            aria-busy={isPending}
            className="relative h-11 w-full rounded-xl bg-foreground text-[15px] font-medium text-background shadow-sm transition-all hover:bg-foreground/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/30 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span className={isPending ? 'opacity-0' : 'opacity-100'}>确认更新密码</span>
            {isPending && (
              <span className="absolute inset-0 flex items-center justify-center">
                <Loader2 className="size-4 animate-spin" aria-hidden />
                <span className="sr-only">正在更新</span>
              </span>
            )}
          </button>
        </form>
      ) : (
        <Link
          href="/forgot-password"
          className="flex h-11 w-full items-center justify-center rounded-xl bg-foreground text-[15px] font-medium text-background shadow-sm transition-all hover:bg-foreground/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/30 focus-visible:ring-offset-2"
        >
          重新申请重置邮件
        </Link>
      )}

      <Link
        href="/login"
        className="mt-4 flex min-h-11 items-center justify-center text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/20"
      >
        返回登录
      </Link>
    </AuthPageShell>
  );
}
