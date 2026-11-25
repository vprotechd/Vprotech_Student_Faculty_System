import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Text, TextInput, View, Pressable } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { getErrorMessage } from '../../../../api/apiClient';
import { getAttemptForStudent, saveExamAnswers, submitExam, type ExamQuestion, type ExamAnswer } from '../../../../api/examinationApi';
import { ExamButton, ExamCard, ExamHeader, ExamLoading, ExamNotice, ExamPage, examTextStyles, EXAM_COLORS } from '../../../../components/examination/ExamUI';

const formatTime = (seconds: number) => `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;

export default function StudentExamAttemptScreen() {
  const params = useLocalSearchParams<{ attemptId: string; examId: string }>();
  const attemptId = String(params.attemptId || '');
  const examId = String(params.examId || '');
  const [questions, setQuestions] = useState<ExamQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [expiresAt, setExpiresAt] = useState('');
  const [examTitle, setExamTitle] = useState('Online Examination');
  const [current, setCurrent] = useState(0);
  const [remaining, setRemaining] = useState(-1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [ready, setReady] = useState(false);

  const answerList = useMemo(() => Object.entries(answers).map(([questionId, answer]) => ({ questionId, answer })), [answers]);

  useEffect(() => {
    let active = true;
    getAttemptForStudent(attemptId).then((data) => {
      if (!active) return;
      setQuestions(data.questions || []);
      setExamTitle(data.exam?.title || 'Online Examination');
      setExpiresAt(data.attempt.expiresAt);
      const restored: Record<string, string> = {};
      (data.attempt.answers || []).forEach((item: any) => { restored[String(item.questionId)] = item.answer || ''; });
      setAnswers(restored);
      setReady(true);
    }).catch((e) => { if (active) setError(getErrorMessage(e, 'Unable to resume this exam.')); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [attemptId]);

  useEffect(() => {
    if (!expiresAt || submitted) return;
    const tick = () => setRemaining(Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 1000)));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [expiresAt, submitted]);

  const save = useCallback(async (nextAnswers = answerList) => {
    if (!attemptId || submitted) return;
    setSaving(true);
    try { await saveExamAnswers(attemptId, nextAnswers); }
    catch (e) { setError(getErrorMessage(e, 'Unable to save answers.')); }
    finally { setSaving(false); }
  }, [answerList, attemptId, submitted]);

  // Keep the server copy current while the student answers each question.
  useEffect(() => {
    if (!ready || !attemptId || submitted || loading) return;
    const timer = setTimeout(() => {
      saveExamAnswers(attemptId, answerList).catch((e) => {
        setError(getErrorMessage(e, 'Automatic answer saving failed. Use Save answers to retry.'));
      });
    }, 650);
    return () => clearTimeout(timer);
  }, [answerList, attemptId, ready, submitted, loading]);

  const submit = useCallback(async (automatic = false) => {
    if (submitting || submitted || !attemptId) return;
    setSubmitting(true); setError('');
    try {
      await submitExam(attemptId, answerList);
      setSubmitted(true);
      Alert.alert(automatic ? 'Time is up' : 'Exam submitted', 'Your answers have been submitted successfully.', [
        { text: 'View results', onPress: () => router.replace('/student/exams/results' as any) },
      ]);
    } catch (e) { setError(getErrorMessage(e, 'Unable to submit exam.')); }
    finally { setSubmitting(false); }
  }, [answerList, attemptId, submitted, submitting]);

  useEffect(() => {
    if (expiresAt && remaining === 0 && !loading && !submitted && !submitting) {
      void submit(true);
    }
  }, [expiresAt, remaining, loading, submitted, submitting, submit]);

  const setAnswer = (questionId: string, value: string) => {
    setAnswers((previous) => ({ ...previous, [questionId]: value }));
  };

  if (loading) return <ExamPage><ExamLoading /></ExamPage>;
  if (!questions.length) return <ExamPage><ExamHeader title={examTitle} onBack={() => router.back()} /><ExamNotice text={error || 'No questions were returned for this attempt.'} error /></ExamPage>;
  if (submitted) return <ExamPage><ExamHeader title="Exam submitted" /><ExamCard><Text style={examTextStyles.name}>Your answers have been submitted.</Text><Text style={examTextStyles.meta}>Your result will appear here when it is available.</Text><ExamButton title="View results" onPress={() => router.replace('/student/exams/results' as any)} /></ExamCard></ExamPage>;

  const question = questions[current];
  const selected = answers[question._id] || '';
  const answeredCount = Object.values(answers).filter((value) => value.trim()).length;

  return (
    <ExamPage>
      <ExamHeader title={examTitle} subtitle={`Question ${current + 1} of ${questions.length}`} />
      <ExamCard style={{ backgroundColor: remaining < 60 ? '#FFF1F0' : '#EAF3FC', borderColor: 'transparent' }}>
        <Text style={{ color: remaining < 60 ? EXAM_COLORS.red : EXAM_COLORS.primary, fontSize: 12, fontWeight: '800' }}>TIME REMAINING</Text>
        <Text style={{ color: remaining < 60 ? EXAM_COLORS.red : EXAM_COLORS.heading, fontSize: 30, fontWeight: '900', marginTop: 3 }}>{formatTime(remaining)}</Text>
        <Text style={examTextStyles.meta}>{answeredCount} of {questions.length} questions answered {saving ? ' • Saving…' : ' • Saved'}</Text>
      </ExamCard>
      {error ? <ExamNotice text={error} error /> : null}
      <ExamCard>
        <Text style={examTextStyles.meta}>QUESTION {current + 1} • {question.marks} MARKS • {question.questionType.toUpperCase()}</Text>
        <Text style={[examTextStyles.name, { marginTop: 10, lineHeight: 25 }]}>{question.questionText}</Text>
        {question.questionType === 'mcq' ? (question.options || []).map((option, index) => {
          const value = option.optionText;
          const isSelected = selected === value;
          return (
            <Pressable key={`${question._id}-${index}`} onPress={() => setAnswer(question._id, value)}
              style={[examTextStyles.option, isSelected && examTextStyles.optionSelected]}>
              <Text style={examTextStyles.optionText}>{isSelected ? '◉  ' : '○  '}{value}</Text>
            </Pressable>
          );
        }) : (
          <TextInput value={selected} onChangeText={(value) => setAnswer(question._id, value)}
            placeholder="Write your answer here…" placeholderTextColor={EXAM_COLORS.muted}
            multiline textAlignVertical="top" style={{ minHeight: 150, borderWidth: 1, borderColor: EXAM_COLORS.border, borderRadius: 12, padding: 12, marginTop: 14, color: EXAM_COLORS.heading, backgroundColor: '#fff' }} />
        )}
      </ExamCard>
      <View style={{ flexDirection: 'row', gap: 9, marginBottom: 10 }}>
        <View style={{ flex: 1 }}><ExamButton title="Previous" secondary disabled={current === 0} onPress={() => setCurrent((v) => Math.max(0, v - 1))} /></View>
        <View style={{ flex: 1 }}><ExamButton title={current === questions.length - 1 ? 'Last question' : 'Next'} disabled={current === questions.length - 1} onPress={() => setCurrent((v) => Math.min(questions.length - 1, v + 1))} /></View>
      </View>
      <ExamButton title={saving ? 'Saving…' : 'Save answers'} secondary onPress={() => void save()} loading={saving} />
      <View style={{ height: 10 }} />
      <ExamButton title="Submit Examination" onPress={() => Alert.alert('Submit exam?', 'You cannot change your answers after submitting.', [{ text: 'Continue exam', style: 'cancel' }, { text: 'Submit', style: 'destructive', onPress: () => void submit(false) }])} loading={submitting} />
    </ExamPage>
  );
}
