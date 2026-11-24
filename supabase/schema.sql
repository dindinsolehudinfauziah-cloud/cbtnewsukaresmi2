-- ============================================================================
-- SKEMA DATABASE CBT UJIAN SEMESTER ONLINE
-- SMP NEGERI 2 SUKARESMI
-- Teknologi: PostgreSQL (Supabase) + Row Level Security (RLS) + Server RPCs
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ----------------------------------------------------------------------------
-- 1. FUNGSI TRIGGER TIMESTAMP OTOMATIS
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- ----------------------------------------------------------------------------
-- 2. TABEL UTAMA
-- ----------------------------------------------------------------------------

-- 2.1 Tahun Pelajaran
CREATE TABLE IF NOT EXISTS public.academic_years (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL, -- contoh: '2025/2026'
  semester TEXT NOT NULL CHECK (semester IN ('Ganjil', 'Genap')),
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (name, semester)
);

-- 2.2 Pengaturan Sekolah
CREATE TABLE IF NOT EXISTS public.school_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_name TEXT NOT NULL DEFAULT 'SMP Negeri 2 Sukaresmi',
  npsn TEXT NOT NULL DEFAULT '20200000',
  address TEXT NOT NULL DEFAULT 'Jl. Raya Sukaresmi, Kab. Cianjur, Jawa Barat',
  headmaster_name TEXT NOT NULL DEFAULT 'Kepala Sekolah',
  headmaster_nip TEXT NOT NULL DEFAULT '-',
  academic_year_active_id UUID REFERENCES public.academic_years(id) ON DELETE SET NULL,
  exam_rules TEXT NOT NULL DEFAULT '1. Bacalah doa sebelum memulai ujian. 2. Dilarang membuka tab lain atau bekerja sama selama ujian berlangsung. 3. Jawaban tersimpan otomatis setiap kali Anda memilih atau mengetik jawaban.',
  logo_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2.3 Kelas
CREATE TABLE IF NOT EXISTS public.classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL, -- contoh: 'VII-A', 'VIII-B', 'IX-C'
  grade_level INT NOT NULL CHECK (grade_level IN (7, 8, 9)),
  academic_year_id UUID REFERENCES public.academic_years(id) ON DELETE SET NULL,
  homeroom_teacher TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (name, academic_year_id)
);

-- 2.4 Mata Pelajaran
CREATE TABLE IF NOT EXISTS public.subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  kkm NUMERIC(5,2) NOT NULL DEFAULT 75.00 CHECK (kkm >= 0 AND kkm <= 100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2.5 Profil Pengguna (terhubung 1:1 dengan auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'guru', 'siswa')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2.6 Data Guru
CREATE TABLE IF NOT EXISTS public.teachers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  nip TEXT UNIQUE,
  subject_id UUID REFERENCES public.subjects(id) ON DELETE SET NULL,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2.7 Data Siswa
CREATE TABLE IF NOT EXISTS public.students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  nis TEXT UNIQUE,
  nisn TEXT UNIQUE,
  class_id UUID REFERENCES public.classes(id) ON DELETE SET NULL,
  gender TEXT CHECK (gender IN ('L', 'P')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2.8 Bank Soal
CREATE TABLE IF NOT EXISTS public.questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  question_type TEXT NOT NULL CHECK (question_type IN ('pg', 'essay')),
  question_text TEXT NOT NULL,
  image_url TEXT,
  option_a TEXT,
  option_b TEXT,
  option_c TEXT,
  option_d TEXT,
  correct_option TEXT CHECK (correct_option IN ('A', 'B', 'C', 'D') OR correct_option IS NULL),
  essay_rubric TEXT,
  weight NUMERIC(5,2) NOT NULL DEFAULT 1.00 CHECK (weight > 0),
  difficulty TEXT NOT NULL DEFAULT 'sedang' CHECK (difficulty IN ('mudah', 'sedang', 'sulit')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2.9 Jadwal Ujian
CREATE TABLE IF NOT EXISTS public.exams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  academic_year_id UUID NOT NULL REFERENCES public.academic_years(id) ON DELETE CASCADE,
  teacher_id UUID REFERENCES public.teachers(id) ON DELETE SET NULL,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  duration_minutes INT NOT NULL CHECK (duration_minutes > 0),
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  token TEXT NOT NULL,
  token_active BOOLEAN NOT NULL DEFAULT true,
  shuffle_questions BOOLEAN NOT NULL DEFAULT true,
  shuffle_options BOOLEAN NOT NULL DEFAULT false,
  is_published BOOLEAN NOT NULL DEFAULT true,
  results_published BOOLEAN NOT NULL DEFAULT false,
  pg_weight_percent NUMERIC(5,2) NOT NULL DEFAULT 70.00 CHECK (pg_weight_percent >= 0 AND pg_weight_percent <= 100),
  essay_weight_percent NUMERIC(5,2) NOT NULL DEFAULT 30.00 CHECK (essay_weight_percent >= 0 AND essay_weight_percent <= 100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (end_time > start_time)
);

-- 2.10 Relasi Soal Ujian
CREATE TABLE IF NOT EXISTS public.exam_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id UUID NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  question_order INT NOT NULL DEFAULT 1,
  points NUMERIC(5,2) NOT NULL DEFAULT 1.00 CHECK (points > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (exam_id, question_id)
);

-- 2.11 Sesi Ujian Siswa
CREATE TABLE IF NOT EXISTS public.exam_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id UUID NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  submitted_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'submitted', 'expired')),
  question_order UUID[],
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (exam_id, student_id)
);

