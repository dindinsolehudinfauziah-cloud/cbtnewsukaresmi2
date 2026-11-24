import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { CurrentUserContext, UserRole } from '../types/database';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabasePublishableKey =
  (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) ||
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined);

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
    supabasePublishableKey &&
    !supabaseUrl.includes('YOUR_PROJECT_ID') &&
    !supabasePublishableKey.includes('YOUR_SUPABASE_PUBLISHABLE_KEY') &&
    !supabasePublishableKey.includes('YOUR_SUPABASE_ANON_KEY')
);

let clientInstance: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (!isSupabaseConfigured || !supabaseUrl || !supabasePublishableKey) {
    throw new Error(
      'Konfigurasi Supabase belum diatur. Tambahkan VITE_SUPABASE_URL dan VITE_SUPABASE_PUBLISHABLE_KEY pada environment.'
    );
  }
  if (!clientInstance) {
    clientInstance = createClient(supabaseUrl, supabasePublishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  }
  return clientInstance;
}

export async function loginWithUsernameOrEmail(identifier: string, password: string) {
  const supabase = getSupabaseClient();
  const cleanIdentifier = identifier.trim();

  if (!cleanIdentifier || !password) {
    throw new Error('Username/email dan password wajib diisi.');
  }

  let resolvedEmail = cleanIdentifier;

  // Resolusi username -> email via PostgreSQL RPC yang aman
  const { data: rpcEmail, error: rpcError } = await supabase.rpc('resolve_login_email', {
    p_identifier: cleanIdentifier,
  });

  if (!rpcError && typeof rpcEmail === 'string' && rpcEmail.includes('@')) {
    resolvedEmail = rpcEmail;
  } else if (!cleanIdentifier.includes('@')) {
    throw new Error('Username tidak ditemukan atau akun sedang dinonaktifkan.');
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email: resolvedEmail,
    password,
  });

  if (error) {
    throw new Error('Username/email atau password salah.');
  }

  return data;
}

export async function fetchCurrentUserContext(): Promise<CurrentUserContext | null> {
  const supabase = getSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return null;

  const { data: profile, error: profileErr } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userRes.user.id)
    .single();

  if (profileErr || !profile) {
    throw new Error('Profil pengguna belum terdaftar pada tabel profiles.');
  }

  if (!profile.is_active) {
    await supabase.auth.signOut();
    throw new Error('Akun Anda sedang dinonaktifkan oleh Admin.');
  }

  let teacher = null;
  let student = null;

  if (profile.role === 'guru') {
    const { data } = await supabase
      .from('teachers')
      .select('*, subjects(*)')
      .eq('profile_id', profile.id)
      .maybeSingle();
    teacher = data;
  } else if (profile.role === 'siswa') {
    const { data } = await supabase
      .from('students')
      .select('*, classes(*, academic_years(*))')
      .eq('profile_id', profile.id)
      .maybeSingle();
    student = data;
  }

  return { profile, teacher, student };
}

