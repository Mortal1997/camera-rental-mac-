import Image from 'next/image';
import type { ReactNode } from 'react';
import { Card, CardHeader } from '@/components/ui/card';

export function AuthPageShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-muted/30 px-4 py-6 sm:py-10">
      <div className="w-full max-w-[420px]">
        <div className="mb-6 flex flex-col items-center gap-3 sm:mb-8">
          <Image
            src="/logo-login.png"
            alt="BANG BANG"
            width={56}
            height={56}
            style={{ width: 'auto', height: 'auto' }}
            className="object-contain"
          />
          <div className="text-center">
            <h1 className="text-xl font-bold uppercase tracking-widest text-foreground">BANG BANG</h1>
            <p className="mt-1 text-sm uppercase tracking-widest text-muted-foreground">Rental</p>
          </div>
        </div>

        <Card className="shadow-[0_18px_55px_rgba(24,24,27,0.08)]">
          <CardHeader className="px-5 pb-6 pt-5 sm:px-6 sm:pt-6">
            {children}
          </CardHeader>
        </Card>

        <p className="mt-5 text-center text-[13px] leading-5 text-muted-foreground/90 sm:mt-6">
          受保护系统 · 请勿向未经授权人员透露账号信息
        </p>
      </div>
    </div>
  );
}
