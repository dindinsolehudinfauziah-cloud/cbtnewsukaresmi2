import React, { useEffect, useMemo, useState } from 'react';
import {
  Image as ImageIcon,
  Pencil,
  Plus,
  Search,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import {
  deleteQuestionImageByUrl,
  getSupabaseClient,
  uploadQuestionImage,
} from '../../lib/supabase';
import type {
  DifficultyLevel,
  Question,
  QuestionType,
  Subject,
} from '../../types/database';

interface QuestionBankPanelProps {
  subjects: Subject[];
  currentUserId: string;
  defaultSubjectId?: string | null;
  restrictToSubjectId?: string | null;
  onChanged?: () => Promise<void>;
}

interface QuestionFormState {
  id?: string;
  subject_id: string;
  question_type: QuestionType;
  question_text: string;
  image_url: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_option: 'A' | 'B' | 'C' | 'D';
  essay_rubric: string;
  weight: string;
  difficulty: DifficultyLevel;
}

export const QuestionBankPanel: React.FC<QuestionBankPanelProps> = ({
  subjects,
  currentUserId,
  defaultSubjectId,
  restrictToSubjectId,
  onChanged,
}) => {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterSubject, setFilterSubject] = useState<string>(restrictToSubjectId || 'all');
  const [filterType, setFilterType] = useState<'all' | QuestionType>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingImg, setUploadingImg] = useState(false);

  const initialSubject = restrictToSubjectId || defaultSubjectId || subjects[0]?.id || '';

  const [form, setForm] = useState<QuestionFormState>({
    subject_id: initialSubject,
    question_type: 'pg',
    question_text: '',
    image_url: '',
    option_a: '',
    option_b: '',
    option_c: '',
    option_d: '',
    correct_option: 'A',
    essay_rubric: '',
    weight: '1',
    difficulty: 'sedang',
  });

  const loadQuestions = async () => {
    setLoading(true);
    setError(null);
    try {
      const supabase = getSupabaseClient();
      let query = supabase
        .from('questions')
        .select('*, subjects(*)')
        .order('created_at', { ascending: false });

      if (restrictToSubjectId) {
        query = query.eq('subject_id', restrictToSubjectId);
      }

      const { data, error: fetchErr } = await query;
      if (fetchErr) throw fetchErr;
      setQuestions((data as Question[]) || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat bank soal.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadQuestions();
  }, [restrictToSubjectId]);

  const filteredQuestions = useMemo(() => {
    const q = search.trim().toLowerCase();
    return questions.filter((item) => {
      if (filterSubject !== 'all' && item.subject_id !== filterSubject) return false;
      if (filterType !== 'all' && item.question_type !== filterType) return false;
      if (q && !item.question_text.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [questions, filterSubject, filterType, search]);

  const openCreateModal = () => {
    setForm({
      subject_id:
        restrictToSubjectId ||
        (filterSubject !== 'all' ? filterSubject : defaultSubjectId || subjects[0]?.id || ''),
      question_type: 'pg',
      question_text: '',
      image_url: '',
      option_a: '',
      option_b: '',
      option_c: '',
      option_d: '',
      correct_option: 'A',
      essay_rubric: '',
      weight: '1',
      difficulty: 'sedang',
    });
    setModalOpen(true);
  };

  const openEditModal = (item: Question) => {
    setForm({
      id: item.id,
      subject_id: item.subject_id,
      question_type: item.question_type,
      question_text: item.question_text,
      image_url: item.image_url || '',
      option_a: item.option_a || '',
      option_b: item.option_b || '',
      option_c: item.option_c || '',
      option_d: item.option_d || '',
      correct_option: item.correct_option || 'A',
      essay_rubric: item.essay_rubric || '',
      weight: String(item.weight ?? 1),
      difficulty: item.difficulty || 'sedang',
    });
    setModalOpen(true);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImg(true);
    setError(null);
    try {
      const publicUrl = await uploadQuestionImage(file);
      setForm((prev) => ({ ...prev, image_url: publicUrl }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal mengunggah gambar soal.');
    } finally {
      setUploadingImg(false);
      e.target.value = '';
    }
  };

  const handleRemoveImage = async () => {
    if (!form.image_url) return;
    try {
      await deleteQuestionImageByUrl(form.image_url);
    } catch {
      // Tetap hapus referensi gambar dari soal meskipun file storage tidak ditemukan
    }
    setForm((prev) => ({ ...prev, image_url: '' }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!form.subject_id) {
      setError('Pilih mata pelajaran terlebih dahulu.');
      return;
    }
    if (!form.question_text.trim()) {
      setError('Teks pertanyaan wajib diisi.');
      return;
    }
    if (form.question_type === 'pg') {
      if (
        !form.option_a.trim() ||
        !form.option_b.trim() ||
        !form.option_c.trim() ||
        !form.option_d.trim()
      ) {
        setError('Semua pilihan jawaban A, B, C, dan D wajib diisi.');
        return;
      }
    }

    setSaving(true);
    try {
      const supabase = getSupabaseClient();
      const payload = {
        subject_id: form.subject_id,
        question_type: form.question_type,
        question_text: form.question_text.trim(),
        image_url: form.image_url.trim() || null,
        option_a: form.question_type === 'pg' ? form.option_a.trim() : null,
        option_b: form.question_type === 'pg' ? form.option_b.trim() : null,
        option_c: form.question_type === 'pg' ? form.option_c.trim() : null,
        option_d: form.question_type === 'pg' ? form.option_d.trim() : null,
        correct_option: form.question_type === 'pg' ? form.correct_option : null,
        essay_rubric: form.question_type === 'essay' ? form.essay_rubric.trim() || null : null,
        weight: Math.max(0.5, Number(form.weight) || 1),
        difficulty: form.difficulty,
      };

      if (form.id) {
        const { error: updateErr } = await supabase
          .from('questions')
          .update(payload)
          .eq('id', form.id);
        if (updateErr) throw updateErr;
      } else {
        const { error: insertErr } = await supabase
          .from('questions')
          .insert({ ...payload, created_by: currentUserId });
        if (insertErr) throw insertErr;
      }

      setModalOpen(false);
      await loadQuestions();
      if (onChanged) await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan soal.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item: Question) => {
    setError(null);
    try {
      const supabase = getSupabaseClient();
      const { error: delErr } = await supabase.from('questions').delete().eq('id', item.id);
      if (delErr) throw delErr;
      if (item.image_url) {
        await deleteQuestionImageByUrl(item.image_url);
      }
      await loadQuestions();
      if (onChanged) await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menghapus soal.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari teks soal..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-900"
            />
          </div>

          {!restrictToSubjectId && (
            <select
              value={filterSubject}
              onChange={(e) => setFilterSubject(e.target.value)}
              className="px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-900"
            >
              <option value="all">Semua Mata Pelajaran</option>
              {subjects.map((sub) => (
                <option key={sub.id} value={sub.id}>
                  {sub.name}
                </option>
              ))}
            </select>
          )}

          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg shrink-0">
            {(['all', 'pg', 'essay'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setFilterType(t)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  filterType === t
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {t === 'all' ? 'Semua Tipe' : t === 'pg' ? 'Pilihan Ganda' : 'Essay'}
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={openCreateModal}
          disabled={subjects.length === 0}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-900 hover:bg-blue-950 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Tambah Soal</span>
        </button>
      </div>

      {error && (
        <div className="p-3.5 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
          {error}
        </div>
      )}

      {/* List Soal */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3].map((n) => (
              <div key={n} className="h-16 bg-slate-100 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : filteredQuestions.length === 0 ? (
          <div className="p-10 text-center space-y-3">
            <p className="text-sm font-medium text-slate-700">
              Belum ada soal pada filter ini.
            </p>
            <p className="text-xs text-slate-500">
              Tambahkan soal Pilihan Ganda atau Essay beserta gambar pendukung jika diperlukan.
            </p>
            <button
              type="button"
              onClick={openCreateModal}
              disabled={subjects.length === 0}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-900 text-white text-xs font-semibold rounded-lg hover:bg-blue-950"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Buat Soal Pertama</span>
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {filteredQuestions.map((item, idx) => (
              <div
                key={item.id}
                className="p-4 sm:p-5 hover:bg-slate-50/70 transition-colors flex flex-col sm:flex-row sm:items-start justify-between gap-4"
              >
                <div className="space-y-2 min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                    <span className="font-mono-tabular font-semibold text-slate-700">
                      #{idx + 1}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="font-medium text-slate-800">
                      {item.subjects?.name || '-'}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{item.question_type === 'pg' ? 'Pilihan Ganda' : 'Essay'}</span>
                    <span aria-hidden="true">·</span>
                    <span className="capitalize">{item.difficulty}</span>
                    <span aria-hidden="true">·</span>
                    <span className="tabular-nums">Bobot {item.weight}</span>
                  </div>

                  <p className="text-sm text-slate-900 leading-relaxed whitespace-pre-line">
                    {item.question_text}
                  </p>

                  {item.image_url && (
                    <div className="pt-1">
                      <img
                        src={item.image_url}
                        alt="Lampiran gambar soal"
                        referrerPolicy="no-referrer"
                        className="max-h-40 rounded-lg border border-slate-200 object-contain bg-slate-50"
                      />
                    </div>
                  )}

                  {item.question_type === 'pg' ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1 text-xs">
                      {(['A', 'B', 'C', 'D'] as const).map((opt) => {
                        const val =
                          opt === 'A'
                            ? item.option_a
                            : opt === 'B'
                              ? item.option_b
                              : opt === 'C'
                                ? item.option_c
                                : item.option_d;
                        const isKey = item.correct_option === opt;
                        return (
                          <div
                            key={opt}
                            className={`px-2.5 py-1.5 rounded border ${
                              isKey
                                ? 'bg-emerald-50 border-emerald-300 text-emerald-900 font-medium'
                                : 'bg-slate-50 border-slate-200 text-slate-700'
                            }`}
                          >
                            <span className="font-mono-tabular font-semibold mr-1.5">{opt}.</span>
                            <span>{val}</span>
                            {isKey && <span className="ml-2 text-emerald-700">(Kunci)</span>}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    item.essay_rubric && (
                      <p className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded px-3 py-2">
                        <span className="font-semibold text-slate-800">Pedoman Penilaian: </span>
                        {item.essay_rubric}
                      </p>
                    )
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => openEditModal(item)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    <span>Edit</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(item)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-700 bg-white border border-red-200 hover:bg-red-50 rounded-lg"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Hapus</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal Tambah / Edit Soal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-xl max-w-2xl w-full max-h-[92vh] flex flex-col overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900">
                {form.id ? 'Edit Soal Ujian' : 'Tambah Soal Baru'}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1.5 text-slate-500 hover:text-slate-900 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-5 space-y-4 overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Mata Pelajaran
                  </label>
                  <select
                    value={form.subject_id}
                    disabled={Boolean(restrictToSubjectId)}
                    onChange={(e) => setForm((p) => ({ ...p, subject_id: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white disabled:bg-slate-100"
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
                  <label className="block text-xs font-medium text-slate-700 mb-1">Tipe Soal</label>
                  <select
                    value={form.question_type}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, question_type: e.target.value as QuestionType }))
                    }
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="pg">Pilihan Ganda (PG)</option>
                    <option value="essay">Uraian (Essay)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Pertanyaan Soal
                </label>
                <textarea
                  rows={4}
                  required
                  value={form.question_text}
                  onChange={(e) => setForm((p) => ({ ...p, question_text: e.target.value }))}
                  placeholder="Tuliskan teks pertanyaan secara jelas..."
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-900"
                />
              </div>

              {/* Gambar Soal (Supabase Storage) */}
              <div className="space-y-2">
                <label className="block text-xs font-medium text-slate-700">
                  Gambar Pendukung Soal (Opsional · Supabase Storage)
                </label>
                <div className="flex flex-wrap items-center gap-3">
                  <label className="inline-flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer">
                    <Upload className="w-3.5 h-3.5" />
                    <span>{uploadingImg ? 'Mengunggah...' : 'Unggah Gambar'}</span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      className="hidden"
                      disabled={uploadingImg}
                      onChange={handleImageUpload}
                    />
                  </label>
                  {form.image_url && (
                    <button
                      type="button"
                      onClick={handleRemoveImage}
                      className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 rounded-lg"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Hapus Gambar</span>
                    </button>
                  )}
                </div>
                {form.image_url ? (
                  <img
                    src={form.image_url}
                    alt="Pratinjau gambar soal"
                    referrerPolicy="no-referrer"
                    className="max-h-44 rounded-lg border border-slate-200 object-contain bg-slate-50"
                  />
                ) : (
                  <p className="text-xs text-slate-500 flex items-center gap-1.5">
                    <ImageIcon className="w-3.5 h-3.5" />
                    <span>Format JPG/PNG/WEBP/GIF maksimal 3 MB.</span>
                  </p>
                )}
              </div>

              {form.question_type === 'pg' ? (
                <div className="space-y-3 pt-2 border-t border-slate-200">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {(['A', 'B', 'C', 'D'] as const).map((opt) => {
                      const field =
                        opt === 'A'
                          ? 'option_a'
                          : opt === 'B'
                            ? 'option_b'
                            : opt === 'C'
                              ? 'option_c'
                              : 'option_d';
                      return (
                        <div key={opt}>
                          <label className="block text-xs font-medium text-slate-700 mb-1">
                            Pilihan {opt}
                          </label>
                          <input
                            type="text"
                            required
                            value={form[field]}
                            onChange={(e) =>
                              setForm((p) => ({ ...p, [field]: e.target.value }))
                            }
                            placeholder={`Jawaban ${opt}`}
                            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                          />
                        </div>
                      );
                    })}
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Kunci Jawaban Benar
                    </label>
                    <select
                      value={form.correct_option}
                      onChange={(e) =>
                        setForm((p) => ({
                          ...p,
                          correct_option: e.target.value as 'A' | 'B' | 'C' | 'D',
                        }))
                      }
                      className="w-full sm:w-48 px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                    >
                      <option value="A">Pilihan A</option>
                      <option value="B">Pilihan B</option>
                      <option value="C">Pilihan C</option>
                      <option value="D">Pilihan D</option>
                    </select>
                  </div>
                </div>
              ) : (
                <div className="pt-2 border-t border-slate-200">
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Pedoman / Kunci Jawaban Essay (Hanya tampil untuk Guru & Admin)
                  </label>
                  <textarea
                    rows={3}
                    value={form.essay_rubric}
                    onChange={(e) => setForm((p) => ({ ...p, essay_rubric: e.target.value }))}
                    placeholder="Tuliskan poin kunci atau rubrik penilaian essay..."
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-200">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Tingkat Kesulitan
                  </label>
                  <select
                    value={form.difficulty}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, difficulty: e.target.value as DifficultyLevel }))
                    }
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="mudah">Mudah</option>
                    <option value="sedang">Sedang</option>
                    <option value="sulit">Sulit</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Bobot Poin Default
                  </label>
                  <input
                    type="number"
                    min="0.5"
                    step="0.5"
                    value={form.weight}
                    onChange={(e) => setForm((p) => ({ ...p, weight: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg tabular-nums"
                  />
                </div>
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
                  disabled={saving || uploadingImg}
                  className="px-4 py-2 text-sm font-semibold text-white bg-blue-900 hover:bg-blue-950 disabled:opacity-50 rounded-lg"
                >
                  {saving ? 'Menyimpan...' : 'Simpan Soal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
