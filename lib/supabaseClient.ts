import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function getMissingEnvMessage() {
  const missing: string[] = [];

  if (!supabaseUrl) missing.push('NEXT_PUBLIC_SUPABASE_URL');
  if (!supabaseAnonKey) missing.push('NEXT_PUBLIC_SUPABASE_ANON_KEY');

  return [
    `Missing Supabase environment variables: ${missing.join(', ')}`,
    'Create a `.env.local` file in the project root and provide the required values.',
    'You can copy `.env.local.example` as a starting point.',
  ].join(' ');
}

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(getMissingEnvMessage());
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
