# CBT Ujian Semester Online — SMP Negeri 2 Sukaresmi

Aplikasi Computer Based Test (CBT) Ujian Semester Online untuk **SMP Negeri 2 Sukaresmi** yang dibangun dengan React, TypeScript, Vite, Tailwind CSS, dan Supabase (PostgreSQL, Authentication, Storage). Siap dijalankan secara lokal maupun di-deploy melalui GitHub dan Vercel.

## Fitur Utama Berdasarkan Peran

1. **Administrator (`admin`)**
   - Mengelola data **Guru**, **Siswa**, **Kelas**, **Mata Pelajaran**, **Tahun Pelajaran**, serta **Identitas Sekolah**.
   - Membuat akun pengguna baru (Guru & Siswa) dan mereset kata sandi melalui API server yang aman.
   - Mengelola seluruh **Bank Soal** (Pilihan Ganda & Essay + unggah gambar ke Supabase Storage).
   - Mengelola **Jadwal Ujian**, **Paket Soal**, dan **Token Ujian**.
   - Melihat seluruh peserta & hasil ujian serta mengunduh laporan berformat **Excel (.xlsx)** dan **PDF (.pdf)** lengkap dengan kop surat sekolah.

2. **Guru (`guru`)**
   - Mengelola Bank Soal sesuai mata pelajaran yang diampu (Pilihan Ganda & Essay beserta gambar).
   - Membuat ujian, mengatur durasi, jadwal pelaksanaan, bobot PG/Essay, dan token.
   - Memantau peserta ujian yang sedang berlangsung maupun yang telah selesai.
   - Memeriksa dan memberi skor + catatan untuk soal **Essay** serta menghitung ulang nilai akhir secara otomatis.
   - Mengumumkan atau menyembunyikan hasil nilai ke siswa dan mengunduh rekap nilai.

3. **Siswa (`siswa`)**
   - Login menggunakan **username** (atau email) dan kata sandi.
   - Melihat jadwal ujian yang diterbitkan khusus untuk kelasnya.
   - Memasukkan **token ujian** yang divalidasi di sisi server (jadwal, kelas, token, dan durasi).
   - Mengerjakan soal PG dan Essay dengan timer sinkron waktu server, fitur **Ragu-ragu**, navigasi nomor soal, dan **autosave** otomatis ke PostgreSQL.
   - Mengakhiri ujian dengan penilaian PG otomatis di server, lalu melihat nilai setelah diumumkan oleh guru/admin.

## Keamanan & Arsitektur Teknis

- **Row Level Security (RLS)** aktif pada seluruh 13 tabel (`profiles`, `students`, `teachers`, `classes`, `subjects`, `academic_years`, `exams`, `questions`, `exam_questions`, `exam_sessions`, `answers`, `results`, `school_settings`).
- **Kunci jawaban dan token tidak pernah dikirim ke browser siswa**: siswa tidak memiliki akses `SELECT` langsung ke tabel `questions` atau `exams`, melainkan mengakses soal melalui fungsi PostgreSQL `SECURITY DEFINER` (`get_student_exams`, `start_exam_session`, `get_exam_questions_for_student`, `save_student_answer`, `submit_exam_session`).
- **Service Role Key** hanya digunakan di sisi server (`/server.ts` untuk lokal dan `/api/admin/*` untuk Vercel Serverless Functions) dan tidak pernah memakai prefix `VITE_`.

---

## Panduan Instalasi & Setup Supabase

### 1. Siapkan Project Supabase

1. Buat project baru di [Supabase Dashboard](https://supabase.com/dashboard).
2. Buka menu **SQL Editor**, salin seluruh isi file `supabase/schema.sql`, lalu jalankan (**Run**).
   - Skrip ini otomatis membuat 13 tabel, relasi foreign key, indeks, trigger `updated_at`, kebijakan RLS, fungsi RPC validasi ujian, serta bucket Storage `question-images`.
3. Buat akun **Admin pertama**:
   - Buka **Authentication > Users > Add user** di Supabase Dashboard, masukkan email & password admin (misalnya `admin@smpn2sukaresmi.sch.id`).
   - Salin **User UID** yang baru dibuat, lalu jalankan SQL berikut di **SQL Editor**:
     ```sql
     INSERT INTO public.profiles (id, username, email, full_name, role, is_active)
     VALUES (
       'PASTE_USER_UID_DI_SINI',
       'admin',
       'admin@smpn2sukaresmi.sch.id',
       'Administrator CBT',
       'admin',
       true
     );
     ```
4. Setelah login sebagai Admin di aplikasi, Anda dapat langsung menambah Kelas, Mata Pelajaran, akun Guru, dan akun Siswa dari menu **Data Master**.

### 2. Jalankan di Komputer Lokal

```bash
npm install
cp .env.example .env
```

Isi file `.env`:

```env
VITE_SUPABASE_URL="https://PROJECT_ID.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="SUPABASE_PUBLISHABLE_KEY_ANDA"
SUPABASE_URL="https://PROJECT_ID.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="SUPABASE_SERVICE_ROLE_KEY_ANDA"
```

Jalankan server pengembangan:

```bash
npm run dev
```

Buka browser pada `http://localhost:3000`.

### 3. Build Produksi & Deployment ke GitHub + Vercel

1. Pastikan build berhasil secara lokal:
   ```bash
   npm run build
   ```
2. Push repository ke GitHub:
   ```bash
   git init
   git add .
   git commit -m "Initial CBT SMP Negeri 2 Sukaresmi"
   git branch -M main
   git remote add origin https://github.com/USERNAME/cbt-smpn2-sukaresmi.git
   git push -u origin main
   ```
3. Hubungkan repository GitHub tersebut di **Vercel** (**Add New Project**).
4. Konfigurasi Build Settings di Vercel:
   - Framework Preset: **Vite**
   - Build Command: `npm run build`
   - Output Directory: `dist`
5. Tambahkan **Environment Variables** di Vercel (**Project Settings > Environment Variables**):
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
   - `SUPABASE_URL` *(opsional untuk reset password & hapus user Auth via server)*
   - `SUPABASE_SERVICE_ROLE_KEY` *(opsional, tidak memakai prefix `VITE_`)*
6. Klik **Deploy**. Endpoint `/api/admin/users` dan `/api/admin/reset-password` akan otomatis berjalan sebagai Vercel Serverless Functions bersama frontend Vite.
