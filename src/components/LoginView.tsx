import React, { useState } from 'react';
import { AlertCircle, Eye, EyeOff, Lock, User } from 'lucide-react';
import { isSupabaseConfigured, loginWithUsernameOrEmail } from '../lib/supabase';

interface LoginViewProps {
  schoolName: string;
  onLoginSuccess: () => Promise<void>;
}

export const LoginView: React.FC<LoginViewProps> = ({ schoolName, onLoginSuccess }) => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageError, setImageError] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!isSupabaseConfigured) {
      setError(
        'Koneksi Supabase belum dikonfigurasi. Lengkapi VITE_SUPABASE_URL dan VITE_SUPABASE_PUBLISHABLE_KEY terlebih dahulu.'
      );
      return;
    }

    setLoading(true);
    try {
      await loginWithUsernameOrEmail(identifier, password);
      await onLoginSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal masuk ke sistem.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl w-full mx-auto bg-white border border-slate-200 rounded-xl overflow-hidden grid grid-cols-1 lg:grid-cols-12 items-stretch">
        {/* Left Institutional Visual Panel */}
        <div className="lg:col-span-6 bg-slate-900 text-white flex flex-col justify-between relative min-h-[260px] lg:min-h-[560px]">
          {!imageError ? (
            <img
              src="/src/assets/images/campus_exam_hero_1795534569747.jpg"
              alt="Ruang Laboratorium Komputer SMP Negeri 2 Sukaresmi"
              referrerPolicy="no-referrer"
              onError={() => setImageError(true)}
              className="absolute inset-0 w-full h-full object-cover opacity-35"
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-blue-950 via-slate-900 to-slate-950" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-900/60 to-slate-950/50" />

          <div className="relative z-10 p-6 sm:p-8 flex items-center gap-3.5">
            <img
              src="/src/assets/images/school_crest_emblem_1795534569314.jpg"
              alt="Lambang SMP Negeri 2 Sukaresmi"
              referrerPolicy="no-referrer"
              className="w-12 h-12 rounded-lg bg-white p-1 object-contain shrink-0"
            />
            <div>
              <p className="text-sm font-bold tracking-tight text-white">{schoolName}</p>
              <p className="text-xs text-slate-300">Kabupaten Cianjur · Jawa Barat</p>
            </div>
          </div>

          <div className="relative z-10 p-6 sm:p-8 space-y-3">
            <h1 className="text-2xl sm:text-3xl font-bold leading-tight text-white">
              Sistem Ujian Semester Berbasis Komputer
            </h1>
            <p className="text-sm text-slate-200 leading-relaxed max-w-md">
              Platform evaluasi akademik terintegrasi untuk Admin, Guru Mata Pelajaran, dan Siswa
              dengan penyimpanan jawaban otomatis serta validasi jadwal berbasis server.
            </p>
            <div className="pt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-300">
              <span>Autentikasi Terpadu</span>
              <span aria-hidden="true">·</span>
              <span>Autosave Real-Time</span>
              <span aria-hidden="true">·</span>
              <span>Laporan Excel & PDF</span>
            </div>
          </div>
        </div>

        {/* Right Login Form */}
        <div className="lg:col-span-6 p-6 sm:p-10 flex flex-col justify-center">
          <div className="max-w-md w-full mx-auto space-y-6">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Masuk ke Portal CBT</h2>
              <p className="text-sm text-slate-600 mt-1">
                Gunakan username atau email terdaftar beserta kata sandi Anda.
              </p>
            </div>

            {!isSupabaseConfigured && (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg space-y-2 text-xs text-amber-900">
                <p className="font-semibold flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 shrink-0 text-amber-700" />
                  Konfigurasi Supabase Diperlukan
                </p>
                <p className="leading-relaxed">
                  Atur variabel <code className="font-mono bg-amber-100 px-1 rounded">VITE_SUPABASE_URL</code> dan{' '}
                  <code className="font-mono bg-amber-100 px-1 rounded">VITE_SUPABASE_PUBLISHABLE_KEY</code> pada file{' '}
                  <code className="font-mono bg-amber-100 px-1 rounded">.env</code> atau Environment Variables Vercel, lalu jalankan skrip{' '}
                  <code className="font-mono bg-amber-100 px-1 rounded">supabase/schema.sql</code> pada SQL Editor Supabase.
                </p>
              </div>
            )}

            {error && (
              <div
                role="alert"
                className="p-3.5 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2.5 text-sm text-red-800"
              >
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="login-identifier"
                  className="block text-sm font-medium text-slate-700 mb-1.5"
                >
                  Username atau Email
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    id="login-identifier"
                    type="text"
                    autoComplete="username"
                    required
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="Contoh: siswa01 atau guru@smpn2sukaresmi.sch.id"
                    className="w-full pl-10 pr-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-900 focus:border-blue-900"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="login-password"
                  className="block text-sm font-medium text-slate-700 mb-1.5"
                >
                  Kata Sandi
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Masukkan kata sandi"
                    className="w-full pl-10 pr-10 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-900 focus:border-blue-900"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-1"
                    aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Lihat kata sandi'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 bg-blue-900 hover:bg-blue-950 disabled:opacity-60 text-white text-sm font-semibold rounded-lg transition-colors whitespace-nowrap"
              >
                {loading ? 'Memeriksa Akun...' : 'Masuk ke Sistem'}
              </button>
            </form>

            <div className="pt-4 border-t border-slate-200 text-xs text-slate-500 space-y-1">
              <p className="font-medium text-slate-700">Bantuan Akses Ujian</p>
              <p>
                Siswa yang belum memiliki akun atau lupa kata sandi dapat menghubungi panitia CBT
                atau administrator sekolah.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
