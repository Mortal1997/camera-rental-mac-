'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { ArrowRight, CheckCircle2, Copy, Play, ShieldCheck, Webhook } from 'lucide-react';
import { PageHeader, PrimaryButton, SecondaryButton, StatBadge, SurfaceCard, cn } from '../components/ui';

const endpointPath = '/api/webhooks/orders';

const requiredFields = [
  ['platform_source', 'string', '平台来源，如淘宝租赁 / 京东 / 自营'],
  ['customer_name', 'string', '客户姓名'],
  ['customer_phone', 'string', '客户手机号'],
] as const;

const optionalFields = [
  ['external_order_id', 'string', '外部平台订单号；配合 platform_source 用于幂等去重'],
  ['order_id', 'string', '外部平台订单号的兼容别名'],
  ['shipping_address', 'string', '收货地址'],
  ['expected_equipment_model', 'string', '期望设备型号'],
  ['start_date', 'string | null', '租用开始日期，推荐格式 YYYY-MM-DD；空字符串会被转为 null'],
  ['end_date', 'string | null', '租用结束日期，推荐格式 YYYY-MM-DD；空字符串会被转为 null'],
  ['total_price', 'number', '总租金，可传数字或数字字符串'],
  ['deposit_paid', 'number', '已收押金，可传数字或数字字符串'],
  ['shipping_method', 'string', '邮寄 / 自提 / 闪送等'],
  ['deposit_exemption', 'string', '免押方式，如芝麻信用'],
  ['metadata', 'object', '任意扩展 JSON 数据'],
] as const;

const samplePayload = `{
  "external_order_id": "tb-20260606-001",
  "platform_source": "xiaohongshu",
  "customer_name": "张三",
  "customer_phone": "13800138000",
  "shipping_address": "上海市浦东新区xx路88号",
  "expected_equipment_model": "Sony A7M4",
  "start_date": "",
  "end_date": "",
  "total_price": 1200,
  "deposit_paid": 0,
  "shipping_method": "sf_express",
  "metadata": {
    "channel": "manual-test",
    "note": "empty date test"
  }
}`;

const minimalPayload = `{
  "platform_source": "京东",
  "customer_name": "测试用户",
  "customer_phone": "13800138000"
}`;

const curlExample = `curl -X POST "https://your-domain.com${endpointPath}" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer your-secret" \\
  -d '${samplePayload}'`;

const successExample = `{
  "success": true,
  "duplicated": false,
  "orderId": 123,
  "status": "unprocessed"
}`;

const duplicateExample = `{
  "success": true,
  "duplicated": true,
  "orderId": 123,
  "status": "unprocessed"
}`;

const sqlExample = `alter table if exists public.orders
  alter column start_date drop not null,
  alter column end_date drop not null;`;

const integrationSteps = [
  '在部署环境配置 ORDER_WEBHOOK_SECRET。',
  '将正式域名下的 /api/webhooks/orders 提供给第三方平台。',
  '要求上游系统使用 POST + JSON 方式推送订单。',
  '先用联调测试页验证 200 响应，再开启真实订单推送。',
] as const;

function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto rounded-2xl border border-slate-200 bg-slate-950 px-4 py-4 text-sm leading-6 text-emerald-300">
      <code>{children}</code>
    </pre>
  );
}

function CopyButton({ value, label, className }: { value: string; label: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  return (
    <button
      type="button"
      onClick={() => void handleCopy()}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50',
        className
      )}
    >
      {copied ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
      {copied ? '已复制' : label}
    </button>
  );
}

