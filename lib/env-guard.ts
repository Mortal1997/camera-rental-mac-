const EXPECTED_PROJECT_REF = 'qqsxnlnqncfirufejylv';

function extractRef(url: string | undefined): string | null {
  if (!url) return null;
  const match = url.match(/^https?:\/\/([^.]+)\.supabase\.co/);
  return match?.[1] ?? null;
}

export function assertSupabaseEnv(env: NodeJS.ProcessEnv = process.env) {
  const checks: Array<[string, string | undefined]> = [
    ['NEXT_PUBLIC_SUPABASE_URL', env.NEXT_PUBLIC_SUPABASE_URL],
    ['SUPABASE_URL', env.SUPABASE_URL],
  ];

  for (const [name, value] of checks) {
    // 1. 先确保环境变量不能为空
    if (!value) {
      throw new Error(`[env-guard] 缺少必须的环境变量: ${name}`);
    }

    const ref = extractRef(value);
    
    // 2. 如果是本地服务器局域网地址 (http:// 开头)，直接放行
    // 否则，继续严格校验云端的 EXPECTED_PROJECT_REF
    if (!value.startsWith('http://') && ref !== EXPECTED_PROJECT_REF) {
      throw new Error(
        `[env-guard] ${name} 的 Supabase project ref 错误：\n` +
        `期望 "${EXPECTED_PROJECT_REF}", 实际 "${value}" (解析出 ref="${ref}")。\n` +
        `请检查 .env / .env.local 是否正确。`
      );
    }
  }
}

assertSupabaseEnv();