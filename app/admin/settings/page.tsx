import { createClient as createSupabaseAdmin } from '@supabase/supabase-js';
import { PageHeader } from '../components/ui';
import SettingsForm from './components/SettingsForm';

export const dynamic = 'force-dynamic';

// TODO (dev only): Replace with real auth userId before deploying to production
const DEV_USER_ID = '00000000-0000-0000-0000-000000000000';

const supabaseAdmin = createSupabaseAdmin(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function getUserSettings(userId: string) {
  const { data } = await supabaseAdmin
    .from('user_settings')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  return data;
}

export default async function SettingsPage() {
  // DEV: hardcoded test userId — bypass auth during local development
  const userId = DEV_USER_ID;
  const settings = await getUserSettings(userId);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Settings"
        title="系统设置"
        description="配置闲鱼/闲管家 API 与顺丰速运电子面单的第三方凭证，所有信息仅您本人可见。"
        meta={
          <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
            DEV · hardcoded userId
          </span>
        }
      />

      <SettingsForm
        initialData={
          settings
            ? {
                goofish_app_key: settings.goofish_app_key ?? '',
                goofish_app_secret: settings.goofish_app_secret ?? '',
                sf_partner_id: settings.sf_partner_id ?? '',
                sf_check_word: settings.sf_check_word ?? '',
                sf_sender_name: settings.sf_sender_name ?? '',
                sf_sender_phone: settings.sf_sender_phone ?? '',
                sf_sender_address: settings.sf_sender_address ?? '',
              }
            : null
        }
        userId={userId}
      />
    </div>
  );
}
