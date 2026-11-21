
import API from './apiClient';

// ==================================================
// TYPES
// ==================================================

export type Ref =
  | { _id: string; name?: string }
  | string
  | null
  | undefined;

export interface StudentRecord {
  _id: string;
  userId: string;
  studentId: string;
  rollNumber: string;
  departmentId?: string | null;
  courseId?: string | null;
  semester?: number | null;
  section?: string | null;
  enrollmentYear?: number | null;
  phone?: string | null;
}

export interface StudentTimetableEntry {
  _id: string;
  title: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  room?: string;
  meetingUrl?: string;
  semester: number;
  section: string;
  courseId?: Ref;
  subjectId?: Ref;
  facultyId?: Ref;
}

export interface StudentLecture {
  _id: string;
  course: string;
  cohort: string;
  date: string;
  startTime: string;
  endTime: string;
  room: string;
  meetingUrl?: string;
  status: 'Scheduled' | 'Live Soon' | 'Live' | 'Completed' | 'Cancelled';
}

export interface AppNotification {
  _id: string;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  createdAt: string;
  targetUrl?: string;
}

export interface SubjectRecord {
  _id: string;
  name: string;
  code: string;
  departmentId?: Ref;
  courseId?: Ref;
  semester?: number;
  facultyIds?: Ref[];
  isActive?: boolean;
}

export interface DoubtReply {
  _id?: string;
  message: string;
  repliedAt: string;
}

export interface Doubt {
  _id: string;
  studentId: Ref;
  facultyId: Ref;
  subjectId: Ref;
  title: string;
  message: string;
  status: 'pending' | 'answered' | 'closed';
  replies: DoubtReply[];
  createdAt: string;
}

export interface StudyMaterial {
  _id: string;
  title: string;
  batch: string;
  type: 'note' | 'video';
  fileUrl: string;
  originalName?: string;
  createdAt?: string;
  uploadedBy?: { name?: string; fullName?: string } | string | null;
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

const extractArray = <T,>(data: any): T[] => {
  return asArray<T>(
    data?.data?.data,
    data?.data?.docs,
    data?.data?.students,
    data?.data?.subjects,
    data?.data?.doubts,
    data?.data?.notifications,
    data?.data?.materials,
    data?.data,
    data?.docs,
    data?.students,
    data?.subjects,
    data?.doubts,
    data?.notifications,
    data?.materials
  );
};

export const refName = (ref: Ref, fallback = '') =>
  ref && typeof ref === 'object'
    ? ref.name || fallback
    : fallback;

export const refId = (ref: Ref): string => {
  if (!ref) return '';
  return typeof ref === 'object' ? String(ref._id || '') : String(ref);
};

const sameId = (a: unknown, b: unknown) =>
  String(refId(a as Ref)) === String(refId(b as Ref));

// ==================================================
// CONSTANTS
// ==================================================

export const DAYS = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

export const todayName = () =>
  DAYS[(new Date().getDay() + 6) % 7];

// ==================================================
// STUDENT
// ==================================================

export const getMyStudentRecord = async (): Promise<StudentRecord | null> => {
  const res = await API.get('/students');
  const list = extractArray<StudentRecord>(res.data);

  return list[0] ?? null;
};

// ==================================================
// TIMETABLE
// ==================================================

export const getStudentTimetable = async (
  student: StudentRecord | null
): Promise<StudentTimetableEntry[]> => {
  const res = await API.get('/timetable', {
    params: { limit: 100 },
  });

  const all = extractArray<StudentTimetableEntry>(res.data)
    .filter((row: any) => row.isActive !== false);

  if (!student) return all;

  return all.filter((row) => {
    if (
      student.courseId &&
      refId(row.courseId) &&
      !sameId(row.courseId, student.courseId)
    ) return false;

    if (
      student.semester &&
      row.semester !== student.semester
    ) return false;

    if (
      student.section &&
      row.section &&
      row.section !== student.section
    ) return false;

    return true;
  });
};

export const getStudentLectures = async (): Promise<StudentLecture[]> => {
  const res = await API.get('/lectures/student');
  return asArray<StudentLecture>(res.data?.data?.lectures, res.data?.lectures);
};

// ==================================================
// NOTIFICATIONS
// ==================================================

export const getNotifications = async (): Promise<AppNotification[]> => {
  const res = await API.get('/notifications', {
    params: { limit: 50 },
  });

  return extractArray<AppNotification>(res.data);
};

// ==================================================
// SUBJECTS
// ==================================================

export const getSubjects = async (): Promise<SubjectRecord[]> => {
  const res = await API.get('/subjects', {
    params: { limit: 100 },
  });

  return extractArray<SubjectRecord>(res.data);
};

// ==================================================
// DOUBTS
// ==================================================

export const getMyDoubts = async (): Promise<Doubt[]> => {
  const res = await API.get('/doubts', {
    params: { limit: 100 },
  });

  return extractArray<Doubt>(res.data);
};

export const createDoubt = async (payload: {
  subjectId: string;
  title: string;
  message: string;
}): Promise<Doubt> => {
  const res = await API.post('/doubts', payload);

  const created =
    res.data?.data?.doubt ||
    res.data?.data ||
    res.data?.doubt;

  if (!created?._id) {
    throw new Error(
      res.data?.message || 'Doubt was submitted but no record was returned.'
    );
  }

  return {
    ...created,
    replies: created.replies || [],
  } as Doubt;
};

export const replyToDoubt = async (id: string, message: string): Promise<Doubt> => {
  const res = await API.patch(`/doubts/${id}/replies`, { message });
  const updated = res.data?.data?.doubt || res.data?.data || res.data?.doubt;

  if (!updated?._id) {
    throw new Error(res.data?.message || 'The server did not return the updated doubt.');
  }

  return {
    ...updated,
    replies: updated.replies || [],
  } as Doubt;
};

// ==================================================
// STUDY MATERIALS
// ==================================================

export const getStudyMaterials = async (): Promise<StudyMaterial[]> => {
  const res = await API.get('/materials');

  return extractArray<StudyMaterial>(res.data);
};
