import { createClient } from '@supabase/supabase-js';
import { env } from './env.js';
import { Database } from '../types/database.types.js';

/**
 * Supabase client configuration for New Mystica backend
 * Uses service role key for full database access
 */
const supabaseOptions = {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
  },
  global: {
    headers: {
      'X-Client-Info': 'new-mystica-express',
    },
  },
};

/**
 * Supabase client instance with service role privileges
 *
 * Features:
 * - Full database access (bypasses RLS when needed)
 * - Server-side operations (no browser session management)
 * - Custom client info header for monitoring
 *
 * @example
 * ```typescript
 * import { supabase } from '@/config/supabase';
 *
 * const { data, error } = await supabase
 *   .from('items')
 *   .select('*')
 *   .eq('user_id', userId);
 * ```
 */
export const supabase = createClient<Database>(
  env.SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  supabaseOptions as any
);

/**
 * Test database connection on startup
 * Logs connection status for debugging
 */
export const testDatabaseConnection = async (): Promise<boolean> => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('count')
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') {
      // PGRST116 is "no rows returned" which is acceptable for empty table
      throw error;
    }

    if (env.NODE_ENV === 'development') {
      console.log('✅ Supabase database connection successful');
    }
    return true;
  } catch (error) {
    console.error('❌ Supabase database connection failed:', error);
    return false;
  }
};

// Test connection on module load in development
if (env.NODE_ENV === 'development') {
  testDatabaseConnection().catch(error => {
    console.warn('Database connection test failed during startup:', error.message);
  });
}