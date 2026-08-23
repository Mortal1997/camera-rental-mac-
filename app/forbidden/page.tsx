import Link from 'next/link';
import { ShieldX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export default function ForbiddenPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <Card className="w-full max-w-md">
        <CardContent className="flex flex-col items-center px-6 py-10 text-center">
          <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
            <ShieldX className="h-7 w-7" />
          </div>
          <h1 className="text-xl font-semibold text-slate-900">没有访问权限</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            当前账号不能访问此页面。如需使用该功能，请联系超级管理员。
          </p>
          <Button asChild className="mt-6">
            <Link href="/admin">返回管理后台</Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
