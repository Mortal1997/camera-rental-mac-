import { type EmailOtpType } from '@supabase/supabase-js';
import { type NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const ALLOWED_NEXT_PATHS = new Set(['/reset-password']);

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const next = searchParams.get('next') ?? '/reset-password';
  const safeNext = ALLOWED_NEXT_PATHS.has(next) ? next : '/reset-password';
  const code = searchParams.get('code');
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;
  const supabase = await createClient();

  let error: { code?: string; status?: number; name?: string } | null = null;

  if (code) {
    const result = await supabase.auth.exchangeCodeForSession(code);
    error = result.error;
  } else if (tokenHash && type === 'recovery') {
    const result = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    error = result.error;
  } else {
    return NextResponse.redirect(new URL('/reset-password?error=invalid-link', request.url));
  }

  if (error) {
    console.warn('[auth] password recovery callback failed', {
      code: error.code ?? 'unknown',
      status: error.status ?? null,
      name: error.name ?? 'unknown',
    });
    return NextResponse.redirect(new URL('/reset-password?error=expired-link', request.url));
  }

  return NextResponse.redirect(new URL(safeNext, request.url));
}
