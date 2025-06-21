// tests/setup/test-env.js - テスト環境変数設定
// 変更点: 新規作成。Jest テスト実行時の環境変数を設定。

// テスト環境の基本設定
process.env.NODE_ENV = 'test';

// データベース設定
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://test:test@localhost:5432/test';

// API キー設定
process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'test-openai-key';

// Supabase 設定
process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'test-anon-key';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-service-role-key';

// アプリケーション設定
process.env.NEXT_PUBLIC_BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
process.env.PORT = process.env.PORT || '3000';

// ログ設定
process.env.LOG_TRANSPORT = process.env.LOG_TRANSPORT || 'console';
process.env.LOG_LEVEL = process.env.LOG_LEVEL || 'error';

// Redis 設定（テスト用）
process.env.REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

// セキュリティ設定
process.env.NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET || 'test-secret';
process.env.NEXTAUTH_URL = process.env.NEXTAUTH_URL || 'http://localhost:3000'; 