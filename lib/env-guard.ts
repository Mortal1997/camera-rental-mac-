const EXPECTED_PROJECT_REF = 'qqsxnlnqncfirufejylv';

function extractRef(url: string | undefined): string | null {
  if (!url) return null;
  const match = url.match(/^https?:\/\/([^.]+)\.supabase\.co/);
  return match?.[1] ?? null;
}

export function assertSupabaseEnv(env: NodeJS.ProcessEnv = process.env): void {
  const checks: Array<[string, string | undefined]> = [
    ['NEXT_PUBLIC_SUPABASE_URL', env.NEXT_PUBLIC_SUPABASE_URL],
    ['SUPABASE_URL', env.SUPABASE_URL],
  ];

  for (const [name, value] of checks) {
    const ref = extractRef(value);
    if (ref !== EXPECTED_PROJECT_REF) {
      throw new Error(
        `[env-guard] ${name} 的 Supabase project ref 错误：` +
          `期望 "${EXPECTED_PROJECT_REF}"，实际 "${value}"（解析出 ref="${ref ?? '<无法解析>'}"）。` +
          `请检查 .env / .env.local 是否正确。`,
      );
    }
  }
}

assertSupabaseEnv();
