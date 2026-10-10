import { loadEnv } from 'vite';
const env = { ...loadEnv('production', process.cwd(), 'VITE_'), ...process.env };
for (const name of ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY']) {
  if (!env[name] || /your-project|your-public/.test(env[name])) throw new Error(`Set ${name} before building`);
}
const key = env.VITE_SUPABASE_ANON_KEY;
if (key.startsWith('sb_secret_')) throw new Error('Never expose a Supabase secret key in VITE_ variables');
if (key.startsWith('eyJ')) {
  const payload = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString());
  if (payload.role !== 'anon') throw new Error('Use a public anon key, never a service-role key');
}
const url = new URL(env.VITE_SUPABASE_URL);
if (url.protocol !== 'https:') throw new Error('Supabase URL must use HTTPS');
console.log('Required public Supabase environment variables are configured.');
