import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  ClipboardCheck,
  Download,
  Eye,
  EyeOff,
  FileSpreadsheet,
  Search,
  X,
} from 'lucide-react';
import { getSupabaseClient } from '../../lib/supabase';
import {
  exportResultsToExcel,
  exportResultsToPdf,
  formatDateTimeID,
  formatGradingStatusLabel,
} from '../../lib/exportReports';
import type {
  AnswerRecord,
  Exam,
  ExamResult,
  ExamSession,
  SchoolClass,
  SchoolSettings,
  Subject,
} from '../../types/database';

interface ResultsAndGradingPanelProps {
  exams: Exam[];
  classes: SchoolClass[];
  subjects: Subject[];
  schoolSettings: SchoolSettings | null;
  restrictToTeacherId?: string | null;
  currentUserId: string;
}

export const ResultsAndGradingPanel: React.FC<ResultsAndGradingPanelProps> = ({
  exams,
  classes,
  subjects,
  schoolSettings,
  restrictToTeacherId,
  currentUserId,
}) => {
  const [subTab, setSubTab] = useState<'results' | 'sessions'>('results');
  const [results, setResults] = useState<ExamResult[]>([]);
  const [sessions, setSessions] = useState<ExamSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filterExamId, setFilterExamId] = useState<string>('all');
  const [filterClassId, setFilterClassId] = useState<string>('all');
  const [filterSubjectId, setFilterSubjectId] = useState<string>('all');
  const [search, setSearch] = useState('');

  // Modal periksa jawaban & essay
  const [gradingTarget, setGradingTarget] = useState<{
    sessionId: string;
    studentName: string;
    examTitle: string;
  } | null>(null);
  const [sessionAnswers, setSessionAnswers] = useState<AnswerRecord[]>([]);
  const [essayInputs, setEssayInputs] = useState<
    Record<string, { score: string; feedback: string }>
  >({});
  const [savingGrades, setSavingGrades] = useState(false);

  const allowedExamIds = useMemo(() => {
    if (!restrictToTeacherId) return null;
    return new Set(
      exams
        .filter((e) => e.teacher_id === restrictToTeacherId || e.created_by === currentUserId)
        .map((e) => e.id)
    );
  }, [exams, restrictToTeacherId, currentUserId]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const supabase = getSupabaseClient();
      const [resRes, sesRes] = await Promise.all([
        supabase
          .from('results')
          .select(
            '*, students(*, profiles(*), classes(*)), exams(*, subjects(*), classes(*))'
          )
          .order('updated_at', { ascending: false }),
        supabase
          .from('exam_sessions')
          .select(
            '*, students(*, profiles(*), classes(*)), exams(*, subjects(*), classes(*))'
          )
          .order('started_at', { ascending: false }),
      ]);

      if (resRes.error) throw resRes.error;
      if (sesRes.error) throw sesRes.error;

      let loadedResults = (resRes.data as ExamResult[]) || [];
      let loadedSessions = (sesRes.data as ExamSession[]) || [];

      if (allowedExamIds) {
        loadedResults = loadedResults.filter((r) => allowedExamIds.has(r.exam_id));
        loadedSessions = loadedSessions.filter((s) => allowedExamIds.has(s.exam_id));
      }

      setResults(loadedResults);
      setSessions(loadedSessions);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat hasil dan peserta ujian.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [exams.length, restrictToTeacherId]);

  const filteredResults = useMemo(() => {
    const q = search.trim().toLowerCase();
    return results.filter((r) => {
      if (filterExamId !== 'all' && r.exam_id !== filterExamId) return false;
      if (
        filterClassId !== 'all' &&
        r.students?.class_id !== filterClassId &&
        r.exams?.class_id !== filterClassId
      ) {
        return false;
      }
      if (filterSubjectId !== 'all' && r.exams?.subject_id !== filterSubjectId) return false;
      if (q) {
        const name = r.students?.profiles?.full_name?.toLowerCase() || '';
        const nis = r.students?.nis?.toLowerCase() || '';
        if (!name.includes(q) && !nis.includes(q)) return false;
      }
      return true;
    });
  }, [results, filterExamId, filterClassId, filterSubjectId, search]);

  const filteredSessions = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sessions.filter((s) => {
      if (filterExamId !== 'all' && s.exam_id !== filterExamId) return false;
      if (
        filterClassId !== 'all' &&
        s.students?.class_id !== filterClassId &&
        s.exams?.class_id !== filterClassId
      ) {
        return false;
      }
      if (filterSubjectId !== 'all' && s.exams?.subject_id !== filterSubjectId) return false;
      if (q) {
        const name = s.students?.profiles?.full_name?.toLowerCase() || '';
        const nis = s.students?.nis?.toLowerCase() || '';
        if (!name.includes(q) && !nis.includes(q)) return false;
      }
      return true;
    });
  }, [sessions, filterExamId, filterClassId, filterSubjectId, search]);

  const openGradingModal = async (sessionId: string, studentName: string, examTitle: string) => {
    setError(null);
    setGradingTarget({ sessionId, studentName, examTitle });
    try {
      const supabase = getSupabaseClient();
      const { data, error: ansErr } = await supabase
        .from('answers')
        .select('*, questions(*)')
        .eq('session_id', sessionId);
      if (ansErr) throw ansErr;

      const records = (data as AnswerRecord[]) || [];
      setSessionAnswers(records);

      const initialInputs: Record<string, { score: string; feedback: string }> = {};
      records.forEach((a) => {
        if (a.questions?.question_type === 'essay') {
          initialInputs[a.id] = {
            score: a.essay_score !== null && a.essay_score !== undefined ? String(a.essay_score) : '0',
            feedback: a.teacher_feedback || '',
          };
        }
      });
      setEssayInputs(initialInputs);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat lembar jawaban siswa.');
    }
  };

  const handleSaveEssayGrades = async () => {
    if (!gradingTarget) return;
    setSavingGrades(true);
    setError(null);
    try {
      const supabase = getSupabaseClient();
      const essayRecords = sessionAnswers.filter((a) => a.questions?.question_type === 'essay');

      for (const ans of essayRecords) {
        const entry = essayInputs[ans.id];
        if (!entry) continue;
        const numericScore = Math.min(100, Math.max(0, Number(entry.score) || 0));
        const { error: updErr } = await supabase
          .from('answers')
          .update({
            essay_score: numericScore,
            teacher_feedback: entry.feedback.trim() || null,
          })
          .eq('id', ans.id);
        if (updErr) throw updErr;
      }

      const { error: recalcErr } = await supabase.rpc('recalculate_exam_result', {
        p_session_id: gradingTarget.sessionId,
      });
      if (recalcErr) throw recalcErr;

      setGradingTarget(null);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan nilai essay.');
    } finally {
      setSavingGrades(false);
    }
  };

  const togglePublishSingle = async (result: ExamResult) => {
    try {
      const supabase = getSupabaseClient();
      const { error: updErr } = await supabase
        .from('results')
        .update({ is_published: !result.is_published })
        .eq('id', result.id);
      if (updErr) throw updErr;
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal mengubah publikasi nilai.');
    }
  };

  const bulkPublishFiltered = async (publish: boolean) => {
    if (filteredResults.length === 0) return;
    try {
      const supabase = getSupabaseClient();
      const ids = filteredResults.map((r) => r.id);
      const { error: updErr } = await supabase
        .from('results')
        .update({ is_published: publish })
        .in('id', ids);
      if (updErr) throw updErr;
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memperbarui publikasi massal.');
    }
  };

  const forceSubmitSession = async (sessionId: string) => {
    try {
      const supabase = getSupabaseClient();
      const { error: rpcErr } = await supabase.rpc('submit_exam_session', {
        p_session_id: sessionId,
      });
      if (rpcErr) throw rpcErr;
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal mengakhiri sesi ujian.');
    }
  };

  const filterSummaryText = useMemo(() => {
    const parts: string[] = [];
    if (filterExamId !== 'all') {
      const ex = exams.find((e) => e.id === filterExamId);
      if (ex) parts.push(`Ujian: ${ex.title}`);
    }
    if (filterSubjectId !== 'all') {
      const sub = subjects.find((s) => s.id === filterSubjectId);
      if (sub) parts.push(`Mapel: ${sub.name}`);
    }
    if (filterClassId !== 'all') {
      const cls = classes.find((c) => c.id === filterClassId);
      if (cls) parts.push(`Kelas: ${cls.name}`);
    }
    return parts.join(' · ') || 'Semua Data Ujian';
  }, [filterExamId, filterSubjectId, filterClassId, exams, subjects, classes]);

  return (
    <div className="space-y-6">
      {/* Filter & Export Toolbar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg self-start">
            <button
              type="button"
              onClick={() => setSubTab('results')}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                subTab === 'results'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Nilai & Koreksi ({filteredResults.length})
            </button>
            <button
              type="button"
              onClick={() => setSubTab('sessions')}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                subTab === 'sessions'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Peserta Ujian ({filteredSessions.length})
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {subTab === 'results' && (
              <>
                <button
                  type="button"
                  onClick={() => bulkPublishFiltered(true)}
                  disabled={filteredResults.length === 0}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-blue-900 bg-blue-50 border border-blue-200 hover:bg-blue-100 disabled:opacity-50 rounded-lg whitespace-nowrap"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Umumkan Semua</span>
                </button>
                <button
                  type="button"
                  onClick={() => exportResultsToExcel(filteredResults)}
                  disabled={filteredResults.length === 0}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-emerald-900 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 disabled:opacity-50 rounded-lg whitespace-nowrap"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>Unduh Excel</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    exportResultsToPdf(filteredResults, schoolSettings, filterSummaryText)
                  }
                  disabled={filteredResults.length === 0}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-blue-900 hover:bg-blue-950 disabled:opacity-50 rounded-lg whitespace-nowrap"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Unduh PDF</span>
                </button>
              </>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama atau NIS siswa..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>

          <select
            value={filterExamId}
            onChange={(e) => setFilterExamId(e.target.value)}
            className="px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
          >
            <option value="all">Semua Ujian</option>
            {exams.map((ex) => (
              <option key={ex.id} value={ex.id}>
                {ex.title}
              </option>
            ))}
          </select>

          <select
            value={filterSubjectId}
            onChange={(e) => setFilterSubjectId(e.target.value)}
            className="px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
          >
            <option value="all">Semua Mata Pelajaran</option>
            {subjects.map((sub) => (
              <option key={sub.id} value={sub.id}>
                {sub.name}
              </option>
            ))}
          </select>

          <select
            value={filterClassId}
            onChange={(e) => setFilterClassId(e.target.value)}
            className="px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
          >
            <option value="all">Semua Kelas</option>
            {classes.map((cls) => (
              <option key={cls.id} value={cls.id}>
                {cls.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="p-3.5 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
          {error}
        </div>
      )}

      {/* Content Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="h-12 bg-slate-100 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : subTab === 'results' ? (
          filteredResults.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-600">
              Belum ada hasil ujian yang tersimpan untuk filter ini.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                    <th className="py-3 px-4">Siswa</th>
                    <th className="py-3 px-4">Kelas</th>
                    <th className="py-3 px-4">Ujian & Mapel</th>
                    <th className="py-3 px-4 text-right">PG</th>
                    <th className="py-3 px-4 text-right">Essay</th>
                    <th className="py-3 px-4 text-right">Nilai Akhir</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-sm">
                  {filteredResults.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50/70">
                      <td className="py-3 px-4">
                        <p className="font-semibold text-slate-900">
                          {r.students?.profiles?.full_name || '-'}
                        </p>
                        <p className="text-xs text-slate-500 font-mono-tabular">
                          NIS {r.students?.nis || '-'}
                        </p>
                      </td>
                      <td className="py-3 px-4 text-slate-700 whitespace-nowrap">
                        {r.students?.classes?.name || r.exams?.classes?.name || '-'}
                      </td>
                      <td className="py-3 px-4">
                        <p className="font-medium text-slate-900">{r.exams?.title || '-'}</p>
                        <p className="text-xs text-slate-500">{r.exams?.subjects?.name || '-'}</p>
                      </td>
                      <td className="py-3 px-4 text-right font-mono-tabular">
                        <span className="text-slate-900">{Number(r.pg_score).toFixed(1)}</span>
                        <span className="block text-xs text-slate-500">
                          {r.pg_correct_count}/{r.pg_total_count}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono-tabular text-slate-900">
                        {Number(r.essay_score).toFixed(1)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono-tabular font-bold text-blue-900">
                        {Number(r.final_score).toFixed(1)}
                      </td>
                      <td className="py-3 px-4 text-xs">
                        <p
                          className={
                            r.grading_status === 'needs_essay_grading'
                              ? 'text-amber-700 font-medium'
                              : 'text-emerald-700 font-medium'
                          }
                        >
                          {formatGradingStatusLabel(r.grading_status)}
                        </p>
                        <p className="text-slate-500">
                          {r.is_published ? 'Diumumkan' : 'Belum diumumkan'}
                        </p>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              openGradingModal(
                                r.session_id,
                                r.students?.profiles?.full_name || 'Siswa',
                                r.exams?.title || 'Ujian'
                              )
                            }
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-blue-900 bg-blue-50 border border-blue-200 hover:bg-blue-100 rounded-lg whitespace-nowrap"
                          >
                            <ClipboardCheck className="w-3.5 h-3.5" />
                            <span>Periksa / Essay</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => togglePublishSingle(r)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg whitespace-nowrap"
                            title={r.is_published ? 'Sembunyikan nilai' : 'Umumkan nilai'}
                          >
                            {r.is_published ? (
                              <>
                                <EyeOff className="w-3.5 h-3.5" />
                                <span>Tarik</span>
                              </>
                            ) : (
                              <>
                                <Eye className="w-3.5 h-3.5" />
                                <span>Umumkan</span>
                              </>
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : filteredSessions.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-600">
            Belum ada peserta yang memulai ujian untuk filter ini.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                  <th className="py-3 px-4">Peserta</th>
                  <th className="py-3 px-4">Kelas</th>
                  <th className="py-3 px-4">Ujian</th>
                  <th className="py-3 px-4">Waktu Mulai</th>
                  <th className="py-3 px-4">Batas / Selesai</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm">
                {filteredSessions.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4">
                      <p className="font-semibold text-slate-900">
                        {s.students?.profiles?.full_name || '-'}
                      </p>
                      <p className="text-xs text-slate-500 font-mono-tabular">
                        NIS {s.students?.nis || '-'}
                      </p>
                    </td>
                    <td className="py-3 px-4 text-slate-700 whitespace-nowrap">
                      {s.students?.classes?.name || s.exams?.classes?.name || '-'}
                    </td>
                    <td className="py-3 px-4">
                      <p className="font-medium text-slate-900">{s.exams?.title || '-'}</p>
                      <p className="text-xs text-slate-500">{s.exams?.subjects?.name || '-'}</p>
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-600 tabular-nums">
                      {formatDateTimeID(s.started_at)}
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-600 tabular-nums">
                      {s.submitted_at
                        ? `Dikumpulkan: ${formatDateTimeID(s.submitted_at)}`
                        : `Batas: ${formatDateTimeID(s.expires_at)}`}
                    </td>
                    <td className="py-3 px-4 text-xs font-medium">
                      {s.status === 'in_progress' ? (
                        <span className="text-amber-700">Sedang Mengerjakan</span>
                      ) : s.status === 'submitted' ? (
                        <span className="text-emerald-700">Selesai Mengumpulkan</span>
                      ) : (
                        <span className="text-red-700">Waktu Habis</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {s.status === 'in_progress' ? (
                        <button
                          type="button"
                          onClick={() => forceSubmitSession(s.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-red-700 bg-red-50 border border-red-200 hover:bg-red-100 rounded-lg whitespace-nowrap"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Akhiri Sesi</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() =>
                            openGradingModal(
                              s.id,
                              s.students?.profiles?.full_name || 'Siswa',
                              s.exams?.title || 'Ujian'
                            )
                          }
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg whitespace-nowrap"
                        >
                          <ClipboardCheck className="w-3.5 h-3.5" />
                          <span>Lihat Jawaban</span>
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Pemeriksaan Jawaban & Koreksi Essay */}
      {gradingTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-xl max-w-3xl w-full max-h-[92vh] flex flex-col overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-slate-900">
                  Lembar Jawaban — {gradingTarget.studentName}
                </h3>
                <p className="text-xs text-slate-500">{gradingTarget.examTitle}</p>
              </div>
              <button
                type="button"
                onClick={() => setGradingTarget(null)}
                className="p-1.5 text-slate-500 hover:text-slate-900 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto flex-1 space-y-4">
              {sessionAnswers.length === 0 ? (
                <p className="text-sm text-slate-600 text-center py-8">
                  Tidak ada jawaban yang tersimpan pada sesi ini.
                </p>
              ) : (
                sessionAnswers.map((ans, idx) => {
                  const q = ans.questions;
                  if (!q) return null;
                  const isEssay = q.question_type === 'essay';
                  return (
                    <div
                      key={ans.id}
                      className="p-4 border border-slate-200 rounded-lg space-y-2.5 bg-slate-50/50"
                    >
                      <div className="flex items-center justify-between text-xs text-slate-500">
                        <span className="font-semibold text-slate-800">
                          Soal #{idx + 1} · {isEssay ? 'Essay' : 'Pilihan Ganda'}
                        </span>
                        {!isEssay && (
                          <span
                            className={
                              ans.is_correct
                                ? 'text-emerald-700 font-semibold'
                                : 'text-red-700 font-semibold'
                            }
                          >
                            {ans.is_correct ? 'Benar' : 'Salah'} (Kunci: {q.correct_option})
                          </span>
                        )}
                      </div>

                      <p className="text-sm text-slate-900 whitespace-pre-line">
                        {q.question_text}
                      </p>

                      {!isEssay ? (
                        <p className="text-xs text-slate-700">
                          Jawaban Siswa:{' '}
                          <span className="font-mono-tabular font-bold">
                            {ans.selected_option || 'Tidak Dijawab'}
                          </span>
                        </p>
                      ) : (
                        <div className="space-y-3 pt-1">
                          <div className="p-3 bg-white border border-slate-200 rounded-lg">
                            <p className="text-xs font-semibold text-slate-600 mb-1">
                              Jawaban Siswa:
                            </p>
                            <p className="text-sm text-slate-900 whitespace-pre-line">
                              {ans.essay_answer || '(Siswa tidak mengisi jawaban)'}
                            </p>
                          </div>

                          {q.essay_rubric && (
                            <p className="text-xs text-slate-600">
                              <span className="font-semibold">Pedoman Penilaian:</span>{' '}
                              {q.essay_rubric}
                            </p>
                          )}

                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div>
                              <label className="block text-xs font-medium text-slate-700 mb-1">
                                Skor Essay (0 - 100)
                              </label>
                              <input
                                type="number"
                                min="0"
                                max="100"
                                step="1"
                                value={essayInputs[ans.id]?.score ?? '0'}
                                onChange={(e) =>
                                  setEssayInputs((prev) => ({
                                    ...prev,
                                    [ans.id]: {
                                      score: e.target.value,
                                      feedback: prev[ans.id]?.feedback || '',
                                    },
                                  }))
                                }
                                className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg bg-white font-mono-tabular"
                              />
                            </div>
                            <div className="sm:col-span-2">
                              <label className="block text-xs font-medium text-slate-700 mb-1">
                                Catatan Guru (Opsional)
                              </label>
                              <input
                                type="text"
                                value={essayInputs[ans.id]?.feedback ?? ''}
                                onChange={(e) =>
                                  setEssayInputs((prev) => ({
                                    ...prev,
                                    [ans.id]: {
                                      score: prev[ans.id]?.score || '0',
                                      feedback: e.target.value,
                                    },
                                  }))
                                }
                                placeholder="Catatan koreksi singkat..."
                                className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg bg-white"
                              />
                            </div>
                          </div>
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
                onClick={() => setGradingTarget(null)}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg"
              >
                Tutup
              </button>
              {sessionAnswers.some((a) => a.questions?.question_type === 'essay') && (
                <button
                  type="button"
                  disabled={savingGrades}
                  onClick={handleSaveEssayGrades}
                  className="px-4 py-2 text-sm font-semibold text-white bg-blue-900 hover:bg-blue-950 disabled:opacity-50 rounded-lg"
                >
                  {savingGrades ? 'Menghitung Nilai...' : 'Simpan Nilai Essay & Hitung Ulang'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
