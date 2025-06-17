'use client';

import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from '@/components/ui/toast';

export default function DashboardPage() {
  const { user, loading, signOut } = useAuth();
  const router = useRouter();
  const [userData, setUserData] = useState<any>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  useEffect(() => {
    async function fetchUserData() {
      try {
        const response = await fetch('/api/auth/me');
        if (response.ok) {
          const data = await response.json();
          setUserData(data.user);
        }
      } catch (error) {
        console.error('Failed to fetch user data:', error);
      }
    }

    if (user) {
      fetchUserData();
    }
  }, [user]);

  const handleSignOut = async () => {
    const { error } = await signOut();
    if (error) {
      toast.error('ログアウトに失敗しました');
    } else {
      toast.success('ログアウトしました');
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-lg">読み込み中...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8 flex justify-between items-center">
        <h1 className="text-3xl font-bold">ダッシュボード</h1>
        <Button onClick={handleSignOut} variant="outline">
          ログアウト
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>ユーザー情報</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-2">
              <div>
                <dt className="text-sm font-medium text-muted-foreground">メールアドレス</dt>
                <dd className="text-sm">{user?.email || '-'}</dd>
              </div>
              {userData && (
                <>
                  <div>
                    <dt className="text-sm font-medium text-muted-foreground">名前</dt>
                    <dd className="text-sm">{userData.name || '-'}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-muted-foreground">ユーザーID</dt>
                    <dd className="text-sm font-mono">{userData.id}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-muted-foreground">登録日</dt>
                    <dd className="text-sm">
                      {new Date(userData.createdAt).toLocaleDateString('ja-JP')}
                    </dd>
                  </div>
                </>
              )}
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Cryptrade機能</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Button 
                onClick={() => router.push('/')} 
                className="w-full"
              >
                トレーディング画面へ
              </Button>
              <p className="text-sm text-muted-foreground text-center">
                認証機能が正常に動作しています
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}