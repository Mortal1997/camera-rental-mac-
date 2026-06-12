'use client';

import { useMemo, useState, useTransition } from 'react';
import {
  CheckCircle2,
  Copy,
  RefreshCw,
  Rocket,
  ShieldAlert,
  XCircle,
} from 'lucide-react';
import { FilterPanel, FormField, PageHeader, PrimaryButton, SecondaryButton, SelectInput, StatBadge, SurfaceCard, TextInput } from '../components/ui';

type WebhookPreset = 'minimal' | 'full' | 'duplicate';

type FieldDef = {
  key: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'textarea' | 'select';
  required?: boolean;
  options?: string[];
};

const FIELD_GROUPS: Array<{ label: string; fields: FieldDef[] }> = [
  {
    label: '基础信息',
    fields: [
      { key: 'platform_source', label: '平台来源', type: 'text', required: true },
      { key: 'customer_name', label: '客户姓名', type: 'text', required: true },
      { key: 'customer_phone', label: '联系电话', type: 'text', required: true },
      { key: 'external_order_id', label: '外部订单号', type: 'text' },
    ],
  },
  {
    label: '租赁信息',
    fields: [
      { key: 'expected_equipment_model', label: '设备型号', type: 'text' },
      { key: 'shipping_address', label: '收货地址', type: 'text' },
      { key: 'start_date', label: '开始日期', type: 'date' },
      { key: 'end_date', label: '结束日期', type: 'date' },
      { key: 'shipping_method', label: '配送方式', type: 'select', options: ['self_pickup', 'sf_express', 'same_city'] },
      { key: 'deposit_exemption', label: '免押方式', type: 'select', options: ['芝麻信用', '小白信用', '企业担保'] },
    ],
  },
  {
    label: '金额与扩展',
    fields: [
      { key: 'total_price', label: '订单金额', type: 'number' },
      { key: 'deposit_paid', label: '已付押金', type: 'number' },
      { key: 'metadata', label: 'metadata(JSON)', type: 'textarea' },
    ],
  },
];

const PRESET_PAYLOADS: Record<WebhookPreset, Record<string, string>> = {
  minimal: {
    platform_source: 'xiaohongshu',
    customer_name: '张三',
    customer_phone: '13800138000',
  },
  full: {
    platform_source: 'xiaohongshu',
    customer_name: '张三',
    customer_phone: '13800138000',
    external_order_id: 'xh-test-order-001',
    expected_equipment_model: 'Canon EOS R5',
    shipping_address: '上海市静安区南京西路 100 号',
    start_date: '2026-06-10',
    end_date: '2026-06-13',
    total_price: '1299',
    deposit_paid: '500',
    shipping_method: 'sf_express',
    deposit_exemption: '芝麻信用',
    metadata: JSON.stringify({ note: '测试订单', source: 'webhook-debug' }, null, 2),
  },
  duplicate: {
    platform_source: 'xiaohongshu',
    customer_name: '张三',
    customer_phone: '13800138000',
    external_order_id: 'xh-test-order-001',
    expected_equipment_model: 'Canon EOS R5',
    shipping_address: '上海市静安区南京西路 100 号',
    start_date: '2026-06-10',
    end_date: '2026-06-13',
    total_price: '1299',
    deposit_paid: '500',
    shipping_method: 'sf_express',
    deposit_exemption: '芝麻信用',
    metadata: JSON.stringify({ note: '重复推送测试', source: 'webhook-debug' }, null, 2),
  },
};

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
        className="w-full rounded-2xl border border-black/[0.05] bg-[var(--bg-card)] px-4 py-3 text-sm font-mono text-[var(--text-main)] shadow-[inset_2px_2px_8px_rgba(220,220,228,0.38),inset_-2px_-2px_8px_rgba(255,255,255,0.92)] transition-all outline-none placeholder:text-[var(--text-muted)] focus:border-[rgba(255,107,74,0.18)] focus:ring-2 focus:ring-[rgba(255,107,74,0.12)]"
        placeholder='{"key": "value"}'
      />
    );
  }
  return <TextInput type={field.type} value={value} onChange={(e) => onChange(e.target.value)} />;
}

