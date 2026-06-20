'use client';

import Image from 'next/image';
import { useEffect, useState, useTransition, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
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
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-[13px] text-foreground/80">
        {label}
      </Label>
      <input
        id={id}
        name={id}
        type={type}
        autoComplete={autoComplete}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange?.(event.target.value)}
        onKeyDown={onKeyDown}
        required
        className="h-10 w-full rounded-xl border border-input bg-background px-4 py-3 text-[14px] text-foreground shadow-sm transition-all outline-none placeholder:text-muted-foreground focus:border-foreground/30 focus:ring-2 focus:ring-foreground/10 disabled:cursor-not-allowed disabled:opacity-50"
      />
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
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const remembered = window.localStorage.getItem(REMEMBERED_EMAIL_KEY);
    if (remembered) {
      startTransition(() => {
        setEmail(remembered);
        setRememberMe(true);
      });
    }
  }, []);

  function handleSubmit(formData: FormData) {
    setError(null);
    setSuccess(null);

    const action = mode === 'login' ? signInWithPassword(formData) : signUp(formData);

    startTransition(async () => {
      const result: AuthResult = await action;
      if (result.success) {
        if (mode === 'register') {
          setSuccess('注册成功');
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
        <InputField id="confirmPassword" label="确认密码" type="password" placeholder="••••••••" autoComplete="new-password" value={resolvedConfirmPassword} onChange={setConfirmPassword} onKeyDown={handleKeyDown} />
      )}

      {error && (
        <p className="rounded-xl border border-rose-200/60 bg-rose-50/60 px-4 py-3 text-[13px] leading-snug text-rose-600">
          {error}
        </p>
      )}

      {success && (
        <p className="rounded-xl border border-emerald-200/60 bg-emerald-50/60 px-4 py-3 text-[13px] leading-snug text-emerald-700">
          {success}
        </p>
      )}

      {mode === 'login' && (
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(event) => setRememberMe(event.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            <span>记住账号</span>
          </label>
        </div>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="relative h-10 w-full rounded-xl bg-foreground text-background text-[14px] font-medium shadow-sm transition-all hover:bg-foreground/80 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span className={`flex items-center justify-center gap-2 transition-opacity ${isPending ? 'opacity-0' : 'opacity-100'}`}>
          {mode === 'login' ? '登录' : '注册账号'}
        </span>
        {isPending && (
          <span className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="h-4 w-4 animate-spin" />
          </span>
        )}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-[420px]">
        {/* Logo */}
        <div className="mb-8 flex flex-col items-center gap-3">
          <Image
            src="/logo-login.png"
            alt="BANG BANG"
            width={56}
            height={56}
            style={{ width: 'auto', height: 'auto' }}
            className="object-contain"
          />
          <div className="text-center">
            <h1 className="text-xl font-bold tracking-widest uppercase text-foreground">BANG BANG</h1>
            <p className="mt-1 text-sm text-muted-foreground tracking-widest uppercase">Rental</p>
          </div>
        </div>

        <Card>
          <CardHeader className="pb-0">
            <Tabs defaultValue="login" className="w-full">
              <TabsList className="mb-5 w-full">
                <TabsTrigger value="login" className="flex-1">登录</TabsTrigger>
                <TabsTrigger value="register" className="flex-1">注册</TabsTrigger>
              </TabsList>

              <TabsContent value="login">
                <CardDescription className="mb-5 text-center text-[13px]">
                  欢迎回来，请登录您的账号
                </CardDescription>
                <CardContent className="p-0">
                  <AuthForm mode="login" />
                </CardContent>
              </TabsContent>

              <TabsContent value="register">
                <CardDescription className="mb-5 text-center text-[13px]">
                  创建新账号，开始管理您的设备
                </CardDescription>
                <CardContent className="p-0">
                  <AuthForm mode="register" />
                </CardContent>
              </TabsContent>
            </Tabs>
          </CardHeader>
        </Card>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          受保护系统 · 请勿向未经授权人员透露账号信息
        </p>
      </div>
    </div>
  );
}
