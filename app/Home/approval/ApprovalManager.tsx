'use client';

import { useEffect, useState, useTransition } from 'react';
import {
  getPendingUsers,
  approveUser,
  rejectUser,
  deleteUser,
  getApprovedUsers,
  getActivityLogs,
  type PendingUser,
  type ApprovedUser,
  type ActivityLog,
} from './actions';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Check,
  X,
  Clock,
  UserCheck,
  Users,
  Trash2,
  Activity,
  AlertCircle,
} from 'lucide-react';

type Tab = 'pending' | 'users' | 'logs';

const ACTION_LABELS: Record<ActivityLog['action'], string> = {
  approved: '通过审核',
  rejected: '拒绝申请',
  deleted: '删除账户',
};

const ACTION_COLORS: Record<ActivityLog['action'], string> = {
  approved: 'text-emerald-600',
  rejected: 'text-rose-500',
  deleted: 'text-orange-500',
};

function PendingSection({
  users,
  onRefresh,
}: {
  users: PendingUser[];
  onRefresh: () => void;
}) {
  const [actionEmail, setActionEmail] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleApprove(user: PendingUser) {
    setActionEmail(user.email);
    startTransition(async () => {
      await approveUser(user.id, user.email);
      setActionEmail(null);
      onRefresh();
    });
  }

  function handleReject(user: PendingUser) {
    setActionEmail(user.email);
    startTransition(async () => {
      await rejectUser(user.id, user.email);
      setActionEmail(null);
      onRefresh();
    });
  }

  if (users.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16 gap-3">
          <div className="rounded-full bg-muted p-3">
            <UserCheck className="h-6 w-6 text-muted-foreground" />
          </div>
          <div className="text-center">
            <p className="font-medium text-foreground">暂无待审核申请</p>
            <p className="text-sm text-muted-foreground mt-1">
              所有注册申请均已处理完毕
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {users.map((user) => (
        <Card key={user.id}>
          <CardContent className="flex items-center justify-between py-4 px-5">
            <div className="flex items-center gap-3 min-w-0">
              <div className="rounded-full bg-amber-50 p-2 shrink-0">
                <Clock className="h-4 w-4 text-amber-600" />
              </div>
              <div className="min-w-0">
                <p className="font-medium text-sm truncate">{user.email}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  申请时间：{new Date(user.created_at).toLocaleString('zh-CN')}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 ml-4">
              <Button
                variant="ghost"
                size="icon-sm"
                className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                onClick={() => handleApprove(user)}
                disabled={isPending && actionEmail === user.email}
                title="通过"
              >
                <Check className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                className="text-rose-500 hover:text-rose-600 hover:bg-rose-50"
                onClick={() => handleReject(user)}
                disabled={isPending && actionEmail === user.email}
                title="拒绝"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function UsersSection({
  users,
  onRefresh,
}: {
  users: ApprovedUser[];
  onRefresh: () => void;
}) {
  const [deletingEmail, setDeletingEmail] = useState<string | null>(null);
  const [confirmEmail, setConfirmEmail] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleDelete(user: ApprovedUser) {
    setDeletingEmail(user.email);
    setConfirmEmail(user.email);
  }

  function confirmDelete(user: ApprovedUser) {
    startTransition(async () => {
      await deleteUser(user.id, user.email);
      setDeletingEmail(null);
      setConfirmEmail(null);
      onRefresh();
    });
  }

  function cancelDelete() {
    setDeletingEmail(null);
    setConfirmEmail(null);
  }

  if (users.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16 gap-3">
          <div className="rounded-full bg-muted p-3">
            <Users className="h-6 w-6 text-muted-foreground" />
          </div>
          <div className="text-center">
            <p className="font-medium text-foreground">暂无已注册用户</p>
            <p className="text-sm text-muted-foreground mt-1">
              审核通过的用户将在此显示
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {users.map((user) => (
        <Card key={user.id}>
          <CardContent className="flex items-center justify-between py-4 px-5">
            <div className="flex items-center gap-3 min-w-0">
              <div className="rounded-full bg-blue-50 p-2 shrink-0">
                <UserCheck className="h-4 w-4 text-blue-600" />
              </div>
              <div className="min-w-0">
                <p className="font-medium text-sm truncate">{user.email}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  通过审核时间：{new Date(user.approved_at).toLocaleString('zh-CN')}
                  {user.approved_by && ` · 审批人：${user.approved_by}`}
                </p>
              </div>
            </div>

            <div className="shrink-0 ml-4">
              {confirmEmail === user.email ? (
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => confirmDelete(user)}
                    disabled={isPending}
                  >
                    确认删除
                  </Button>
                  <Button size="sm" variant="outline" onClick={cancelDelete}>
                    取消
                  </Button>
                </div>
              ) : (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="text-rose-500 hover:text-rose-600 hover:bg-rose-50"
                  onClick={() => handleDelete(user)}
                  disabled={isPending}
                  title="删除账户"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function LogsSection({ logs }: { logs: ActivityLog[] }) {
  if (logs.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16 gap-3">
          <div className="rounded-full bg-muted p-3">
            <Activity className="h-6 w-6 text-muted-foreground" />
          </div>
          <div className="text-center">
            <p className="font-medium text-foreground">暂无操作记录</p>
            <p className="text-sm text-muted-foreground mt-1">
              审核和删除操作将记录在此
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {logs.map((log) => (
        <Card key={log.id} className="bg-card/60">
          <CardContent className="flex items-start gap-3 py-3 px-4">
            <div
              className={`mt-0.5 shrink-0 rounded-full p-1.5 ${
                log.action === 'approved'
                  ? 'bg-emerald-50'
                  : log.action === 'rejected'
                  ? 'bg-rose-50'
                  : 'bg-orange-50'
              }`}
            >
              {log.action === 'approved' ? (
                <Check className={`h-3.5 w-3.5 ${ACTION_COLORS[log.action]}`} />
              ) : log.action === 'rejected' ? (
                <X className={`h-3.5 w-3.5 ${ACTION_COLORS[log.action]}`} />
              ) : (
                <Trash2 className={`h-3.5 w-3.5 ${ACTION_COLORS[log.action]}`} />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-sm text-foreground truncate">
                  {log.email}
                </span>
                <span
                  className={`text-xs font-medium shrink-0 ${ACTION_COLORS[log.action]}`}
                >
                  {ACTION_LABELS[log.action]}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                操作人：{log.operator_email} ·{' '}
                {new Date(log.created_at).toLocaleString('zh-CN')}
              </p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function ApprovalManager() {
  const [activeTab, setActiveTab] = useState<Tab>('pending');
  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([]);
  const [approvedUsers, setApprovedUsers] = useState<ApprovedUser[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadAll() {
    setLoading(true);
    setError(null);
    try {
      const [pending, approved, logs] = await Promise.all([
        getPendingUsers(),
        getApprovedUsers(),
        getActivityLogs(),
      ]);
      setPendingUsers(pending);
      setApprovedUsers(approved);
      setActivityLogs(logs);
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载数据失败');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  const tabs: { id: Tab; label: string; count: number; icon: React.ReactNode }[] = [
    {
      id: 'pending',
      label: '待审核',
      count: pendingUsers.length,
      icon: <Clock className="h-3.5 w-3.5" />,
    },
    {
      id: 'users',
      label: '用户管理',
      count: approvedUsers.length,
      icon: <Users className="h-3.5 w-3.5" />,
    },
    {
      id: 'logs',
      label: '操作记录',
      count: activityLogs.length,
      icon: <Activity className="h-3.5 w-3.5" />,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">注册审核</h1>
        <p className="text-sm text-muted-foreground mt-1">
          管理用户注册申请、账户及操作日志
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-200/60 bg-rose-50/60 px-4 py-3 text-sm text-rose-600">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
          <button
            onClick={loadAll}
            className="ml-auto underline underline-offset-2 hover:no-underline"
          >
            重试
          </button>
        </div>
      )}

      <div className="flex gap-1 bg-muted/60 p-1 rounded-xl w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.id
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.icon}
            {tab.label}
            {tab.count > 0 && (
              <span
                className={`ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold ${
                  activeTab === tab.id
                    ? 'bg-foreground text-background'
                    : 'bg-muted-foreground/20 text-muted-foreground'
                }`}
              >
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      <div>
        {loading ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground text-sm">
            加载中...
          </div>
        ) : activeTab === 'pending' ? (
          <PendingSection users={pendingUsers} onRefresh={loadAll} />
        ) : activeTab === 'users' ? (
          <UsersSection users={approvedUsers} onRefresh={loadAll} />
        ) : (
          <LogsSection logs={activityLogs} />
        )}
      </div>
    </div>
  );
}