function SectionCard({
  id,
  index,
  title,
  description,
  children,
}: {
  id: string;
  index: string;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24">
      <SurfaceCard className="space-y-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-sm font-semibold text-indigo-600">
            {index}
          </div>
          <div>
            <h2 className="text-xl font-semibold text-slate-900">{title}</h2>
            {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
          </div>
        </div>
        {children}
      </SurfaceCard>
    </section>
  );
}

function FieldTable({ rows }: { rows: readonly (readonly [string, string, string])[] }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
          <tr>
            <th className="px-4 py-3">字段</th>
            <th className="px-4 py-3">类型</th>
            <th className="px-4 py-3">说明</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white text-slate-600">
          {rows.map(([name, type, description]) => (
            <tr key={name}>
              <td className="px-4 py-3 font-mono text-slate-900">{name}</td>
              <td className="px-4 py-3 font-mono text-slate-500">{type}</td>
              <td className="px-4 py-3">{description}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FlowStep({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-sm font-semibold text-slate-900">{title}</p>
      <p className="mt-1 text-sm leading-6 text-slate-500">{description}</p>
    </div>
  );
}

export default function WebhookWikiPage() {
  const sectionLinks = useMemo(
    () => [
      ['endpoint', '接口地址'],
      ['auth', '鉴权方式'],
      ['fields', '请求字段'],
      ['examples', '示例请求'],
      ['flow', '接入流程'],
      ['responses', '返回结果'],
      ['dates', '日期字段'],
      ['faq', '常见问题'],
    ] as const,
    []
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Webhook Wiki"
        title="订单 Webhook 使用说明"
        description="给外部平台、运营同学和开发同学使用的接单文档，涵盖地址、鉴权、字段定义、示例请求和常见问题。"
        meta={
          <div className="flex flex-wrap items-center gap-2">
            <StatBadge tone="indigo">
              <Webhook className="h-3.5 w-3.5" />
              POST {endpointPath}
            </StatBadge>
            <Link href="/admin/webhook-test">
              <SecondaryButton>
                <Play className="h-4 w-4" />
                打开联调测试台
              </SecondaryButton>
            </Link>
          </div>
        }
      />

      <SurfaceCard className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-900 text-white">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-200">External Integrations</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">给第三方同学的精简接入版</h2>
            <p className="mt-2 text-sm leading-6 text-slate-200">
              使用 POST 请求发送 JSON 到 <code className="rounded bg-white/10 px-1.5 py-0.5 text-indigo-100">{endpointPath}</code>，并在 Header 中带上鉴权密钥。最小必填字段只有平台、客户姓名、客户手机号三个。
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <CopyButton value={curlExample} label="复制 curl" className="border-white/20 bg-white/10 text-white hover:bg-white/15" />
            <CopyButton value={samplePayload} label="复制示例 JSON" className="border-white/20 bg-white/10 text-white hover:bg-white/15" />
          </div>
        </div>
      </SurfaceCard>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-6">
          <SectionCard id="endpoint" index="01" title="接口地址" description="所有外部订单都通过这个 HTTP 接口推送进系统。">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Endpoint</p>
              <div className="mt-2 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <p className="font-mono text-sm text-slate-800">POST {endpointPath}</p>
                <CopyButton value={endpointPath} label="复制路径" />
              </div>
              <p className="mt-2 text-sm text-slate-500">本地开发通常是 <code>http://localhost:3000{endpointPath}</code>，生产环境替换成你的正式域名。</p>
            </div>
          </SectionCard>

          <SectionCard id="auth" index="02" title="鉴权方式" description="如果服务端配置了 ORDER_WEBHOOK_SECRET，请求必须携带正确密钥。">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-900">方式 A：Bearer Token</p>
                  <CopyButton value={'Authorization: Bearer your-secret'} label="复制" />
                </div>
                <div className="mt-3">
                  <CodeBlock>{'Authorization: Bearer your-secret'}</CodeBlock>
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-900">方式 B：自定义请求头</p>
                  <CopyButton value={'x-webhook-secret: your-secret'} label="复制" />
                </div>
                <div className="mt-3">
                  <CodeBlock>{'x-webhook-secret: your-secret'}</CodeBlock>
                </div>
              </div>
            </div>
          </SectionCard>

          <SectionCard id="fields" index="03" title="请求字段" description="必填字段缺失会返回 400；其余字段按需传递即可。">
            <div className="space-y-3">
              <p className="text-sm font-semibold text-slate-900">必填字段</p>
              <FieldTable rows={requiredFields} />
            </div>

            <div className="space-y-3">
              <p className="text-sm font-semibold text-slate-900">可选字段</p>
              <FieldTable rows={optionalFields} />
            </div>
          </SectionCard>

          <SectionCard id="examples" index="04" title="示例请求" description="下面示例演示了完整 payload，以及空日期自动转成 null 的用法。">
            <div className="grid gap-4 xl:grid-cols-2">
              <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-900">最小可用 JSON</p>
                  <CopyButton value={minimalPayload} label="复制" />
                </div>
                <CodeBlock>{minimalPayload}</CodeBlock>
              </div>

              <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-900">完整示例 JSON</p>
                  <CopyButton value={samplePayload} label="复制" />
                </div>
                <CodeBlock>{samplePayload}</CodeBlock>
              </div>
            </div>

            <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-slate-900">curl 调用</p>
                <CopyButton value={curlExample} label="复制 curl" />
              </div>
              <CodeBlock>{curlExample}</CodeBlock>
            </div>
          </SectionCard>

          <SectionCard id="flow" index="05" title="接入流程图" description="推荐先走一遍下面流程，再让第三方平台开始正式推送。">
            <div className="grid gap-3 lg:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr] lg:items-stretch">
              <FlowStep title="配置密钥" description="在部署环境中设置 ORDER_WEBHOOK_SECRET。" />
              <div className="hidden items-center justify-center lg:flex"><ArrowRight className="h-5 w-5 text-slate-300" /></div>
              <FlowStep title="提供地址" description="把正式环境接口地址给第三方平台。" />
              <div className="hidden items-center justify-center lg:flex"><ArrowRight className="h-5 w-5 text-slate-300" /></div>
              <FlowStep title="联调测试" description="先用测试页或 curl 验证 200 响应和落库情况。" />
              <div className="hidden items-center justify-center lg:flex"><ArrowRight className="h-5 w-5 text-slate-300" /></div>
              <FlowStep title="开始推送" description="确认正常后，再放开真实订单流量。" />
            </div>
          </SectionCard>

          <SectionCard id="responses" index="06" title="返回结果" description="接口带有幂等去重逻辑，使用 platform_source + external_order_id 识别重复订单。">
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-900">新建成功</p>
                  <CopyButton value={successExample} label="复制" />
                </div>
                <CodeBlock>{successExample}</CodeBlock>
              </div>
              <div className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-900">命中重复单</p>
                  <CopyButton value={duplicateExample} label="复制" />
                </div>
                <CodeBlock>{duplicateExample}</CodeBlock>
              </div>
            </div>
          </SectionCard>

          <SectionCard id="dates" index="07" title="日期字段说明" description="建议使用 YYYY-MM-DD 格式。如果暂时没有租期，可以传空字符串或不传该字段。">
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
              <p className="font-semibold">当前服务端行为</p>
              <p className="mt-1">当 <code>start_date</code> / <code>end_date</code> 为 <code>&quot;&quot;</code> 或 <code>undefined</code> 时，接口会在写入 Supabase 前自动转成 <code>null</code>。</p>
            </div>

            <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-slate-900">如数据库列仍为 NOT NULL，请执行以下 SQL</p>
                <CopyButton value={sqlExample} label="复制 SQL" />
              </div>
              <CodeBlock>{sqlExample}</CodeBlock>
            </div>
          </SectionCard>

          <SectionCard id="faq" index="08" title="常见问题">
            <div className="space-y-3 text-sm text-slate-600">
              <div className="rounded-2xl border border-slate-200 p-4">
                <p className="font-semibold text-slate-900">401 Unauthorized</p>
                <p className="mt-1">说明未携带密钥，或密钥与 <code>ORDER_WEBHOOK_SECRET</code> 不一致。</p>
              </div>
              <div className="rounded-2xl border border-slate-200 p-4">
                <p className="font-semibold text-slate-900">400 Invalid JSON payload</p>
                <p className="mt-1">请求体不是合法 JSON，或上游平台以错误编码推送。</p>
              </div>
              <div className="rounded-2xl border border-slate-200 p-4">
                <p className="font-semibold text-slate-900">400 required fields missing</p>
                <p className="mt-1">至少要传 <code>platform_source</code>、<code>customer_name</code>、<code>customer_phone</code>。</p>
              </div>
              <div className="rounded-2xl border border-slate-200 p-4">
                <p className="font-semibold text-slate-900">日期格式错误</p>
                <p className="mt-1">优先使用 <code>YYYY-MM-DD</code>。空值可以传空字符串，非法日期如 <code>2026/06/10</code> 仍可能被数据库拒绝。</p>
              </div>
            </div>
          </SectionCard>
        </div>

        <div className="space-y-6">
          <SurfaceCard className="sticky top-8 space-y-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">快速导航</p>
              <h3 className="mt-2 text-lg font-semibold text-slate-900">接入清单</h3>
            </div>

            <div className="space-y-2">
              {sectionLinks.map(([id, label]) => (
                <a
                  key={id}
                  href={`#${id}`}
                  className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900"
                >
                  <span>{label}</span>
                  <ArrowRight className="h-4 w-4 text-slate-400" />
                </a>
              ))}
            </div>

            <div className="space-y-3 text-sm text-slate-600">
              {integrationSteps.map((step, index) => (
                <div key={step} className="flex gap-3 rounded-2xl border border-slate-200 p-4">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-xs font-semibold text-indigo-600">
                    {index + 1}
                  </div>
                  <p>{step}</p>
                </div>
              ))}
              <div className="flex gap-3 rounded-2xl border border-slate-200 p-4">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                <p>建议先在测试页发送一次空日期订单，确认修复后的 null 落库行为符合预期。</p>
              </div>
            </div>

            <Link href="/admin/webhook-test" className="block">
              <PrimaryButton className="w-full justify-center">
                <Play className="h-4 w-4" />
                前往联调测试页
              </PrimaryButton>
            </Link>
          </SurfaceCard>
        </div>
      </div>
    </div>
  );
}
