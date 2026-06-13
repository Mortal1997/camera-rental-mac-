'use client';

import { useState } from 'react';
import { CheckCircle2, Loader2, Lock, Package, Save, Shield, Truck, Eye, EyeOff } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface UserSettings {
  goofish_app_key: string;
  goofish_app_secret: string;
  sf_partner_id: string;
  sf_check_word: string;
  sf_sender_name: string;
  sf_sender_phone: string;
  sf_sender_address: string;
}

interface SettingsFormProps {
  initialData: UserSettings | null;
}

const EMPTY: UserSettings = {
  goofish_app_key: '',
  goofish_app_secret: '',
  sf_partner_id: '',
  sf_check_word: '',
  sf_sender_name: '',
  sf_sender_phone: '',
  sf_sender_address: '',
};

type Toast = { type: 'success' | 'error'; message: string } | null;

export default function SettingsForm({ initialData }: SettingsFormProps) {
  const [form, setForm] = useState<UserSettings>(initialData ?? EMPTY);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<Toast>(null);

  const set = (key: keyof UserSettings) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const isDirty = JSON.stringify(form) !== JSON.stringify(initialData ?? EMPTY);

  const save = async () => {
    setSaving(true);
    setToast(null);
    try {
      const res = await fetch('/admin/settings/api/user-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setToast({ type: 'error', message: data.error ?? '保存失败，请重试。' });
      } else {
        setToast({ type: 'success', message: '配置已安全保存' });
        setTimeout(() => setToast(null), 3500);
      }
    } catch {
      setToast({ type: 'error', message: '网络异常，请检查网络后重试。' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 max-w-3xl">

      {/* ── Toast ── */}
      {toast && (
        <div
          className={`fixed bottom-8 right-8 z-50 flex items-center gap-3 rounded-2xl px-5 py-3.5 shadow-2xl backdrop-blur transition-all duration-300 ${
            toast.type === 'success'
              ? 'bg-emerald-50/90 border border-emerald-200 text-emerald-700'
              : 'bg-rose-50/90 border border-rose-200 text-rose-700'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 className="h-4.5 w-4.5 shrink-0" />
          ) : (
            <span className="flex h-4.5 w-4.5 shrink-0 items-center justify-center text-xs font-bold">!</span>
          )}
          <span className="text-sm font-medium">{toast.message}</span>
        </div>
      )}

      {/* ── Section A: 闲鱼 / 闲管家 API ── */}
      <div className="group relative overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-sm transition-shadow hover:shadow-md">
        {/* subtle gradient accent */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-300 to-transparent opacity-60" />

        <div className="p-7">
          {/* Section header */}
          <div className="flex items-start justify-between gap-4 mb-6">
            <div className="flex items-center gap-3.5">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50 ring-1 ring-amber-100">
                <Package className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <h2 className="text-[15px] font-semibold text-slate-900 tracking-tight">闲鱼 / 闲管家 API</h2>
                <p className="mt-0.5 text-sm text-slate-500">用于自动同步闲鱼平台订单凭证</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 rounded-full bg-slate-50 px-3 py-1.5 text-xs text-slate-400 ring-1 ring-slate-200">
              <Shield className="h-3 w-3" />
              加密存储
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <FormField label="AppKey" htmlFor="goofish_app_key" hint="闲管家开放平台申请的 AppKey" className="sm:col-span-2">
              <Input
                id="goofish_app_key"
                placeholder="在开放平台 → 应用信息 中获取"
                value={form.goofish_app_key}
                onChange={set('goofish_app_key')}
                autoComplete="off"
                className="h-11 rounded-xl border-slate-200 bg-slate-50/50 text-[14px] transition-colors placeholder:text-slate-400 focus:border-amber-300 focus:bg-white focus:ring-2 focus:ring-amber-50"
              />
            </FormField>

            <FormField label="AppSecret" htmlFor="goofish_app_secret" hint="对应 AppKey 的 AppSecret，请勿泄露" className="sm:col-span-2">
              <PasswordInput
                id="goofish_app_secret"
                placeholder="请输入 AppSecret"
                value={form.goofish_app_secret}
                onChange={set('goofish_app_secret')}
              />
            </FormField>
          </div>
        </div>
      </div>

      {/* ── Section B: 顺丰速运 ── */}
      <div className="group relative overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-sm transition-shadow hover:shadow-md">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-sky-300 to-transparent opacity-60" />

        <div className="p-7">
          <div className="flex items-start justify-between gap-4 mb-6">
            <div className="flex items-center gap-3.5">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-50 to-blue-50 ring-1 ring-sky-100">
                <Truck className="h-5 w-5 text-sky-500" />
              </div>
              <div>
                <h2 className="text-[15px] font-semibold text-slate-900 tracking-tight">顺丰速运配置</h2>
                <p className="mt-0.5 text-sm text-slate-500">用于电子面单打印和寄件人信息自动填充</p>
              </div>
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <FormField label="顾客编码" htmlFor="sf_partner_id" hint="顺丰开放平台账号的商家编码">
              <Input
                id="sf_partner_id"
                placeholder="例如：021XXX"
                value={form.sf_partner_id}
                onChange={set('sf_partner_id')}
                autoComplete="off"
                className="h-11 rounded-xl border-slate-200 bg-slate-50/50 text-[14px] transition-colors placeholder:text-slate-400 focus:border-sky-300 focus:bg-white focus:ring-2 focus:ring-sky-50"
              />
            </FormField>

            <FormField label="校验码" htmlFor="sf_check_word" hint="商家编码对应的校验码">
              <PasswordInput
                id="sf_check_word"
                placeholder="请输入校验码"
                value={form.sf_check_word}
                onChange={set('sf_check_word')}
              />
            </FormField>

            <FormField label="默认寄件人姓名" htmlFor="sf_sender_name">
              <Input
                id="sf_sender_name"
                placeholder="例如：张三"
                value={form.sf_sender_name}
                onChange={set('sf_sender_name')}
                className="h-11 rounded-xl border-slate-200 bg-slate-50/50 text-[14px] transition-colors placeholder:text-slate-400 focus:border-sky-300 focus:bg-white focus:ring-2 focus:ring-sky-50"
              />
            </FormField>

            <FormField label="寄件人电话" htmlFor="sf_sender_phone">
              <Input
                id="sf_sender_phone"
                placeholder="例如：13800138000"
                type="tel"
                value={form.sf_sender_phone}
                onChange={set('sf_sender_phone')}
                className="h-11 rounded-xl border-slate-200 bg-slate-50/50 text-[14px] transition-colors placeholder:text-slate-400 focus:border-sky-300 focus:bg-white focus:ring-2 focus:ring-sky-50"
              />
            </FormField>

            <FormField label="寄件人详细地址" htmlFor="sf_sender_address" className="sm:col-span-2">
              <Input
                id="sf_sender_address"
                placeholder="例如：广东省深圳市福田区深业上城A栋XX号"
                value={form.sf_sender_address}
                onChange={set('sf_sender_address')}
                className="h-11 rounded-xl border-slate-200 bg-slate-50/50 text-[14px] transition-colors placeholder:text-slate-400 focus:border-sky-300 focus:bg-white focus:ring-2 focus:ring-sky-50"
              />
            </FormField>
          </div>
        </div>
      </div>

      {/* ── Footer actions ── */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Lock className="h-3.5 w-3.5" />
          <span>所有配置数据均经过加密存储，仅您本人可访问</span>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setForm(initialData ?? EMPTY)}
            disabled={saving || !isDirty}
            className="h-9 rounded-xl border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40"
          >
            放弃更改
          </Button>
          <Button
            size="sm"
            onClick={save}
            disabled={saving || !isDirty}
            className="h-9 gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 px-5 text-sm font-medium text-white shadow-sm hover:from-indigo-500 hover:to-indigo-600 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saving ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                保存中…
              </>
            ) : (
              <>
                <Save className="h-3.5 w-3.5" />
                保存配置
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

function FormField({
  label,
  htmlFor,
  hint,
  className,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-slate-700">
        {label}
        {hint && <span className="font-normal text-slate-400">({hint})</span>}
      </label>
      {children}
    </div>
  );
}

function PasswordInput({
  id,
  placeholder,
  value,
  onChange,
}: {
  id: string;
  placeholder: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input
        id={id}
        type={show ? 'text' : 'password'}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        autoComplete="new-password"
        className="h-11 rounded-xl border-slate-200 bg-slate-50/50 pr-10 text-[14px] transition-colors placeholder:text-slate-400 focus:border-amber-300 focus:bg-white focus:ring-2 focus:ring-amber-50"
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
        tabIndex={-1}
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}
