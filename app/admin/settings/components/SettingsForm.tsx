'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Settings2, Eye, EyeOff, CheckCircle2, Loader2, Save } from 'lucide-react';
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
  userId: string;
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

type Toast = { type: 'success'; message: string } | { type: 'error'; message: string } | null;

export default function SettingsForm({ initialData, userId }: SettingsFormProps) {
  const router = useRouter();
  const [form, setForm] = useState<UserSettings>(initialData ?? EMPTY);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<Toast>(null);

  const showToast = (t: Toast) => {
    setToast(t);
    if (t?.type === 'success') {
      setTimeout(() => setToast(null), 3500);
    }
  };

  const save = async () => {
    setSaving(true);
    setToast(null);
    try {
      const res = await fetch('/api/user-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, ...form }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast({ type: 'error', message: data.error ?? '保存失败，请重试。' });
      } else {
        showToast({ type: 'success', message: '配置已保存！' });
        router.refresh();
      }
    } catch {
      showToast({ type: 'error', message: '网络错误，请检查网络后重试。' });
    } finally {
      setSaving(false);
    }
  };

  const set = (key: keyof UserSettings) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));

  return (
    <div className="space-y-8">
      {/* ── Toast 提示 ── */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-2.5 rounded-2xl px-4 py-3 shadow-xl transition-all ${
            toast.type === 'success'
              ? 'bg-emerald-600 text-white'
              : 'bg-rose-600 text-white'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 className="h-4 w-4 shrink-0" />
          ) : (
            <span className="h-4 w-4 shrink-0 text-center text-xs font-bold">!</span>
          )}
          <span className="text-sm font-medium">{toast.message}</span>
        </div>
      )}

      {/* ── 区块 A：闲鱼 / 闲管家 API ── */}
      <section className="rounded-3xl border border-border/70 bg-card p-6 shadow-sm">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
            <Settings2 className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-foreground">闲鱼 / 闲管家 API 配置</h2>
            <p className="text-sm text-muted-foreground">用于自动同步闲鱼平台订单的 AppKey 与 AppSecret。</p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Field label="AppKey" htmlFor="goofish_app_key" hint="闲管家开放平台申请的 AppKey">
            <Input
              id="goofish_app_key"
              placeholder="例如：214xxxxxx"
              value={form.goofish_app_key}
              onChange={set('goofish_app_key')}
            />
          </Field>

          <Field
            label="AppSecret"
            htmlFor="goofish_app_secret"
            hint="对应 AppKey 的 AppSecret，请妥善保管"
          >
            <PasswordInput
              id="goofish_app_secret"
              placeholder="请输入 AppSecret"
              value={form.goofish_app_secret}
              onChange={set('goofish_app_secret')}
            />
          </Field>
        </div>
      </section>

      {/* ── 区块 B：顺丰速运配置 ── */}
      <section className="rounded-3xl border border-border/70 bg-card p-6 shadow-sm">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-sky-50 text-sky-600">
            <Settings2 className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-foreground">顺丰速运配置</h2>
            <p className="text-sm text-muted-foreground">用于电子面单打印和寄件人信息自动填充。</p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Field label="顾客编码" htmlFor="sf_partner_id" hint="顺丰开放平台账号的商家编码">
            <Input
              id="sf_partner_id"
              placeholder="例如：021XXX"
              value={form.sf_partner_id}
              onChange={set('sf_partner_id')}
            />
          </Field>

          <Field label="校验码" htmlFor="sf_check_word" hint="商家编码对应的校验码">
            <PasswordInput
              id="sf_check_word"
              placeholder="请输入校验码"
              value={form.sf_check_word}
              onChange={set('sf_check_word')}
            />
          </Field>

          <Field label="默认寄件人姓名" htmlFor="sf_sender_name">
            <Input
              id="sf_sender_name"
              placeholder="例如：张三"
              value={form.sf_sender_name}
              onChange={set('sf_sender_name')}
            />
          </Field>

          <Field label="寄件人电话" htmlFor="sf_sender_phone">
            <Input
              id="sf_sender_phone"
              placeholder="例如：13800138000"
              type="tel"
              value={form.sf_sender_phone}
              onChange={set('sf_sender_phone')}
            />
          </Field>

          <Field label="寄件人详细地址" htmlFor="sf_sender_address" className="md:col-span-2">
            <Input
              id="sf_sender_address"
              placeholder="例如：广东省深圳市福田区深业上城A栋XX号"
              value={form.sf_sender_address}
              onChange={set('sf_sender_address')}
            />
          </Field>
        </div>
      </section>

      {/* ── 保存按钮 ── */}
      <div className="flex items-center justify-end gap-3">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setForm(initialData ?? EMPTY)}
          disabled={saving}
        >
          重置
        </Button>
        <Button
          size="sm"
          onClick={save}
          disabled={saving}
          className="gap-2 bg-emerald-600 hover:bg-emerald-700"
        >
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              保存中…
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              保存配置
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

function Field({
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
      <label
        htmlFor={htmlFor}
        className="mb-1.5 block text-sm font-medium text-foreground"
      >
        {label}
        {hint && <span className="ml-1.5 text-xs font-normal text-muted-foreground">({hint})</span>}
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
        className="pr-10"
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground hover:bg-muted"
        tabIndex={-1}
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}
