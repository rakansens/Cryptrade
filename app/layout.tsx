import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { ToastContainer } from '@/components/ui/toast';
import { UIEventProvider } from '@/components/providers/UIEventProvider';
import { BinanceAPIProvider } from '@/lib/binance/binance-context';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Cryptrade',
  description: 'Crypto Trading Interface',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} bg-background text-foreground`}>
        <BinanceAPIProvider>
          <UIEventProvider>
            {children}
          </UIEventProvider>
        </BinanceAPIProvider>
        <ToastContainer />
      </body>
    </html>
  );
}