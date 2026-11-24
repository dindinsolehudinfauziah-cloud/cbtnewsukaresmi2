import React, { useEffect, useState } from 'react';
import {
  KeyRound,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import {
  createManagedUser,
  deleteManagedUser,
  getSupabaseClient,
  resetManagedUserPassword,
} from '../../lib/supabase';
import type {
  AcademicYear,
  SchoolClass,
  SchoolSettings,
  Student,
  Subject,
  Teacher,
} from '../../types/database';

type MasterSubTab =
  | 'teachers'
  | 'students'
  | 'classes'
  | 'subjects'
  | 'academic_years'
  | 'settings';

interface MasterDataPanelProps {
  teachers: Teacher[];
  students: Student[];
  classes: SchoolClass[];
  subjects: Subject[];
  academicYears: AcademicYear[];
  schoolSettings: SchoolSettings | null;
  onRefresh: () => Promise<void>;
}

export const MasterDataPanel: React.FC<MasterDataPanelProps> = ({
  teachers,
  students,
  classes,
  subjects,
  academicYears,
  schoolSettings,
  onRefresh,
}) => {
  const [tab, setTab] = useState<MasterSubTab>('teachers');
  const [search, setSearch] = useState('');
  const [filterClassId, setFilterClassId] = useState('all');
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Modal state Guru
  const [teacherModal, setTeacherModal] = useState<{
    mode: 'create' | 'edit';
    id?: string;
    profile_id?: string;
    username: string;
    email: string;
    password: string;
    full_name: string;
    nip: string;
    subject_id: string;
    phone: string;
  } | null>(null);

  // Modal state Siswa
  const [studentModal, setStudentModal] = useState<{
    mode: 'create' | 'edit';
    id?: string;
    profile_id?: string;
    username: string;
    email: string;
    password: string;
    full_name: string;
    nis: string;
    nisn: string;
    class_id: string;
    gender: 'L' | 'P';
  } | null>(null);

  // Modal Reset Password
  const [passwordModal, setPasswordModal] = useState<{
    userId: string;
    fullName: string;
    newPassword: string;
  } | null>(null);

  // Modal Kelas
  const [classModal, setClassModal] = useState<{
    id?: string;
    name: string;
    grade_level: string;
    academic_year_id: string;
    homeroom_teacher: string;
  } | null>(null);

  // Modal Mapel
  const [subjectModal, setSubjectModal] = useState<{
    id?: string;
    code: string;
    name: string;
    kkm: string;
  } | null>(null);

  // Modal Tahun Pelajaran
  const [yearModal, setYearModal] = useState<{
    id?: string;
    name: string;
    semester: 'Ganjil' | 'Genap';
    is_active: boolean;
  } | null>(null);

  // State Pengaturan Sekolah
  const [settingsForm, setSettingsForm] = useState({
    school_name: schoolSettings?.school_name || 'SMP Negeri 2 Sukaresmi',
    npsn: schoolSettings?.npsn || '',
    address: schoolSettings?.address || '',
    headmaster_name: schoolSettings?.headmaster_name || '',
    headmaster_nip: schoolSettings?.headmaster_nip || '',
    exam_rules: schoolSettings?.exam_rules || '',
  });

  useEffect(() => {
    if (schoolSettings) {
      setSettingsForm({
        school_name: schoolSettings.school_name || 'SMP Negeri 2 Sukaresmi',
        npsn: schoolSettings.npsn || '',
        address: schoolSettings.address || '',
        headmaster_name: schoolSettings.headmaster_name || '',
        headmaster_nip: schoolSettings.headmaster_nip || '',
        exam_rules: schoolSettings.exam_rules || '',
      });
    }
  }, [schoolSettings]);

  const notifySuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 3500);
  };

  // --- HANDLERS GURU ---
  const handleSaveTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teacherModal) return;
    setSaving(true);
    setError(null);
    try {
      const supabase = getSupabaseClient();
      if (teacherModal.mode === 'create') {
        await createManagedUser({
          username: teacherModal.username,
          email: teacherModal.email,
          password: teacherModal.password,
          full_name: teacherModal.full_name,
          role: 'guru',
          nip: teacherModal.nip,
          subject_id: teacherModal.subject_id || null,
          phone: teacherModal.phone,
        });
        notifySuccess('Akun guru berhasil ditambahkan.');
      } else if (teacherModal.id && teacherModal.profile_id) {
        const { error: pErr } = await supabase
          .from('profiles')
          .update({
            full_name: teacherModal.full_name.trim(),
            username: teacherModal.username.trim().toLowerCase(),
          })
          .eq('id', teacherModal.profile_id);
        if (pErr) throw pErr;

        const { error: tErr } = await supabase
          .from('teachers')
          .update({
            nip: teacherModal.nip.trim() || null,
            subject_id: teacherModal.subject_id || null,
            phone: teacherModal.phone.trim() || null,
          })
          .eq('id', teacherModal.id);
        if (tErr) throw tErr;
        notifySuccess('Data guru berhasil diperbarui.');
      }
      setTeacherModal(null);
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan data guru.');
    } finally {
      setSaving(false);
    }
  };

  // --- HANDLERS SISWA ---
  const handleSaveStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentModal) return;
    setSaving(true);
    setError(null);
    try {
      const supabase = getSupabaseClient();
      if (studentModal.mode === 'create') {
        await createManagedUser({
          username: studentModal.username,
          email: studentModal.email,
          password: studentModal.password,
          full_name: studentModal.full_name,
          role: 'siswa',
          nis: studentModal.nis,
          nisn: studentModal.nisn,
          class_id: studentModal.class_id || null,
          gender: studentModal.gender,
        });
        notifySuccess('Akun siswa berhasil ditambahkan.');
      } else if (studentModal.id && studentModal.profile_id) {
        const { error: pErr } = await supabase
          .from('profiles')
          .update({
            full_name: studentModal.full_name.trim(),
            username: studentModal.username.trim().toLowerCase(),
          })
          .eq('id', studentModal.profile_id);
        if (pErr) throw pErr;

        const { error: sErr } = await supabase
          .from('students')
          .update({
            nis: studentModal.nis.trim() || null,
            nisn: studentModal.nisn.trim() || null,
            class_id: studentModal.class_id || null,
            gender: studentModal.gender,
          })
          .eq('id', studentModal.id);
        if (sErr) throw sErr;
        notifySuccess('Data siswa berhasil diperbarui.');
      }
      setStudentModal(null);
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan data siswa.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteUserAccount = async (profileId: string) => {
    setError(null);
    try {
      await deleteManagedUser(profileId);
      notifySuccess('Akun pengguna berhasil dihapus.');
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menghapus akun.');
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordModal) return;
    setSaving(true);
    setError(null);
    try {
      await resetManagedUserPassword(passwordModal.userId, passwordModal.newPassword);
      setPasswordModal(null);
      notifySuccess('Kata sandi pengguna berhasil diperbarui.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memperbarui kata sandi.');
    } finally {
      setSaving(false);
    }
  };

  // --- HANDLERS KELAS ---
  const handleSaveClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!classModal) return;
    setSaving(true);
    setError(null);
    try {
      const supabase = getSupabaseClient();
      const payload = {
        name: classModal.name.trim(),
        grade_level: Number(classModal.grade_level),
        academic_year_id: classModal.academic_year_id || null,
        homeroom_teacher: classModal.homeroom_teacher.trim() || null,
      };
      if (classModal.id) {
        const { error: updErr } = await supabase.from('classes').update(payload).eq('id', classModal.id);
        if (updErr) throw updErr;
      } else {
        const { error: insErr } = await supabase.from('classes').insert(payload);
        if (insErr) throw insErr;
      }
      setClassModal(null);
      notifySuccess('Data kelas berhasil disimpan.');
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan kelas.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteClass = async (id: string) => {
    setError(null);
    try {
      const supabase = getSupabaseClient();
      const { error: delErr } = await supabase.from('classes').delete().eq('id', id);
      if (delErr) throw delErr;
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menghapus kelas.');
    }
  };

  // --- HANDLERS MAPEL ---
  const handleSaveSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subjectModal) return;
    setSaving(true);
    setError(null);
    try {
      const supabase = getSupabaseClient();
      const payload = {
        code: subjectModal.code.trim().toUpperCase(),
        name: subjectModal.name.trim(),
        kkm: Number(subjectModal.kkm) || 75,
      };
      if (subjectModal.id) {
        const { error: updErr } = await supabase.from('subjects').update(payload).eq('id', subjectModal.id);
        if (updErr) throw updErr;
      } else {
        const { error: insErr } = await supabase.from('subjects').insert(payload);
        if (insErr) throw insErr;
      }
      setSubjectModal(null);
      notifySuccess('Mata pelajaran berhasil disimpan.');
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan mata pelajaran.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSubject = async (id: string) => {
    setError(null);
    try {
      const supabase = getSupabaseClient();
      const { error: delErr } = await supabase.from('subjects').delete().eq('id', id);
      if (delErr) throw delErr;
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menghapus mata pelajaran.');
    }
  };

  // --- HANDLERS TAHUN PELAJARAN ---
  const handleSaveYear = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!yearModal) return;
    setSaving(true);
    setError(null);
    try {
      const supabase = getSupabaseClient();
      if (yearModal.is_active) {
        await supabase.from('academic_years').update({ is_active: false }).neq('id', yearModal.id || '');
      }
      const payload = {
        name: yearModal.name.trim(),
        semester: yearModal.semester,
        is_active: yearModal.is_active,
      };
      if (yearModal.id) {
        const { error: updErr } = await supabase.from('academic_years').update(payload).eq('id', yearModal.id);
        if (updErr) throw updErr;
      } else {
        const { error: insErr } = await supabase.from('academic_years').insert(payload);
        if (insErr) throw insErr;
      }
      setYearModal(null);
      notifySuccess('Tahun pelajaran berhasil disimpan.');
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan tahun pelajaran.');
    } finally {
      setSaving(false);
    }
  };

  const handleSetActiveYear = async (year: AcademicYear) => {
    setError(null);
    try {
      const supabase = getSupabaseClient();
      await supabase.from('academic_years').update({ is_active: false }).neq('id', year.id);
      const { error: updErr } = await supabase
        .from('academic_years')
        .update({ is_active: true })
        .eq('id', year.id);
      if (updErr) throw updErr;
      if (schoolSettings?.id) {
        await supabase
          .from('school_settings')
          .update({ academic_year_active_id: year.id })
          .eq('id', schoolSettings.id);
      }
      notifySuccess(`Tahun pelajaran ${year.name} (${year.semester}) diaktifkan.`);
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal mengaktifkan tahun pelajaran.');
    }
  };

  const handleDeleteYear = async (year: AcademicYear) => {
    if (year.is_active) {
      setError('Tahun pelajaran yang sedang aktif tidak dapat dihapus.');
      return;
    }
    setError(null);
    try {
      const supabase = getSupabaseClient();
      const { error: delErr } = await supabase.from('academic_years').delete().eq('id', year.id);
      if (delErr) throw delErr;
      notifySuccess('Tahun pelajaran berhasil dihapus.');
      await onRefresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Gagal menghapus tahun pelajaran. Pastikan tidak sedang digunakan oleh kelas atau ujian.'
      );
    }
  };

  // --- HANDLER PENGATURAN SEKOLAH ---
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const supabase = getSupabaseClient();
      if (schoolSettings?.id) {
        const { error: updErr } = await supabase
          .from('school_settings')
          .update(settingsForm)
          .eq('id', schoolSettings.id);
        if (updErr) throw updErr;
      } else {
        const { error: insErr } = await supabase.from('school_settings').insert(settingsForm);
        if (insErr) throw insErr;
      }
      notifySuccess('Pengaturan sekolah berhasil disimpan.');
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan pengaturan sekolah.');
    } finally {
      setSaving(false);
    }
  };

  const q = search.trim().toLowerCase();
  const filteredTeachers = teachers.filter((t) => {
    if (!q) return true;
    return (
      t.profiles?.full_name?.toLowerCase().includes(q) ||
      t.profiles?.username?.toLowerCase().includes(q) ||
      (t.nip || '').toLowerCase().includes(q)
    );
  });

  const filteredStudents = students.filter((s) => {
    if (filterClassId !== 'all' && s.class_id !== filterClassId) return false;
    if (!q) return true;
    return (
      s.profiles?.full_name?.toLowerCase().includes(q) ||
      s.profiles?.username?.toLowerCase().includes(q) ||
      (s.nis || '').toLowerCase().includes(q) ||
      (s.nisn || '').toLowerCase().includes(q)
    );
  });

  const subTabs: { id: MasterSubTab; label: string }[] = [
    { id: 'teachers', label: `Guru (${teachers.length})` },
    { id: 'students', label: `Siswa (${students.length})` },
    { id: 'classes', label: `Kelas (${classes.length})` },
    { id: 'subjects', label: `Mata Pelajaran (${subjects.length})` },
    { id: 'academic_years', label: `Tahun Pelajaran (${academicYears.length})` },
    { id: 'settings', label: 'Identitas Sekolah' },
  ];

  return (
    <div className="space-y-6">
      {/* Sub-tab Segmented Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-2 flex flex-wrap gap-1">
        {subTabs.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              setTab(item.id);
              setError(null);
            }}
            className={`px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
              tab === item.id
                ? 'bg-blue-900 text-white'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="p-3.5 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
          {error}
        </div>
      )}
      {successMsg && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-800">
          {successMsg}
        </div>
      )}

      {/* TAB: GURU */}
      {tab === 'teachers' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari nama, username, atau NIP guru..."
                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
            <button
              type="button"
              onClick={() =>
                setTeacherModal({
                  mode: 'create',
                  username: '',
                  email: '',
                  password: '',
                  full_name: '',
                  nip: '',
                  subject_id: subjects[0]?.id || '',
                  phone: '',
                })
              }
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-900 hover:bg-blue-950 text-white text-xs font-semibold rounded-lg whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Guru</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                  <th className="py-3 px-4">Nama Guru</th>
                  <th className="py-3 px-4">Username</th>
                  <th className="py-3 px-4">NIP</th>
                  <th className="py-3 px-4">Mata Pelajaran</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm">
                {filteredTeachers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-500">
                      Belum ada data guru.
                    </td>
                  </tr>
                ) : (
                  filteredTeachers.map((t) => (
                    <tr key={t.id} className="hover:bg-slate-50/70">
                      <td className="py-3 px-4 font-semibold text-slate-900">
                        {t.profiles?.full_name || '-'}
                      </td>
                      <td className="py-3 px-4 font-mono-tabular text-xs text-slate-600">
                        {t.profiles?.username || '-'}
                      </td>
                      <td className="py-3 px-4 font-mono-tabular text-xs text-slate-700">
                        {t.nip || '-'}
                      </td>
                      <td className="py-3 px-4 text-slate-700">
                        {t.subjects?.name || 'Belum ditentukan'}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() =>
                              setTeacherModal({
                                mode: 'edit',
                                id: t.id,
                                profile_id: t.profile_id,
                                username: t.profiles?.username || '',
                                email: t.profiles?.email || '',
                                password: '',
                                full_name: t.profiles?.full_name || '',
                                nip: t.nip || '',
                                subject_id: t.subject_id || '',
                                phone: t.phone || '',
                              })
                            }
                            className="p-1.5 text-slate-600 hover:text-slate-900 border border-slate-200 rounded-lg"
                            title="Edit Guru"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setPasswordModal({
                                userId: t.profile_id,
                                fullName: t.profiles?.full_name || 'Guru',
                                newPassword: '',
                              })
                            }
                            className="p-1.5 text-slate-600 hover:text-blue-900 border border-slate-200 rounded-lg"
                            title="Reset Kata Sandi"
                          >
                            <KeyRound className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteUserAccount(t.profile_id)}
                            className="p-1.5 text-red-600 hover:text-red-800 border border-red-200 rounded-lg"
                            title="Hapus Akun Guru"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB: SISWA */}
      {tab === 'students' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="flex flex-col sm:flex-row gap-3 flex-1">
              <div className="relative flex-1 max-w-sm">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Cari nama, username, NIS, atau NISN..."
                  className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
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
            <button
              type="button"
              onClick={() =>
                setStudentModal({
                  mode: 'create',
                  username: '',
                  email: '',
                  password: '',
                  full_name: '',
                  nis: '',
                  nisn: '',
                  class_id: classes[0]?.id || '',
                  gender: 'L',
                })
              }
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-900 hover:bg-blue-950 text-white text-xs font-semibold rounded-lg whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Siswa</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                  <th className="py-3 px-4">Nama Siswa</th>
                  <th className="py-3 px-4">Username</th>
                  <th className="py-3 px-4">NIS / NISN</th>
                  <th className="py-3 px-4">Kelas</th>
                  <th className="py-3 px-4">L/P</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm">
                {filteredStudents.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-500">
                      Belum ada data siswa.
                    </td>
                  </tr>
                ) : (
                  filteredStudents.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50/70">
                      <td className="py-3 px-4 font-semibold text-slate-900">
                        {s.profiles?.full_name || '-'}
                      </td>
                      <td className="py-3 px-4 font-mono-tabular text-xs text-slate-600">
                        {s.profiles?.username || '-'}
                      </td>
                      <td className="py-3 px-4 font-mono-tabular text-xs text-slate-700">
                        {s.nis || '-'} / {s.nisn || '-'}
                      </td>
                      <td className="py-3 px-4 text-slate-700">
                        {s.classes?.name || 'Belum ada kelas'}
                      </td>
                      <td className="py-3 px-4 text-slate-700">{s.gender || '-'}</td>
                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() =>
                              setStudentModal({
                                mode: 'edit',
                                id: s.id,
                                profile_id: s.profile_id,
                                username: s.profiles?.username || '',
                                email: s.profiles?.email || '',
                                password: '',
                                full_name: s.profiles?.full_name || '',
                                nis: s.nis || '',
                                nisn: s.nisn || '',
                                class_id: s.class_id || '',
                                gender: s.gender || 'L',
                              })
                            }
                            className="p-1.5 text-slate-600 hover:text-slate-900 border border-slate-200 rounded-lg"
                            title="Edit Siswa"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setPasswordModal({
                                userId: s.profile_id,
                                fullName: s.profiles?.full_name || 'Siswa',
                                newPassword: '',
                              })
                            }
                            className="p-1.5 text-slate-600 hover:text-blue-900 border border-slate-200 rounded-lg"
                            title="Reset Kata Sandi"
                          >
                            <KeyRound className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteUserAccount(s.profile_id)}
                            className="p-1.5 text-red-600 hover:text-red-800 border border-red-200 rounded-lg"
                            title="Hapus Akun Siswa"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB: KELAS */}
      {tab === 'classes' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900">Daftar Rombongan Belajar</h3>
            <button
              type="button"
              onClick={() =>
                setClassModal({
                  name: '',
                  grade_level: '7',
                  academic_year_id:
                    academicYears.find((y) => y.is_active)?.id || academicYears[0]?.id || '',
                  homeroom_teacher: '',
                })
              }
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-900 hover:bg-blue-950 text-white text-xs font-semibold rounded-lg"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Kelas</span>
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                  <th className="py-3 px-4">Nama Kelas</th>
                  <th className="py-3 px-4">Tingkat</th>
                  <th className="py-3 px-4">Tahun Pelajaran</th>
                  <th className="py-3 px-4">Wali Kelas</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm">
                {classes.map((cls) => (
                  <tr key={cls.id}>
                    <td className="py-3 px-4 font-semibold text-slate-900">{cls.name}</td>
                    <td className="py-3 px-4 text-slate-700">Kelas {cls.grade_level}</td>
                    <td className="py-3 px-4 text-slate-600">
                      {cls.academic_years
                        ? `${cls.academic_years.name} (${cls.academic_years.semester})`
                        : '-'}
                    </td>
                    <td className="py-3 px-4 text-slate-600">{cls.homeroom_teacher || '-'}</td>
                    <td className="py-3 px-4 text-right space-x-2">
                      <button
                        type="button"
                        onClick={() =>
                          setClassModal({
                            id: cls.id,
                            name: cls.name,
                            grade_level: String(cls.grade_level),
                            academic_year_id: cls.academic_year_id || '',
                            homeroom_teacher: cls.homeroom_teacher || '',
                          })
                        }
                        className="p-1.5 text-slate-600 hover:text-slate-900 border border-slate-200 rounded-lg"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteClass(cls.id)}
                        className="p-1.5 text-red-600 hover:text-red-800 border border-red-200 rounded-lg"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB: MATA PELAJARAN */}
      {tab === 'subjects' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900">Daftar Mata Pelajaran</h3>
            <button
              type="button"
              onClick={() => setSubjectModal({ code: '', name: '', kkm: '75' })}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-900 hover:bg-blue-950 text-white text-xs font-semibold rounded-lg"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Mapel</span>
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                  <th className="py-3 px-4">Kode</th>
                  <th className="py-3 px-4">Nama Mata Pelajaran</th>
                  <th className="py-3 px-4 text-right">KKM</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm">
                {subjects.map((sub) => (
                  <tr key={sub.id}>
                    <td className="py-3 px-4 font-mono-tabular text-xs font-semibold text-slate-700">
                      {sub.code}
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-900">{sub.name}</td>
                    <td className="py-3 px-4 text-right font-mono-tabular text-slate-700">
                      {Number(sub.kkm).toFixed(0)}
                    </td>
                    <td className="py-3 px-4 text-right space-x-2">
                      <button
                        type="button"
                        onClick={() =>
                          setSubjectModal({
                            id: sub.id,
                            code: sub.code,
                            name: sub.name,
                            kkm: String(sub.kkm),
                          })
                        }
                        className="p-1.5 text-slate-600 hover:text-slate-900 border border-slate-200 rounded-lg"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteSubject(sub.id)}
                        className="p-1.5 text-red-600 hover:text-red-800 border border-red-200 rounded-lg"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB: TAHUN PELAJARAN */}
      {tab === 'academic_years' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900">Tahun Pelajaran & Semester</h3>
            <button
              type="button"
              onClick={() =>
                setYearModal({ name: '2025/2026', semester: 'Ganjil', is_active: false })
              }
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-900 hover:bg-blue-950 text-white text-xs font-semibold rounded-lg"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Tahun Pelajaran</span>
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                  <th className="py-3 px-4">Tahun Pelajaran</th>
                  <th className="py-3 px-4">Semester</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm">
                {academicYears.map((ay) => (
                  <tr key={ay.id}>
                    <td className="py-3 px-4 font-semibold text-slate-900 tabular-nums">
                      {ay.name}
                    </td>
                    <td className="py-3 px-4 text-slate-700">{ay.semester}</td>
                    <td className="py-3 px-4 text-xs font-medium">
                      {ay.is_active ? (
                        <span className="text-emerald-700">Aktif</span>
                      ) : (
                        <span className="text-slate-500">Arsip</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right space-x-2">
                      {!ay.is_active && (
                        <button
                          type="button"
                          onClick={() => handleSetActiveYear(ay)}
                          className="px-3 py-1.5 text-xs font-medium text-blue-900 bg-blue-50 border border-blue-200 rounded-lg"
                        >
                          Aktifkan
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() =>
                          setYearModal({
                            id: ay.id,
                            name: ay.name,
                            semester: ay.semester,
                            is_active: ay.is_active,
                          })
                        }
                        className="p-1.5 text-slate-600 hover:text-slate-900 border border-slate-200 rounded-lg"
                        title="Edit Tahun Pelajaran"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      {!ay.is_active && (
                        <button
                          type="button"
                          onClick={() => handleDeleteYear(ay)}
                          className="p-1.5 text-red-600 hover:text-red-800 border border-red-200 rounded-lg"
                          title="Hapus Tahun Pelajaran"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB: PENGATURAN SEKOLAH */}
      {tab === 'settings' && (
        <form
          onSubmit={handleSaveSettings}
          className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 space-y-4 max-w-2xl"
        >
          <h3 className="text-base font-semibold text-slate-900">
            Identitas Sekolah & Kop Laporan Resmi
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Nama Sekolah</label>
              <input
                type="text"
                required
                value={settingsForm.school_name}
                onChange={(e) =>
                  setSettingsForm((p) => ({ ...p, school_name: e.target.value }))
                }
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">NPSN</label>
              <input
                type="text"
                value={settingsForm.npsn}
                onChange={(e) => setSettingsForm((p) => ({ ...p, npsn: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono-tabular"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Alamat Sekolah</label>
            <input
              type="text"
              value={settingsForm.address}
              onChange={(e) => setSettingsForm((p) => ({ ...p, address: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Nama Kepala Sekolah
              </label>
              <input
                type="text"
                value={settingsForm.headmaster_name}
                onChange={(e) =>
                  setSettingsForm((p) => ({ ...p, headmaster_name: e.target.value }))
                }
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                NIP Kepala Sekolah
              </label>
              <input
                type="text"
                value={settingsForm.headmaster_nip}
                onChange={(e) =>
                  setSettingsForm((p) => ({ ...p, headmaster_nip: e.target.value }))
                }
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono-tabular"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Tata Tertib Ujian Siswa
            </label>
            <textarea
              rows={4}
              value={settingsForm.exam_rules}
              onChange={(e) => setSettingsForm((p) => ({ ...p, exam_rules: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 bg-blue-900 hover:bg-blue-950 disabled:opacity-50 text-white text-sm font-semibold rounded-lg"
          >
            {saving ? 'Menyimpan...' : 'Simpan Pengaturan'}
          </button>
        </form>
      )}

      {/* MODAL GURU */}
      {teacherModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl max-w-lg w-full overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900">
                {teacherModal.mode === 'create' ? 'Tambah Akun Guru' : 'Edit Data Guru'}
              </h3>
              <button type="button" onClick={() => setTeacherModal(null)}>
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <form onSubmit={handleSaveTeacher} className="p-5 space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Nama Lengkap</label>
                <input
                  type="text"
                  required
                  value={teacherModal.full_name}
                  onChange={(e) =>
                    setTeacherModal((p) => p && { ...p, full_name: e.target.value })
                  }
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Username</label>
                  <input
                    type="text"
                    required
                    value={teacherModal.username}
                    onChange={(e) =>
                      setTeacherModal((p) => p && { ...p, username: e.target.value })
                    }
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">NIP</label>
                  <input
                    type="text"
                    value={teacherModal.nip}
                    onChange={(e) => setTeacherModal((p) => p && { ...p, nip: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono-tabular"
                  />
                </div>
              </div>
              {teacherModal.mode === 'create' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Email (Opsional)
                    </label>
                    <input
                      type="email"
                      value={teacherModal.email}
                      onChange={(e) =>
                        setTeacherModal((p) => p && { ...p, email: e.target.value })
                      }
                      placeholder="otomatis jika kosong"
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Kata Sandi
                    </label>
                    <input
                      type="password"
                      required
                      minLength={6}
                      value={teacherModal.password}
                      onChange={(e) =>
                        setTeacherModal((p) => p && { ...p, password: e.target.value })
                      }
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                    />
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Mata Pelajaran Utama
                  </label>
                  <select
                    value={teacherModal.subject_id}
                    onChange={(e) =>
                      setTeacherModal((p) => p && { ...p, subject_id: e.target.value })
                    }
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
                  <label className="block text-xs font-medium text-slate-700 mb-1">No. HP</label>
                  <input
                    type="text"
                    value={teacherModal.phone}
                    onChange={(e) =>
                      setTeacherModal((p) => p && { ...p, phone: e.target.value })
                    }
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
              </div>
              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setTeacherModal(null)}
                  className="px-4 py-2 text-sm border border-slate-300 rounded-lg"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 text-sm font-semibold text-white bg-blue-900 rounded-lg disabled:opacity-50"
                >
                  {saving ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL SISWA */}
      {studentModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl max-w-lg w-full overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900">
                {studentModal.mode === 'create' ? 'Tambah Akun Siswa' : 'Edit Data Siswa'}
              </h3>
              <button type="button" onClick={() => setStudentModal(null)}>
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <form onSubmit={handleSaveStudent} className="p-5 space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Nama Lengkap</label>
                <input
                  type="text"
                  required
                  value={studentModal.full_name}
                  onChange={(e) =>
                    setStudentModal((p) => p && { ...p, full_name: e.target.value })
                  }
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Username</label>
                  <input
                    type="text"
                    required
                    value={studentModal.username}
                    onChange={(e) =>
                      setStudentModal((p) => p && { ...p, username: e.target.value })
                    }
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Kelas</label>
                  <select
                    value={studentModal.class_id}
                    onChange={(e) =>
                      setStudentModal((p) => p && { ...p, class_id: e.target.value })
                    }
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
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">NIS</label>
                  <input
                    type="text"
                    value={studentModal.nis}
                    onChange={(e) => setStudentModal((p) => p && { ...p, nis: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono-tabular"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">NISN</label>
                  <input
                    type="text"
                    value={studentModal.nisn}
                    onChange={(e) => setStudentModal((p) => p && { ...p, nisn: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono-tabular"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Jenis Kelamin
                  </label>
                  <select
                    value={studentModal.gender}
                    onChange={(e) =>
                      setStudentModal((p) => p && { ...p, gender: e.target.value as 'L' | 'P' })
                    }
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="L">Laki-laki</option>
                    <option value="P">Perempuan</option>
                  </select>
                </div>
              </div>
              {studentModal.mode === 'create' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Email (Opsional)
                    </label>
                    <input
                      type="email"
                      value={studentModal.email}
                      onChange={(e) =>
                        setStudentModal((p) => p && { ...p, email: e.target.value })
                      }
                      placeholder="otomatis jika kosong"
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Kata Sandi
                    </label>
                    <input
                      type="password"
                      required
                      minLength={6}
                      value={studentModal.password}
                      onChange={(e) =>
                        setStudentModal((p) => p && { ...p, password: e.target.value })
                      }
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                    />
                  </div>
                </div>
              )}
              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setStudentModal(null)}
                  className="px-4 py-2 text-sm border border-slate-300 rounded-lg"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 text-sm font-semibold text-white bg-blue-900 rounded-lg disabled:opacity-50"
                >
                  {saving ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL RESET PASSWORD */}
      {passwordModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl max-w-sm w-full overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900">Reset Kata Sandi</h3>
              <button type="button" onClick={() => setPasswordModal(null)}>
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <form onSubmit={handleResetPassword} className="p-5 space-y-4">
              <p className="text-xs text-slate-600">
                Pengguna: <span className="font-semibold text-slate-900">{passwordModal.fullName}</span>
              </p>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Kata Sandi Baru (Min. 6 karakter)
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={passwordModal.newPassword}
                  onChange={(e) =>
                    setPasswordModal((p) => p && { ...p, newPassword: e.target.value })
                  }
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setPasswordModal(null)}
                  className="px-4 py-2 text-sm border border-slate-300 rounded-lg"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 text-sm font-semibold text-white bg-blue-900 rounded-lg"
                >
                  Simpan Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL KELAS */}
      {classModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900">
                {classModal.id ? 'Edit Kelas' : 'Tambah Kelas'}
              </h3>
              <button type="button" onClick={() => setClassModal(null)}>
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <form onSubmit={handleSaveClass} className="p-5 space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Nama Kelas
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: VII-A"
                    value={classModal.name}
                    onChange={(e) => setClassModal((p) => p && { ...p, name: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Tingkat</label>
                  <select
                    value={classModal.grade_level}
                    onChange={(e) =>
                      setClassModal((p) => p && { ...p, grade_level: e.target.value })
                    }
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="7">Kelas 7</option>
                    <option value="8">Kelas 8</option>
                    <option value="9">Kelas 9</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Tahun Pelajaran
                </label>
                <select
                  value={classModal.academic_year_id}
                  onChange={(e) =>
                    setClassModal((p) => p && { ...p, academic_year_id: e.target.value })
                  }
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
                <label className="block text-xs font-medium text-slate-700 mb-1">Wali Kelas</label>
                <input
                  type="text"
                  value={classModal.homeroom_teacher}
                  onChange={(e) =>
                    setClassModal((p) => p && { ...p, homeroom_teacher: e.target.value })
                  }
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setClassModal(null)}
                  className="px-4 py-2 text-sm border border-slate-300 rounded-lg"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 text-sm font-semibold text-white bg-blue-900 rounded-lg"
                >
                  Simpan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL MAPEL */}
      {subjectModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900">
                {subjectModal.id ? 'Edit Mata Pelajaran' : 'Tambah Mata Pelajaran'}
              </h3>
              <button type="button" onClick={() => setSubjectModal(null)}>
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <form onSubmit={handleSaveSubject} className="p-5 space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Kode Mapel</label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: MTK"
                    value={subjectModal.code}
                    onChange={(e) =>
                      setSubjectModal((p) => p && { ...p, code: e.target.value })
                    }
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg uppercase font-mono-tabular"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">KKM</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    required
                    value={subjectModal.kkm}
                    onChange={(e) => setSubjectModal((p) => p && { ...p, kkm: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono-tabular"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Nama Mata Pelajaran
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Matematika"
                  value={subjectModal.name}
                  onChange={(e) => setSubjectModal((p) => p && { ...p, name: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSubjectModal(null)}
                  className="px-4 py-2 text-sm border border-slate-300 rounded-lg"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 text-sm font-semibold text-white bg-blue-900 rounded-lg"
                >
                  Simpan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL TAHUN PELAJARAN */}
      {yearModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900">
                {yearModal.id ? 'Edit Tahun Pelajaran' : 'Tambah Tahun Pelajaran'}
              </h3>
              <button type="button" onClick={() => setYearModal(null)}>
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <form onSubmit={handleSaveYear} className="p-5 space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Tahun Pelajaran
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: 2025/2026"
                  value={yearModal.name}
                  onChange={(e) => setYearModal((p) => p && { ...p, name: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg tabular-nums"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Semester</label>
                <select
                  value={yearModal.semester}
                  onChange={(e) =>
                    setYearModal(
                      (p) => p && { ...p, semester: e.target.value as 'Ganjil' | 'Genap' }
                    )
                  }
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                >
                  <option value="Ganjil">Ganjil</option>
                  <option value="Genap">Genap</option>
                </select>
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={yearModal.is_active}
                  onChange={(e) =>
                    setYearModal((p) => p && { ...p, is_active: e.target.checked })
                  }
                />
                <span>Jadikan Tahun Pelajaran Aktif</span>
              </label>
              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setYearModal(null)}
                  className="px-4 py-2 text-sm border border-slate-300 rounded-lg"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 text-sm font-semibold text-white bg-blue-900 rounded-lg"
                >
                  Simpan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
