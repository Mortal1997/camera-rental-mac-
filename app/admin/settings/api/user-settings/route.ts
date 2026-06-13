import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

type UserSettingsInput = {
  goofish_app_key?: string | null;
  goofish_app_secret?: string | null;
  sf_partner_id?: string | null;
  sf_check_word?: string | null;
  sf_sender_name?: string | null;
  sf_sender_phone?: string | null;
  sf_sender_address?: string | null;
};

export async function GET() {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: '未登录或会话已过期，请重新登录' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('user_settings')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) {
    console.error('[user-settings GET] select error:', error);
    return NextResponse.json({ error: '读取配置失败，请刷新页面重试' }, { status: 500 });
  }

  return NextResponse.json({ data });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: '未登录或会话已过期，请重新登录' }, { status: 401 });
  }

  let body: UserSettingsInput;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '请求格式无效' }, { status: 400 });
  }

  const clean = Object.fromEntries(
    Object.entries({
      goofish_app_key: body.goofish_app_key?.trim() || null,
      goofish_app_secret: body.goofish_app_secret?.trim() || null,
      sf_partner_id: body.sf_partner_id?.trim() || null,
      sf_check_word: body.sf_check_word?.trim() || null,
      sf_sender_name: body.sf_sender_name?.trim() || null,
      sf_sender_phone: body.sf_sender_phone?.trim() || null,
      sf_sender_address: body.sf_sender_address?.trim() || null,
    }).map(([k, v]) => [k, v === '' ? null : v])
  );

  const { error } = await supabase
    .from('user_settings')
    .upsert(
      { user_id: user.id, ...clean },
      { onConflict: 'user_id' }
    );

  if (error) {
    console.error('[user-settings POST] upsert error:', error);
    return NextResponse.json({ error: '保存失败，请稍后重试' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
