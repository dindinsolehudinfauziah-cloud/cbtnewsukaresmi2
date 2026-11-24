import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export function getSupabaseAdminClient(): SupabaseClient {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey || serviceKey.includes('YOUR_SUPABASE_SERVICE_ROLE_KEY')) {
    throw new Error(
      'SERVICE_ROLE_MISSING: Konfigurasi server belum lengkap (SUPABASE_SERVICE_ROLE_KEY belum diatur).'
    );
  }

  return createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export async function verifyAdminRequest(
  authHeader: string | undefined
): Promise<{ adminClient: SupabaseClient; callerId: string }> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('UNAUTHORIZED: Token autentikasi tidak ditemukan.');
  }

  const token = authHeader.slice('Bearer '.length).trim();
  if (!token) {
    throw new Error('UNAUTHORIZED: Token autentikasi kosong.');
  }

  const adminClient = getSupabaseAdminClient();
  const { data: userData, error: authError } = await adminClient.auth.getUser(token);

  if (authError || !userData?.user) {
    throw new Error('UNAUTHORIZED: Sesi tidak valid atau sudah berakhir.');
  }

  const { data: profile, error: profileError } = await adminClient
    .from('profiles')
    .select('id, role, is_active')
    .eq('id', userData.user.id)
    .single();

  if (profileError || !profile || !profile.is_active || profile.role !== 'admin') {
    throw new Error('FORBIDDEN: Hanya Admin yang dapat mengakses fitur ini.');
  }

  return { adminClient, callerId: userData.user.id };
}
