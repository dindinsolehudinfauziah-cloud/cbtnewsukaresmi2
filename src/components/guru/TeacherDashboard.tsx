import React, { useEffect, useState } from 'react';
import {
  BookOpen,
  CalendarClock,
  ClipboardCheck,
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
  Subject,
  Teacher,
} from '../../types/database';
import { QuestionBankPanel } from '../shared/QuestionBankPanel';
import { ExamManagementPanel } from '../shared/ExamManagementPanel';
import { ResultsAndGradingPanel } from '../shared/ResultsAndGradingPanel';

interface TeacherDashboardProps {
  user: CurrentUserContext;
  schoolSettings: SchoolSettings | null;
  onLogout: () => void;
}

export const TeacherDashboard: React.FC<TeacherDashboardProps> = ({
  user,
  schoolSettings,
  onLogout,
}) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [questionCount, setQuestionCount] = useState(0);
  const [pendingEssayCount, setPendingEssayCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const teacherId = user.teacher?.id || null;
  const teacherSubjectId = user.teacher?.subject_id || null;

  const loadTeacherData = async () => {
    setLoading(true);
    try {
      const supabase = getSupabaseClient();
      const [subRes, clsRes, ayRes, tRes, exRes] = await Promise.all([
        supabase.from('subjects').select('*').order('name'),
        supabase.from('classes').select('*').order('grade_level').order('name'),
        supabase.from('academic_years').select('*').order('name', { ascending: false }),
        supabase.from('teachers').select('*, profiles(*), subjects(*)'),
        supabase
          .from('exams')
          .select('*, subjects(*), classes(*)')
          .or(
            teacherId
              ? `teacher_id.eq.${teacherId},created_by.eq.${user.profile.id}`
              : `created_by.eq.${user.profile.id}`
          )
          .order('start_time', { ascending: false }),
      ]);

      const loadedSubjects = (subRes.data as Subject[]) || [];
      const loadedExams = (exRes.data as Exam[]) || [];
      setSubjects(loadedSubjects);
      setClasses((clsRes.data as SchoolClass[]) || []);
      setAcademicYears((ayRes.data as AcademicYear[]) || []);
      setTeachers((tRes.data as Teacher[]) || []);
      setExams(loadedExams);

      let qQuery = supabase.from('questions').select('id', { count: 'exact', head: true });
      if (teacherSubjectId) {
        qQuery = qQuery.eq('subject_id', teacherSubjectId);
      }
      const qCountRes = await qQuery;
      setQuestionCount(qCountRes.count || 0);

      if (loadedExams.length > 0) {
        const examIds = loadedExams.map((e) => e.id);
        const { count } = await supabase
          .from('results')
          .select('id', { count: 'exact', head: true })
          .in('exam_id', examIds)
          .eq('grading_status', 'needs_essay_grading');
        setPendingEssayCount(count || 0);
      } else {
        setPendingEssayCount(0);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTeacherData();
  }, [teacherId, teacherSubjectId]);

  const navItems: NavItem[] = [
    { id: 'overview', label: 'Ringkasan', icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: 'questions', label: 'Bank Soal', icon: <BookOpen className="w-4 h-4" /> },
    { id: 'exams', label: 'Ujian & Jadwal', icon: <CalendarClock className="w-4 h-4" /> },
    { id: 'grading', label: 'Peserta & Nilai', icon: <ClipboardCheck className="w-4 h-4" /> },
  ];

  const titles: Record<string, { title: string; subtitle: string }> = {
    overview: {
      title: 'Dashboard Guru Mata Pelajaran',
      subtitle: user.teacher?.subjects?.name
        ? `Pengampu Mata Pelajaran ${user.teacher.subjects.name}`
        : 'Pengelolaan soal, jadwal ujian, dan penilaian peserta',
    },
    questions: {
      title: 'Bank Soal Mata Pelajaran',
      subtitle: 'Buat dan kelola soal Pilihan Ganda maupun Essay beserta gambar pendukung',
    },
    exams: {
      title: 'Manajemen Ujian & Jadwal',
      subtitle: 'Atur jadwal pelaksanaan, durasi, token ujian, dan paket soal',
    },
    grading: {
      title: 'Peserta, Koreksi Essay & Nilai',
      subtitle: 'Pantau peserta ujian, nilai jawaban essay, dan umumkan hasil ke siswa',
    },
  };

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
                {user.teacher?.subjects?.name
                  ? `Mata Pelajaran: ${user.teacher.subjects.name}`
                  : 'Guru Mata Pelajaran'}
                {user.teacher?.nip ? ` · NIP ${user.teacher.nip}` : ''}
              </p>
              <h2 className="text-lg font-bold text-slate-900 mt-0.5">
                Selamat datang, {user.profile.full_name}
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveTab('questions')}
                className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg whitespace-nowrap"
              >
                Kelola Bank Soal
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('exams')}
                className="px-3.5 py-2 text-xs font-semibold text-white bg-blue-900 hover:bg-blue-950 rounded-lg whitespace-nowrap"
              >
                Buat Ujian Baru
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <p className="text-xs text-slate-500">Soal di Bank Soal</p>
              <p className="text-2xl font-bold text-slate-900 font-mono-tabular mt-1">
                {loading ? '-' : questionCount}
              </p>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <p className="text-xs text-slate-500">Ujian Dikelola</p>
              <p className="text-2xl font-bold text-slate-900 font-mono-tabular mt-1">
                {loading ? '-' : exams.length}
              </p>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <p className="text-xs text-slate-500">Perlu Koreksi Essay</p>
              <p className="text-2xl font-bold text-amber-700 font-mono-tabular mt-1">
                {loading ? '-' : pendingEssayCount}
              </p>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">Jadwal Ujian Anda</h3>
              <button
                type="button"
                onClick={() => setActiveTab('grading')}
                className="text-xs font-medium text-blue-900 hover:underline"
              >
                Lihat Peserta & Nilai
              </button>
            </div>
            <div className="divide-y divide-slate-200">
              {exams.length === 0 ? (
                <p className="p-8 text-sm text-slate-500 text-center">
                  Anda belum membuat jadwal ujian. Klik menu Ujian & Jadwal untuk memulai.
                </p>
              ) : (
                exams.map((ex) => (
                  <div
                    key={ex.id}
                    className="px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                  >
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{ex.title}</p>
                      <p className="text-xs text-slate-500">
                        {ex.subjects?.name} · Kelas {ex.classes?.name} · Durasi {ex.duration_minutes} menit ·{' '}
                        {formatDateTimeID(ex.start_time)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 text-xs shrink-0">
                      <span className="font-mono-tabular font-bold px-2.5 py-1 bg-slate-100 border border-slate-200 rounded">
                        Token: {ex.token}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'questions' && (
        <QuestionBankPanel
          subjects={
            teacherSubjectId
              ? subjects.filter((s) => s.id === teacherSubjectId)
              : subjects
          }
          currentUserId={user.profile.id}
          defaultSubjectId={teacherSubjectId}
          restrictToSubjectId={teacherSubjectId}
          onChanged={loadTeacherData}
        />
      )}

      {activeTab === 'exams' && (
        <ExamManagementPanel
          subjects={
            teacherSubjectId
              ? subjects.filter((s) => s.id === teacherSubjectId)
              : subjects
          }
          classes={classes}
          academicYears={academicYears}
          teachers={teachers}
          currentUserId={user.profile.id}
          currentTeacherId={teacherId}
          restrictToTeacherId={teacherId}
          onChanged={loadTeacherData}
        />
      )}

      {activeTab === 'grading' && (
        <ResultsAndGradingPanel
          exams={exams}
          classes={classes}
          subjects={subjects}
          schoolSettings={schoolSettings}
          restrictToTeacherId={teacherId}
          currentUserId={user.profile.id}
        />
      )}
    </AppShell>
  );
};
