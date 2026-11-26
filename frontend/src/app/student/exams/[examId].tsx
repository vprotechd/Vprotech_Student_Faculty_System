import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { getErrorMessage } from '../../../api/apiClient';
import { getExam, startExam, type Exam, type ExamQuestion } from '../../../api/examinationApi';
import { ExamButton, ExamCard, ExamHeader, ExamLoading, ExamNotice, ExamPage, ExamPill, examTextStyles, EXAM_COLORS } from '../../../components/examination/ExamUI';

export default function StudentExamDetailsScreen() {
  const params = useLocalSearchParams<{ examId: string }>();
  const examId = String(params.examId || '');
  const [exam, setExam] = useState<Exam | null>(null);
  const [questions, setQuestions] = useState<ExamQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let active = true;
    getExam(examId).then((result) => {
      if (active) { setExam(result.exam); setQuestions(result.questions); }
    }).catch((e) => { if (active) setError(getErrorMessage(e, 'Unable to load exam details.')); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [examId]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const begin = async () => {
    setStarting(true); setError('');
    try {
      const data = await startExam(examId);
      router.replace({ pathname: '/student/exams/attempt/[attemptId]', params: { attemptId: data.attempt.id, examId } } as any);
    } catch (e) {
      setError(getErrorMessage(e, 'Unable to start this exam.'));
    } finally { setStarting(false); }
  };

  if (loading) return <ExamPage><ExamLoading /></ExamPage>;
  if (!exam) return <ExamPage><ExamHeader title="Exam details" onBack={() => router.back()} /><ExamNotice text={error || 'Exam not found.'} error /></ExamPage>;

  const startAt = new Date(exam.startTime).getTime();
  const endAt = new Date(exam.endTime).getTime();
  const validSchedule = Number.isFinite(startAt) && Number.isFinite(endAt);
  const canStart = exam.status === 'published' && validSchedule && now >= startAt && now <= endAt;
  const scheduleMessage = !validSchedule
    ? 'The exam schedule is invalid. Please contact faculty.'
    : now < startAt
      ? `This exam opens at ${new Date(exam.startTime).toLocaleString('en-IN', { timeZoneName: 'short' })}.`
      : now > endAt
        ? 'This exam window has ended.'
        : 'The exam is open. You can start now.';

  return (
    <ExamPage>
      <ExamHeader title={exam.title} subtitle={`${exam.subject} • ${exam.className}`} onBack={() => router.back()} />
      {error ? <ExamNotice text={error} error /> : null}
      <ExamCard>
        <Text style={examTextStyles.name}>Exam overview</Text>
        {!!exam.description && <Text style={examTextStyles.meta}>{exam.description}</Text>}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 10 }}>
          <ExamPill text={`${exam.duration} minutes`} />
          <ExamPill text={`${exam.totalMarks} total marks`} color={EXAM_COLORS.orange} />
          <ExamPill text={`${exam.passingMarks} passing marks`} color={EXAM_COLORS.green} />
          <ExamPill text={`${questions.length} questions`} />
        </View>
        <Text style={examTextStyles.meta}>Start: {new Date(exam.startTime).toLocaleString('en-IN', { timeZoneName: 'short' })}</Text>
        <Text style={examTextStyles.meta}>End: {new Date(exam.endTime).toLocaleString('en-IN', { timeZoneName: 'short' })}</Text>
        {exam.negativeMarking ? <Text style={examTextStyles.meta}>Negative marking: {exam.negativeMarks || 0} marks per incorrect answer.</Text> : null}
      </ExamCard>
      <ExamCard>
        <Text style={examTextStyles.section}>Instructions</Text>
        {(exam.instructions || []).length ? (exam.instructions || []).map((item, i) => <Text key={i} style={examTextStyles.meta}>{i + 1}. {item}</Text>) : <Text style={examTextStyles.meta}>Read each question carefully. Save your answers and submit before the timer ends.</Text>}
      </ExamCard>
      <ExamCard>
        <Text style={examTextStyles.section}>Before you begin</Text>
        <Text style={examTextStyles.meta}>• Your exam timer starts when you begin the attempt.</Text>
        <Text style={examTextStyles.meta}>• Your answers are saved to the server when you save them.</Text>
        <Text style={examTextStyles.meta}>• You cannot change answers after submission.</Text>
        <Text style={examTextStyles.meta}>• Descriptive answers may require faculty evaluation.</Text>
        <View style={{ marginTop: 14 }}>
          <ExamButton title={starting ? 'Starting…' : 'Start Examination'} onPress={begin} disabled={!canStart} loading={starting} />
          <Text style={[examTextStyles.meta, { textAlign: 'center', marginTop: 8 }]}>{scheduleMessage}</Text>
        </View>
      </ExamCard>
    </ExamPage>
  );
}
