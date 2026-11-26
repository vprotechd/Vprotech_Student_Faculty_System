import API from './apiClient';

export type AssignmentFile = { url: string; fileName: string; mimeType?: string; bytes?: number };
export type AssignmentSubmission = {
  _id: string;
  file: AssignmentFile;
  status: 'submitted' | 'late' | 'graded';
  marks?: number | null;
  feedback?: string;
  submittedAt: string;
  comment?: string;
};
export type Assignment = {
  _id: string;
  title: string;
  description: string;
  instructions?: string;
  dueDate: string;
  maxMarks: number;
  status: 'draft' | 'published' | 'closed';
  attachment?: AssignmentFile | null;
  course?: { _id: string; name: string; code?: string } | string | null;
  semester?: number | null;
  section?: string | null;
  mySubmission?: AssignmentSubmission | null;
};

const appendFile = (form: FormData, file: any) => {
  if (file?.uri) form.append('file', { uri: file.uri, name: file.name || 'assignment-file', type: file.mimeType || 'application/octet-stream' } as any);
};

export const listAssignments = async () => {
  const { data } = await API.get('/assignments');
  return (data.assignments || []) as Assignment[];
};

export const getAssignment = async (id: string) => {
  const { data } = await API.get(`/assignments/${id}`);
  return data as { assignment: Assignment; submission?: AssignmentSubmission | null };
};

export const saveAssignment = async (payload: Record<string, any>, file?: any, id?: string) => {
  const form = new FormData();
  Object.entries(payload).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') form.append(key, String(value));
  });
  appendFile(form, file);
  const { data } = id ? await API.put(`/assignments/${id}`, form) : await API.post('/assignments', form);
  return data.assignment as Assignment;
};

export const publishAssignment = async (id: string) => {
  const { data } = await API.patch(`/assignments/${id}/publish`);
  return data.assignment as Assignment;
};

export const deleteAssignment = async (id: string) => {
  const { data } = await API.delete(`/assignments/${id}`);
  return data;
};

export const submitAssignment = async (id: string, file: any, comment: string) => {
  const form = new FormData();
  appendFile(form, file);
  form.append('comment', comment);
  const { data } = await API.post(`/assignments/${id}/submit`, form);
  return data.submission as AssignmentSubmission;
};

export const listAssignmentSubmissions = async (id: string) => {
  const { data } = await API.get(`/assignments/${id}/submissions`);
  return { assignment: data.assignment as Assignment, submissions: data.submissions as any[] };
};

export const gradeAssignmentSubmission = async (id: string, submissionId: string, marks: number, feedback: string) => {
  const { data } = await API.patch(`/assignments/${id}/submissions/${submissionId}/grade`, { marks, feedback });
  return data.submission;
};
