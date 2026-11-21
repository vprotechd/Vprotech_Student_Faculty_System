import API from './apiClient';

export type ClassroomStatus = {
  classroomId: string | null;
  status: 'scheduled' | 'live' | 'ended';
  startedAt: string | null;
  endedAt: string | null;
};

export type ClassroomCredentials = {
  classroomId: string;
  channelName: string;
  appId: string;
  token: string;
  uid: number;
  tokenExpiresIn: number;
  title: string;
};

export type ClassroomParticipant = {
  id: string;
  name: string;
  role: 'student' | 'faculty';
  joinedAt: string;
  leftAt: string | null;
  durationSeconds: number;
};

export type ClassroomMessage = {
  _id: string;
  classroomId: string;
  userId: string;
  senderName: string;
  senderRole: 'student' | 'faculty';
  message: string;
  createdAt: string;
};

const getData = <T,>(response: { data?: { data?: T } }): T =>
  response.data?.data as T;

export const getClassroomStatus = async (
  timetableId: string,
  classDate: string
): Promise<ClassroomStatus> => {
  const response = await API.get(`/classrooms/timetable/${timetableId}/status`, {
    params: { classDate },
  });
  return getData<ClassroomStatus>(response);
};

export const startClassroom = async (
  timetableId: string,
  classDate: string
): Promise<ClassroomCredentials> => {
  const response = await API.post(`/classrooms/timetable/${timetableId}/start`, {
    classDate,
  });
  return getData<ClassroomCredentials>(response);
};

export const joinClassroom = async (
  timetableId: string,
  classDate: string
): Promise<ClassroomCredentials> => {
  const response = await API.post(`/classrooms/timetable/${timetableId}/join`, {
    classDate,
  });
  return getData<ClassroomCredentials>(response);
};

export const refreshClassroomToken = async (
  classroomId: string
): Promise<ClassroomCredentials> => {
  const response = await API.post(`/classrooms/${classroomId}/refresh-token`);
  return getData<ClassroomCredentials>(response);
};

export const leaveClassroom = async (classroomId: string): Promise<void> => {
  await API.post(`/classrooms/${classroomId}/leave`);
};

export const endClassroom = async (classroomId: string): Promise<void> => {
  await API.post(`/classrooms/${classroomId}/end`);
};

export const getClassroomParticipants = async (
  classroomId: string
): Promise<ClassroomParticipant[]> => {
  const response = await API.get(`/classrooms/${classroomId}/participants`);
  return getData<ClassroomParticipant[]>(response);
};

export const getClassroomMessages = async (
  classroomId: string
): Promise<ClassroomMessage[]> => {
  const response = await API.get(`/classrooms/${classroomId}/messages`);
  return getData<ClassroomMessage[]>(response);
};
