'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Boxes,
  CalendarCheck2,
  Camera,
  CheckCircle2,
  CircleAlert,
  Keyboard,
  Loader2,
  PackageCheck,
  ScanLine,
  Search,
  Sparkles,
  Truck,
  WandSparkles,
  Wrench,
} from 'lucide-react';
import { assignEquipmentToOrder } from '@/app/actions/admin-actions';
import type { Equipment, Order } from '@/app/actions/types';
import type {
  EquipmentRecommendation,
  OperationsSnapshot,
  WorkbenchTask,
  WorkbenchTaskLevel,
} from '@/lib/operations';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  EmptyState,
  MetricCard,
  PageHeader,
  PrimaryButton,
  SecondaryButton,
  SectionHeader,
  StatBadge,
  SurfaceCard,
  TextInput,
  cn,
} from './ui';

type TaskFilter = 'all' | WorkbenchTaskLevel;
type ScanMatch =
  | { type: 'equipment'; item: Equipment }
  | { type: 'order'; item: Order }
  | null;

type BarcodeDetectorInstance = {
  detect(source: CanvasImageSource): Promise<Array<{ rawValue?: string }>>;
};

type BarcodeDetectorConstructor = new (options?: { formats?: string[] }) => BarcodeDetectorInstance;

const taskLevels: Record<WorkbenchTaskLevel, {
  label: string;
  tone: 'red' | 'amber' | 'blue' | 'slate';
  icon: typeof AlertTriangle;
  iconClassName: string;
  cardClassName: string;
}> = {
  urgent: {
    label: '紧急',
    tone: 'red',
    icon: AlertTriangle,
    iconClassName: 'border-rose-200 bg-rose-50 text-rose-700',
    cardClassName: 'border-rose-200/90 bg-rose-50/35',
  },
  today: {
    label: '今天',
    tone: 'amber',
    icon: CalendarCheck2,
    iconClassName: 'border-amber-200 bg-amber-50 text-amber-700',
    cardClassName: 'border-amber-200/90 bg-amber-50/25',
  },
  upcoming: {
    label: '即将到期',
    tone: 'blue',
    icon: Truck,
    iconClassName: 'border-sky-200 bg-sky-50 text-sky-700',
    cardClassName: 'border-sky-200/80 bg-sky-50/20',
  },
  attention: {
    label: '需要关注',
    tone: 'slate',
    icon: CircleAlert,
    iconClassName: 'border-zinc-200 bg-zinc-100 text-zinc-700',
    cardClassName: 'border-border/80 bg-card',
  },
};

const statusLabels: Record<Order['status'], string> = {
  unprocessed: '待处理',
  pending_payment: '待付款',
  confirmed: '待发货',
  using: '出租中',
  returned: '已归还',
  cancelled: '已取消',
};

function normalizeScanValue(value: string) {
  return value.trim().toLocaleLowerCase('zh-CN').replace(/\s+/g, '');
}

function getOrderLink(order: Order) {
  if (!order.equipment_id || order.status === 'unprocessed') return '/admin/orders/dispatch';
  if (order.status === 'using') return '/admin/orders/active';
  if (order.status === 'returned' || order.status === 'cancelled') return '/admin/orders/completed';
  return '/admin/orders/pending';
}

function getScanMatch(value: string, equipment: Equipment[], orders: Order[]): ScanMatch {
  const normalized = normalizeScanValue(value);
  if (!normalized) return null;

  const equipmentMatch = equipment.find((item) =>
    [item.id, item.serial_number].some((candidate) => normalizeScanValue(candidate ?? '') === normalized),
  );
  if (equipmentMatch) return { type: 'equipment', item: equipmentMatch };

  const orderMatch = orders.find((item) =>
    [item.id, item.external_order_id, item.tracking_number].some(
      (candidate) => normalizeScanValue(candidate ?? '') === normalized,
    ),
  );
  if (orderMatch) return { type: 'order', item: orderMatch };

  return null;
}

