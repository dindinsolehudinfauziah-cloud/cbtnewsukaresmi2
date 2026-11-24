import { useCallback, useEffect, useState } from 'react';
import {
  fetchCurrentUserContext,
  getSupabaseClient,
  isSupabaseConfigured,
} from './lib/supabase';
import type { CurrentUserContext, SchoolSettings } from './types/database';
import { LoginView } from './components/LoginView';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { TeacherDashboard } from './components/guru/TeacherDashboard';
import { StudentDashboard } from './components/siswa/StudentDashboard';

export default function App() {
  const [userContext, setUserContext] = useState<CurrentUserContext | null>(null);
  const [schoolSettings, setSchoolSettings] = useState<SchoolSettings | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  const loadSettings = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    try {
      const supabase = getSupabaseClient();
      const { data } = await supabase.from('school_settings').select('*').limit(1).maybeSingle();
      if (data) {
        setSchoolSettings(data as SchoolSettings);
      }
    } catch {
      // Gunakan fallback nama sekolah bawaan bila tabel belum dibuat
    }
  }, []);

  const syncUserSession = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setUserContext(null);
      setInitializing(false);
      return;
    }

    setAuthError(null);
    try {
      const ctx = await fetchCurrentUserContext();
      setUserContext(ctx);
      await loadSettings();
    } catch (err) {
      setUserContext(null);
      setAuthError(err instanceof Error ? err.message : 'Gagal memuat profil pengguna.');
    } finally {
      setInitializing(false);
    }
  }, [loadSettings]);

  useEffect(() => {
    syncUserSession();

    if (!isSupabaseConfigured) return;
    const supabase = getSupabaseClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        setUserContext(null);
      }
    });

    return () => subscription.unsubscribe();
  }, [syncUserSession]);

  const handleLogout = async () => {
    if (isSupabaseConfigured) {
      const supabase = getSupabaseClient();
      await supabase.auth.signOut();
    }
    setUserContext(null);
  };

  const schoolName = schoolSettings?.school_name || 'SMP Negeri 2 Sukaresmi';

  if (initializing) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="bg-white border border-slate-200 rounded-xl px-8 py-6 text-center space-y-2">
          <p className="text-sm font-semibold text-slate-900">{schoolName}</p>
          <p className="text-xs text-slate-500">Memuat sistem CBT Ujian Semester...</p>
        </div>
      </div>
    );
  }

  if (!userContext) {
    return (
      <div>
        {authError && (
          <div className="max-w-5xl mx-auto px-4 pt-4">
            <div className="p-3.5 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
              {authError}
            </div>
          </div>
        )}
        <LoginView schoolName={schoolName} onLoginSuccess={syncUserSession} />
      </div>
    );
  }

  if (userContext.profile.role === 'admin') {
    return (
      <AdminDashboard
        user={userContext}
        schoolSettings={schoolSettings}
        onRefreshSettings={loadSettings}
        onLogout={handleLogout}
      />
    );
  }

  if (userContext.profile.role === 'guru') {
    return (
      <TeacherDashboard
        user={userContext}
        schoolSettings={schoolSettings}
        onLogout={handleLogout}
      />
    );
  }

  return (
    <StudentDashboard
      user={userContext}
      schoolSettings={schoolSettings}
      onLogout={handleLogout}
    />
  );
}