-- 2.12 Jawaban Siswa
CREATE TABLE IF NOT EXISTS public.answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.exam_sessions(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  selected_option TEXT CHECK (selected_option IN ('A', 'B', 'C', 'D') OR selected_option IS NULL),
  essay_answer TEXT,
  is_flagged BOOLEAN NOT NULL DEFAULT false,
  is_correct BOOLEAN,
  essay_score NUMERIC(5,2) CHECK (essay_score IS NULL OR (essay_score >= 0 AND essay_score <= 100)),
  teacher_feedback TEXT,
  answered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (session_id, question_id)
);

-- 2.13 Hasil & Nilai Ujian
CREATE TABLE IF NOT EXISTS public.results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id UUID NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
  session_id UUID NOT NULL UNIQUE REFERENCES public.exam_sessions(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  total_questions INT NOT NULL DEFAULT 0,
  pg_correct_count INT NOT NULL DEFAULT 0,
  pg_total_count INT NOT NULL DEFAULT 0,
  pg_score NUMERIC(5,2) NOT NULL DEFAULT 0.00,
  essay_score NUMERIC(5,2) NOT NULL DEFAULT 0.00,
  final_score NUMERIC(5,2) NOT NULL DEFAULT 0.00,
  grading_status TEXT NOT NULL DEFAULT 'auto_graded' CHECK (grading_status IN ('auto_graded', 'needs_essay_grading', 'graded')),
  is_published BOOLEAN NOT NULL DEFAULT false,
  graded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  graded_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (exam_id, student_id)
);

-- ----------------------------------------------------------------------------
-- 3. INDEKS PERFORMA
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles(LOWER(username));
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_teachers_subject ON public.teachers(subject_id);
CREATE INDEX IF NOT EXISTS idx_students_class ON public.students(class_id);
CREATE INDEX IF NOT EXISTS idx_questions_subject ON public.questions(subject_id);
CREATE INDEX IF NOT EXISTS idx_questions_created_by ON public.questions(created_by);
CREATE INDEX IF NOT EXISTS idx_exams_class_subject ON public.exams(class_id, subject_id);
CREATE INDEX IF NOT EXISTS idx_exams_schedule ON public.exams(start_time, end_time);
CREATE INDEX IF NOT EXISTS idx_exam_questions_exam ON public.exam_questions(exam_id, question_order);
CREATE INDEX IF NOT EXISTS idx_exam_sessions_exam_student ON public.exam_sessions(exam_id, student_id);
CREATE INDEX IF NOT EXISTS idx_answers_session ON public.answers(session_id);
CREATE INDEX IF NOT EXISTS idx_results_exam ON public.results(exam_id);
CREATE INDEX IF NOT EXISTS idx_results_student ON public.results(student_id);

-- ----------------------------------------------------------------------------
-- 4. TRIGGER UPDATED_AT PADA SEMUA TABEL
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'academic_years', 'school_settings', 'classes', 'subjects',
    'profiles', 'teachers', 'students', 'questions', 'exams',
    'exam_questions', 'exam_sessions', 'answers', 'results'
  ]
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%I_updated_at ON public.%I;', t, t);
    EXECUTE format('CREATE TRIGGER trg_%I_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();', t, t);
  END LOOP;
END $$;

-- ----------------------------------------------------------------------------
-- 5. FUNGSI PEMBANTU KEAMANAN & OTORISASI
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid() AND is_active = true LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.current_teacher_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.teachers WHERE profile_id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.current_student_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.students WHERE profile_id = auth.uid() LIMIT 1;
$$;

-- ----------------------------------------------------------------------------
-- 6. ROW LEVEL SECURITY (RLS)
-- ----------------------------------------------------------------------------
ALTER TABLE public.academic_years ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.results ENABLE ROW LEVEL SECURITY;

-- Kebijakan: academic_years, school_settings, classes, subjects
-- Semua pengguna terautentikasi dapat membaca data referensi; hanya admin yang mengubah
DROP POLICY IF EXISTS "auth_read_academic_years" ON public.academic_years;
CREATE POLICY "auth_read_academic_years" ON public.academic_years FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "admin_manage_academic_years" ON public.academic_years;
CREATE POLICY "admin_manage_academic_years" ON public.academic_years FOR ALL TO authenticated USING (public.current_user_role() = 'admin') WITH CHECK (public.current_user_role() = 'admin');

DROP POLICY IF EXISTS "public_read_school_settings" ON public.school_settings;
CREATE POLICY "public_read_school_settings" ON public.school_settings FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "admin_manage_school_settings" ON public.school_settings;
CREATE POLICY "admin_manage_school_settings" ON public.school_settings FOR ALL TO authenticated USING (public.current_user_role() = 'admin') WITH CHECK (public.current_user_role() = 'admin');

DROP POLICY IF EXISTS "auth_read_classes" ON public.classes;
CREATE POLICY "auth_read_classes" ON public.classes FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "admin_manage_classes" ON public.classes;
CREATE POLICY "admin_manage_classes" ON public.classes FOR ALL TO authenticated USING (public.current_user_role() = 'admin') WITH CHECK (public.current_user_role() = 'admin');

DROP POLICY IF EXISTS "auth_read_subjects" ON public.subjects;
CREATE POLICY "auth_read_subjects" ON public.subjects FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "admin_manage_subjects" ON public.subjects;
CREATE POLICY "admin_manage_subjects" ON public.subjects FOR ALL TO authenticated USING (public.current_user_role() = 'admin') WITH CHECK (public.current_user_role() = 'admin');

-- Kebijakan: profiles
DROP POLICY IF EXISTS "read_own_or_staff_profiles" ON public.profiles;
CREATE POLICY "read_own_or_staff_profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.current_user_role() IN ('admin', 'guru'));

