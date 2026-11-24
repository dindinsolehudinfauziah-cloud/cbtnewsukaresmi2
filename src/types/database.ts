export type UserRole = 'admin' | 'guru' | 'siswa';
export type QuestionType = 'pg' | 'essay';
export type DifficultyLevel = 'mudah' | 'sedang' | 'sulit';
export type SessionStatus = 'in_progress' | 'submitted' | 'expired';
export type GradingStatus = 'auto_graded' | 'needs_essay_grading' | 'graded';

export interface AcademicYear {
  id: string;
  name: string;
  semester: 'Ganjil' | 'Genap';
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SchoolSettings {
  id: string;
  school_name: string;
  npsn: string;
  address: string;
  headmaster_name: string;
  headmaster_nip: string;
  academic_year_active_id: string | null;
  exam_rules: string;
  logo_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface SchoolClass {
  id: string;
  name: string;
  grade_level: number;
  academic_year_id: string | null;
  homeroom_teacher: string | null;
  academic_years?: AcademicYear | null;
  created_at: string;
  updated_at: string;
}

export interface Subject {
  id: string;
  code: string;
  name: string;
  kkm: number;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  username: string;
  email: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Teacher {
  id: string;
  profile_id: string;
  nip: string | null;
  subject_id: string | null;
  phone: string | null;
  profiles?: Profile;
  subjects?: Subject | null;
  created_at: string;
  updated_at: string;
}

export interface Student {
  id: string;
  profile_id: string;
  nis: string | null;
  nisn: string | null;
  class_id: string | null;
  gender: 'L' | 'P' | null;
  profiles?: Profile;
  classes?: SchoolClass | null;
  created_at: string;
  updated_at: string;
}

export interface Question {
  id: string;
  subject_id: string;
  created_by: string | null;
  question_type: QuestionType;
  question_text: string;
  image_url: string | null;
  option_a: string | null;
  option_b: string | null;
  option_c: string | null;
  option_d: string | null;
  correct_option: 'A' | 'B' | 'C' | 'D' | null;
  essay_rubric: string | null;
  weight: number;
  difficulty: DifficultyLevel;
  subjects?: Subject;
  created_at: string;
  updated_at: string;
}

export interface Exam {
  id: string;
  title: string;
  description: string | null;
  subject_id: string;
  class_id: string;
  academic_year_id: string;
  teacher_id: string | null;
  created_by: string | null;
  duration_minutes: number;
  start_time: string;
  end_time: string;
  token: string;
  token_active: boolean;
  shuffle_questions: boolean;
  shuffle_options: boolean;
  is_published: boolean;
  results_published: boolean;
  pg_weight_percent: number;
  essay_weight_percent: number;
  subjects?: Subject;
  classes?: SchoolClass;
  academic_years?: AcademicYear;
  teachers?: Teacher | null;
  exam_questions?: { id: string; question_id: string; question_order: number; points: number }[];
  created_at: string;
  updated_at: string;
}

export interface ExamSession {
  id: string;
  exam_id: string;
  student_id: string;
  started_at: string;
  expires_at: string;
  submitted_at: string | null;
  status: SessionStatus;
  question_order: string[] | null;
  last_activity_at: string;
  students?: Student;
  exams?: Exam;
  created_at: string;
  updated_at: string;
}

export interface AnswerRecord {
  id: string;
  session_id: string;
  question_id: string;
  selected_option: 'A' | 'B' | 'C' | 'D' | null;
  essay_answer: string | null;
  is_flagged: boolean;
  is_correct: boolean | null;
  essay_score: number | null;
  teacher_feedback: string | null;
  answered_at: string;
  questions?: Question;
}

export interface ExamResult {
  id: string;
  exam_id: string;
  session_id: string;
  student_id: string;
  total_questions: number;
  pg_correct_count: number;
  pg_total_count: number;
  pg_score: number;
  essay_score: number;
  final_score: number;
  grading_status: GradingStatus;
  is_published: boolean;
  graded_by: string | null;
  graded_at: string | null;
  notes: string | null;
  students?: Student;
  exams?: Exam;
  created_at: string;
  updated_at: string;
}

export interface StudentExamItem {
  exam_id: string;
  title: string;
  description: string | null;
  subject_id: string;
  subject_name: string;
  subject_code: string;
  class_id: string;
  class_name: string;
  academic_year_name: string;
  semester: string;
  teacher_name: string;
  duration_minutes: number;
  start_time: string;
  end_time: string;
  token_active: boolean;
  results_published: boolean;
  question_count: number;
  session_id: string | null;
  session_status: SessionStatus | null;
  session_started_at: string | null;
  session_expires_at: string | null;
  session_submitted_at: string | null;
  final_score: number | null;
  pg_score: number | null;
  essay_score: number | null;
  grading_status: GradingStatus | null;
  result_published: boolean;
  server_now: string;
}

export interface StudentQuestionItem {
  id: string;
  question_type: QuestionType;
  question_text: string;
  image_url: string | null;
  option_a: string | null;
  option_b: string | null;
  option_c: string | null;
  option_d: string | null;
  points: number;
}

export interface StudentAnswerItem {
  question_id: string;
  selected_option: 'A' | 'B' | 'C' | 'D' | null;
  essay_answer: string | null;
  is_flagged: boolean;
  answered_at?: string;
}

export interface StudentExamPayload {
  expired?: boolean;
  message?: string;
  session: {
    id: string;
    exam_id: string;
    started_at: string;
    expires_at: string;
    server_now: string;
  };
  exam: {
    id: string;
    title: string;
    description: string | null;
    duration_minutes: number;
    start_time: string;
    end_time: string;
    subject_name: string;
    class_name: string;
  };
  questions: StudentQuestionItem[];
  answers: StudentAnswerItem[];
}

export interface CurrentUserContext {
  profile: Profile;
  teacher: Teacher | null;
  student: Student | null;
}
