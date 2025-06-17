'use client';

import { useEffect } from 'react';

export function BodyStyleWrapper({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // クライアントサイドでのみbodyにスタイルを適用
    document.body.classList.add('bg-background', 'text-foreground');
    
    return () => {
      document.body.classList.remove('bg-background', 'text-foreground');
    };
  }, []);

  return <>{children}</>;
}