export async function uploadQuestionImage(file: File): Promise<string> {
  const supabase = getSupabaseClient();
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (!allowedTypes.includes(file.type)) {
    throw new Error('Format gambar harus JPG, PNG, WEBP, atau GIF.');
  }
  if (file.size > 3 * 1024 * 1024) {
    throw new Error('Ukuran gambar maksimal 3 MB.');
  }

  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const filePath = `questions/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from('question-images')
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false,
    });

  if (uploadError) {
    throw new Error(`Gagal mengunggah gambar: ${uploadError.message}`);
  }

  const { data } = supabase.storage.from('question-images').getPublicUrl(filePath);
  return data.publicUrl;
}

export async function deleteQuestionImageByUrl(imageUrl: string): Promise<void> {
  const supabase = getSupabaseClient();
  const marker = '/storage/v1/object/public/question-images/';
  const idx = imageUrl.indexOf(marker);
  if (idx === -1) return;
  const path = imageUrl.slice(idx + marker.length);
  if (!path) return;
  await supabase.storage.from('question-images').remove([path]);
}

async function getAccessToken(): Promise<string> {
  const supabase = getSupabaseClient();
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Sesi login tidak ditemukan.');
  return token;
}

export interface CreateManagedUserInput {
  username: string;
  email?: string;
  password: string;
  full_name: string;
  role: UserRole;
  nip?: string;
  subject_id?: string | null;
  phone?: string;
  nis?: string;
  nisn?: string;
  class_id?: string | null;
  gender?: 'L' | 'P' | null;
}

async function createManagedUserViaSignUpFallback(payload: CreateManagedUserInput) {
  if (!supabaseUrl || !supabasePublishableKey) {
    throw new Error('Konfigurasi Supabase belum lengkap.');
  }

  const cleanUsername = payload.username.trim().toLowerCase().replace(/\s+/g, '');
  const cleanEmail =
    payload.email && payload.email.trim().includes('@')
      ? payload.email.trim().toLowerCase()
      : `${cleanUsername}@smpn2sukaresmi.sch.id`;

  // Gunakan klien terpisah agar sesi login Admin yang aktif tidak tertimpa
  const tempClient = createClient(supabaseUrl, supabasePublishableKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  const { data: signUpData, error: signUpErr } = await tempClient.auth.signUp({
    email: cleanEmail,
    password: payload.password,
    options: {
      data: {
        username: cleanUsername,
        full_name: payload.full_name.trim(),
        role: payload.role,
      },
    },
  });

  if (signUpErr || !signUpData.user) {
    throw new Error(
      signUpErr?.message ||
        'Gagal mendaftarkan akun. Pastikan konfirmasi email Supabase dinonaktifkan atau tambahkan SUPABASE_SERVICE_ROLE_KEY di server.'
    );
  }

  if (Array.isArray(signUpData.user.identities) && signUpData.user.identities.length === 0) {
    throw new Error('Email atau username tersebut sudah terdaftar di Supabase Authentication.');
  }

  const userId = signUpData.user.id;
  const adminSupabase = getSupabaseClient();

  const { error: profileErr } = await adminSupabase.from('profiles').insert({
    id: userId,
    username: cleanUsername,
    email: cleanEmail,
    full_name: payload.full_name.trim(),
    role: payload.role,
    is_active: true,
  });

  if (profileErr) {
    throw new Error(profileErr.message);
  }

  if (payload.role === 'guru') {
    const { error: teacherErr } = await adminSupabase.from('teachers').insert({
      profile_id: userId,
      nip: payload.nip ? payload.nip.trim() : null,
      subject_id: payload.subject_id || null,
      phone: payload.phone ? payload.phone.trim() : null,
    });
    if (teacherErr) throw new Error(teacherErr.message);
  } else if (payload.role === 'siswa') {
    const { error: studentErr } = await adminSupabase.from('students').insert({
      profile_id: userId,
      nis: payload.nis ? payload.nis.trim() : null,
      nisn: payload.nisn ? payload.nisn.trim() : null,
      class_id: payload.class_id || null,
      gender: payload.gender === 'L' || payload.gender === 'P' ? payload.gender : null,
    });
    if (studentErr) throw new Error(studentErr.message);
  }

  return {
    id: userId,
    username: cleanUsername,
    email: cleanEmail,
    full_name: payload.full_name.trim(),
    role: payload.role,
  };
}

export async function createManagedUser(payload: CreateManagedUserInput) {
  const token = await getAccessToken();
  try {
    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => ({}));
    if (res.status === 503 || data?.code === 'SERVICE_ROLE_MISSING' || res.status === 404) {
      return await createManagedUserViaSignUpFallback(payload);
    }
    if (!res.ok) {
      throw new Error(data.error || 'Gagal membuat akun pengguna.');
    }
    return data;
  } catch (err) {
    if (err instanceof TypeError) {
      return await createManagedUserViaSignUpFallback(payload);
    }
    throw err;
  }
}

export async function deleteManagedUser(userId: string) {
  const token = await getAccessToken();
  const res = await fetch(`/api/admin/users?id=${encodeURIComponent(userId)}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 503 || data?.code === 'SERVICE_ROLE_MISSING') {
    // Fallback jika SUPABASE_SERVICE_ROLE_KEY belum diatur: nonaktifkan profil & hapus baris guru/siswa
    const supabase = getSupabaseClient();
    const { data: userData } = await supabase.auth.getUser();
    if (userData.user?.id === userId) {
      throw new Error('Tidak dapat menghapus akun Anda sendiri.');
    }
    await supabase.from('teachers').delete().eq('profile_id', userId);
    await supabase.from('students').delete().eq('profile_id', userId);
    const { error: updErr } = await supabase
      .from('profiles')
      .update({ is_active: false })
      .eq('id', userId);
    if (updErr) {
      throw new Error(updErr.message);
    }
    return { deactivated: true };
  }
  if (!res.ok) {
    throw new Error(data.error || 'Gagal menghapus akun pengguna.');
  }
  return data;
}

export async function resetManagedUserPassword(userId: string, newPassword: string) {
  const token = await getAccessToken();
  const res = await fetch('/api/admin/reset-password', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ userId, newPassword }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      data.error ||
        'Gagal memperbarui password. Pastikan SUPABASE_SERVICE_ROLE_KEY telah diatur di environment server.'
    );
  }
  return data;
}
