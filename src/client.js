import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY');
}

// Capture only the error code before Supabase consumes the redirect fragment.
const initialParams = typeof window === 'undefined' ? new URLSearchParams() : new URLSearchParams(window.location.hash.slice(1));
const initialQuery = typeof window === 'undefined' ? new URLSearchParams() : new URLSearchParams(window.location.search);
export const recoveryLinkError = initialParams.get('error_code') || initialParams.get('error') || initialQuery.get('error_code') || initialQuery.get('error');

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
