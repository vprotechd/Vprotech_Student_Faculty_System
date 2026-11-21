import API from './apiClient';

// ==================================================
// TYPES  (match the Express/Mongoose backend)
// ==================================================

export type LectureStatus =
  | 'Scheduled'
  | 'Live Soon'
  | 'Live'
  | 'Completed'
  | 'Cancelled';

export interface FacultyDashboardStats {
  todayLectures: number;
  pendingSubmissions: number;
  materialCount: number;
}

export interface FacultyProfile {
  phone?: string | null;
  designation?: string;
  departmentId?: { name?: string } | string | null;
  userId?: { name?: string; email?: string } | string | null;
}

export interface Lecture {
  _id: string;
  course: string;
  cohort: string;
  date: string;
  startTime: string;
  endTime: string;
  room: string;
  status: LectureStatus;
  meetingUrl?: string;
}

export interface CreateLecturePayload {
  course: string;
  cohort: string;
  date: string; // YYYY-MM-DD
  startTime: string;
  endTime: string;
  room: string;
  meetingUrl?: string;
}

export interface TimetableEntry {
  _id: string;
  title: string;
  semester: number;
  section: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  room?: string;
  meetingUrl?: string;
  courseId?: { _id: string; name: string } | string | null;
  subjectId?: { _id: string; name: string } | string | null;
  departmentId?: { _id: string; name: string } | string | null;
}

export interface Material {
  _id: string;
  title: string;
  batch: string;
  type: 'note' | 'video';
  fileUrl: string;
  originalName?: string;
  mimeType?: string;
  size?: number;
  createdAt?: string;
}

export interface Submission {
  _id: string;
  title: string;
  description?: string;
  fileUrl: string;
  fileName?: string;
  status: 'pending' | 'reviewed' | 'graded' | 'rejected';
  marks?: number | null;
  maxMarks?: number;
  feedback?: string;
  submittedAt?: string;
  student?: { _id: string; name?: string; email?: string } | null;
}

// ==================================================
// HELPERS
// ==================================================

const asArray = <T,>(...candidates: unknown[]): T[] => {
  for (const item of candidates) {
    if (Array.isArray(item)) return item as T[];
  }
  return [];
};

// ==================================================
// PROFILE + DASHBOARD
// ==================================================

// GET /api/faculty/me
export const getFacultyProfile = async (): Promise<FacultyProfile | null> => {
  const res = await API.get('/faculty/me');
  return (res.data?.data?.faculty ?? res.data?.data ?? null) as FacultyProfile | null;
};

// GET /api/faculty/dashboard
export const getFacultyDashboard = async (): Promise<FacultyDashboardStats> => {
  const res = await API.get('/faculty/dashboard');
  const d = res.data?.data ?? {};
  return {
    todayLectures: Number(d.todayLectures) || 0,
    pendingSubmissions: Number(d.pendingSubmissions) || 0,
    materialCount: Number(d.materialCount) || 0,
  };
};

// ==================================================
// LECTURES  (/api/lectures)
// ==================================================

export const getMyLectures = async (date?: string): Promise<Lecture[]> => {
  const res = await API.get('/lectures/my', {
    params: date ? { date } : undefined,
  });
  return asArray<Lecture>(res.data?.data?.lectures, res.data?.lectures, res.data?.data);
};

export const createLecture = async (payload: CreateLecturePayload): Promise<Lecture> => {
  const res = await API.post('/lectures', payload);
  const lecture = res.data?.data?.lecture;
  if (!lecture?._id) {
    throw new Error('The server did not return the scheduled lecture.');
  }
  return lecture as Lecture;
};

export const updateLectureStatus = async (id: string, status: LectureStatus) => {
  const res = await API.patch(`/lectures/${id}/status`, { status });
  return res.data?.data?.lecture as Lecture;
};

// ==================================================
// TIMETABLE  (/api/timetable/faculty)
// ==================================================

export const getFacultyTimetable = async (): Promise<TimetableEntry[]> => {
  const res = await API.get('/timetable/faculty');
  return asArray<TimetableEntry>(res.data?.data, res.data?.timetable);
};

// PATCH /api/timetable/:id/meeting-link  (empty string removes the link)
export const updateTimetableMeetingLink = async (
  id: string,
  meetingUrl: string
): Promise<TimetableEntry> => {
  const res = await API.patch(`/timetable/${id}/meeting-link`, { meetingUrl });
  return res.data?.data as TimetableEntry;
};

// ==================================================
// MATERIALS  (/api/materials)
// ==================================================

// GET /api/materials/my   (NOT /materials/faculty - that route does not exist)
export const getMyMaterials = async (): Promise<Material[]> => {
  const res = await API.get('/materials/my');
  return asArray<Material>(res.data?.materials, res.data?.data?.materials, res.data?.data);
};

// POST /api/materials/upload   (multipart: file, title, batch, type)
export const uploadMaterial = async (formData: FormData) => {
  const res = await API.post('/materials/upload', formData);
  return res.data;
};

export const deleteMaterial = async (id: string) => {
  const res = await API.delete(`/materials/${id}`);
  return res.data;
};

// ==================================================
// SUBMISSIONS / GRADING  (/api/submissions)
// ==================================================

export const getPendingSubmissions = async (): Promise<Submission[]> => {
  const res = await API.get('/submissions/pending');
  return asArray<Submission>(res.data?.data?.submissions, res.data?.submissions);
};

export const gradeSubmission = async (
  id: string,
  marks: number,
  feedback: string
) => {
  const res = await API.patch(`/submissions/${id}/grade`, { marks, feedback });
  return res.data?.data?.submission as Submission;
};
