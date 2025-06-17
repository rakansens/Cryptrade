// Updated: Supabase database configuration with proper environment validation
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { env } from '@/config/env'

let supabase: SupabaseClient | null = null;
let supabaseAdmin: SupabaseClient | null = null;

/**
 * Get Supabase client instance
 * Returns null if Supabase is not configured
 */
export function getSupabase(): SupabaseClient | null {
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return null;
  }

  if (!supabase) {
    supabase = createClient(
      env.NEXT_PUBLIC_SUPABASE_URL,
      env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );
  }

  return supabase;
}

/**
 * Get Supabase admin client instance
 * Returns null if Supabase admin is not configured
 */
export function getSupabaseAdmin(): SupabaseClient | null {
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return null;
  }

  if (!supabaseAdmin) {
    supabaseAdmin = createClient(
      env.NEXT_PUBLIC_SUPABASE_URL,
      env.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );
  }

  return supabaseAdmin;
}

// Initialize clients
const _supabase = getSupabase();
const _supabaseAdmin = getSupabaseAdmin();

// Export for backward compatibility (will be null if not configured)
export { _supabase as supabase, _supabaseAdmin as supabaseAdmin };
