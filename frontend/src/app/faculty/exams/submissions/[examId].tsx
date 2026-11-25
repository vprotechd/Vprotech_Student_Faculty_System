import React, { useCallback, useState } from 'react';
import { Text } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { getErrorMessage } from '../../../../api/apiClient';
import { getSubmissions, type ExamAttempt } from '../../../../api/examinationApi';
import { ExamCard, ExamHeader, ExamLoading, ExamNotice, ExamPage, ExamPill, examTextStyles, EXAM_COLORS, ExamButton } from '../../../../components/examination/ExamUI';

export default function ExamSubmissionsScreen() {
  const params = useLocalSearchParams<{ examId: string }>();
  const examId = String(params.examId || '');
  const [attempts, setAttempts] = useState<ExamAttempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try { setAttempts(await getSubmissions(examId)); }
    catch (e) { setError(getErrorMessage(e, 'Unable to load submissions.')); }
    finally { setLoading(false); }
  }, [examId]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  if (loading) return <ExamPage><ExamLoading /></ExamPage>;
  return (
    <ExamPage>
      <ExamHeader title="Student Submissions" subtitle="Review submitted attempts and evaluate descriptive answers." onBack={() => router.back()} />
      {error ? <ExamNotice text={error} error /> : null}
      {!attempts.length ? <ExamCard><Text style={examTextStyles.name}>No submissions yet</Text><Text style={examTextStyles.meta}>Student attempts will appear here after submission.</Text></ExamCard> :
        attempts.map((attempt, i) => {
          const student: any = attempt.studentId && typeof attempt.studentId === 'object' ? attempt.studentId : {};
          const id = String(attempt._id || '');
          return <ExamCard key={id || i}>
            <Text style={examTextStyles.name}>{student.name || 'Student'}</Text>
            <Text style={examTextStyles.meta}>{student.email || ''}</Text>
            <ExamPill text={attempt.status} color={attempt.resultPublished ? EXAM_COLORS.green : EXAM_COLORS.orange} />
            <Text style={examTextStyles.meta}>Submitted: {attempt.submittedAt ? new Date(attempt.submittedAt).toLocaleString('en-IN') : '—'}</Text>
            {attempt.resultPublished ? <Text style={examTextStyles.meta}>Marks: {attempt.obtainedMarks} / {attempt.totalMarks}</Text> : <Text style={examTextStyles.meta}>Result pending evaluation / publication.</Text>}
            <View style={{ marginTop: 12 }}><ExamButton title="Review & Evaluate" onPress={() => router.push(`/faculty/exams/evaluate/${examId}/${id}` as any)} /></View>
          </ExamCard>;
        })
      }
    </ExamPage>
  );
}