function TaskCard({
  task,
  recommendations,
  onAssign,
}: {
  task: WorkbenchTask;
  recommendations: EquipmentRecommendation[];
  onAssign: (task: WorkbenchTask, recommendation: EquipmentRecommendation) => void;
}) {
  const config = taskLevels[task.level];
  const Icon = task.title.includes('维修') ? Wrench : config.icon;

  return (
    <article className={cn('rounded-2xl border p-4 shadow-sm sm:p-5', config.cardClassName)}>
      <div className="flex items-start gap-3 sm:gap-4">
        <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border', config.iconClassName)}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <StatBadge tone={config.tone} dot>{config.label}</StatBadge>
            <span className="text-xs font-medium text-muted-foreground">{task.dueLabel}</span>
          </div>
          <h3 className="mt-2.5 text-[15px] font-semibold tracking-[-0.01em] text-foreground sm:text-base">{task.title}</h3>
          <p className="mt-1 text-[13px] leading-5 text-muted-foreground sm:text-sm">{task.description}</p>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {task.customerName ? <span>客户：<strong className="font-medium text-foreground">{task.customerName}</strong></span> : null}
            {task.equipmentName ? <span>设备：<strong className="font-medium text-foreground">{task.equipmentName}</strong></span> : null}
          </div>
        </div>
        <Button asChild variant="outline" size="sm" className="hidden shrink-0 sm:inline-flex">
          <Link href={task.href}>处理<ArrowRight /></Link>
        </Button>
      </div>

      {task.id.startsWith('unassigned:') ? (
        <div className="mt-4 rounded-2xl border border-emerald-200/80 bg-emerald-50/55 p-3.5 sm:ml-14 sm:p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-emerald-900">
            <WandSparkles className="h-4 w-4 text-emerald-700" />
            智能设备推荐
          </div>
          {recommendations.length > 0 ? (
            <div className="mt-3 grid gap-2">
              {recommendations.map((recommendation, index) => (
                <div
                  key={recommendation.equipmentId}
                  className="flex flex-col gap-3 rounded-xl border border-emerald-100 bg-white/90 p-3 sm:flex-row sm:items-center"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-semibold text-foreground">{recommendation.name}</p>
                      {index === 0 ? <StatBadge tone="emerald">首选</StatBadge> : null}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {recommendation.serialNumber} · {recommendation.reasons.join(' · ')}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant={index === 0 ? 'dark' : 'outline'}
                    size="sm"
                    onClick={() => onAssign(task, recommendation)}
                  >
                    选择这台
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-xs leading-5 text-emerald-800">
              {task.dueLabel === '租期待补充'
                ? '请先补充订单开始与结束日期，系统才能安全计算可用设备。'
                : '当前没有租期可用的设备，请调整租期或先处理已有冲突。'}
            </p>
          )}
        </div>
      ) : null}

      <Button asChild variant="outline" size="sm" className="mt-4 w-full sm:hidden">
        <Link href={task.href}>进入处理<ArrowRight /></Link>
      </Button>
    </article>
  );
}

export default function OperationsWorkbench({
  snapshot,
  equipment,
  orders,
}: {
  snapshot: OperationsSnapshot;
  equipment: Equipment[];
  orders: Order[];
}) {
  const router = useRouter();
  const [filter, setFilter] = useState<TaskFilter>('all');
  const [query, setQuery] = useState('');
  const [scanOpen, setScanOpen] = useState(false);
  const [scanValue, setScanValue] = useState('');
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [assignment, setAssignment] = useState<{
    task: WorkbenchTask;
    recommendation: EquipmentRecommendation;
  } | null>(null);
  const [isPending, startTransition] = useTransition();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameRef = useRef<number | null>(null);
  const detectingRef = useRef(false);

  const stopCamera = () => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraActive(false);
    detectingRef.current = false;
  };

  useEffect(() => stopCamera, []);

  const scanMatch = useMemo(
    () => getScanMatch(scanValue, equipment, orders),
    [scanValue, equipment, orders],
  );

  const filteredTasks = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('zh-CN');
    return snapshot.tasks.filter((task) => {
      if (filter !== 'all' && task.level !== filter) return false;
      if (!normalizedQuery) return true;
      const recommendations = task.orderId ? snapshot.recommendationsByOrder[task.orderId] ?? [] : [];
      const haystack = [
        task.title,
        task.description,
        task.customerName,
        task.equipmentName,
        task.dueLabel,
        ...recommendations.flatMap((item) => [item.name, item.serialNumber]),
      ].filter(Boolean).join(' ').toLocaleLowerCase('zh-CN');
      return haystack.includes(normalizedQuery);
    });
  }, [filter, query, snapshot]);

  const filterCounts = useMemo(() => ({
    all: snapshot.tasks.length,
    urgent: snapshot.tasks.filter((task) => task.level === 'urgent').length,
    today: snapshot.tasks.filter((task) => task.level === 'today').length,
    upcoming: snapshot.tasks.filter((task) => task.level === 'upcoming').length,
    attention: snapshot.tasks.filter((task) => task.level === 'attention').length,
  }), [snapshot.tasks]);

  async function startCamera() {
    setCameraError(null);
    const BarcodeDetectorApi = (window as typeof window & { BarcodeDetector?: BarcodeDetectorConstructor }).BarcodeDetector;
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError('当前浏览器无法调用摄像头，请使用下方手动输入。');
      return;
    }
    if (!BarcodeDetectorApi) {
      setCameraError('当前浏览器不支持自动识别二维码，请使用下方手动输入编号。');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
      streamRef.current = stream;
      setCameraActive(true);
      const video = videoRef.current;
      if (!video) {
        stopCamera();
        return;
      }
      video.srcObject = stream;
      await video.play();

      const detector = new BarcodeDetectorApi({ formats: ['qr_code', 'code_128', 'ean_13'] });
      let lastDetectionAt = 0;
      const detectFrame = async (timestamp: number) => {
        if (!streamRef.current || !videoRef.current) return;
        if (timestamp - lastDetectionAt > 350 && !detectingRef.current) {
          lastDetectionAt = timestamp;
          detectingRef.current = true;
          try {
            const results = await detector.detect(videoRef.current);
            const value = results.find((result) => result.rawValue)?.rawValue;
            if (value) {
              setScanValue(value);
              stopCamera();
              return;
            }
          } catch {
            setCameraError('识别过程出现问题，请调整距离或改用手动输入。');
          } finally {
            detectingRef.current = false;
          }
        }
        frameRef.current = requestAnimationFrame(detectFrame);
      };
      frameRef.current = requestAnimationFrame(detectFrame);
    } catch {
      stopCamera();
      setCameraError('无法打开摄像头，请检查浏览器权限，或使用手动输入。');
    }
  }

  function handleAssign() {
    if (!assignment?.task.orderId) return;
    startTransition(async () => {
      const result = await assignEquipmentToOrder(
        assignment.task.orderId!,
        assignment.recommendation.equipmentId,
      );
      if (!result.success) {
        setNotice(result.error ?? '分配失败，请稍后重试');
        return;
      }
      setNotice(`已将 ${assignment.recommendation.name} 分配给该订单`);
      setAssignment(null);
      router.refresh();
    });
  }

  const filterOptions: Array<{ value: TaskFilter; label: string }> = [
    { value: 'all', label: '全部' },
    { value: 'urgent', label: '紧急' },
    { value: 'today', label: '今天' },
    { value: 'upcoming', label: '即将到期' },
    { value: 'attention', label: '需关注' },
  ];

  return (
    <section className="flex flex-col gap-4 sm:gap-6">
      {notice ? (
        <button
          type="button"
          onClick={() => setNotice(null)}
          className="fixed bottom-5 right-5 z-50 flex max-w-[calc(100vw-2.5rem)] items-center gap-2 rounded-2xl border border-border bg-card px-4 py-3 text-left text-sm font-medium text-foreground shadow-xl"
        >
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
          {notice}
        </button>
      ) : null}

      <PageHeader
        eyebrow="Daily Operations"
        title="今日运营工作台"
        description={`${snapshot.todayLabel}。系统已经把需要处理的发货、归还、逾期、排期和库存异常集中到这里。`}
        meta={
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <SecondaryButton className="w-full sm:w-auto" onClick={() => setScanOpen(true)}>
              <ScanLine className="h-4 w-4" />扫码处理
            </SecondaryButton>
            <Button asChild variant="dark" className="w-full sm:w-auto">
              <Link href="/admin/orders/dispatch"><Sparkles />新订单调度</Link>
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <MetricCard
          icon={AlertTriangle}
          iconClassName={snapshot.metrics.urgent > 0 ? 'border-rose-200 bg-rose-50 text-rose-700' : undefined}
          label="紧急异常"
          value={snapshot.metrics.urgent}
          hint={snapshot.metrics.urgent > 0 ? '建议优先处理' : '暂无紧急事项'}
          valueClassName={snapshot.metrics.urgent > 0 ? 'text-rose-700' : undefined}
        />
        <MetricCard icon={CalendarCheck2} label="今日任务" value={snapshot.metrics.today} hint="发货与归还" />
        <MetricCard icon={WandSparkles} label="待分配订单" value={snapshot.metrics.unassigned} hint="已生成设备推荐" />
        <MetricCard icon={Boxes} label="当前闲置设备" value={snapshot.metrics.available} hint="可继续排期" />
      </div>

      <SurfaceCard>
        <SectionHeader
          title="待办与异常"
          description="按紧急程度自动排序；搜索客户、设备、SN 或任务内容即可快速定位。"
          meta={<span>共 {snapshot.tasks.length} 项</span>}
        />

        <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {filterOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setFilter(option.value)}
                className={cn(
                  'inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/20',
                  filter === option.value
                    ? 'border-foreground bg-foreground text-background'
                    : 'border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                {option.label}
                <span className={cn(
                  'rounded-full px-1.5 py-0.5 text-[10px]',
                  filter === option.value ? 'bg-background/15 text-background' : 'bg-muted text-muted-foreground',
                )}>
                  {filterCounts[option.value]}
                </span>
              </button>
            ))}
          </div>
          <label className="relative block w-full lg:max-w-sm">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <TextInput
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索客户、设备或 SN"
              className="pl-11"
              aria-label="搜索待办任务"
            />
          </label>
        </div>

        <div className="mt-4 grid gap-3">
          {filteredTasks.length > 0 ? filteredTasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              recommendations={task.orderId ? snapshot.recommendationsByOrder[task.orderId] ?? [] : []}
              onAssign={(selectedTask, recommendation) => setAssignment({ task: selectedTask, recommendation })}
            />
          )) : (
            <EmptyState>
              {query ? '没有找到匹配的任务，请尝试客户姓名、设备名称或 SN。' : '这个分类暂时没有待办事项。'}
            </EmptyState>
          )}
        </div>
      </SurfaceCard>

      <div className="grid gap-4 lg:grid-cols-3">
        <SurfaceCard className="lg:col-span-2">
          <SectionHeader title="推荐工作顺序" description="系统根据业务风险给出的今日处理建议。" />
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {[
              { step: '01', title: '先处理逾期', text: '确认续租或催还，避免占用后续排期。', icon: AlertTriangle },
              { step: '02', title: '再完成今日出入库', text: '核对设备、配件、物流与客户信息。', icon: PackageCheck },
              { step: '03', title: '最后准备未来两天', text: '提前分配设备并排除周转冲突。', icon: Sparkles },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.step} className="rounded-2xl border border-border/70 bg-muted/35 p-4">
                  <div className="flex items-center justify-between">
                    <Icon className="h-4 w-4 text-emerald-700" />
                    <span className="text-[11px] font-semibold tracking-[0.16em] text-muted-foreground">{item.step}</span>
                  </div>
                  <p className="mt-4 text-sm font-semibold text-foreground">{item.title}</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">{item.text}</p>
                </div>
              );
            })}
          </div>
        </SurfaceCard>

        <SurfaceCard className="bg-zinc-950 text-white">
          <div className="flex h-full flex-col">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10">
              <ScanLine className="h-5 w-5" />
            </div>
            <h2 className="mt-5 text-lg font-semibold">手机也能快速处理</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-400">
              可将系统添加到手机主屏幕。扫码设备 SN、订单号或物流单号，直接进入对应业务页面。
            </p>
            <button
              type="button"
              onClick={() => setScanOpen(true)}
              className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-white px-4 text-sm font-medium text-zinc-950 transition-colors hover:bg-zinc-200"
            >
              开始扫码<ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </SurfaceCard>
      </div>

      <Dialog
        open={assignment !== null}
        onOpenChange={(open) => {
          if (!open && !isPending) setAssignment(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>确认分配设备</DialogTitle>
            <DialogDescription>
              系统会在提交前再次校验排期。如果其他人刚刚占用了设备，本次操作会自动停止。
            </DialogDescription>
          </DialogHeader>
          {assignment ? (
            <div className="rounded-2xl border border-border bg-muted/45 p-4">
              <p className="text-sm font-semibold text-foreground">{assignment.recommendation.name}</p>
              <p className="mt-1 text-xs text-muted-foreground">{assignment.recommendation.serialNumber}</p>
              <p className="mt-3 text-xs leading-5 text-muted-foreground">
                推荐依据：{assignment.recommendation.reasons.join('、')}
              </p>
            </div>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAssignment(null)} disabled={isPending}>取消</Button>
            <Button type="button" variant="dark" onClick={handleAssign} disabled={isPending}>
              {isPending ? <><Loader2 className="animate-spin" />分配中</> : <><CheckCircle2 />确认分配</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={scanOpen}
        onOpenChange={(open) => {
          setScanOpen(open);
          if (!open) {
            stopCamera();
            setCameraError(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>扫码查找设备或订单</DialogTitle>
            <DialogDescription>
              支持设备 SN、订单号、外部订单号和物流单号。识别后不会自动修改数据。
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="overflow-hidden rounded-2xl border border-border bg-zinc-950">
              <div className="relative aspect-[4/3]">
                <video
                  ref={videoRef}
                  muted
                  playsInline
                  className={cn('h-full w-full object-cover', cameraActive ? 'block' : 'hidden')}
                />
                {!cameraActive ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center text-white">
                    <Camera className="h-8 w-8 text-zinc-400" />
                    <p className="mt-3 text-sm font-medium">使用后置摄像头扫描二维码或条形码</p>
                    <p className="mt-1 text-xs leading-5 text-zinc-400">摄像头只在当前识别过程中开启</p>
                    <PrimaryButton className="mt-4 bg-white text-zinc-950 hover:bg-zinc-200" onClick={startCamera}>
                      <ScanLine className="h-4 w-4" />打开摄像头
                    </PrimaryButton>
                  </div>
                ) : (
                  <div className="pointer-events-none absolute inset-8 rounded-2xl border-2 border-white/75 shadow-[0_0_0_999px_rgba(0,0,0,0.3)]" />
                )}
              </div>
            </div>

            {cameraError ? (
              <div className="rounded-xl bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-800">{cameraError}</div>
            ) : null}

            <label className="grid gap-2 text-sm font-medium text-foreground">
              <span className="flex items-center gap-2"><Keyboard className="h-4 w-4" />也可以手动输入</span>
              <TextInput
                value={scanValue}
                onChange={(event) => setScanValue(event.target.value)}
                placeholder="输入设备 SN、订单号或物流单号"
                autoComplete="off"
              />
            </label>

            {scanValue ? (
              scanMatch ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                      {scanMatch.type === 'equipment' ? <Boxes className="h-4 w-4" /> : <PackageCheck className="h-4 w-4" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-emerald-950">
                        {scanMatch.type === 'equipment' ? scanMatch.item.name : scanMatch.item.customer_name || '未命名订单'}
                      </p>
                      <p className="mt-1 text-xs text-emerald-800">
                        {scanMatch.type === 'equipment'
                          ? `SN：${scanMatch.item.serial_number || '未录入'} · 状态：${scanMatch.item.status}`
                          : `订单状态：${statusLabels[scanMatch.item.status]} · ${scanMatch.item.tracking_number || scanMatch.item.external_order_id || scanMatch.item.id}`}
                      </p>
                    </div>
                  </div>
                  <Button asChild variant="dark" size="sm" className="mt-4 w-full">
                    <Link href={scanMatch.type === 'equipment' ? '/admin/inventory' : getOrderLink(scanMatch.item)}>
                      进入处理<ArrowRight />
                    </Link>
                  </Button>
                </div>
              ) : (
                <div className="rounded-xl bg-rose-50 px-4 py-3 text-xs leading-5 text-rose-700">
                  没有找到匹配记录，请检查编号是否完整，或先同步最新订单。
                </div>
              )
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