DROP POLICY IF EXISTS "admin_manage_profiles" ON public.profiles;
CREATE POLICY "admin_manage_profiles" ON public.profiles
  FOR ALL TO authenticated
  USING (public.current_user_role() = 'admin')
  WITH CHECK (public.current_user_role() = 'admin');

-- Kebijakan: teachers
DROP POLICY IF EXISTS "auth_read_teachers" ON public.teachers;
CREATE POLICY "auth_read_teachers" ON public.teachers
  FOR SELECT TO authenticated
  USING (profile_id = auth.uid() OR public.current_user_role() IN ('admin', 'guru', 'siswa'));

DROP POLICY IF EXISTS "admin_manage_teachers" ON public.teachers;
CREATE POLICY "admin_manage_teachers" ON public.teachers
  FOR ALL TO authenticated
  USING (public.current_user_role() = 'admin')
  WITH CHECK (public.current_user_role() = 'admin');

-- Kebijakan: students
DROP POLICY IF EXISTS "read_own_or_staff_students" ON public.students;
CREATE POLICY "read_own_or_staff_students" ON public.students
  FOR SELECT TO authenticated
  USING (profile_id = auth.uid() OR public.current_user_role() IN ('admin', 'guru'));

DROP POLICY IF EXISTS "admin_manage_students" ON public.students;
CREATE POLICY "admin_manage_students" ON public.students
  FOR ALL TO authenticated
  USING (public.current_user_role() = 'admin')
  WITH CHECK (public.current_user_role() = 'admin');

-- Kebijakan: questions (KETAT: Siswa TIDAK BOLEH membaca tabel questions agar kunci jawaban aman!)
DROP POLICY IF EXISTS "staff_read_questions" ON public.questions;
CREATE POLICY "staff_read_questions" ON public.questions
  FOR SELECT TO authenticated
  USING (public.current_user_role() IN ('admin', 'guru'));

DROP POLICY IF EXISTS "admin_manage_questions" ON public.questions;
CREATE POLICY "admin_manage_questions" ON public.questions
  FOR ALL TO authenticated
  USING (public.current_user_role() = 'admin')
  WITH CHECK (public.current_user_role() = 'admin');

DROP POLICY IF EXISTS "guru_manage_subject_questions" ON public.questions;
CREATE POLICY "guru_manage_subject_questions" ON public.questions
  FOR ALL TO authenticated
  USING (
    public.current_user_role() = 'guru'
    AND (
      created_by = auth.uid()
      OR subject_id IN (SELECT subject_id FROM public.teachers WHERE profile_id = auth.uid() AND subject_id IS NOT NULL)
    )
  )
  WITH CHECK (
    public.current_user_role() = 'guru'
    AND (
      subject_id IN (SELECT subject_id FROM public.teachers WHERE profile_id = auth.uid() AND subject_id IS NOT NULL)
      OR created_by = auth.uid()
    )
  );

-- Kebijakan: exams (KETAT: Siswa mengakses jadwal lewat RPC get_student_exams agar token tidak bocor!)
DROP POLICY IF EXISTS "staff_read_exams" ON public.exams;
CREATE POLICY "staff_read_exams" ON public.exams
  FOR SELECT TO authenticated
  USING (public.current_user_role() IN ('admin', 'guru'));

DROP POLICY IF EXISTS "admin_manage_exams" ON public.exams;
CREATE POLICY "admin_manage_exams" ON public.exams
  FOR ALL TO authenticated
  USING (public.current_user_role() = 'admin')
  WITH CHECK (public.current_user_role() = 'admin');

DROP POLICY IF EXISTS "guru_manage_exams" ON public.exams;
CREATE POLICY "guru_manage_exams" ON public.exams
  FOR ALL TO authenticated
  USING (
    public.current_user_role() = 'guru'
    AND (created_by = auth.uid() OR teacher_id = public.current_teacher_id())
  )
  WITH CHECK (
    public.current_user_role() = 'guru'
    AND (created_by = auth.uid() OR teacher_id = public.current_teacher_id())
  );

-- Kebijakan: exam_questions
DROP POLICY IF EXISTS "staff_read_exam_questions" ON public.exam_questions;
CREATE POLICY "staff_read_exam_questions" ON public.exam_questions
  FOR SELECT TO authenticated
  USING (public.current_user_role() IN ('admin', 'guru'));

DROP POLICY IF EXISTS "admin_manage_exam_questions" ON public.exam_questions;
DROP POLICY IF EXISTS "staff_manage_exam_questions" ON public.exam_questions;
CREATE POLICY "admin_manage_exam_questions" ON public.exam_questions
  FOR ALL TO authenticated
  USING (public.current_user_role() = 'admin')
  WITH CHECK (public.current_user_role() = 'admin');

DROP POLICY IF EXISTS "guru_manage_exam_questions" ON public.exam_questions;
CREATE POLICY "guru_manage_exam_questions" ON public.exam_questions
  FOR ALL TO authenticated
  USING (
    public.current_user_role() = 'guru'
    AND exam_id IN (
      SELECT id FROM public.exams
      WHERE created_by = auth.uid() OR teacher_id = public.current_teacher_id()
    )
  )
  WITH CHECK (
    public.current_user_role() = 'guru'
    AND exam_id IN (
      SELECT id FROM public.exams
      WHERE created_by = auth.uid() OR teacher_id = public.current_teacher_id()
    )
  );

