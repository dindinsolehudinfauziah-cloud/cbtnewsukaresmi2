import React, { useCallback, useEffect, useState } from 'react';
import {
  Award,
  CalendarClock,
  CheckCircle2,
  KeyRound,
  Play,
  X,
} from 'lucide-react';
import { AppShell, type NavItem } from '../AppShell';
import { getSupabaseClient } from '../../lib/supabase';
import { formatDateTimeID, formatGradingStatusLabel } from '../../lib/exportReports';
import type {
  CurrentUserContext,
  SchoolSettings,
  StudentExamItem,
} from '../../types/database';
import { ExamRunner } from './ExamRunner';

interface StudentDashboardProps {
  user: CurrentUserContext;
  schoolSettings: SchoolSettings | null;
  onLogout: () => void;
}

export const StudentDashboard: React.FC<StudentDashboardProps> = ({
  user,
  schoolSettings,
  onLogout,
}) => {
  const [activeTab, setActiveTab] = useState('schedule');
  const [exams, setExams] = useState<StudentExamItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Modal token ujian
  const [tokenExam, setTokenExam] = useState<StudentExamItem | null>(null);
  const [tokenInput, setTokenInput] = useState('');
  const [starting, setStarting] = useState(false);
  const [tokenError, setTokenError] = useState<string | null>(null);

  // Sesi aktif yang sedang dijalankan
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  const loadStudentExams = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const supabase = getSupabaseClient();
      const { data, error: rpcErr } = await supabase.rpc('get_student_exams');
      if (rpcErr) throw rpcErr;
      setExams((data as StudentExamItem[]) || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat jadwal ujian siswa.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStudentExams();
  }, [loadStudentExams]);

  const handleOpenStartModal = (exam: StudentExamItem) => {
    setTokenError(null);
    setTokenInput('');
    setTokenExam(exam);
  };

  const handleVerifyTokenAndStart = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tokenExam) return;
    setStarting(true);
    setTokenError(null);
    try {
      const supabase = getSupabaseClient();
      const { data, error: rpcErr } = await supabase.rpc('start_exam_session', {
        p_exam_id: tokenExam.exam_id,
        p_token: tokenInput.trim(),
      });
      if (rpcErr) throw rpcErr;
      const res = data as { session_id: string; expired?: boolean; message?: string };
      setTokenExam(null);
      if (res.expired) {
        setNotice(
          res.message || 'Waktu pengerjaan ujian Anda telah berakhir dan jawaban telah dikumpulkan.'
        );
        await loadStudentExams();
        return;
      }
      setActiveSessionId(res.session_id);
    } catch (err) {
      setTokenError(
        err instanceof Error ? err.message : 'Token ujian tidak valid atau jadwal belum dibuka.'
      );
    } finally {
      setStarting(false);
    }
  };

  const handleFinalizeExpiredSession = async (sessionId: string) => {
    setError(null);
    try {
      const supabase = getSupabaseClient();
      const { data, error: rpcErr } = await supabase.rpc('submit_exam_session', {
        p_session_id: sessionId,
      });
      if (rpcErr) throw rpcErr;
      const summary = data as { results_published: boolean; final_score: number | null };
      setNotice(
        summary.results_published && summary.final_score !== null
          ? `Ujian diselesaikan. Nilai Anda: ${Number(summary.final_score).toFixed(1)}`
          : 'Ujian berhasil diselesaikan dan jawaban tersimpan.'
      );
      await loadStudentExams();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyelesaikan sesi ujian.');
    }
  };

  if (activeSessionId) {
    return (
      <ExamRunner
        sessionId={activeSessionId}
        studentName={user.profile.full_name}
        onFinished={(summary) => {
          setActiveSessionId(null);
          setNotice(
            summary.results_published && summary.final_score !== null
              ? `Ujian selesai dikumpulkan. Nilai Anda: ${Number(summary.final_score).toFixed(1)}`
              : 'Ujian berhasil dikumpulkan. Nilai dapat dilihat setelah diumumkan oleh guru atau admin.'
          );
          loadStudentExams();
        }}
        onExit={() => {
          setActiveSessionId(null);
          loadStudentExams();
        }}
      />
    );
  }

  const navItems: NavItem[] = [
    { id: 'schedule', label: 'Jadwal Ujian', icon: <CalendarClock className="w-4 h-4" /> },
    { id: 'grades', label: 'Nilai Saya', icon: <Award className="w-4 h-4" /> },
  ];

  const schoolName = schoolSettings?.school_name || 'SMP Negeri 2 Sukaresmi';
  const finishedExams = exams.filter((e) => e.session_status === 'submitted' || e.session_status === 'expired');

  return (
    <AppShell
      user={user}
      schoolName={schoolName}
      navItems={navItems}
      activeTab={activeTab}
      onSelectTab={setActiveTab}
      onLogout={onLogout}
      pageTitle={activeTab === 'schedule' ? 'Jadwal Ujian Semester' : 'Hasil & Nilai Ujian'}
      pageSubtitle={`Kelas ${user.student?.classes?.name || '-'} · NIS ${user.student?.nis || '-'}`}
    >
      <div className="space-y-6">
        {notice && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start justify-between gap-3 text-sm text-emerald-900">
            <div className="flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-emerald-700" />
              <span>{notice}</span>
            </div>
            <button type="button" onClick={() => setNotice(null)} className="text-emerald-700">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-800">
            {error}
          </div>
        )}

        {activeTab === 'schedule' && (
          <>
            {schoolSettings?.exam_rules && (
              <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-1.5">
                <h2 className="text-sm font-semibold text-slate-900">Tata Tertib Ujian</h2>
                <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-line">
                  {schoolSettings.exam_rules}
                </p>
              </div>
            )}

            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((n) => (
                  <div key={n} className="h-28 bg-white border border-slate-200 rounded-xl animate-pulse" />
                ))}
              </div>
            ) : exams.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-xl p-10 text-center space-y-2">
                <p className="text-sm font-semibold text-slate-900">
                  Belum ada jadwal ujian untuk kelas Anda.
                </p>
                <p className="text-xs text-slate-500">
                  Jadwal akan muncul secara otomatis setelah diterbitkan oleh guru atau admin.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {exams.map((ex) => {
                  const nowMs = new Date(ex.server_now).getTime();
                  const startMs = new Date(ex.start_time).getTime();
                  const endMs = new Date(ex.end_time).getTime();

                  const isCompleted =
                    ex.session_status === 'submitted' || ex.session_status === 'expired';
                  const isInProgress = ex.session_status === 'in_progress';
                  const isSessionExpired =
                    isInProgress &&
                    Boolean(ex.session_expires_at) &&
                    new Date(ex.session_expires_at as string).getTime() <= nowMs;
                  const notStartedYet = nowMs < startMs;
                  const alreadyClosed = nowMs > endMs;
                  const canStart = !isCompleted && !isSessionExpired && !notStartedYet && !alreadyClosed;

                  let statusText = 'Tersedia';
                  let statusClass = 'text-emerald-700';
                  if (isCompleted) {
                    statusText = 'Selesai Dikerjakan';
                    statusClass = 'text-blue-900';
                  } else if (isSessionExpired) {
                    statusText = 'Waktu Sesi Habis';
                    statusClass = 'text-red-700';
                  } else if (isInProgress) {
                    statusText = 'Sedang Berlangsung';
                    statusClass = 'text-amber-700';
                  } else if (notStartedYet) {
                    statusText = 'Belum Dimulai';
                    statusClass = 'text-slate-600';
                  } else if (alreadyClosed) {
                    statusText = 'Jadwal Berakhir';
                    statusClass = 'text-red-700';
                  }

                  return (
                    <div
                      key={ex.exam_id}
                      className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between gap-4"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2 text-xs">
                          <span className="font-medium text-slate-600">
                            {ex.subject_name} · Kelas {ex.class_name}
                          </span>
                          <span className={`font-semibold ${statusClass}`}>{statusText}</span>
                        </div>

                        <h3 className="text-base font-bold text-slate-900">{ex.title}</h3>

                        <div className="text-xs text-slate-500 space-y-1 tabular-nums">
                          <p>
                            Jadwal: {formatDateTimeID(ex.start_time)} s.d.{' '}
                            {formatDateTimeID(ex.end_time)}
                          </p>
                          <p>
                            Durasi {ex.duration_minutes} menit · {ex.question_count} soal · Guru:{' '}
                            {ex.teacher_name}
                          </p>
                        </div>
                      </div>

                      <div className="pt-3 border-t border-slate-200 flex items-center justify-between gap-3">
                        {isCompleted ? (
                          <span className="text-xs text-slate-600">
                            {ex.result_published && ex.final_score !== null
                              ? `Nilai Akhir: ${Number(ex.final_score).toFixed(1)}`
                              : 'Menunggu pengumuman nilai'}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-500">
                            {ex.token_active ? 'Memerlukan token pengawas' : 'Tanpa token'}
                          </span>
                        )}

                        {isSessionExpired && ex.session_id ? (
                          <button
                            type="button"
                            onClick={() => handleFinalizeExpiredSession(ex.session_id as string)}
                            className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-700 hover:bg-amber-800 text-white text-xs font-semibold rounded-lg whitespace-nowrap"
                          >
                            <span>Selesaikan Ujian</span>
                          </button>
                        ) : (
                          canStart && (
                            <button
                              type="button"
                              onClick={() => handleOpenStartModal(ex)}
                              className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-900 hover:bg-blue-950 text-white text-xs font-semibold rounded-lg whitespace-nowrap"
                            >
                              <Play className="w-3.5 h-3.5" />
                              <span>{isInProgress ? 'Lanjutkan Ujian' : 'Kerjakan Ujian'}</span>
                            </button>
                          )
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {activeTab === 'grades' && (
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            {finishedExams.length === 0 ? (
              <div className="p-10 text-center text-sm text-slate-600">
                Belum ada ujian yang Anda selesaikan.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                      <th className="py-3 px-4">Mata Pelajaran</th>
                      <th className="py-3 px-4">Nama Ujian</th>
                      <th className="py-3 px-4">Waktu Selesai</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Nilai Akhir</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-sm">
                    {finishedExams.map((ex) => (
                      <tr key={ex.exam_id}>
                        <td className="py-3 px-4 font-medium text-slate-900">{ex.subject_name}</td>
                        <td className="py-3 px-4 text-slate-700">{ex.title}</td>
                        <td className="py-3 px-4 text-xs text-slate-500 tabular-nums">
                          {formatDateTimeID(ex.session_submitted_at)}
                        </td>
                        <td className="py-3 px-4 text-xs">
                          {ex.result_published ? (
                            <span className="text-emerald-700 font-medium">
                              {formatGradingStatusLabel(ex.grading_status)}
                            </span>
                          ) : (
                            <span className="text-amber-700 font-medium">
                              Menunggu diumumkan
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right font-mono-tabular font-bold text-slate-900">
                          {ex.result_published && ex.final_score !== null
                            ? Number(ex.final_score).toFixed(1)
                            : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal Verifikasi Token Ujian */}
      {tokenExam && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900">Konfirmasi Mulai Ujian</h3>
              <button type="button" onClick={() => setTokenExam(null)}>
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <form onSubmit={handleVerifyTokenAndStart} className="p-5 space-y-4">
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-1 text-xs">
                <p className="font-bold text-sm text-slate-900">{tokenExam.title}</p>
                <p className="text-slate-600">
                  {tokenExam.subject_name} · Durasi {tokenExam.duration_minutes} menit ·{' '}
                  {tokenExam.question_count} soal
                </p>
              </div>

              {tokenError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800">
                  {tokenError}
                </div>
              )}

              {tokenExam.token_active && (
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    Masukkan Token Ujian
                  </label>
                  <div className="relative">
                    <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      autoFocus
                      value={tokenInput}
                      onChange={(e) => setTokenInput(e.target.value.toUpperCase())}
                      placeholder="Contoh: A7K9M2"
                      className="w-full pl-9 pr-3 py-2.5 text-sm font-mono-tabular uppercase tracking-widest border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-900"
                    />
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setTokenExam(null)}
                  className="px-4 py-2 text-sm border border-slate-300 rounded-lg"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={starting}
                  className="px-4 py-2 text-sm font-semibold text-white bg-blue-900 hover:bg-blue-950 disabled:opacity-50 rounded-lg"
                >
                  {starting ? 'Memverifikasi...' : 'Mulai Kerjakan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
};
