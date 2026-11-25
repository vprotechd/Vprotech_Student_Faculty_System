import React, { useCallback, useEffect, useState } from 'react';
import { Alert, RefreshControl, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { getErrorMessage } from '../../../api/apiClient';
import { listExams, type Exam } from '../../../api/examinationApi';
import { ExamButton, ExamCard, ExamHeader, ExamLoading, ExamNotice, ExamPage, ExamPill, examTextStyles, EXAM_COLORS } from '../../../components/examination/ExamUI';

const dateLabel = (value: string) => new Date(value).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });

export default function StudentExamsScreen() {
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try { setExams(await listExams()); }
    catch (e) { setError(getErrorMessage(e, 'Unable to load exams.')); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  if (loading) return <ExamPage><ExamLoading /></ExamPage>;

  return (
    <ExamPage>
      <ExamHeader title="Available Exams" subtitle="View your published examinations and attempt history." onBack={() => router.back()} />
      {error ? <ExamNotice text={error} error /> : null}
      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
        <View style={{ flex: 1 }}><ExamButton title="My Results" secondary onPress={() => router.push('/student/exams/results' as any)} /></View>
        <View style={{ flex: 1 }}><ExamButton title="Refresh Exams" secondary onPress={() => { setRefreshing(true); void load(); }} loading={refreshing} /></View>
      </View>
      {exams.length === 0 ? <ExamCard><Text style={examTextStyles.name}>No published exams</Text><Text style={examTextStyles.meta}>Your faculty has not published any exams yet.</Text></ExamCard> :
        exams.map((exam) => (
          <ExamCard key={exam._id}>
            <Text style={examTextStyles.name}>{exam.title}</Text>
            <Text style={examTextStyles.meta}>{exam.subject} • {exam.className}{exam.batch ? ` • ${exam.batch}` : ''}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 8 }}>
              <ExamPill text={exam.status} color={exam.status === 'published' ? EXAM_COLORS.green : EXAM_COLORS.orange} />
              <ExamPill text={`${exam.duration} min`} />
              <ExamPill text={`${exam.totalMarks} marks`} color={EXAM_COLORS.orange} />
            </View>
            <Text style={examTextStyles.meta}>Starts: {dateLabel(exam.startTime)}</Text>
            <Text style={examTextStyles.meta}>Ends: {dateLabel(exam.endTime)}</Text>
            <View style={{ marginTop: 13 }}><ExamButton title="View Exam" onPress={() => router.push(`/student/exams/${exam._id}` as any)} /></View>
          </ExamCard>
        ))
      }
    </ExamPage>
  );
}
