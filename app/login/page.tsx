'use client';

import Link from 'next/link';
import { useEffect, useState, useTransition, useRef } from 'react';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CardContent, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { AuthPageShell } from '@/components/auth/AuthPageShell';
import { signInWithPassword, signUp, type AuthResult } from './actions';

const REMEMBERED_EMAIL_KEY = 'rememberedEmail';

function InputField({
  id,
  label,
  type = 'text',
  placeholder,
  autoComplete,
  value,
  onChange,
  onKeyDown,
}: {
  id: string;
  label: string;
  type?: string;
  placeholder?: string;
  autoComplete?: string;
  value?: string;
  onChange?: (value: string) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}) {
  const isPassword = type === 'password';
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-sm font-medium text-foreground/80">
        {label}
      </Label>
      <div className="relative">
        <input
          id={id}
          name={id}
          type={isPassword && showPassword ? 'text' : type}
          autoComplete={autoComplete}
          placeholder={placeholder}
          value={value}
          onChange={(event) => onChange?.(event.target.value)}
          onKeyDown={onKeyDown}
          required
          className={`h-11 w-full rounded-xl border border-input bg-background px-4 py-3 text-[15px] text-foreground shadow-sm transition-all outline-none placeholder:text-muted-foreground focus:border-foreground/30 focus:ring-2 focus:ring-foreground/10 disabled:cursor-not-allowed disabled:opacity-50 ${isPassword ? 'pr-12' : ''}`}
        />
        {isPassword ? (
          <button
            type="button"
            onClick={() => setShowPassword((current) => !current)}
            aria-label={showPassword ? '隐藏密码' : '显示密码'}
            aria-pressed={showPassword}
            className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-xl text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-foreground/20"
          >
            {showPassword ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function AuthForm({
  mode,
  onSuccess,
}: {
  mode: 'login' | 'register';
  onSuccess?: () => void;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const authNotice = window.sessionStorage.getItem('authNotice');
    const remembered = window.localStorage.getItem(REMEMBERED_EMAIL_KEY);

    if (authNotice || remembered) {
      startTransition(() => {
        if (authNotice) setSuccess(authNotice);
        if (remembered) {
          setEmail(remembered);
          setRememberMe(true);
        }
      });
    }

    if (authNotice) window.sessionStorage.removeItem('authNotice');
  }, []);

  function handleSubmit(formData: FormData) {
    setError(null);
    setSuccess(null);

    const action = mode === 'login' ? signInWithPassword(formData) : signUp(formData);

    startTransition(async () => {
      const result: AuthResult = await action;
      if (result.success) {
        if (mode === 'register') {
          setSuccess('申请已提交，请等待管理员审核通过后登录');
        } else {
          if (rememberMe) {
            window.localStorage.setItem(REMEMBERED_EMAIL_KEY, email);
          } else {
            window.localStorage.removeItem(REMEMBERED_EMAIL_KEY);
          }
          onSuccess?.();
        }
      } else {
        setError(result.error);
      }
    });
  }

  const resolvedConfirmPassword = mode === 'register' ? confirmPassword : undefined;

  function handleSubmitInternal(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    handleSubmit(formData);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      formRef.current?.requestSubmit();
    }
  }

  return (
    <form ref={formRef} onSubmit={handleSubmitInternal} className="space-y-4">
      <InputField id="email" label="邮箱" type="email" placeholder="your@email.com" autoComplete="email" value={email} onChange={setEmail} />
      <InputField id="password" label="密码" type="password" placeholder="••••••••" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={password} onChange={setPassword} onKeyDown={handleKeyDown} />
      {mode === 'register' && (
        <>
          <InputField id="confirmPassword" label="确认密码" type="password" placeholder="••••••••" autoComplete="new-password" value={resolvedConfirmPassword} onChange={setConfirmPassword} onKeyDown={handleKeyDown} />
          <p className="-mt-2 text-xs leading-5 text-muted-foreground">密码至少 8 位，审批通过后即可登录。</p>
        </>
      )}

      {error && (
        <p role="alert" aria-live="assertive" className="rounded-xl border border-rose-200/60 bg-rose-50/60 px-4 py-3 text-[13px] leading-snug text-rose-700">
          {error}
        </p>
      )}

      {success && (
        <p role="status" aria-live="polite" className="rounded-xl border border-emerald-200/60 bg-emerald-50/60 px-4 py-3 text-[13px] leading-snug text-emerald-700">
          {success}
        </p>
      )}

      {mode === 'login' && (
        <div className="flex items-center justify-between">
          <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(event) => setRememberMe(event.target.checked)}
              className="h-4 w-4 rounded border-border accent-foreground focus:ring-foreground/20"
            />
            <span>记住账号</span>
          </label>
          <Link
            href="/forgot-password"
            className="inline-flex min-h-11 items-center text-sm font-medium text-foreground/70 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/20"
          >
            忘记密码？
          </Link>
        </div>
      )}

      <button
        type="submit"
        disabled={isPending}
        aria-busy={isPending}
        className="relative h-11 w-full rounded-xl bg-foreground text-background text-[15px] font-medium shadow-sm transition-all hover:bg-foreground/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/30 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span className={`flex items-center justify-center gap-2 transition-opacity ${isPending ? 'opacity-0' : 'opacity-100'}`}>
          {mode === 'login' ? '登录' : '注册账号'}
        </span>
        {isPending && (
          <span className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            <span className="sr-only">处理中</span>
          </span>
        )}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <AuthPageShell>
      <Tabs defaultValue="login" className="w-full">
        <TabsList aria-label="账号操作" className="mb-6 w-full">
          <TabsTrigger value="login" className="flex-1">登录</TabsTrigger>
          <TabsTrigger value="register" className="flex-1">注册</TabsTrigger>
        </TabsList>

        <TabsContent value="login">
          <CardDescription className="mb-5 text-center text-sm">
            欢迎回来，请登录您的账号
          </CardDescription>
          <CardContent className="p-0">
            <AuthForm mode="login" />
          </CardContent>
        </TabsContent>

        <TabsContent value="register">
          <CardDescription className="mb-5 text-center text-sm">
            创建新账号，开始管理您的设备
          </CardDescription>
          <CardContent className="p-0">
            <AuthForm mode="register" />
          </CardContent>
        </TabsContent>
      </Tabs>
    </AuthPageShell>
  );
}
