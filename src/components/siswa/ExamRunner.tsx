import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Flag,
  LayoutGrid,
  Send,
  X,
  ZoomIn,
} from 'lucide-react';
import { getSupabaseClient } from '../../lib/supabase';
import type {
  StudentAnswerItem,
  StudentExamPayload,
  StudentQuestionItem,
} from '../../types/database';

interface ExamRunnerProps {
  sessionId: string;
  studentName: string;
  onFinished: (summary: { results_published: boolean; final_score: number | null }) => void;
  onExit: () => void;
}

function formatCountdown(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hrs = Math.floor(safe / 3600);
  const mins = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  return [hrs, mins, secs].map((v) => String(v).padStart(2, '0')).join(':');
}

export const ExamRunner: React.FC<ExamRunnerProps> = ({
  sessionId,
  studentName,
  onFinished,
  onExit,
}) => {
  const [payload, setPayload] = useState<StudentExamPayload | null>(null);
  const [answersMap, setAnswersMap] = useState<Record<string, StudentAnswerItem>>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('saved');
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [mobileGridOpen, setMobileGridOpen] = useState(false);
  const [zoomImageUrl, setZoomImageUrl] = useState<string | null>(null);

  const serverOffsetMsRef = useRef<number>(0);
  const essayDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoSubmittedRef = useRef<boolean>(false);

  const loadExamSession = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const supabase = getSupabaseClient();
      const { data, error: rpcErr } = await supabase.rpc('get_exam_questions_for_student', {
        p_session_id: sessionId,
      });
      if (rpcErr) throw rpcErr;

      const typed = data as StudentExamPayload;
      if (typed.expired) {
        setPayload(null);
        setError(
          typed.message ||
            'Waktu pengerjaan ujian telah berakhir dan jawaban Anda telah dikumpulkan.'
        );
        return;
      }
      setPayload(typed);

      const serverNowMs = new Date(typed.session.server_now).getTime();
      serverOffsetMsRef.current = serverNowMs - Date.now();

      const expiresMs = new Date(typed.session.expires_at).getTime();
      const diffSec = Math.max(0, Math.floor((expiresMs - serverNowMs) / 1000));
      setRemainingSeconds(diffSec);

      const map: Record<string, StudentAnswerItem> = {};
      typed.answers.forEach((a) => {
        map[a.question_id] = a;
      });
      setAnswersMap(map);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat soal ujian.');
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    loadExamSession();
  }, [loadExamSession]);

  const handleSubmitExam = useCallback(
    async (isAuto = false) => {
      if (submitting) return;
      setSubmitting(true);
      setError(null);
      try {
        if (essayDebounceRef.current) {
          clearTimeout(essayDebounceRef.current);
          essayDebounceRef.current = null;
        }
        const supabase = getSupabaseClient();
        const { data, error: subErr } = await supabase.rpc('submit_exam_session', {
          p_session_id: sessionId,
        });
        if (subErr) throw subErr;
        const result = data as { results_published: boolean; final_score: number | null };
        onFinished(result);
      } catch (err) {
        if (!isAuto) {
          setError(err instanceof Error ? err.message : 'Gagal mengumpulkan ujian.');
        }
        setSubmitting(false);
      }
    },
    [sessionId, submitting, onFinished]
  );

  // Timer sinkron server
  useEffect(() => {
    if (!payload) return;
    const expiresMs = new Date(payload.session.expires_at).getTime();

    const interval = setInterval(() => {
      const estimatedServerNow = Date.now() + serverOffsetMsRef.current;
      const secs = Math.max(0, Math.floor((expiresMs - estimatedServerNow) / 1000));
      setRemainingSeconds(secs);

      if (secs <= 0 && !autoSubmittedRef.current) {
        autoSubmittedRef.current = true;
        handleSubmitExam(true);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [payload, handleSubmitExam]);

  const persistAnswer = useCallback(
    async (item: StudentAnswerItem) => {
      setSaveState('saving');
      try {
        const supabase = getSupabaseClient();
        const { data: saveData, error: saveErr } = await supabase.rpc('save_student_answer', {
          p_session_id: sessionId,
          p_question_id: item.question_id,
          p_selected_option: item.selected_option,
          p_essay_answer: item.essay_answer,
          p_is_flagged: item.is_flagged,
        });
        if (saveErr) throw saveErr;
        const saveRes = saveData as { saved?: boolean; expired?: boolean; message?: string } | null;
        if (saveRes?.expired) {
          setSaveState('saved');
          if (!autoSubmittedRef.current) {
            autoSubmittedRef.current = true;
            onExit();
          }
          return;
        }
        setSaveState('saved');
      } catch (err) {
        setSaveState('error');
        setError(err instanceof Error ? err.message : 'Gagal menyimpan jawaban otomatis.');
      }
    },
    [sessionId, onExit]
  );

  const questions: StudentQuestionItem[] = payload?.questions || [];
  const currentQuestion = questions[currentIndex];
  const currentAnswer: StudentAnswerItem = useMemo(() => {
    if (!currentQuestion) {
      return { question_id: '', selected_option: null, essay_answer: null, is_flagged: false };
    }
    return (
      answersMap[currentQuestion.id] || {
        question_id: currentQuestion.id,
        selected_option: null,
        essay_answer: null,
        is_flagged: false,
      }
    );
  }, [answersMap, currentQuestion]);

  const handleSelectOption = (opt: 'A' | 'B' | 'C' | 'D') => {
    if (!currentQuestion) return;
    const updated: StudentAnswerItem = {
      ...currentAnswer,
      question_id: currentQuestion.id,
      selected_option: opt,
    };
    setAnswersMap((prev) => ({ ...prev, [currentQuestion.id]: updated }));
    persistAnswer(updated);
  };

  const handleEssayChange = (text: string) => {
    if (!currentQuestion) return;
    const updated: StudentAnswerItem = {
      ...currentAnswer,
      question_id: currentQuestion.id,
      essay_answer: text,
    };
    setAnswersMap((prev) => ({ ...prev, [currentQuestion.id]: updated }));
    setSaveState('saving');

    if (essayDebounceRef.current) {
      clearTimeout(essayDebounceRef.current);
    }
    essayDebounceRef.current = setTimeout(() => {
      persistAnswer(updated);
    }, 650);
  };

  const handleToggleFlag = () => {
    if (!currentQuestion) return;
    const updated: StudentAnswerItem = {
      ...currentAnswer,
      question_id: currentQuestion.id,
      is_flagged: !currentAnswer.is_flagged,
    };
    setAnswersMap((prev) => ({ ...prev, [currentQuestion.id]: updated }));
    persistAnswer(updated);
  };

  const answeredCount = useMemo(() => {
    return questions.filter((q) => {
      const ans = answersMap[q.id];
      if (!ans) return false;
      if (q.question_type === 'pg') return Boolean(ans.selected_option);
      return Boolean(ans.essay_answer && ans.essay_answer.trim().length > 0);
    }).length;
  }, [questions, answersMap]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="bg-white border border-slate-200 rounded-xl p-8 max-w-md w-full text-center space-y-3">
          <p className="text-base font-semibold text-slate-900">Memuat Lembar Ujian...</p>
          <p className="text-xs text-slate-500">
            Menyinkronkan waktu server dan menyiapkan daftar soal Anda.
          </p>
        </div>
      </div>
    );
  }

  if (error && !payload) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="bg-white border border-slate-200 rounded-xl p-8 max-w-md w-full text-center space-y-4">
          <AlertTriangle className="w-8 h-8 text-amber-600 mx-auto" />
          <p className="text-base font-semibold text-slate-900">Sesi Ujian Tidak Dapat Dibuka</p>
          <p className="text-sm text-slate-600">{error}</p>
          <button
            type="button"
            onClick={onExit}
            className="px-4 py-2 bg-blue-900 text-white text-sm font-semibold rounded-lg"
          >
            Kembali ke Dashboard
          </button>
        </div>
      </div>
    );
  }

  const isLowTime = remainingSeconds !== null && remainingSeconds <= 300;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Compact Sticky Exam Top Bar (<= 15% mobile height) */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-200 px-3 sm:px-6 h-14 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-bold text-slate-900 truncate">{payload?.exam.title}</p>
          <p className="hidden sm:block text-xs text-slate-500 truncate">
            {payload?.exam.subject_name} · {studentName}
          </p>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <span
            className={`hidden md:inline text-xs font-medium ${
              saveState === 'saving'
                ? 'text-amber-700'
                : saveState === 'error'
                  ? 'text-red-700'
                  : 'text-emerald-700'
            }`}
          >
            {saveState === 'saving'
              ? 'Menyimpan...'
              : saveState === 'error'
                ? 'Gagal simpan'
                : 'Tersimpan otomatis'}
          </span>

          <div
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border font-mono-tabular text-xs sm:text-sm font-bold ${
              isLowTime
                ? 'bg-red-50 border-red-300 text-red-800'
                : 'bg-slate-100 border-slate-200 text-slate-900'
            }`}
          >
            <Clock className="w-3.5 h-3.5 shrink-0" />
            <span>{remainingSeconds !== null ? formatCountdown(remainingSeconds) : '--:--:--'}</span>
          </div>

          <button
            type="button"
            onClick={() => setMobileGridOpen(true)}
            className="lg:hidden p-2 text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg"
            aria-label="Daftar Nomor Soal"
          >
            <LayoutGrid className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => setConfirmOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-900 hover:bg-blue-950 text-white text-xs font-semibold rounded-lg whitespace-nowrap"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Akhiri</span>
          </button>
        </div>
      </header>

      {error && (
        <div className="max-w-6xl w-full mx-auto px-4 pt-4">
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800">
            {error}
          </div>
        </div>
      )}

      {/* Main Two-Zone CBT Stage */}
      <div className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Question Area */}
        <section className="lg:col-span-8 bg-white border border-slate-200 rounded-xl p-5 sm:p-7 space-y-6">
          {currentQuestion ? (
            <>
              <div className="flex items-center justify-between gap-3 pb-4 border-b border-slate-200">
                <div className="text-xs text-slate-500 flex items-center gap-2">
                  <span className="font-mono-tabular text-sm font-bold text-slate-900">
                    Soal {currentIndex + 1} dari {questions.length}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>
                    {currentQuestion.question_type === 'pg' ? 'Pilihan Ganda' : 'Uraian (Essay)'}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleToggleFlag}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
                    currentAnswer.is_flagged
                      ? 'bg-amber-50 border-amber-300 text-amber-800'
                      : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Flag className="w-3.5 h-3.5" />
                  <span>{currentAnswer.is_flagged ? 'Ditandai Ragu' : 'Ragu-ragu'}</span>
                </button>
              </div>

              <div className="space-y-4">
                <p className="text-base text-slate-900 leading-relaxed whitespace-pre-line">
                  {currentQuestion.question_text}
                </p>

                {currentQuestion.image_url && (
                  <div className="relative inline-block">
                    <img
                      src={currentQuestion.image_url}
                      alt={`Gambar soal nomor ${currentIndex + 1}`}
                      referrerPolicy="no-referrer"
                      onClick={() => setZoomImageUrl(currentQuestion.image_url)}
                      className="max-h-72 rounded-lg border border-slate-200 object-contain bg-slate-50 cursor-zoom-in"
                    />
                    <button
                      type="button"
                      onClick={() => setZoomImageUrl(currentQuestion.image_url)}
                      className="mt-1.5 inline-flex items-center gap-1 text-xs text-blue-900 hover:underline"
                    >
                      <ZoomIn className="w-3.5 h-3.5" />
                      <span>Perbesar gambar</span>
                    </button>
                  </div>
                )}
              </div>

              {currentQuestion.question_type === 'pg' ? (
                <div className="space-y-2.5 pt-2">
                  {(['A', 'B', 'C', 'D'] as const).map((opt) => {
                    const text =
                      opt === 'A'
                        ? currentQuestion.option_a
                        : opt === 'B'
                          ? currentQuestion.option_b
                          : opt === 'C'
                            ? currentQuestion.option_c
                            : currentQuestion.option_d;
                    const selected = currentAnswer.selected_option === opt;
                    return (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => handleSelectOption(opt)}
                        className={`w-full min-h-[48px] px-4 py-3 text-left rounded-lg border flex items-start gap-3 transition-colors ${
                          selected
                            ? 'bg-blue-50 border-blue-900 text-slate-900'
                            : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-800'
                        }`}
                      >
                        <span
                          className={`w-7 h-7 rounded-md font-mono-tabular text-xs font-bold flex items-center justify-center shrink-0 border ${
                            selected
                              ? 'bg-blue-900 border-blue-900 text-white'
                              : 'bg-slate-100 border-slate-300 text-slate-700'
                          }`}
                        >
                          {opt}
                        </span>
                        <span className="text-sm leading-relaxed pt-0.5">{text}</span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="space-y-2 pt-2">
                  <label className="block text-xs font-semibold text-slate-700">
                    Jawaban Uraian Anda
                  </label>
                  <textarea
                    rows={7}
                    value={currentAnswer.essay_answer || ''}
                    onChange={(e) => handleEssayChange(e.target.value)}
                    onBlur={() => persistAnswer(currentAnswer)}
                    placeholder="Ketik jawaban uraian Anda di sini. Jawaban tersimpan otomatis..."
                    className="w-full px-3.5 py-3 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-900"
                  />
                  <p className="text-xs text-slate-500">
                    {(currentAnswer.essay_answer || '').length} karakter · Tersimpan otomatis ke
                    server
                  </p>
                </div>
              )}

              {/* Prev / Next Footer */}
              <div className="pt-4 border-t border-slate-200 flex items-center justify-between gap-3">
                <button
                  type="button"
                  disabled={currentIndex === 0}
                  onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 disabled:opacity-40 rounded-lg"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Sebelumnya</span>
                </button>

                {currentIndex < questions.length - 1 ? (
                  <button
                    type="button"
                    onClick={() => setCurrentIndex((i) => Math.min(questions.length - 1, i + 1))}
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold text-white bg-blue-900 hover:bg-blue-950 rounded-lg"
                  >
                    <span>Berikutnya</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmOpen(true)}
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Selesai & Kumpulkan</span>
                  </button>
                )}
              </div>
            </>
          ) : (
            <p className="text-sm text-slate-600">Tidak ada soal pada ujian ini.</p>
          )}
        </section>

        {/* Desktop Question Map */}
        <aside className="hidden lg:block lg:col-span-4 bg-white border border-slate-200 rounded-xl p-5 space-y-4 sticky top-20">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900">Navigasi Soal</h3>
            <span className="text-xs font-mono-tabular text-slate-600">
              {answeredCount}/{questions.length} terjawab
            </span>
          </div>

          <div className="grid grid-cols-5 gap-2">
            {questions.map((q, idx) => {
              const ans = answersMap[q.id];
              const isAnswered =
                q.question_type === 'pg'
                  ? Boolean(ans?.selected_option)
                  : Boolean(ans?.essay_answer && ans.essay_answer.trim().length > 0);
              const isFlagged = Boolean(ans?.is_flagged);
              const isCurrent = idx === currentIndex;

              let style = 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50';
              if (isFlagged) {
                style = 'bg-amber-50 border-amber-400 text-amber-900';
              } else if (isAnswered) {
                style = 'bg-emerald-50 border-emerald-500 text-emerald-900';
              }

              return (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => setCurrentIndex(idx)}
                  className={`h-10 rounded-lg border font-mono-tabular text-xs font-bold transition-colors ${style} ${
                    isCurrent ? 'ring-2 ring-blue-900 ring-offset-1' : ''
                  }`}
                >
                  {idx + 1}
                </button>
              );
            })}
          </div>

          <div className="pt-3 border-t border-slate-200 space-y-1.5 text-xs text-slate-600">
            <div className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 rounded bg-emerald-50 border border-emerald-500 inline-block" />
              <span>Sudah dijawab</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 rounded bg-amber-50 border border-amber-400 inline-block" />
              <span>Ditandai ragu-ragu</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 rounded bg-white border border-slate-300 inline-block" />
              <span>Belum dijawab</span>
            </div>
          </div>
        </aside>
      </div>

      {/* Mobile Navigation Grid Drawer */}
      {mobileGridOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-end sm:items-center justify-center p-4 lg:hidden">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-md p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">
                Navigasi Soal ({answeredCount}/{questions.length} terjawab)
              </h3>
              <button type="button" onClick={() => setMobileGridOpen(false)}>
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <div className="grid grid-cols-5 gap-2 max-h-72 overflow-y-auto">
              {questions.map((q, idx) => {
                const ans = answersMap[q.id];
                const isAnswered =
                  q.question_type === 'pg'
                    ? Boolean(ans?.selected_option)
                    : Boolean(ans?.essay_answer && ans.essay_answer.trim().length > 0);
                const isFlagged = Boolean(ans?.is_flagged);
                return (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => {
                      setCurrentIndex(idx);
                      setMobileGridOpen(false);
                    }}
                    className={`h-11 rounded-lg border font-mono-tabular text-xs font-bold ${
                      isFlagged
                        ? 'bg-amber-50 border-amber-400 text-amber-900'
                        : isAnswered
                          ? 'bg-emerald-50 border-emerald-500 text-emerald-900'
                          : 'bg-white border-slate-300 text-slate-700'
                    } ${idx === currentIndex ? 'ring-2 ring-blue-900' : ''}`}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Modal Konfirmasi Akhiri Ujian */}
      {confirmOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-900">Konfirmasi Pengumpulan Ujian</h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              Anda telah menjawab{' '}
              <span className="font-mono-tabular font-bold text-slate-900">
                {answeredCount} dari {questions.length}
              </span>{' '}
              soal. Setelah ujian diakhiri, jawaban tidak dapat diubah lagi.
            </p>
            {answeredCount < questions.length && (
              <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3">
                Masih terdapat {questions.length - answeredCount} soal yang belum terjawab.
              </p>
            )}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={submitting}
                onClick={() => setConfirmOpen(false)}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg"
              >
                Periksa Lagi
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={() => handleSubmitExam(false)}
                className="px-4 py-2 text-sm font-semibold text-white bg-blue-900 hover:bg-blue-950 disabled:opacity-50 rounded-lg"
              >
                {submitting ? 'Mengumpulkan...' : 'Ya, Akhiri Ujian'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Zoom Gambar */}
      {zoomImageUrl && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/80 flex items-center justify-center p-4"
          onClick={() => setZoomImageUrl(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh]">
            <img
              src={zoomImageUrl}
              alt="Perbesaran gambar soal"
              referrerPolicy="no-referrer"
              className="max-w-full max-h-[85vh] rounded-lg bg-white object-contain"
            />
          </div>
        </div>
      )}
    </div>
  );
};
