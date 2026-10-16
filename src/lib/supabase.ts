import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/** null when the env vars are missing (for example, before Supabase is connected in Bolt). */
export const supabase: SupabaseClient | null = url && anonKey ? createClient(url, anonKey) : null;
