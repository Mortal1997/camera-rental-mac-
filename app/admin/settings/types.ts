export interface UserSettings {
  user_id: string;
  goofish_app_key: string | null;
  goofish_app_secret: string | null;
  sf_partner_id: string | null;
  sf_check_word: string | null;
  sf_sender_name: string | null;
  sf_sender_phone: string | null;
  sf_sender_address: string | null;
  created_at: string;
  updated_at: string;
}
