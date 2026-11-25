import React, { useCallback, useState } from 'react';
import { Text } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { getErrorMessage } from '../../../api/apiClient';
import { getMyAttempts, type ExamAttempt } from '../../../api/examinationApi';
import { ExamCard, ExamHeader, ExamLoading, ExamNotice, ExamPage, ExamPill, examTextStyles, EXAM_COLORS } from '../../../components/examination/ExamUI';

export default function StudentExamResultsScreen() {
  const [attempts, setAttempts] = useState<ExamAttempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try { setAttempts(await getMyAttempts()); }
    catch (e) { setError(getErrorMessage(e, 'Unable to load exam history.')); }
    finally { setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  if (loading) return <ExamPage><ExamLoading /></ExamPage>;
  return (
    <ExamPage>
      <ExamHeader title="My Exam Results" subtitle="Your submitted attempts and published results." onBack={() => router.back()} />
      {error ? <ExamNotice text={error} error /> : null}
      {!attempts.length ? <ExamCard><Text style={examTextStyles.name}>No attempts yet</Text><Text style={examTextStyles.meta}>Your exam attempts will appear here.</Text></ExamCard> :
        attempts.map((attempt, index) => {
          const exam: any = attempt.examId && typeof attempt.examId === 'object' ? attempt.examId : null;
          return <ExamCard key={attempt._id || String(index)}>
            <Text style={examTextStyles.name}>{exam?.title || 'Examination'}</Text>
            <Text style={examTextStyles.meta}>{exam?.subject || ''}</Text>
            <ExamPill text={attempt.status} color={attempt.status === 'evaluated' ? EXAM_COLORS.green : EXAM_COLORS.orange} />
            <Text style={examTextStyles.meta}>Submitted: {attempt.submittedAt ? new Date(attempt.submittedAt).toLocaleString('en-IN') : '—'}</Text>
            {attempt.resultPublished ? <Text style={[examTextStyles.name, { marginTop: 8 }]}>{attempt.obtainedMarks} / {attempt.totalMarks} marks ({attempt.percentage}%)</Text> :
              <Text style={examTextStyles.meta}>Result is not published yet.</Text>}
          </ExamCard>;
        })
      }
    </ExamPage>
  );
}
