import React, { useEffect, useState } from 'react';
import {
  BarChart3,
  BookOpen,
  CalendarClock,
  Database,
  LayoutDashboard,
} from 'lucide-react';
import { AppShell, type NavItem } from '../AppShell';
import { getSupabaseClient } from '../../lib/supabase';
import { formatDateTimeID } from '../../lib/exportReports';
import type {
  AcademicYear,
  CurrentUserContext,
  Exam,
  SchoolClass,
  SchoolSettings,
  Student,
  Subject,
  Teacher,
} from '../../types/database';
import { MasterDataPanel } from './MasterDataPanel';
import { QuestionBankPanel } from '../shared/QuestionBankPanel';
import { ExamManagementPanel } from '../shared/ExamManagementPanel';
import { ResultsAndGradingPanel } from '../shared/ResultsAndGradingPanel';

interface AdminDashboardProps {
  user: CurrentUserContext;
  schoolSettings: SchoolSettings | null;
  onRefreshSettings: () => Promise<void>;
  onLogout: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  user,
  schoolSettings,
  onRefreshSettings,
  onLogout,
}) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [questionCount, setQuestionCount] = useState(0);
  const [resultCount, setResultCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const loadMasterAndSummary = async () => {
    setLoading(true);
    try {
      const supabase = getSupabaseClient();
      const [tRes, sRes, cRes, subRes, ayRes, exRes, qRes, rRes] = await Promise.all([
        supabase.from('teachers').select('*, profiles(*), subjects(*)').order('created_at', { ascending: false }),
        supabase.from('students').select('*, profiles(*), classes(*)').order('created_at', { ascending: false }),
        supabase.from('classes').select('*, academic_years(*)').order('grade_level').order('name'),
        supabase.from('subjects').select('*').order('name'),
        supabase.from('academic_years').select('*').order('name', { ascending: false }),
        supabase.from('exams').select('*, subjects(*), classes(*)').order('start_time', { ascending: false }),
        supabase.from('questions').select('id', { count: 'exact', head: true }),
        supabase.from('results').select('id', { count: 'exact', head: true }),
      ]);

      setTeachers((tRes.data as Teacher[]) || []);
      setStudents((sRes.data as Student[]) || []);
      setClasses((cRes.data as SchoolClass[]) || []);
      setSubjects((subRes.data as Subject[]) || []);
      setAcademicYears((ayRes.data as AcademicYear[]) || []);
      setExams((exRes.data as Exam[]) || []);
      setQuestionCount(qRes.count || 0);
      setResultCount(rRes.count || 0);
      await onRefreshSettings();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMasterAndSummary();
  }, []);

  const navItems: NavItem[] = [
    { id: 'overview', label: 'Ringkasan', icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: 'master', label: 'Data Master', icon: <Database className="w-4 h-4" /> },
    { id: 'questions', label: 'Bank Soal', icon: <BookOpen className="w-4 h-4" /> },
    { id: 'exams', label: 'Jadwal & Token', icon: <CalendarClock className="w-4 h-4" /> },
    { id: 'results', label: 'Hasil & Laporan', icon: <BarChart3 className="w-4 h-4" /> },
  ];

  const titles: Record<string, { title: string; subtitle: string }> = {
    overview: {
      title: 'Dashboard Administrator CBT',
      subtitle: 'Ringkasan operasional ujian semester dan manajemen sekolah',
    },
    master: {
      title: 'Manajemen Data Master',
      subtitle: 'Kelola data guru, siswa, kelas, mata pelajaran, dan tahun pelajaran',
    },
    questions: {
      title: 'Bank Soal Sekolah',
      subtitle: 'Kelola seluruh soal Pilihan Ganda dan Essay lintas mata pelajaran',
    },
    exams: {
      title: 'Jadwal & Token Ujian',
      subtitle: 'Atur pelaksanaan ujian, paket soal, dan token peserta',
    },
    results: {
      title: 'Hasil Ujian & Laporan',
      subtitle: 'Pantau peserta, periksa nilai, dan ekspor laporan Excel atau PDF',
    },
  };

  const activeYear = academicYears.find((a) => a.is_active);
  const schoolName = schoolSettings?.school_name || 'SMP Negeri 2 Sukaresmi';

  return (
    <AppShell
      user={user}
      schoolName={schoolName}
      navItems={navItems}
      activeTab={activeTab}
      onSelectTab={setActiveTab}
      onLogout={onLogout}
      pageTitle={titles[activeTab].title}
      pageSubtitle={titles[activeTab].subtitle}
    >
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <p className="text-xs text-slate-500">
                Tahun Pelajaran Aktif · {activeYear ? `${activeYear.name} Semester ${activeYear.semester}` : 'Belum Diatur'}
              </p>
              <h2 className="text-lg font-bold text-slate-900 mt-0.5">{schoolName}</h2>
              <p className="text-xs text-slate-600 mt-1">
                NPSN {schoolSettings?.npsn || '-'} · {schoolSettings?.address || '-'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setActiveTab('exams')}
              className="px-4 py-2 bg-blue-900 hover:bg-blue-950 text-white text-xs font-semibold rounded-lg whitespace-nowrap self-start sm:self-center"
            >
              Kelola Jadwal Ujian
            </button>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Total Guru', value: teachers.length },
              { label: 'Total Siswa', value: students.length },
              { label: 'Total Soal', value: questionCount },
              { label: 'Hasil Ujian Masuk', value: resultCount },
            ].map((stat) => (
              <div
                key={stat.label}
                className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5"
              >
                <p className="text-xs text-slate-500">{stat.label}</p>
                <p className="text-2xl font-bold text-slate-900 mt-1 font-mono-tabular">
                  {loading ? '-' : stat.value}
                </p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-900">Jadwal Ujian Terbaru</h3>
                <button
                  type="button"
                  onClick={() => setActiveTab('exams')}
                  className="text-xs font-medium text-blue-900 hover:underline"
                >
                  Lihat Semua
                </button>
              </div>
              <div className="divide-y divide-slate-200">
                {exams.length === 0 ? (
                  <p className="p-6 text-sm text-slate-500 text-center">
                    Belum ada jadwal ujian dibuat.
                  </p>
                ) : (
                  exams.slice(0, 5).map((ex) => (
                    <div key={ex.id} className="px-5 py-3.5 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900 truncate">{ex.title}</p>
                        <p className="text-xs text-slate-500 truncate">
                          {ex.subjects?.name} · Kelas {ex.classes?.name} · {formatDateTimeID(ex.start_time)}
                        </p>
                      </div>
                      <span className="font-mono-tabular text-xs font-bold px-2 py-1 bg-slate-100 border border-slate-200 rounded text-slate-900 shrink-0">
                        {ex.token}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-900">Ringkasan Akademik</h3>
                <button
                  type="button"
                  onClick={() => setActiveTab('master')}
                  className="text-xs font-medium text-blue-900 hover:underline"
                >
                  Kelola Master
                </button>
              </div>
              <div className="p-5 grid grid-cols-2 gap-4 text-sm">
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg">
                  <p className="text-xs text-slate-500">Jumlah Kelas</p>
                  <p className="text-lg font-bold text-slate-900 font-mono-tabular mt-0.5">
                    {classes.length}
                  </p>
                </div>
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg">
                  <p className="text-xs text-slate-500">Mata Pelajaran</p>
                  <p className="text-lg font-bold text-slate-900 font-mono-tabular mt-0.5">
                    {subjects.length}
                  </p>
                </div>
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg">
                  <p className="text-xs text-slate-500">Jadwal Ujian</p>
                  <p className="text-lg font-bold text-slate-900 font-mono-tabular mt-0.5">
                    {exams.length}
                  </p>
                </div>
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg">
                  <p className="text-xs text-slate-500">Tahun Pelajaran</p>
                  <p className="text-lg font-bold text-slate-900 font-mono-tabular mt-0.5">
                    {academicYears.length}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'master' && (
        <MasterDataPanel
          teachers={teachers}
          students={students}
          classes={classes}
          subjects={subjects}
          academicYears={academicYears}
          schoolSettings={schoolSettings}
          onRefresh={loadMasterAndSummary}
        />
      )}

      {activeTab === 'questions' && (
        <QuestionBankPanel
          subjects={subjects}
          currentUserId={user.profile.id}
          onChanged={loadMasterAndSummary}
        />
      )}

      {activeTab === 'exams' && (
        <ExamManagementPanel
          subjects={subjects}
          classes={classes}
          academicYears={academicYears}
          teachers={teachers}
          currentUserId={user.profile.id}
          onChanged={loadMasterAndSummary}
        />
      )}

      {activeTab === 'results' && (
        <ResultsAndGradingPanel
          exams={exams}
          classes={classes}
          subjects={subjects}
          schoolSettings={schoolSettings}
          currentUserId={user.profile.id}
        />
      )}
    </AppShell>
  );
};
