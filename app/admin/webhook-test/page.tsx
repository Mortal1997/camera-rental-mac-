'use client';

import { useState, useTransition } from 'react';
import { CheckCircle2, Copy, RefreshCw, Rocket, ShieldAlert, XCircle } from 'lucide-react';
import { PrimaryButton, SecondaryButton, SelectInput, SurfaceCard, TextInput, FormField, PageHeader, StatBadge } from '../components/ui';

type WebhookPreset = 'minimal' | 'full' | 'duplicate';

const platformOptions = ['京东', '淘宝租赁', '支付宝租机', '微信小程序', '抖音租赁', '自营'];

const shippingMethodOptions = ['邮寄', '自提', '闪送'];

const depositExemptionOptions = ['芝麻信用', '押金双免', '支付押金', '熟人免押'];

function today(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

function randomPhone() {
  return `1${3 + Math.floor(Math.random() * 6)}${String(Math.floor(Math.random() * 1e8)).padStart(8, '0')}`;
}

const PRESET_PAYLOADS: Record<WebhookPreset, Record<string, string>> = {
  minimal: {
    platform_source: '京东',
    customer_name: '测试用户',
    customer_phone: randomPhone(),
  },
  full: {
    platform_source: '京东',
    customer_name: '李明',
    customer_phone: randomPhone(),
    shipping_address: '北京市朝阳区建国路88号SOHO现代城A座1201',
    expected_equipment_model: 'Sony A7M4',
    start_date: today(2),
    end_date: today(5),
    total_price: '599',
    deposit_paid: '0',
    shipping_method: '邮寄',
    deposit_exemption: '芝麻信用',
    external_order_id: `TEST-${Date.now()}`,
    metadata: '{"shop_name":"京东旗舰店","remark":"客户加急发货"}',
  },
  duplicate: {
    platform_source: '京东',
    customer_name: '李明',
    customer_phone: randomPhone(),
    shipping_address: '北京市朝阳区建国路88号SOHO现代城A座1201',
    expected_equipment_model: 'Sony A7M4',
    start_date: today(2),
    end_date: today(5),
    total_price: '599',
    deposit_paid: '0',
    shipping_method: '邮寄',
    deposit_exemption: '芝麻信用',
    external_order_id: 'TEST-DUPLICATE-001',
    metadata: '{"shop_name":"京东旗舰店","remark":"重复推送测试"}',
  },
};

const FIELD_GROUPS: { label: string; fields: FieldDef[] }[] = [
  {
    label: '必填字段',
    fields: [
      { key: 'platform_source', label: '平台来源', type: 'select', options: platformOptions, required: true },
      { key: 'customer_name', label: '客户姓名', type: 'text', required: true },
      { key: 'customer_phone', label: '联系电话', type: 'tel', required: true },
    ],
  },
  {
    label: '订单信息',
    fields: [
      { key: 'external_order_id', label: '外部平台订单号', type: 'text' },
      { key: 'start_date', label: '租用开始日期', type: 'date' },
      { key: 'end_date', label: '租用结束日期', type: 'date' },
      { key: 'total_price', label: '总租金', type: 'number' },
      { key: 'deposit_paid', label: '已收押金', type: 'number' },
    ],
  },
  {
    label: '设备与发货',
    fields: [
      { key: 'expected_equipment_model', label: '期望设备型号', type: 'text' },
      { key: 'shipping_address', label: '收货地址', type: 'text' },
      { key: 'shipping_method', label: '发货方式', type: 'select', options: shippingMethodOptions },
      { key: 'deposit_exemption', label: '免押方式', type: 'select', options: depositExemptionOptions },
    ],
  },
  {
    label: '扩展数据',
    fields: [
      { key: 'metadata', label: '元数据 (JSON)', type: 'textarea' },
    ],
  },
];

type FieldDef = { key: string; label: string; type: string; required?: boolean; options?: string[] };

function FieldInput({ field, value, onChange }: { field: FieldDef; value: string; onChange: (v: string) => void }) {
  if (field.type === 'select') {
    return (
      <SelectInput value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">— 不填 —</option>
        {field.options?.map((opt) => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </SelectInput>
    );
  }
  if (field.type === 'textarea') {
    return (
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm transition-all outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-900/10 font-mono"
        placeholder='{"key": "value"}'
      />
    );
  }
  return (
    <TextInput type={field.type} value={value} onChange={(e) => onChange(e.target.value)} />
  );
}

type ResponseState = {
  status: number | null;
  statusText: string;
  body: string;
  duration: number | null;
  duplicated: boolean | null;
};

export default function WebhookTestPage() {
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [authToken, setAuthToken] = useState('');
  const [preset, setPreset] = useState<WebhookPreset>('full');
  const [response, setResponse] = useState<ResponseState>({ status: null, statusText: '', body: '', duration: null, duplicated: null });
  const [isPending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);

  const applyPreset = (p: WebhookPreset) => {
    setPreset(p);
    const payload = PRESET_PAYLOADS[p];
    setFormValues({ ...payload });
  };

  const updateField = (key: string, value: string) => {
    setFormValues((prev) => ({ ...prev, [key]: value }));
  };

  const buildPayload = () => {
    const payload: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(formValues)) {
      if (value === '') continue;
      if (key === 'total_price' || key === 'deposit_paid') {
        const n = Number(value);
        if (!isNaN(n)) payload[key] = n;
      } else if (key === 'metadata') {
        try {
          payload[key] = JSON.parse(value);
        } catch {
          // skip invalid JSON
        }
      } else {
        payload[key] = value;
      }
    }
    return payload;
  };

  const handleSubmit = () => {
    setResponse({ status: null, statusText: '', body: '', duration: null, duplicated: null });
    startTransition(async () => {
      const payload = buildPayload();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (authToken.trim()) {
        headers['Authorization'] = `Bearer ${authToken.trim()}`;
      }

      const start = Date.now();
      try {
        const res = await fetch('/api/webhooks/orders', {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
        });
        const elapsed = Date.now() - start;
        const text = await res.text();
        let json: Record<string, unknown> = {};
        try { json = JSON.parse(text); } catch { /* use raw */ }

        setResponse({
          status: res.status,
          statusText: res.statusText,
          body: JSON.stringify(json, null, 2),
          duration: elapsed,
          duplicated: Boolean(json.duplicated),
        });
      } catch (err) {
        const elapsed = Date.now() - start;
        setResponse({
          status: 0,
          statusText: 'Network Error',
          body: String(err instanceof Error ? err.message : 'Request failed'),
          duration: elapsed,
          duplicated: null,
        });
      }
    });
  };

  const handleCopyEndpoint = () => {
    navigator.clipboard.writeText(`${window.location.origin}/api/webhooks/orders`).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const statusBadge = response.status
    ? response.status >= 200 && response.status < 300
      ? { tone: 'emerald' as const, label: `${response.status} ${response.statusText}`, icon: CheckCircle2, iconClass: 'text-emerald-500' }
      : response.status === 0
      ? { tone: 'red' as const, label: 'Network Error', icon: XCircle, iconClass: 'text-red-500' }
      : { tone: 'red' as const, label: `${response.status} ${response.statusText}`, icon: XCircle, iconClass: 'text-red-500' }
    : null;

  const isValid = Boolean(formValues.platform_source && formValues.customer_name && formValues.customer_phone);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Webhook Debug"
        title="Webhook 联调测试"
        description="模拟外部平台推送订单，验证接单入口、去重逻辑和数据写入是否正常。"
      />

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Left: Form */}
        <div className="lg:col-span-3 space-y-5">
          <SurfaceCard>
            {/* Endpoint */}
            <div className="mb-5">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">接收地址</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 truncate rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-mono text-slate-700">
                  {typeof window !== 'undefined' ? `${window.location.origin}/api/webhooks/orders` : '/api/webhooks/orders'}
                </code>
                <SecondaryButton onClick={handleCopyEndpoint}>
                  {copied ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                  {copied ? '已复制' : '复制'}
                </SecondaryButton>
              </div>
            </div>

            {/* Auth */}
            <div className="mb-5 rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                <ShieldAlert className="h-3.5 w-3.5" />认证密钥（可选）
              </p>
              <TextInput
                value={authToken}
                onChange={(e) => setAuthToken(e.target.value)}
                placeholder="ORDER_WEBHOOK_SECRET 对应的值，留空则跳过鉴权"
              />
              <p className="mt-1.5 text-xs text-slate-400">支持 Bearer Token 或 x-webhook-secret Header</p>
            </div>

            {/* Presets */}
            <div className="mb-5">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">预设 Payload</p>
              <div className="flex flex-wrap gap-2">
                {([
                  ['minimal', '最小集（仅必填）'],
                  ['full', '完整数据'],
                  ['duplicate', '重复推送'],
                ] as [WebhookPreset, string][]).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => applyPreset(key)}
                    className={`rounded-xl px-4 py-2 text-sm font-medium transition-all ${
                      preset === key
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'border border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs text-slate-400">
                {preset === 'duplicate'
                  ? '将推送与"完整数据"相同 external_order_id，验证去重逻辑'
                  : preset === 'full'
                  ? '填充所有字段，可直接提交测试'
                  : '只填必填字段，快速验证基础接单'}
              </p>
            </div>

            {/* Field groups */}
            {FIELD_GROUPS.map((group) => (
              <div key={group.label} className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4">
                <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{group.label}</p>
                <div className="grid gap-4 md:grid-cols-2">
                  {group.fields.map((field) => (
                    <FormField
                      key={field.key}
                      label={field.label + (field.required ? ' *' : '')}
                      className={field.type === 'textarea' ? 'md:col-span-2' : undefined}
                    >
                      <FieldInput
                        field={field}
                        value={formValues[field.key] ?? ''}
                        onChange={(v) => updateField(field.key, v)}
                      />
                    </FormField>
                  ))}
                </div>
              </div>
            ))}

            <div className="mt-5 flex items-center justify-between">
              <p className="text-xs text-slate-400">* 为必填字段，至少填写平台来源、客户姓名、联系电话</p>
              <PrimaryButton onClick={handleSubmit} disabled={isPending || !isValid}>
                {isPending ? (
                  <><RefreshCw className="h-4 w-4 animate-spin" />发送中...</>
                ) : (
                  <><Rocket className="h-4 w-4" />发送 Webhook</>
                )}
              </PrimaryButton>
            </div>
          </SurfaceCard>
        </div>

        {/* Right: Response */}
        <div className="lg:col-span-2 space-y-4">
          <SurfaceCard>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">响应结果</p>

            {!response.status && !isPending && (
              <div className="mt-6 rounded-xl border border-dashed border-slate-200 bg-slate-50 py-10 text-center text-sm text-slate-400">
                点击「发送 Webhook」后，响应将显示在这里
              </div>
            )}

            {isPending && (
              <div className="mt-6 flex items-center justify-center gap-3 py-10 text-sm text-slate-400">
                <RefreshCw className="h-5 w-5 animate-spin" />
                等待响应...
              </div>
            )}

            {response.status !== null && !isPending && (
              <div className="mt-4 space-y-4">
                {/* Status line */}
                <div className="flex flex-wrap items-center gap-3">
                  {statusBadge && (
                    <StatBadge tone={statusBadge.tone}>
                      <statusBadge.icon className={statusBadge.iconClass + ' h-3.5 w-3.5'} />
                      {statusBadge.label}
                    </StatBadge>
                  )}
                  {response.duration !== null && (
                    <span className="text-xs text-slate-400">{response.duration}ms</span>
                  )}
                  {response.duplicated !== null && (
                    <StatBadge tone={response.duplicated ? 'amber' : 'emerald'}>
                      {response.duplicated ? '命中重复单' : '新建订单'}
                    </StatBadge>
                  )}
                </div>

                {/* Duplicated warning */}
                {response.duplicated && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                    <p className="font-semibold">重复订单已拦截</p>
                    <p className="mt-1 text-xs text-amber-600">该 external_order_id 在同一平台已存在，订单未被重复写入。</p>
                  </div>
                )}

                {/* Response body */}
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">响应体</p>
                  <pre className="max-h-80 overflow-auto rounded-xl border border-slate-200 bg-slate-950 px-4 py-3 text-xs text-emerald-400 font-mono whitespace-pre-wrap break-all">
                    {response.body || '(empty)'}
                  </pre>
                </div>
              </div>
            )}
          </SurfaceCard>

          {/* Quick reference */}
          <SurfaceCard>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">字段参考</p>
            <div className="mt-3 space-y-1.5 text-xs text-slate-500 font-mono">
              <p><span className="text-slate-700">platform_source</span> <span className="text-slate-400">string *</span></p>
              <p><span className="text-slate-700">customer_name</span> <span className="text-slate-400">string *</span></p>
              <p><span className="text-slate-700">customer_phone</span> <span className="text-slate-400">string *</span></p>
              <p><span className="text-slate-700">external_order_id</span> <span className="text-slate-400">string</span></p>
              <p><span className="text-slate-700">expected_equipment_model</span> <span className="text-slate-400">string</span></p>
              <p><span className="text-slate-700">shipping_address</span> <span className="text-slate-400">string</span></p>
              <p><span className="text-slate-700">start_date</span> <span className="text-slate-400">string</span></p>
              <p><span className="text-slate-700">end_date</span> <span className="text-slate-400">string</span></p>
              <p><span className="text-slate-700">total_price</span> <span className="text-slate-400">number</span></p>
              <p><span className="text-slate-700">deposit_paid</span> <span className="text-slate-400">number</span></p>
              <p><span className="text-slate-700">shipping_method</span> <span className="text-slate-400">string</span></p>
              <p><span className="text-slate-700">deposit_exemption</span> <span className="text-slate-400">string</span></p>
              <p><span className="text-slate-700">metadata</span> <span className="text-slate-400">object</span></p>
            </div>
          </SurfaceCard>
        </div>
      </div>
    </div>
  );
}
