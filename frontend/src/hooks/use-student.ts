import { useCallback, useEffect, useState } from 'react';

import { getErrorMessage } from '../api/apiClient';
import { getMyStudentRecord, type StudentRecord } from '../api/studentApi';
import { getStoredUser, type SessionUser } from '../api/session';

/** Loads the signed-in account and its student record (class, semester, section). */
export function useStudent() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [student, setStudent] = useState<StudentRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    setError('');
    setUser(await getStoredUser());
    try {
      setStudent(await getMyStudentRecord());
    } catch (e) {
      setError(getErrorMessage(e, 'Unable to load your student profile.'));
    }
  }, []);

  useEffect(() => {
    reload().finally(() => setLoading(false));
  }, [reload]);

  return { user, student, loading, error, reload };
}
