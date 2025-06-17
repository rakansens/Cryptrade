'use client';

import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export function AuthNavigation() {
  const { user, loading, signOut } = useAuth();
  const router = useRouter();

  if (loading) {
    return null;
  }

  return (
    <div className="fixed top-4 right-4 z-50 flex items-center gap-2">
      {user ? (
        <>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/dashboard')}
          >
            ダッシュボード
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={signOut}
          >
            ログアウト
          </Button>
        </>
      ) : (
        <>
          <Link href="/login">
            <Button variant="ghost" size="sm">
              ログイン
            </Button>
          </Link>
          <Link href="/signup">
            <Button size="sm">
              新規登録
            </Button>
          </Link>
        </>
      )}
    </div>
  );
}