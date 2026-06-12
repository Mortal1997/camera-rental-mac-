import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

type UserSettings = {
  user_id: string;
  goofish_app_key: string | null;
  goofish_app_secret: string | null;
  sf_partner_id: string | null;
  sf_check_word: string | null;
  sf_sender_name: string | null;
  sf_sender_phone: string | null;
  sf_sender_address: string | null;
  created_at?: string;
  updated_at?: string;
};

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const body: UserSettings & { user_id: string } = await req.json();
    const { user_id, ...fields } = body;

    if (!user_id) {
      return NextResponse.json({ error: 'user_id 为必填项' }, { status: 400 });
    }

    const { error } = await supabase
      .from('user_settings')
      .upsert(
        { user_id, ...fields },
        { onConflict: 'user_id' }
      );

    if (error) {
      console.error('[user-settings] upsert error:', error);
      return NextResponse.json({ error: '保存失败，请重试' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[user-settings] route error:', err);
    return NextResponse.json({ error: '服务器内部错误' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const userId = req.nextUrl.searchParams.get('user_id');
    if (!userId) {
      return NextResponse.json({ error: 'user_id 为必填项' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('user_settings')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.error('[user-settings] select error:', error);
      return NextResponse.json({ error: '读取失败' }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (err) {
    console.error('[user-settings] route error:', err);
    return NextResponse.json({ error: '服务器内部错误' }, { status: 500 });
  }
}
