import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckSquare,
  Copy,
  KeyRound,
  ListChecks,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from 'lucide-react';
import { getSupabaseClient } from '../../lib/supabase';
import { formatDateTimeID } from '../../lib/exportReports';
import type {
  AcademicYear,
  Exam,
  Question,
  SchoolClass,
  Subject,
  Teacher,
} from '../../types/database';

interface ExamManagementPanelProps {
  subjects: Subject[];
  classes: SchoolClass[];
  academicYears: AcademicYear[];
  teachers: Teacher[];
  currentUserId: string;
  currentTeacherId?: string | null;
  restrictToTeacherId?: string | null;
  onChanged?: () => Promise<void>;
}

function generateToken(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 6; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

function toDatetimeLocalValue(iso: string | null | undefined): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const tzOffset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - tzOffset).toISOString().slice(0, 16);
}

interface ExamFormState {
  id?: string;
  title: string;
  description: string;
  subject_id: string;
  class_id: string;
  academic_year_id: string;
  teacher_id: string;
  duration_minutes: string;
  start_time: string;
  end_time: string;
  token: string;
  token_active: boolean;
  shuffle_questions: boolean;
  is_published: boolean;
  results_published: boolean;
  pg_weight_percent: string;
  essay_weight_percent: string;
}

export const ExamManagementPanel: React.FC<ExamManagementPanelProps> = ({
  subjects,
  classes,
  academicYears,
  teachers,
  currentUserId,
  currentTeacherId,
  restrictToTeacherId,
  onChanged,
}) => {
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // State modal pilih soal ujian
  const [questionModalExam, setQuestionModalExam] = useState<Exam | null>(null);
  const [bankQuestions, setBankQuestions] = useState<Question[]>([]);
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<Record<string, number>>({});
  const [savingQuestions, setSavingQuestions] = useState(false);

  const activeYearId = useMemo(
    () => academicYears.find((a) => a.is_active)?.id || academicYears[0]?.id || '',
    [academicYears]
  );

  const [form, setForm] = useState<ExamFormState>({
    title: '',
    description: '',
    subject_id: subjects[0]?.id || '',
    class_id: classes[0]?.id || '',
    academic_year_id: activeYearId,
    teacher_id: currentTeacherId || teachers[0]?.id || '',
    duration_minutes: '90',
    start_time: '',
    end_time: '',
    token: generateToken(),
    token_active: true,
    shuffle_questions: true,
    is_published: true,
    results_published: false,
    pg_weight_percent: '70',
    essay_weight_percent: '30',
  });

  const loadExams = async () => {
    setLoading(true);
    setError(null);
    try {
      const supabase = getSupabaseClient();
      let query = supabase
        .from('exams')
        .select(
          '*, subjects(*), classes(*), academic_years(*), teachers(*, profiles(*)), exam_questions(id, question_id, question_order, points)'
        )
        .order('start_time', { ascending: false });

      if (restrictToTeacherId) {
        query = query.or(`teacher_id.eq.${restrictToTeacherId},created_by.eq.${currentUserId}`);
      }

      const { data, error: fetchErr } = await query;
      if (fetchErr) throw fetchErr;
      setExams((data as Exam[]) || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat jadwal ujian.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadExams();
  }, [restrictToTeacherId, currentUserId]);

  const openCreateModal = () => {
    const now = new Date();
    const later = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    setForm({
      title: '',
      description: '',
      subject_id: subjects[0]?.id || '',
      class_id: classes[0]?.id || '',
      academic_year_id: activeYearId,
      teacher_id: currentTeacherId || teachers[0]?.id || '',
      duration_minutes: '90',
      start_time: toDatetimeLocalValue(now.toISOString()),
      end_time: toDatetimeLocalValue(later.toISOString()),
      token: generateToken(),
      token_active: true,
      shuffle_questions: true,
      is_published: true,
      results_published: false,
      pg_weight_percent: '70',
      essay_weight_percent: '30',
    });
    setModalOpen(true);
  };

  const openEditModal = (exam: Exam) => {
    setForm({
      id: exam.id,
      title: exam.title,
      description: exam.description || '',
      subject_id: exam.subject_id,
      class_id: exam.class_id,
      academic_year_id: exam.academic_year_id,
      teacher_id: exam.teacher_id || '',
      duration_minutes: String(exam.duration_minutes),
      start_time: toDatetimeLocalValue(exam.start_time),
      end_time: toDatetimeLocalValue(exam.end_time),
      token: exam.token,
      token_active: exam.token_active,
      shuffle_questions: exam.shuffle_questions,
      is_published: exam.is_published,
      results_published: exam.results_published,
      pg_weight_percent: String(exam.pg_weight_percent),
      essay_weight_percent: String(exam.essay_weight_percent),
    });
    setModalOpen(true);
  };

  const handleSaveExam = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!form.title.trim()) {
      setError('Judul ujian wajib diisi.');
      return;
    }
    if (!form.subject_id || !form.class_id || !form.academic_year_id) {
      setError('Mata pelajaran, kelas, dan tahun pelajaran wajib dipilih.');
      return;
    }
    const start = new Date(form.start_time);
    const end = new Date(form.end_time);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
      setError('Waktu selesai ujian harus lebih akhir dari waktu mulai.');
      return;
    }

    const pgW = Number(form.pg_weight_percent) || 0;
    const essayW = Number(form.essay_weight_percent) || 0;
    if (pgW + essayW !== 100) {
      setError('Total bobot Pilihan Ganda dan Essay harus 100%.');
      return;
    }

    setSaving(true);
    try {
      const supabase = getSupabaseClient();
      const payload = {
        title: form.title.trim(),
        description: form.description.trim() || null,
        subject_id: form.subject_id,
        class_id: form.class_id,
        academic_year_id: form.academic_year_id,
        teacher_id: form.teacher_id || null,
        duration_minutes: Math.max(5, Number(form.duration_minutes) || 60),
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        token: (form.token.trim() || generateToken()).toUpperCase(),
        token_active: form.token_active,
        shuffle_questions: form.shuffle_questions,
        is_published: form.is_published,
        results_published: form.results_published,
        pg_weight_percent: pgW,
        essay_weight_percent: essayW,
      };

      if (form.id) {
        const { error: updErr } = await supabase.from('exams').update(payload).eq('id', form.id);
        if (updErr) throw updErr;
        // Sinkronkan status publikasi hasil jika diubah
        await supabase
          .from('results')
          .update({ is_published: form.results_published })
          .eq('exam_id', form.id);
      } else {
        const { error: insErr } = await supabase
          .from('exams')
          .insert({ ...payload, created_by: currentUserId });
        if (insErr) throw insErr;
      }

      setModalOpen(false);
      await loadExams();
      if (onChanged) await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan jadwal ujian.');
    } finally {
      setSaving(false);
    }
  };

  const handleRegenerateToken = async (exam: Exam) => {
    const newToken = generateToken();
    try {
      const supabase = getSupabaseClient();
      const { error: updErr } = await supabase
        .from('exams')
        .update({ token: newToken, token_active: true })
        .eq('id', exam.id);
      if (updErr) throw updErr;
      await loadExams();
      if (onChanged) await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memperbarui token.');
    }
  };

  const handleCopyToken = async (examId: string, token: string) => {
    try {
      await navigator.clipboard.writeText(token);
      setCopiedId(examId);
      setTimeout(() => setCopiedId(null), 1800);
    } catch {
      // Abaikan jika clipboard diblokir browser
    }
  };

  const handleToggleResultsPublished = async (exam: Exam) => {
    const nextState = !exam.results_published;
    try {
      const supabase = getSupabaseClient();
      const { error: updErr } = await supabase
        .from('exams')
        .update({ results_published: nextState })
        .eq('id', exam.id);
      if (updErr) throw updErr;
      await supabase
        .from('results')
        .update({ is_published: nextState })
        .eq('exam_id', exam.id);
      await loadExams();
      if (onChanged) await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal mengubah status pengumuman nilai.');
    }
  };

  const handleDeleteExam = async (exam: Exam) => {
    try {
      const supabase = getSupabaseClient();
      const { error: delErr } = await supabase.from('exams').delete().eq('id', exam.id);
      if (delErr) throw delErr;
      await loadExams();
      if (onChanged) await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menghapus ujian.');
    }
  };

  const openAssignQuestions = async (exam: Exam) => {
    setError(null);
    setQuestionModalExam(exam);
    try {
      const supabase = getSupabaseClient();
      const { data: qData, error: qErr } = await supabase
        .from('questions')
        .select('*')
        .eq('subject_id', exam.subject_id)
        .order('created_at', { ascending: false });
      if (qErr) throw qErr;
      setBankQuestions((qData as Question[]) || []);

      const map: Record<string, number> = {};
      (exam.exam_questions || []).forEach((eq) => {
        map[eq.question_id] = eq.points;
      });
      setSelectedQuestionIds(map);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat daftar soal.');
    }
  };

  const toggleQuestionPick = (question: Question) => {
    setSelectedQuestionIds((prev) => {
      const next = { ...prev };
      if (next[question.id] !== undefined) {
        delete next[question.id];
      } else {
        next[question.id] = Number(question.weight) || 1;
      }
      return next;
    });
  };

  const saveAssignedQuestions = async () => {
    if (!questionModalExam) return;
    setSavingQuestions(true);
    setError(null);
    try {
      const supabase = getSupabaseClient();
      const { error: delErr } = await supabase
        .from('exam_questions')
        .delete()
        .eq('exam_id', questionModalExam.id);
      if (delErr) throw delErr;

      const entries = Object.entries(selectedQuestionIds);
      if (entries.length > 0) {
        const rows = entries.map(([questionId, points], index) => ({
          exam_id: questionModalExam.id,
          question_id: questionId,
          question_order: index + 1,
          points: Number(points) || 1,
        }));
        const { error: insErr } = await supabase.from('exam_questions').insert(rows);
        if (insErr) throw insErr;
      }

      setQuestionModalExam(null);
      await loadExams();
      if (onChanged) await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan daftar soal ujian.');
    } finally {
      setSavingQuestions(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Jadwal & Token Ujian Semester</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Atur waktu pelaksanaan, durasi pengerjaan, token akses siswa, dan paket soal ujian.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreateModal}
          disabled={subjects.length === 0 || classes.length === 0 || academicYears.length === 0}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-900 hover:bg-blue-950 disabled:opacity-50 text-white text-sm font-semibold rounded-lg whitespace-nowrap shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Buat Jadwal Ujian</span>
        </button>
      </div>

      {error && (
        <div className="p-3.5 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
          {error}
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3].map((n) => (
              <div key={n} className="h-20 bg-slate-100 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : exams.length === 0 ? (
          <div className="p-10 text-center space-y-3">
            <p className="text-sm font-medium text-slate-700">Belum ada jadwal ujian dibuat.</p>
            <p className="text-xs text-slate-500">
              Buat jadwal ujian baru lalu pilih soal dari bank soal agar siswa dapat mengikuti ujian.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {exams.map((exam) => {
              const qCount = exam.exam_questions?.length || 0;
              return (
                <div
                  key={exam.id}
                  className="p-4 sm:p-5 flex flex-col xl:flex-row xl:items-center justify-between gap-4 hover:bg-slate-50/70 transition-colors"
                >
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <h3 className="text-sm font-bold text-slate-900">{exam.title}</h3>
                      <span className="text-xs text-slate-400" aria-hidden="true">
                        ·
                      </span>
                      <span className="text-xs font-medium text-blue-900">
                        {exam.subjects?.name || '-'}
                      </span>
                      <span className="text-xs text-slate-400" aria-hidden="true">
                        ·
                      </span>
                      <span className="text-xs text-slate-700">
                        Kelas {exam.classes?.name || '-'}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 tabular-nums">
                      <span>Mulai: {formatDateTimeID(exam.start_time)}</span>
                      <span aria-hidden="true">·</span>
                      <span>Selesai: {formatDateTimeID(exam.end_time)}</span>
                      <span aria-hidden="true">·</span>
                      <span>Durasi {exam.duration_minutes} menit</span>
                      <span aria-hidden="true">·</span>
                      <span>{qCount} soal terpasang</span>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-1 text-xs">
                      <span className={exam.is_published ? 'text-emerald-700 font-medium' : 'text-slate-500'}>
                        {exam.is_published ? 'Jadwal Terbit' : 'Draft Jadwal'}
                      </span>
                      <span className="text-slate-300" aria-hidden="true">
                        |
                      </span>
                      <button
                        type="button"
                        onClick={() => handleToggleResultsPublished(exam)}
                        className={`font-medium underline-offset-2 hover:underline ${
                          exam.results_published ? 'text-blue-900' : 'text-amber-700'
                        }`}
                      >
                        {exam.results_published
                          ? 'Nilai Diumumkan ke Siswa (Klik untuk Sembunyikan)'
                          : 'Nilai Belum Diumumkan (Klik untuk Umumkan)'}
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {/* Token Box */}
                    <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-100 border border-slate-200 rounded-lg">
                      <KeyRound className="w-3.5 h-3.5 text-slate-500" />
                      <span className="font-mono-tabular text-xs font-bold tracking-wider text-slate-900">
                        {exam.token}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCopyToken(exam.id, exam.token)}
                        title="Salin token"
                        className="p-1 text-slate-500 hover:text-slate-900"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRegenerateToken(exam)}
                        title="Acak token baru"
                        className="p-1 text-slate-500 hover:text-blue-900"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                      </button>
                      {copiedId === exam.id && (
                        <span className="text-[11px] text-emerald-700 font-medium">Tersalin</span>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => openAssignQuestions(exam)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-900 bg-blue-50 border border-blue-200 hover:bg-blue-100 rounded-lg whitespace-nowrap"
                    >
                      <ListChecks className="w-3.5 h-3.5" />
                      <span>Pilih Soal ({qCount})</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => openEditModal(exam)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg whitespace-nowrap"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      <span>Edit</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDeleteExam(exam)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-700 bg-white border border-red-200 hover:bg-red-50 rounded-lg whitespace-nowrap"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Hapus</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal Form Ujian */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-xl max-w-2xl w-full max-h-[92vh] flex flex-col overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900">
                {form.id ? 'Edit Jadwal Ujian' : 'Buat Jadwal Ujian Baru'}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1.5 text-slate-500 hover:text-slate-900 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveExam} className="p-5 space-y-4 overflow-y-auto">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Judul Ujian</label>
                <input
                  type="text"
                  required
                  value={form.title}
                  onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                  placeholder="Contoh: Penilaian Akhir Semester (PAS) Matematika"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Mata Pelajaran
                  </label>
                  <select
                    required
                    value={form.subject_id}
                    onChange={(e) => setForm((p) => ({ ...p, subject_id: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="">-- Pilih Mapel --</option>
                    {subjects.map((sub) => (
                      <option key={sub.id} value={sub.id}>
                        {sub.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Kelas Peserta
                  </label>
                  <select
                    required
                    value={form.class_id}
                    onChange={(e) => setForm((p) => ({ ...p, class_id: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="">-- Pilih Kelas --</option>
                    {classes.map((cls) => (
                      <option key={cls.id} value={cls.id}>
                        {cls.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Tahun Pelajaran
                  </label>
                  <select
                    required
                    value={form.academic_year_id}
                    onChange={(e) => setForm((p) => ({ ...p, academic_year_id: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="">-- Pilih Tahun --</option>
                    {academicYears.map((ay) => (
                      <option key={ay.id} value={ay.id}>
                        {ay.name} ({ay.semester})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Guru Pengampu
                  </label>
                  <select
                    value={form.teacher_id}
                    disabled={Boolean(restrictToTeacherId)}
                    onChange={(e) => setForm((p) => ({ ...p, teacher_id: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white disabled:bg-slate-100"
                  >
                    <option value="">-- Opsional --</option>
                    {teachers.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.profiles?.full_name || t.nip || t.id}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Waktu Mulai
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={form.start_time}
                    onChange={(e) => setForm((p) => ({ ...p, start_time: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Waktu Selesai
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={form.end_time}
                    onChange={(e) => setForm((p) => ({ ...p, end_time: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Durasi (Menit)
                  </label>
                  <input
                    type="number"
                    min="5"
                    max="300"
                    required
                    value={form.duration_minutes}
                    onChange={(e) => setForm((p) => ({ ...p, duration_minutes: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg tabular-nums"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Token Ujian
                  </label>
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      required
                      value={form.token}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, token: e.target.value.toUpperCase() }))
                      }
                      className="w-full px-3 py-2 text-sm font-mono-tabular uppercase border border-slate-300 rounded-lg"
                    />
                    <button
                      type="button"
                      onClick={() => setForm((p) => ({ ...p, token: generateToken() }))}
                      className="px-2.5 py-2 border border-slate-300 rounded-lg hover:bg-slate-100"
                      title="Acak token"
                    >
                      <RefreshCw className="w-4 h-4 text-slate-600" />
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Bobot PG (%)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={form.pg_weight_percent}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, pg_weight_percent: e.target.value }))
                    }
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Bobot Essay (%)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={form.essay_weight_percent}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, essay_weight_percent: e.target.value }))
                    }
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg tabular-nums"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.token_active}
                    onChange={(e) => setForm((p) => ({ ...p, token_active: e.target.checked }))}
                    className="rounded border-slate-300"
                  />
                  <span>Wajibkan verifikasi token</span>
                </label>

                <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.shuffle_questions}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, shuffle_questions: e.target.checked }))
                    }
                    className="rounded border-slate-300"
                  />
                  <span>Acak urutan soal per siswa</span>
                </label>

                <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.is_published}
                    onChange={(e) => setForm((p) => ({ ...p, is_published: e.target.checked }))}
                    className="rounded border-slate-300"
                  />
                  <span>Tampilkan jadwal ke siswa</span>
                </label>

                <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.results_published}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, results_published: e.target.checked }))
                    }
                    className="rounded border-slate-300"
                  />
                  <span>Umumkan nilai ke siswa</span>
                </label>
              </div>

              <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 text-sm font-semibold text-white bg-blue-900 hover:bg-blue-950 disabled:opacity-50 rounded-lg"
                >
                  {saving ? 'Menyimpan...' : 'Simpan Jadwal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Pilih Soal dari Bank Soal */}
      {questionModalExam && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-slate-900">
                  Pilih Soal — {questionModalExam.title}
                </h3>
                <p className="text-xs text-slate-500">
                  Mata Pelajaran: {questionModalExam.subjects?.name} ·{' '}
                  {Object.keys(selectedQuestionIds).length} soal dipilih
                </p>
              </div>
              <button
                type="button"
                onClick={() => setQuestionModalExam(null)}
                className="p-1.5 text-slate-500 hover:text-slate-900 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto flex-1 space-y-2.5">
              {bankQuestions.length === 0 ? (
                <p className="text-sm text-slate-600 text-center py-8">
                  Belum ada soal pada bank soal untuk mata pelajaran ini. Tambahkan soal terlebih
                  dahulu di menu Bank Soal.
                </p>
              ) : (
                bankQuestions.map((q) => {
                  const checked = selectedQuestionIds[q.id] !== undefined;
                  return (
                    <div
                      key={q.id}
                      className={`p-3.5 border rounded-lg flex items-start justify-between gap-3 transition-colors ${
                        checked ? 'bg-blue-50/70 border-blue-300' : 'bg-white border-slate-200'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => toggleQuestionPick(q)}
                        className="flex items-start gap-3 text-left flex-1 min-w-0"
                      >
                        <CheckSquare
                          className={`w-4 h-4 mt-0.5 shrink-0 ${
                            checked ? 'text-blue-900' : 'text-slate-300'
                          }`}
                        />
                        <div className="min-w-0">
                          <p className="text-xs text-slate-500">
                            {q.question_type === 'pg' ? 'Pilihan Ganda' : 'Essay'} ·{' '}
                            <span className="capitalize">{q.difficulty}</span>
                          </p>
                          <p className="text-sm text-slate-900 line-clamp-2 mt-0.5">
                            {q.question_text}
                          </p>
                        </div>
                      </button>

                      {checked && (
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-xs text-slate-600">Poin:</span>
                          <input
                            type="number"
                            min="0.5"
                            step="0.5"
                            value={selectedQuestionIds[q.id]}
                            onChange={(e) =>
                              setSelectedQuestionIds((prev) => ({
                                ...prev,
                                [q.id]: Number(e.target.value) || 1,
                              }))
                            }
                            className="w-16 px-2 py-1 text-xs border border-slate-300 rounded bg-white tabular-nums"
                          />
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            <div className="px-5 py-4 border-t border-slate-200 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setQuestionModalExam(null)}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg"
              >
                Tutup
              </button>
              <button
                type="button"
                disabled={savingQuestions}
                onClick={saveAssignedQuestions}
                className="px-4 py-2 text-sm font-semibold text-white bg-blue-900 hover:bg-blue-950 disabled:opacity-50 rounded-lg"
              >
                {savingQuestions
                  ? 'Menyimpan...'
                  : `Simpan Paket Soal (${Object.keys(selectedQuestionIds).length})`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
