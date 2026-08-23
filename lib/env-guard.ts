const EXPECTED_PROJECT_REF = 'qqsxnlnqncfirufejylv';

function parseSupabaseUrl(name: string, value: string) {
  let parsed: URL;

  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`[env-guard] ${name} 不是有效的 URL: "${value}"`);
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`[env-guard] ${name} 只支持 http 或 https 地址`);
  }

  const managedHost = parsed.hostname.match(/^([a-z0-9]+)\.supabase\.co$/i);
  return { managedProjectRef: managedHost?.[1] ?? null };
}

export function assertSupabaseEnv(env: NodeJS.ProcessEnv = process.env) {
  const checks: Array<[string, string | undefined]> = [
    ['NEXT_PUBLIC_SUPABASE_URL', env.NEXT_PUBLIC_SUPABASE_URL],
    ['SUPABASE_URL', env.SUPABASE_URL],
  ];

  for (const [name, value] of checks) {
    if (!value) {
      throw new Error(`[env-guard] 缺少必须的环境变量: ${name}`);
    }

    const { managedProjectRef } = parseSupabaseUrl(name, value);

    // Managed Supabase URLs keep the project-ref guard. Custom domains,
    // private IPs and Docker service names are valid self-hosted endpoints.
    if (managedProjectRef && managedProjectRef !== EXPECTED_PROJECT_REF) {
      throw new Error(
        `[env-guard] ${name} 的 Supabase project ref 错误：\n` +
        `期望 "${EXPECTED_PROJECT_REF}", 实际 "${value}" (解析出 ref="${managedProjectRef}")。\n` +
        `请检查 .env / .env.local 是否正确。`
      );
    }
  }
}

assertSupabaseEnv();
