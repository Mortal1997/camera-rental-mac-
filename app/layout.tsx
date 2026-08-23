import './globals.css';
import type { Metadata } from 'next';
import { TooltipProvider } from "@/components/ui/tooltip";
import PwaRegistration from '@/components/PwaRegistration';

export const metadata: Metadata = {
  title: 'BANG BANG 租赁管理',
  description: '相机租赁排期、订单、库存与运营工作台',
  icons: { icon: '/icon.png' },
  applicationName: 'BANG BANG 租赁管理',
  appleWebApp: {
    capable: true,
    title: 'BANG BANG',
    statusBarStyle: 'default',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="h-full font-sans antialiased">
      <body className="min-h-full flex flex-col">
        <TooltipProvider>{children}</TooltipProvider>
        <PwaRegistration />
      </body>
    </html>
  );
}
