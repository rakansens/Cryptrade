import { useEffect, useState } from 'react';

export function useIsClient(): boolean {
  const [isClient, setIsClient] = useState<boolean>(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  return isClient;
}