type ResponseState = {
  status: number | null;
  statusText: string;
  body: string;
  duration: number | null;
  duplicated: boolean | null;
};

export default function WebhookTestPage() {
  const [formValues, setFormValues] = useState<Record<string, string>>(() => ({ ...PRESET_PAYLOADS.full }));
  const [authToken, setAuthToken] = useState('');
  const [preset, setPreset] = useState<WebhookPreset>('full');
  const [response, setResponse] = useState<ResponseState>({ status: null, statusText: '', body: '', duration: null, duplicated: null });
  const [isPending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);

  const endpoint = useMemo(() => {
    if (typeof window === 'undefined') return '/api/webhooks/orders';
    return `${window.location.origin}/api/webhooks/orders`;
  }, []);

  const applyPreset = (p: WebhookPreset) => {
    setPreset(p);
    setFormValues({ ...PRESET_PAYLOADS[p] });
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
          // ignore invalid json
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
        headers.Authorization = `Bearer ${authToken.trim()}`;
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
        try {
          json = JSON.parse(text);
        } catch {
          json = { raw: text };
        }

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
    navigator.clipboard.writeText(endpoint).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const statusBadge = response.status
    ? response.status >= 200 && response.status < 300
      ? { tone: 'emerald' as const, label: `${response.status} ${response.statusText}`, icon: CheckCircle2, iconClass: 'text-[var(--accent-primary)]' }
      : response.status === 0
        ? { tone: 'red' as const, label: 'Network Error', icon: XCircle, iconClass: 'text-[var(--accent-primary)]' }
        : { tone: 'red' as const, label: `${response.status} ${response.statusText}`, icon: XCircle, iconClass: 'text-[var(--accent-primary)]' }
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
        <div className="space-y-5 lg:col-span-3">
          <SurfaceCard>
            <div className="mb-5">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">接收地址</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 truncate rounded-xl border border-black/[0.05] bg-[rgba(245,245,248,0.92)] px-4 py-2.5 text-sm font-mono text-[var(--text-main)]">
                  {endpoint}
                </code>
                <SecondaryButton onClick={handleCopyEndpoint}>
                  {copied ? <CheckCircle2 className="h-4 w-4 text-[var(--accent-primary)]" /> : <Copy className="h-4 w-4" />}
                  {copied ? '已复制' : '复制'}
                </SecondaryButton>
              </div>
            </div>

            <FilterPanel className="mb-5">
              <div>
                <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
                  <ShieldAlert className="h-3.5 w-3.5" />认证密钥（可选）
                </p>
                <TextInput
                  value={authToken}
                  onChange={(e) => setAuthToken(e.target.value)}
                  placeholder="ORDER_WEBHOOK_SECRET 对应的值，留空则跳过鉴权"
                />
                <p className="mt-1.5 text-xs text-[var(--text-muted)]">支持 Bearer Token 或 x-webhook-secret Header</p>
              </div>
            </FilterPanel>

            <div className="mb-5">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">预设 Payload</p>
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
                        ? 'bg-[var(--accent-primary)] text-white shadow-[0_10px_20px_rgba(255,107,74,0.22)]'
                        : 'border border-black/[0.05] bg-[var(--bg-card)] text-[var(--text-muted)] shadow-[4px_4px_14px_rgba(208,208,216,0.18),-4px_-4px_14px_rgba(255,255,255,0.9)] hover:text-[var(--accent-primary)]'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs text-[var(--text-muted)]">
                {preset === 'duplicate'
                  ? '将推送与“完整数据”相同的 external_order_id，用于验证去重逻辑'
                  : preset === 'full'
                    ? '填充所有字段，可直接提交测试'
                    : '只填必填字段，快速验证基础接单'}
              </p>
            </div>

            {FIELD_GROUPS.map((group) => (
              <div key={group.label} className="mb-5 rounded-[22px] border border-black/[0.04] bg-white/72 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] last:mb-0">
                <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">{group.label}</p>
                <div className="grid gap-4 md:grid-cols-2">
                  {group.fields.map((field) => (
                    <FormField
                      key={field.key}
                      label={field.label + (field.required ? ' *' : '')}
                      className={field.type === 'textarea' ? 'md:col-span-2' : undefined}
                    >
                      <FieldInput field={field} value={formValues[field.key] ?? ''} onChange={(v) => updateField(field.key, v)} />
                    </FormField>
                  ))}
                </div>
              </div>
            ))}

            <div className="mt-5 flex items-center justify-between gap-4">
              <p className="text-xs text-[var(--text-muted)]">* 为必填字段，至少填写平台来源、客户姓名、联系电话</p>
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

        <div className="space-y-4 lg:col-span-2">
          <SurfaceCard>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">响应结果</p>

            {!response.status && !isPending && (
              <div className="mt-6 rounded-xl border border-dashed border-black/[0.06] bg-[rgba(245,245,248,0.92)] py-10 text-center text-sm text-[var(--text-muted)]">
                点击「发送 Webhook」后，响应将显示在这里
              </div>
            )}

            {isPending && (
              <div className="mt-6 flex items-center justify-center gap-3 py-10 text-sm text-[var(--text-muted)]">
                <RefreshCw className="h-5 w-5 animate-spin" />
                等待响应...
              </div>
            )}

            {response.status !== null && !isPending && (
              <div className="mt-4 space-y-4">
                <div className="flex flex-wrap items-center gap-3">
                  {statusBadge ? (
                    <StatBadge tone={statusBadge.tone}>
                      <statusBadge.icon className={statusBadge.iconClass + ' h-3.5 w-3.5'} />
                      {statusBadge.label}
                    </StatBadge>
                  ) : null}
                  {response.duration !== null ? <span className="text-xs text-[var(--text-muted)]">{response.duration}ms</span> : null}
                  {response.duplicated !== null ? (
                    <StatBadge tone={response.duplicated ? 'amber' : 'emerald'}>
                      {response.duplicated ? '命中重复单' : '新建订单'}
                    </StatBadge>
                  ) : null}
                </div>

                {response.duplicated ? (
                  <div className="rounded-xl border border-transparent bg-[rgba(255,107,74,0.1)] px-4 py-3 text-sm text-[var(--accent-primary)]">
                    <p className="font-semibold">重复订单已拦截</p>
                    <p className="mt-1 text-xs">该 external_order_id 在同一平台已存在，订单未被重复写入。</p>
                  </div>
                ) : null}

                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">响应体</p>
                  <pre className="max-h-80 overflow-auto rounded-xl border border-black/[0.05] bg-[#1f2026] px-4 py-3 text-xs font-mono text-[#ff9a82] whitespace-pre-wrap break-all">
                    {response.body || '(empty)'}
                  </pre>
                </div>
              </div>
            )}
          </SurfaceCard>

          <SurfaceCard>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">字段参考</p>
            <div className="mt-3 space-y-1.5 font-mono text-xs text-[var(--text-muted)]">
              <p><span className="text-[var(--text-main)]">platform_source</span> <span>string *</span></p>
              <p><span className="text-[var(--text-main)]">customer_name</span> <span>string *</span></p>
              <p><span className="text-[var(--text-main)]">customer_phone</span> <span>string *</span></p>
              <p><span className="text-[var(--text-main)]">external_order_id</span> <span>string</span></p>
              <p><span className="text-[var(--text-main)]">expected_equipment_model</span> <span>string</span></p>
              <p><span className="text-[var(--text-main)]">shipping_address</span> <span>string</span></p>
              <p><span className="text-[var(--text-main)]">start_date</span> <span>string</span></p>
              <p><span className="text-[var(--text-main)]">end_date</span> <span>string</span></p>
              <p><span className="text-[var(--text-main)]">total_price</span> <span>number</span></p>
              <p><span className="text-[var(--text-main)]">deposit_paid</span> <span>number</span></p>
              <p><span className="text-[var(--text-main)]">shipping_method</span> <span>string</span></p>
              <p><span className="text-[var(--text-main)]">deposit_exemption</span> <span>string</span></p>
              <p><span className="text-[var(--text-main)]">metadata</span> <span>object</span></p>
            </div>
          </SurfaceCard>
        </div>
      </div>
    </div>
  );
}
