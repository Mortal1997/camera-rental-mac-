import './globals.css';
import { Inter } from "next/font/google";
import { cn } from "@/lib/utils";
import { TooltipProvider } from "@/components/ui/tooltip";

const inter = Inter({subsets:['latin'],variable:'--font-sans'});

export const metadata = {  title: '小玄租赁 | 智能租赁管理中控台',  description: '智能相机租赁管理平台',}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={cn("h-full antialiased", "font-sans", inter.variable)}>
      <body className="min-h-full flex flex-col">
        <TooltipProvider>{children}</TooltipProvider>
      </body>
    </html>
  );
}
