import API from './apiClient';

export type Exam = {
  _id: string;
  title: string;
  description?: string;
  subject: string;
  className: string;
  batch?: string;
  duration: number;
  totalMarks: number;
  passingMarks: number;
  startTime: string;
  endTime: string;
  status: 'draft' | 'scheduled' | 'published' | 'completed' | 'cancelled';
  negativeMarking?: boolean;
  negativeMarks?: number;
  shuffleQuestions?: boolean;
  showResultImmediately?: boolean;
  instructions?: string[];
  questionCount?: number;
};

export type ExamQuestion = {
  _id: string;
  questionText: string;
  questionType: 'mcq' | 'descriptive';
  options?: { optionText: string }[];
  correctAnswer?: string | null;
  marks: number;
  negativeMarks?: number;
  explanation?: string;
  order?: number;
};

export type ExamAnswer = { questionId: string; answer: string };

export type ExamAttempt = {
  _id?: string;
  id?: string;
  examId?: Exam | string;
  studentId?: any;
  startedAt: string;
  expiresAt: string;
  submittedAt?: string | null;
  status: string;
  answers?: { questionId: string; answer: string; marksAwarded?: number; isEvaluated?: boolean; feedback?: string }[];
  obtainedMarks?: number | null;
  totalMarks?: number;
  percentage?: number | null;
  resultPublished?: boolean;
};

export const listExams = async () => {
  const { data } = await API.get('/examinations');
  return (data?.exams || []) as Exam[];
};

export const getExam = async (id: string) => {
  const { data } = await API.get(`/examinations/${id}`);
  return { exam: data.exam as Exam, questions: (data.questions || []) as ExamQuestion[] };
};

export const createExam = async (payload: Partial<Exam>) => {
  const { data } = await API.post('/examinations', payload);
  return data.exam as Exam;
};

export const updateExam = async (id: string, payload: Partial<Exam>) => {
  const { data } = await API.put(`/examinations/${id}`, payload);
  return data.exam as Exam;
};

export const publishExam = async (id: string) => {
  const { data } = await API.patch(`/examinations/${id}/publish`);
  return data.exam as Exam;
};

export const cancelExam = async (id: string) => {
  const { data } = await API.patch(`/examinations/${id}/cancel`);
  return data.exam as Exam;
};

export const addQuestion = async (examId: string, payload: Partial<ExamQuestion>) => {
  const { data } = await API.post(`/examination-questions/${examId}`, payload);
  return data.question as ExamQuestion;
};

export const updateQuestion = async (examId: string, questionId: string, payload: Partial<ExamQuestion>) => {
  const { data } = await API.put(`/examination-questions/${examId}/${questionId}`, payload);
  return data.question as ExamQuestion;
};

export const deleteQuestion = async (examId: string, questionId: string) => {
  const { data } = await API.delete(`/examination-questions/${examId}/${questionId}`);
  return data;
};

export const startExam = async (examId: string) => {
  const { data } = await API.post(`/examination-attempts/${examId}/start`);
  return data as {
    attempt: { id: string; startedAt: string; expiresAt: string; status: string; answers: ExamAnswer[] };
    exam: { id: string; title: string; subject: string; duration: number; totalMarks: number; instructions?: string[] };
    questions: ExamQuestion[];
  };
};

export const getAttemptForStudent = async (attemptId: string) => {
  const { data } = await API.get(`/examination-attempts/${attemptId}`);
  return data as {
    attempt: { id: string; startedAt: string; expiresAt: string; status: string; answers: ExamAnswer[] };
    exam: { id: string; title: string; subject: string; duration: number; totalMarks: number; instructions?: string[] };
    questions: ExamQuestion[];
  };
};

export const saveExamAnswers = async (attemptId: string, answers: ExamAnswer[]) => {
  const { data } = await API.put(`/examination-attempts/${attemptId}/answers`, { answers });
  return data;
};

export const submitExam = async (attemptId: string, answers: ExamAnswer[]) => {
  const { data } = await API.post(`/examination-attempts/${attemptId}/submit`, { answers });
  return data;
};

export const getMyAttempts = async () => {
  const { data } = await API.get('/examination-attempts/my-attempts');
  return (data?.attempts || []) as ExamAttempt[];
};

export const getSubmissions = async (examId: string) => {
  const { data } = await API.get(`/examination-evaluation/${examId}/submissions`);
  return (data?.attempts || []) as ExamAttempt[];
};

export const getAttemptForEvaluation = async (examId: string, attemptId: string) => {
  const { data } = await API.get(`/examination-evaluation/${examId}/attempts/${attemptId}`);
  return data as {
    attempt: { id: string; student?: { name?: string; email?: string }; submittedAt?: string; status: string; resultPublished: boolean };
    questions: (ExamQuestion & { questionId: string; studentAnswer: string; marksAwarded: number; isEvaluated: boolean; feedback: string })[];
  };
};

export const evaluateAttempt = async (examId: string, attemptId: string, evaluations: { questionId: string; marksAwarded: number; feedback: string }[]) => {
  const { data } = await API.put(`/examination-evaluation/${examId}/attempts/${attemptId}/evaluate`, { evaluations });
  return data;
};

export const publishAttemptResult = async (examId: string, attemptId: string) => {
  const { data } = await API.patch(`/examination-evaluation/${examId}/attempts/${attemptId}/publish`);
  return data;
};
