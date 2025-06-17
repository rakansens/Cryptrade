import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { ToastContainer } from '@/components/ui/toast';
import { UIEventProvider } from '@/components/providers/UIEventProvider';
import { BinanceAPIProvider } from '@/lib/binance/binance-context';
import { AuthProvider } from '@/app/providers/auth-provider';
import { BodyStyleWrapper } from '@/components/layout/BodyStyleWrapper';

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
      <body className={inter.className} suppressHydrationWarning>
        <BodyStyleWrapper>
          <AuthProvider>
            <BinanceAPIProvider>
              <UIEventProvider>
                {children}
              </UIEventProvider>
            </BinanceAPIProvider>
          </AuthProvider>
          <ToastContainer />
        </BodyStyleWrapper>
      </body>
    </html>
  );
}