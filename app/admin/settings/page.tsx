import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '../components/ui';
import SettingsForm from './components/SettingsForm';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const supabase = await createClient();

  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    redirect('/login');
  }

  const { data: settings } = await supabase
    .from('user_settings')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Settings"
        title="系统设置"
        description="配置闲鱼/闲管家 API 与顺丰速运电子面单的第三方凭证，所有信息仅您本人可见。"
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
      />
    </div>
  );
}