-- Kebijakan: exam_sessions (Siswa hanya baca miliknya; mutasi melalui RPC tervalidasi server)
DROP POLICY IF EXISTS "read_exam_sessions" ON public.exam_sessions;
CREATE POLICY "read_exam_sessions" ON public.exam_sessions
  FOR SELECT TO authenticated
  USING (
    student_id = public.current_student_id()
    OR public.current_user_role() = 'admin'
    OR (
      public.current_user_role() = 'guru'
      AND exam_id IN (
        SELECT id FROM public.exams
        WHERE created_by = auth.uid() OR teacher_id = public.current_teacher_id()
      )
    )
  );

DROP POLICY IF EXISTS "admin_manage_exam_sessions" ON public.exam_sessions;
DROP POLICY IF EXISTS "staff_manage_exam_sessions" ON public.exam_sessions;
CREATE POLICY "admin_manage_exam_sessions" ON public.exam_sessions
  FOR ALL TO authenticated
  USING (public.current_user_role() = 'admin')
  WITH CHECK (public.current_user_role() = 'admin');

DROP POLICY IF EXISTS "guru_manage_exam_sessions" ON public.exam_sessions;
CREATE POLICY "guru_manage_exam_sessions" ON public.exam_sessions
  FOR ALL TO authenticated
  USING (
    public.current_user_role() = 'guru'
    AND exam_id IN (
      SELECT id FROM public.exams
      WHERE created_by = auth.uid() OR teacher_id = public.current_teacher_id()
    )
  )
  WITH CHECK (
    public.current_user_role() = 'guru'
    AND exam_id IN (
      SELECT id FROM public.exams
      WHERE created_by = auth.uid() OR teacher_id = public.current_teacher_id()
    )
  );

-- Kebijakan: answers (Siswa hanya baca miliknya; mutasi melalui RPC save_student_answer)
DROP POLICY IF EXISTS "read_answers" ON public.answers;
CREATE POLICY "read_answers" ON public.answers
  FOR SELECT TO authenticated
  USING (
    public.current_user_role() = 'admin'
    OR session_id IN (SELECT id FROM public.exam_sessions WHERE student_id = public.current_student_id())
    OR (
      public.current_user_role() = 'guru'
      AND session_id IN (
        SELECT es.id FROM public.exam_sessions es
        JOIN public.exams e ON e.id = es.exam_id
        WHERE e.created_by = auth.uid() OR e.teacher_id = public.current_teacher_id()
      )
    )
  );

DROP POLICY IF EXISTS "staff_grade_answers" ON public.answers;
CREATE POLICY "staff_grade_answers" ON public.answers
  FOR UPDATE TO authenticated
  USING (
    public.current_user_role() = 'admin'
    OR (
      public.current_user_role() = 'guru'
      AND session_id IN (
        SELECT es.id FROM public.exam_sessions es
        JOIN public.exams e ON e.id = es.exam_id
        WHERE e.created_by = auth.uid() OR e.teacher_id = public.current_teacher_id()
      )
    )
  )
  WITH CHECK (
    public.current_user_role() = 'admin'
    OR (
      public.current_user_role() = 'guru'
      AND session_id IN (
        SELECT es.id FROM public.exam_sessions es
        JOIN public.exams e ON e.id = es.exam_id
        WHERE e.created_by = auth.uid() OR e.teacher_id = public.current_teacher_id()
      )
    )
  );

-- Kebijakan: results (Siswa HANYA bisa melihat nilai jika is_published = true)
DROP POLICY IF EXISTS "student_read_published_results" ON public.results;
CREATE POLICY "student_read_published_results" ON public.results
  FOR SELECT TO authenticated
  USING (
    public.current_user_role() = 'admin'
    OR (student_id = public.current_student_id() AND is_published = true)
    OR (
      public.current_user_role() = 'guru'
      AND exam_id IN (
        SELECT id FROM public.exams
        WHERE created_by = auth.uid() OR teacher_id = public.current_teacher_id()
      )
    )
  );

DROP POLICY IF EXISTS "admin_manage_results" ON public.results;
DROP POLICY IF EXISTS "staff_manage_results" ON public.results;
CREATE POLICY "admin_manage_results" ON public.results
  FOR ALL TO authenticated
  USING (public.current_user_role() = 'admin')
  WITH CHECK (public.current_user_role() = 'admin');

DROP POLICY IF EXISTS "guru_manage_results" ON public.results;
CREATE POLICY "guru_manage_results" ON public.results
  FOR ALL TO authenticated
  USING (
    public.current_user_role() = 'guru'
    AND exam_id IN (
      SELECT id FROM public.exams
      WHERE created_by = auth.uid() OR teacher_id = public.current_teacher_id()
    )
  )
  WITH CHECK (
    public.current_user_role() = 'guru'
    AND exam_id IN (
      SELECT id FROM public.exams
      WHERE created_by = auth.uid() OR teacher_id = public.current_teacher_id()
    )
  );

-- ----------------------------------------------------------------------------
-- 7. SERVER-SIDE VALIDATION RPCs (ANTI-CHEAT & VALIDASI TOKEN/WAKTU)
-- ----------------------------------------------------------------------------

