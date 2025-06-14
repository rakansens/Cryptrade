/* eslint-disable no-restricted-syntax */
// Updated: Supabaseデータベース設定 - ESLintルール一時無効化（環境変数未定義のため）
import { createClient } from '@supabase/supabase-js'
import { env } from '@/config/env'

// Create a single supabase client for interacting with your database
export const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL!,
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// For server-side operations with admin privileges
export const supabaseAdmin = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL!,
  env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)