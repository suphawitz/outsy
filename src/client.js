import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://sihfjdpefsozabdhwucd.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNpaGZqZHBlZnNvemFiZGh3dWNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwOTIyNDUsImV4cCI6MjA4NTY2ODI0NX0.T_GwKa9ymSguMErlNHOtaGurWVEiHl_S5hF40Mjn9FM';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);