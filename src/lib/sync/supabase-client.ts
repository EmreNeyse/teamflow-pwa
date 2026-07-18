import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { isCloudSyncAvailable } from '@/lib/sync/config';

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (!isCloudSyncAvailable()) return null;
  if (client) return client;

  const url = import.meta.env.VITE_SUPABASE_URL!.trim();
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY!.trim();

  client = createClient(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });

  return client;
}
