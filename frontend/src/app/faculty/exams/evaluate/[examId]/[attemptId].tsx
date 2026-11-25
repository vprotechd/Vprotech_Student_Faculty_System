import React, { useCallback, useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { getErrorMessage } from '../../../../../api/apiClient';
import { evaluateAttempt, getAttemptForEvaluation, publishAttemptResult } from '../../../../../api/examinationApi';
import { ExamButton, ExamCard, ExamField, ExamHeader, ExamLoading, ExamNotice, ExamPage, ExamPill, examTextStyles, EXAM_COLORS } from '../../../../../components/examination/ExamUI';

type ReviewQuestion = {
  _id?: string;
  questionId: string;
  questionText: string;
  questionType: 'mcq' | 'descriptive';
  options?: { optionText: string }[];
  correctAnswer?: string;
  marks: number;
  studentAnswer: string;
  marksAwarded: number;
  isEvaluated: boolean;
  feedback: string;
};

export default function EvaluateExamAttemptScreen() {
  const params = useLocalSearchParams<{ examId: string; attemptId: string }>();
  const examId = String(params.examId || '');
  const attemptId = String(params.attemptId || '');
  const [studentName, setStudentName] = useState('Student');
  const [questions, setQuestions] = useState<ReviewQuestion[]>([]);
  const [resultPublished, setResultPublished] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const data = await getAttemptForEvaluation(examId, attemptId);
      setStudentName(data.attempt.student?.name || data.attempt.student?.email || 'Student');
      setResultPublished(data.attempt.resultPublished);
      setQuestions(data.questions.map((q: any) => ({ ...q, questionId: String(q.questionId), marksAwarded: Number(q.marksAwarded || 0), feedback: q.feedback || '' })));
    } catch (e) { setError(getErrorMessage(e, 'Unable to load student attempt.')); }
    finally { setLoading(false); }
  }, [examId, attemptId]);
  useEffect(() => { void load(); }, [load]);

  const updateQuestion = (questionId: string, field: 'marksAwarded' | 'feedback', value: string) => {
    setQuestions((previous) => previous.map((q) => q.questionId === questionId ? { ...q, [field]: field === 'marksAwarded' ? Number(value) : value } : q));
  };

  const saveEvaluation = async () => {
    const descriptive = questions.filter((q) => q.questionType === 'descriptive');
    const invalid = descriptive.find((q) => !Number.isFinite(q.marksAwarded) || q.marksAwarded < 0 || q.marksAwarded > q.marks);
    if (invalid) { setError(`Marks for each descriptive answer must be between 0 and ${invalid.marks}.`); return; }
    setSaving(true); setError('');
    try {
      const data = await evaluateAttempt(examId, attemptId, descriptive.map((q) => ({ questionId: q.questionId, marksAwarded: q.marksAwarded, feedback: q.feedback })));
      Alert.alert('Evaluation saved', data.message || 'Evaluation saved successfully.');
      await load();
    } catch (e) { setError(getErrorMessage(e, 'Unable to save evaluation.')); }
    finally { setSaving(false); }
  };

  const publish = () => Alert.alert('Publish result?', 'The student will be able to see their marks after publication.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Publish', onPress: async () => {
      setSaving(true); setError('');
      try { await publishAttemptResult(examId, attemptId); setResultPublished(true); Alert.alert('Result published', 'The student can now view the result.'); }
      catch (e) { setError(getErrorMessage(e, 'Unable to publish result.')); }
      finally { setSaving(false); }
    } },
  ]);

  if (loading) return <ExamPage><ExamLoading /></ExamPage>;
  return (
    <ExamPage>
      <ExamHeader title="Evaluate Attempt" subtitle={studentName} onBack={() => router.back()} />
      {error ? <ExamNotice text={error} error /> : null}
      {resultPublished ? <ExamNotice text="This result has already been published and cannot be changed." /> : null}
      {questions.map((q, index) => <ExamCard key={q.questionId}>
        <Text style={examTextStyles.meta}>QUESTION {index + 1} • {q.questionType.toUpperCase()} • MAX {q.marks} MARKS</Text>
        <Text style={[examTextStyles.name, { marginTop: 8 }]}>{q.questionText}</Text>
        {q.questionType === 'mcq' ? <>
          <Text style={examTextStyles.meta}>Student answer: {q.studentAnswer || 'Not answered'}</Text>
          <Text style={[examTextStyles.meta, { color: EXAM_COLORS.green }]}>Correct answer: {q.correctAnswer || '—'}</Text>
          <Text style={examTextStyles.meta}>Awarded: {q.marksAwarded} marks</Text>
        </> : <>
          <Text style={examTextStyles.meta}>Student answer</Text>
          <Text style={{ color: EXAM_COLORS.heading, fontSize: 14, lineHeight: 22, marginTop: 5 }}>{q.studentAnswer || 'No answer submitted.'}</Text>
          <ExamField label={`Marks awarded (0–${q.marks})`} value={String(q.marksAwarded)} onChangeText={(value) => updateQuestion(q.questionId, 'marksAwarded', value)} keyboardType="decimal-pad" editable={!resultPublished} />
          <ExamField label="Feedback for student" value={q.feedback} onChangeText={(value) => updateQuestion(q.questionId, 'feedback', value)} multiline editable={!resultPublished} />
          <ExamPill text={q.isEvaluated ? 'Evaluated' : 'Pending'} color={q.isEvaluated ? EXAM_COLORS.green : EXAM_COLORS.orange} />
        </>}
      </ExamCard>)}
      {!resultPublished ? <>
        <ExamButton title="Save Evaluation" onPress={saveEvaluation} loading={saving} />
        <View style={{ height: 10 }} />
        <ExamButton title="Publish Result to Student" onPress={publish} secondary loading={saving} />
      </> : null}
    </ExamPage>
  );
}
