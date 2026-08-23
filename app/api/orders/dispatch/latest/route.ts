import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(
      { error: '未登录或会话已过期' },
      { status: 401, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const { data, error } = await supabase
    .from('orders')
    .select('id, status, created_at')
    .eq('user_id', user.id)
    .in('status', ['unprocessed', 'pending_payment'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('[dispatch/latest] 查询待调度订单失败:', error);
    return NextResponse.json(
      { error: '读取订单刷新状态失败' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const fingerprint = data
    ? `${data.id}:${data.status}:${data.created_at}`
    : null;

  return NextResponse.json(
    { fingerprint },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