-- 7.1 Resolusi username/email untuk login siswa, guru, dan admin
CREATE OR REPLACE FUNCTION public.resolve_login_email(p_identifier TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email TEXT;
BEGIN
  SELECT email INTO v_email
  FROM public.profiles
  WHERE (LOWER(username) = LOWER(TRIM(p_identifier)) OR LOWER(email) = LOWER(TRIM(p_identifier)))
    AND is_active = true
  LIMIT 1;

  RETURN v_email;
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_login_email(TEXT) TO anon, authenticated;

-- 7.2 Ambil daftar ujian khusus untuk siswa yang sedang login (tanpa kolom token!)
CREATE OR REPLACE FUNCTION public.get_student_exams()
RETURNS TABLE (
  exam_id UUID,
  title TEXT,
  description TEXT,
  subject_id UUID,
  subject_name TEXT,
  subject_code TEXT,
  class_id UUID,
  class_name TEXT,
  academic_year_name TEXT,
  semester TEXT,
  teacher_name TEXT,
  duration_minutes INT,
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  token_active BOOLEAN,
  results_published BOOLEAN,
  question_count BIGINT,
  session_id UUID,
  session_status TEXT,
  session_started_at TIMESTAMPTZ,
  session_expires_at TIMESTAMPTZ,
  session_submitted_at TIMESTAMPTZ,
  final_score NUMERIC,
  pg_score NUMERIC,
  essay_score NUMERIC,
  grading_status TEXT,
  result_published BOOLEAN,
  server_now TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student_id UUID;
  v_class_id UUID;
BEGIN
  SELECT s.id, s.class_id INTO v_student_id, v_class_id
  FROM public.students s
  JOIN public.profiles p ON p.id = s.profile_id
  WHERE s.profile_id = auth.uid() AND p.is_active = true
  LIMIT 1;

  IF v_student_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    e.id AS exam_id,
    e.title,
    e.description,
    e.subject_id,
    sub.name AS subject_name,
    sub.code AS subject_code,
    e.class_id,
    c.name AS class_name,
    ay.name AS academic_year_name,
    ay.semester,
    COALESCE(tp.full_name, '-') AS teacher_name,
    e.duration_minutes,
    e.start_time,
    e.end_time,
    e.token_active,
    e.results_published,
    (SELECT COUNT(*) FROM public.exam_questions eq WHERE eq.exam_id = e.id) AS question_count,
    es.id AS session_id,
    es.status AS session_status,
    es.started_at AS session_started_at,
    es.expires_at AS session_expires_at,
    es.submitted_at AS session_submitted_at,
    CASE WHEN r.is_published = true THEN r.final_score ELSE NULL END AS final_score,
    CASE WHEN r.is_published = true THEN r.pg_score ELSE NULL END AS pg_score,
    CASE WHEN r.is_published = true THEN r.essay_score ELSE NULL END AS essay_score,
    r.grading_status,
    COALESCE(r.is_published, false) AS result_published,
    NOW() AS server_now
  FROM public.exams e
  JOIN public.subjects sub ON sub.id = e.subject_id
  JOIN public.classes c ON c.id = e.class_id
  JOIN public.academic_years ay ON ay.id = e.academic_year_id
  LEFT JOIN public.teachers t ON t.id = e.teacher_id
  LEFT JOIN public.profiles tp ON tp.id = t.profile_id
  LEFT JOIN public.exam_sessions es ON es.exam_id = e.id AND es.student_id = v_student_id
  LEFT JOIN public.results r ON r.exam_id = e.id AND r.student_id = v_student_id
  WHERE e.class_id = v_class_id
    AND e.is_published = true
  ORDER BY e.start_time DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_student_exams() TO authenticated;

-- 7.3 Mulai / Lanjutkan Sesi Ujian dengan Validasi Token, Jadwal, dan Durasi di Server
CREATE OR REPLACE FUNCTION public.start_exam_session(p_exam_id UUID, p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student RECORD;
  v_exam RECORD;
  v_session RECORD;
  v_expires_at TIMESTAMPTZ;
  v_order UUID[];
BEGIN
  SELECT s.id, s.class_id INTO v_student
  FROM public.students s
  JOIN public.profiles p ON p.id = s.profile_id
  WHERE s.profile_id = auth.uid() AND p.role = 'siswa' AND p.is_active = true
  LIMIT 1;

  IF v_student.id IS NULL THEN
    RAISE EXCEPTION 'Akun siswa tidak ditemukan atau tidak aktif.';
  END IF;

  SELECT * INTO v_exam FROM public.exams WHERE id = p_exam_id LIMIT 1;
  IF v_exam.id IS NULL THEN
    RAISE EXCEPTION 'Ujian tidak ditemukan.';
  END IF;

  IF v_exam.is_published = false THEN
    RAISE EXCEPTION 'Ujian belum dipublikasikan.';
  END IF;

  IF v_exam.class_id <> v_student.class_id THEN
    RAISE EXCEPTION 'Ujian ini tidak ditujukan untuk kelas Anda.';
  END IF;

  IF NOW() < v_exam.start_time THEN
    RAISE EXCEPTION 'Jadwal ujian belum dimulai.';
  END IF;

  IF NOW() > v_exam.end_time THEN
    RAISE EXCEPTION 'Jadwal ujian sudah berakhir.';
  END IF;

  IF v_exam.token_active = true THEN
    IF p_token IS NULL OR UPPER(TRIM(p_token)) <> UPPER(TRIM(v_exam.token)) THEN
      RAISE EXCEPTION 'Token ujian tidak valid. Periksa kembali token dari pengawas atau admin.';
    END IF;
  END IF;

  SELECT * INTO v_session
  FROM public.exam_sessions
  WHERE exam_id = p_exam_id AND student_id = v_student.id
  LIMIT 1;

  IF v_session.id IS NOT NULL THEN
    IF v_session.status IN ('submitted', 'expired') THEN
      RAISE EXCEPTION 'Anda sudah menyelesaikan ujian ini.';
    END IF;

    IF NOW() > v_session.expires_at THEN
      PERFORM public.submit_exam_session(v_session.id);
      RETURN jsonb_build_object(
        'expired', true,
        'session_id', v_session.id,
        'message', 'Waktu pengerjaan ujian Anda telah habis dan jawaban telah dikumpulkan.'
      );
    END IF;

    RETURN jsonb_build_object(
      'expired', false,
      'session_id', v_session.id,
      'started_at', v_session.started_at,
      'expires_at', v_session.expires_at,
      'server_now', NOW(),
      'resumed', true
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.exam_questions WHERE exam_id = p_exam_id) THEN
    RAISE EXCEPTION 'Belum ada soal yang ditambahkan ke ujian ini.';
  END IF;

  IF v_exam.shuffle_questions THEN
    SELECT ARRAY_AGG(eq.question_id ORDER BY random()) INTO v_order
    FROM public.exam_questions eq
    WHERE eq.exam_id = p_exam_id;
  ELSE
    SELECT ARRAY_AGG(eq.question_id ORDER BY eq.question_order ASC) INTO v_order
    FROM public.exam_questions eq
    WHERE eq.exam_id = p_exam_id;
  END IF;

  v_expires_at := LEAST(
    NOW() + make_interval(mins => v_exam.duration_minutes),
    v_exam.end_time
  );

  INSERT INTO public.exam_sessions (
    exam_id, student_id, started_at, expires_at, status, question_order, last_activity_at
  )
  VALUES (
    p_exam_id, v_student.id, NOW(), v_expires_at, 'in_progress', v_order, NOW()
  )
  RETURNING * INTO v_session;

  RETURN jsonb_build_object(
    'expired', false,
    'session_id', v_session.id,
    'started_at', v_session.started_at,
    'expires_at', v_session.expires_at,
    'server_now', NOW(),
    'resumed', false
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.start_exam_session(UUID, TEXT) TO authenticated;

-- 7.4 Ambil soal ujian untuk siswa (tanpa kunci jawaban & rubrik essay)
CREATE OR REPLACE FUNCTION public.get_exam_questions_for_student(p_session_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student_id UUID;
  v_session RECORD;
  v_exam RECORD;
  v_questions JSONB;
  v_answers JSONB;
BEGIN
  v_student_id := public.current_student_id();
  IF v_student_id IS NULL THEN
    RAISE EXCEPTION 'Akses ditolak.';
  END IF;

  SELECT * INTO v_session
  FROM public.exam_sessions
  WHERE id = p_session_id AND student_id = v_student_id
  LIMIT 1;

  IF v_session.id IS NULL THEN
    RAISE EXCEPTION 'Sesi ujian tidak ditemukan.';
  END IF;

  IF v_session.status = 'in_progress' AND NOW() > v_session.expires_at THEN
    PERFORM public.submit_exam_session(v_session.id);
    RETURN jsonb_build_object(
      'expired', true,
      'message', 'Waktu pengerjaan telah berakhir dan jawaban Anda telah dikumpulkan.'
    );
  END IF;

  IF v_session.status <> 'in_progress' THEN
    RETURN jsonb_build_object(
      'expired', true,
      'message', 'Sesi ujian sudah berakhir.'
    );
  END IF;

  SELECT e.id, e.title, e.description, e.duration_minutes, e.start_time, e.end_time,
         sub.name AS subject_name, c.name AS class_name
  INTO v_exam
  FROM public.exams e
  JOIN public.subjects sub ON sub.id = e.subject_id
  JOIN public.classes c ON c.id = e.class_id
  WHERE e.id = v_session.exam_id;

  SELECT COALESCE(jsonb_agg(q_row ORDER BY ord), '[]'::jsonb) INTO v_questions
  FROM (
    SELECT
      COALESCE(array_position(v_session.question_order, eq.question_id), eq.question_order) AS ord,
      jsonb_build_object(
        'id', q.id,
        'question_type', q.question_type,
        'question_text', q.question_text,
        'image_url', q.image_url,
        'option_a', q.option_a,
        'option_b', q.option_b,
        'option_c', q.option_c,
        'option_d', q.option_d,
        'points', eq.points
      ) AS q_row
    FROM public.exam_questions eq
    JOIN public.questions q ON q.id = eq.question_id
    WHERE eq.exam_id = v_session.exam_id
  ) subq;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'question_id', a.question_id,
      'selected_option', a.selected_option,
      'essay_answer', a.essay_answer,
      'is_flagged', a.is_flagged,
      'answered_at', a.answered_at
    )
  ), '[]'::jsonb) INTO v_answers
  FROM public.answers a
  WHERE a.session_id = v_session.id;

  RETURN jsonb_build_object(
    'expired', false,
    'session', jsonb_build_object(
      'id', v_session.id,
      'exam_id', v_session.exam_id,
      'started_at', v_session.started_at,
      'expires_at', v_session.expires_at,
      'server_now', NOW()
    ),
    'exam', to_jsonb(v_exam),
    'questions', v_questions,
    'answers', v_answers
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_exam_questions_for_student(UUID) TO authenticated;

-- 7.5 Autosave jawaban siswa
CREATE OR REPLACE FUNCTION public.save_student_answer(
  p_session_id UUID,
  p_question_id UUID,
  p_selected_option TEXT DEFAULT NULL,
  p_essay_answer TEXT DEFAULT NULL,
  p_is_flagged BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student_id UUID;
  v_session RECORD;
BEGIN
  v_student_id := public.current_student_id();
  IF v_student_id IS NULL THEN
    RAISE EXCEPTION 'Akses ditolak.';
  END IF;

  SELECT * INTO v_session
  FROM public.exam_sessions
  WHERE id = p_session_id AND student_id = v_student_id
  LIMIT 1;

  IF v_session.id IS NULL THEN
    RAISE EXCEPTION 'Sesi ujian tidak ditemukan.';
  END IF;

  IF v_session.status <> 'in_progress' THEN
    RETURN jsonb_build_object('saved', false, 'expired', true, 'message', 'Sesi ujian sudah ditutup.');
  END IF;

  IF NOW() > v_session.expires_at + INTERVAL '30 seconds' THEN
    PERFORM public.submit_exam_session(v_session.id);
    RETURN jsonb_build_object('saved', false, 'expired', true, 'message', 'Waktu pengerjaan telah berakhir.');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.exam_questions
    WHERE exam_id = v_session.exam_id AND question_id = p_question_id
  ) THEN
    RAISE EXCEPTION 'Soal tidak terdaftar dalam ujian ini.';
  END IF;

  IF p_selected_option IS NOT NULL AND p_selected_option NOT IN ('A', 'B', 'C', 'D') THEN
    RAISE EXCEPTION 'Pilihan jawaban tidak valid.';
  END IF;

  INSERT INTO public.answers (
    session_id, question_id, selected_option, essay_answer, is_flagged, answered_at
  )
  VALUES (
    p_session_id, p_question_id, p_selected_option, p_essay_answer, COALESCE(p_is_flagged, false), NOW()
  )
  ON CONFLICT (session_id, question_id)
  DO UPDATE SET
    selected_option = EXCLUDED.selected_option,
    essay_answer = EXCLUDED.essay_answer,
    is_flagged = EXCLUDED.is_flagged,
    answered_at = NOW();

  UPDATE public.exam_sessions
  SET last_activity_at = NOW()
  WHERE id = p_session_id;

  RETURN jsonb_build_object('saved', true, 'expired', false, 'saved_at', NOW());
END;
$$;

GRANT EXECUTE ON FUNCTION public.save_student_answer(UUID, UUID, TEXT, TEXT, BOOLEAN) TO authenticated;

-- 7.6 Akhiri Ujian & Penilaian Otomatis Soal Pilihan Ganda di Server
CREATE OR REPLACE FUNCTION public.submit_exam_session(p_session_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
  v_student_id UUID;
  v_session RECORD;
  v_exam RECORD;
  v_total_questions INT := 0;
  v_pg_total INT := 0;
  v_pg_correct INT := 0;
  v_pg_points_total NUMERIC := 0;
  v_pg_points_earned NUMERIC := 0;
  v_essay_count INT := 0;
  v_pg_score NUMERIC(5,2) := 0;
  v_final_score NUMERIC(5,2) := 0;
  v_grading_status TEXT := 'auto_graded';
BEGIN
  v_role := public.current_user_role();
  v_student_id := public.current_student_id();

  SELECT * INTO v_session FROM public.exam_sessions WHERE id = p_session_id LIMIT 1;
  IF v_session.id IS NULL THEN
    RAISE EXCEPTION 'Sesi ujian tidak ditemukan.';
  END IF;

  IF v_role NOT IN ('admin', 'guru') AND v_session.student_id <> v_student_id THEN
    RAISE EXCEPTION 'Anda tidak memiliki izin mengakhiri sesi ini.';
  END IF;

  SELECT * INTO v_exam FROM public.exams WHERE id = v_session.exam_id LIMIT 1;

  IF v_session.status = 'in_progress' THEN
    UPDATE public.exam_sessions
    SET status = 'submitted',
        submitted_at = NOW(),
        last_activity_at = NOW()
    WHERE id = p_session_id;
  END IF;

  -- Evaluasi jawaban PG secara aman di server
  UPDATE public.answers a
  SET is_correct = (a.selected_option IS NOT NULL AND a.selected_option = q.correct_option)
  FROM public.questions q
  WHERE a.session_id = p_session_id
    AND a.question_id = q.id
    AND q.question_type = 'pg';

  SELECT
    COUNT(*)::INT,
    COUNT(*) FILTER (WHERE q.question_type = 'pg')::INT,
    COUNT(*) FILTER (WHERE q.question_type = 'essay')::INT,
    COALESCE(SUM(eq.points) FILTER (WHERE q.question_type = 'pg'), 0),
    COALESCE(SUM(
      CASE
        WHEN q.question_type = 'pg' AND a.selected_option IS NOT NULL AND a.selected_option = q.correct_option
        THEN eq.points ELSE 0
      END
    ), 0),
    COUNT(*) FILTER (
      WHERE q.question_type = 'pg' AND a.selected_option IS NOT NULL AND a.selected_option = q.correct_option
    )::INT
  INTO v_total_questions, v_pg_total, v_essay_count, v_pg_points_total, v_pg_points_earned, v_pg_correct
  FROM public.exam_questions eq
  JOIN public.questions q ON q.id = eq.question_id
  LEFT JOIN public.answers a ON a.session_id = p_session_id AND a.question_id = q.id
  WHERE eq.exam_id = v_session.exam_id;

  IF v_pg_points_total > 0 THEN
    v_pg_score := ROUND((v_pg_points_earned / v_pg_points_total) * 100, 2);
  END IF;

  IF v_essay_count > 0 THEN
    v_grading_status := 'needs_essay_grading';
    v_final_score := ROUND((v_pg_score * v_exam.pg_weight_percent / 100.0), 2);
  ELSE
    v_grading_status := 'auto_graded';
    v_final_score := v_pg_score;
  END IF;

  INSERT INTO public.results (
    exam_id, session_id, student_id, total_questions, pg_correct_count,
    pg_total_count, pg_score, essay_score, final_score, grading_status, is_published
  )
  VALUES (
    v_session.exam_id, p_session_id, v_session.student_id, v_total_questions, v_pg_correct,
    v_pg_total, v_pg_score, 0, v_final_score, v_grading_status, v_exam.results_published
  )
  ON CONFLICT (exam_id, student_id)
  DO UPDATE SET
    total_questions = EXCLUDED.total_questions,
    pg_correct_count = EXCLUDED.pg_correct_count,
    pg_total_count = EXCLUDED.pg_total_count,
    pg_score = EXCLUDED.pg_score,
    final_score = EXCLUDED.final_score,
    grading_status = EXCLUDED.grading_status;

  RETURN jsonb_build_object(
    'submitted', true,
    'submitted_at', NOW(),
    'results_published', v_exam.results_published,
    'final_score', CASE WHEN v_exam.results_published THEN v_final_score ELSE NULL END
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_exam_session(UUID) TO authenticated;

-- 7.7 Hitung Ulang Nilai Setelah Guru Menilai Essay
CREATE OR REPLACE FUNCTION public.recalculate_exam_result(p_session_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
  v_session RECORD;
  v_exam RECORD;
  v_pg_score NUMERIC(5,2) := 0;
  v_essay_points_total NUMERIC := 0;
  v_essay_weighted_sum NUMERIC := 0;
  v_essay_score NUMERIC(5,2) := 0;
  v_final_score NUMERIC(5,2) := 0;
  v_essay_count INT := 0;
  v_pg_count INT := 0;
BEGIN
  v_role := public.current_user_role();
  IF v_role NOT IN ('admin', 'guru') THEN
    RAISE EXCEPTION 'Hanya admin atau guru yang dapat menghitung ulang nilai.';
  END IF;

  SELECT * INTO v_session FROM public.exam_sessions WHERE id = p_session_id LIMIT 1;
  IF v_session.id IS NULL THEN
    RAISE EXCEPTION 'Sesi ujian tidak ditemukan.';
  END IF;

  SELECT * INTO v_exam FROM public.exams WHERE id = v_session.exam_id LIMIT 1;

  SELECT
    COUNT(*) FILTER (WHERE q.question_type = 'pg')::INT,
    COUNT(*) FILTER (WHERE q.question_type = 'essay')::INT,
    COALESCE(SUM(eq.points) FILTER (WHERE q.question_type = 'essay'), 0),
    COALESCE(SUM(
      CASE
        WHEN q.question_type = 'essay' THEN COALESCE(a.essay_score, 0) * eq.points
        ELSE 0
      END
    ), 0)
  INTO v_pg_count, v_essay_count, v_essay_points_total, v_essay_weighted_sum
  FROM public.exam_questions eq
  JOIN public.questions q ON q.id = eq.question_id
  LEFT JOIN public.answers a ON a.session_id = p_session_id AND a.question_id = q.id
  WHERE eq.exam_id = v_session.exam_id;

  SELECT COALESCE(pg_score, 0) INTO v_pg_score
  FROM public.results
  WHERE session_id = p_session_id;

  IF v_essay_points_total > 0 THEN
    v_essay_score := ROUND(v_essay_weighted_sum / v_essay_points_total, 2);
  END IF;

  IF v_pg_count > 0 AND v_essay_count > 0 THEN
    v_final_score := ROUND(
      (v_pg_score * v_exam.pg_weight_percent / 100.0) +
      (v_essay_score * v_exam.essay_weight_percent / 100.0),
      2
    );
  ELSIF v_essay_count > 0 THEN
    v_final_score := v_essay_score;
  ELSE
    v_final_score := v_pg_score;
  END IF;

  UPDATE public.results
  SET essay_score = v_essay_score,
      final_score = v_final_score,
      grading_status = 'graded',
      graded_by = auth.uid(),
      graded_at = NOW()
  WHERE session_id = p_session_id;

  RETURN jsonb_build_object(
    'pg_score', v_pg_score,
    'essay_score', v_essay_score,
    'final_score', v_final_score
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.recalculate_exam_result(UUID) TO authenticated;

-- ----------------------------------------------------------------------------
-- 8. SUPABASE STORAGE UNTUK GAMBAR SOAL
-- ----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('question-images', 'question-images', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "public_view_question_images" ON storage.objects;
CREATE POLICY "public_view_question_images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'question-images');

DROP POLICY IF EXISTS "staff_upload_question_images" ON storage.objects;
CREATE POLICY "staff_upload_question_images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'question-images'
  AND public.current_user_role() IN ('admin', 'guru')
);

DROP POLICY IF EXISTS "staff_delete_question_images" ON storage.objects;
CREATE POLICY "staff_delete_question_images"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'question-images'
  AND public.current_user_role() IN ('admin', 'guru')
);

-- ----------------------------------------------------------------------------
-- 9. DATA AWAL SEKOLAH (OPSIONAL, AMAN DIJALANKAN ULANG)
-- ----------------------------------------------------------------------------
INSERT INTO public.academic_years (name, semester, is_active)
SELECT '2025/2026', 'Ganjil', true
WHERE NOT EXISTS (SELECT 1 FROM public.academic_years);

INSERT INTO public.school_settings (school_name, npsn, address, headmaster_name, headmaster_nip, academic_year_active_id)
SELECT
  'SMP Negeri 2 Sukaresmi',
  '20203892',
  'Jl. Raya Sukaresmi, Kecamatan Sukaresmi, Kabupaten Cianjur, Jawa Barat',
  'Drs. H. Ahmad Fauzi, M.Pd.',
  '196805121994121002',
  (SELECT id FROM public.academic_years WHERE is_active = true LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM public.school_settings);
