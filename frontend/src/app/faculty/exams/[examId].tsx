import React, { useEffect, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { getErrorMessage } from '../../../api/apiClient';
import { addQuestion, cancelExam, getExam, publishExam, type Exam, type ExamQuestion } from '../../../api/examinationApi';
import { ExamButton, ExamCard, ExamField, ExamHeader, ExamLoading, ExamNotice, ExamPage, ExamPill, examTextStyles, EXAM_COLORS } from '../../../components/examination/ExamUI';

export default function FacultyExamDetailScreen() {
  const params = useLocalSearchParams<{ examId: string }>();
  const examId = String(params.examId || '');
  const [exam, setExam] = useState<Exam | null>(null);
  const [questions, setQuestions] = useState<ExamQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [showQuestionForm, setShowQuestionForm] = useState(false);
  const [questionText, setQuestionText] = useState('');
  const [questionType, setQuestionType] = useState<'mcq' | 'descriptive'>('mcq');
  const [optionsText, setOptionsText] = useState('Option 1\nOption 2\nOption 3\nOption 4');
  const [correctAnswer, setCorrectAnswer] = useState('Option 1');
  const [marks, setMarks] = useState('1');
  const [negativeMarks, setNegativeMarks] = useState('0');
  const [explanation, setExplanation] = useState('');

  const load = async () => {
    try {
      const data = await getExam(examId);
      setExam(data.exam); setQuestions(data.questions);
    } catch (e) { setError(getErrorMessage(e, 'Unable to load exam.')); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, [examId]);

  const handleAddQuestion = async () => {
    const options = optionsText.split('\n').map((optionText) => optionText.trim()).filter(Boolean);
    const numericMarks = Number(marks);
    if (!questionText.trim() || numericMarks <= 0 || (questionType === 'mcq' && (options.length < 2 || !options.includes(correctAnswer.trim())))) {
      setError('Check the question text, marks, options and correct answer.');
      return;
    }
    setBusy(true); setError('');
    try {
      await addQuestion(examId, { questionText: questionText.trim(), questionType, marks: numericMarks, negativeMarks: Number(negativeMarks) || 0, options: questionType === 'mcq' ? options.map((optionText) => ({ optionText })) : [], correctAnswer: questionType === 'mcq' ? correctAnswer.trim() : null, explanation });
      setQuestionText(''); setExplanation(''); setShowQuestionForm(false);
      await load();
    } catch (e) { setError(getErrorMessage(e, 'Unable to add question.')); }
    finally { setBusy(false); }
  };

  const handlePublish = () => Alert.alert('Publish examination?', 'Students will be able to see this exam. The sum of question marks must equal the exam total marks.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Publish', onPress: async () => {
      setBusy(true); setError('');
      try { await publishExam(examId); await load(); Alert.alert('Published', 'The examination is now published.'); }
      catch (e) { setError(getErrorMessage(e, 'Unable to publish exam.')); }
      finally { setBusy(false); }
    } },
  ]);

  if (loading) return <ExamPage><ExamLoading /></ExamPage>;
  if (!exam) return <ExamPage><ExamHeader title="Manage exam" onBack={() => router.back()} /><ExamNotice text={error || 'Exam not found.'} error /></ExamPage>;

  return (
    <ExamPage>
      <ExamHeader title={exam.title} subtitle={`${exam.subject} • ${exam.className}`} onBack={() => router.back()} />
      {error ? <ExamNotice text={error} error /> : null}
      <ExamCard>
        <Text style={examTextStyles.name}>Exam settings</Text>
        <ExamPill text={exam.status} color={exam.status === 'published' ? EXAM_COLORS.green : EXAM_COLORS.orange} />
        <Text style={examTextStyles.meta}>{exam.duration} minutes • {exam.totalMarks} total marks • {exam.passingMarks} passing marks</Text>
        <Text style={examTextStyles.meta}>Questions: {questions.length} • Marks assigned: {questions.reduce((sum, q) => sum + Number(q.marks || 0), 0)}</Text>
        <View style={{ marginTop: 12, gap: 9 }}>
          <ExamButton title="View Student Submissions" secondary onPress={() => router.push(`/faculty/exams/submissions/${examId}` as any)} />
          {['draft', 'scheduled'].includes(exam.status) ? <ExamButton title="Publish Examination" onPress={handlePublish} loading={busy} /> : null}
          {exam.status !== 'cancelled' && exam.status !== 'completed' ? <ExamButton title="Cancel Examination" secondary onPress={() => Alert.alert('Cancel exam?', 'Students will no longer be able to take this exam.', [{ text: 'Keep exam', style: 'cancel' }, { text: 'Cancel exam', style: 'destructive', onPress: async () => { setBusy(true); try { await cancelExam(examId); await load(); } catch (e) { setError(getErrorMessage(e)); } finally { setBusy(false); } } }])} /> : null}
        </View>
      </ExamCard>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <Text style={examTextStyles.section}>Questions ({questions.length})</Text>
        <View style={{ width: 145 }}><ExamButton title={showQuestionForm ? 'Close' : '+ Add Question'} onPress={() => setShowQuestionForm((v) => !v)} secondary /></View>
      </View>
      {showQuestionForm && exam.status !== 'published' ? <ExamCard>
        <Text style={examTextStyles.section}>New question</Text>
        <ExamField label="Question" value={questionText} onChangeText={setQuestionText} multiline placeholder="Enter the question" />
        <Text style={examTextStyles.meta}>Question type</Text>
        <View style={{ flexDirection: 'row', gap: 8, marginVertical: 10 }}>
          <View style={{ flex: 1 }}><ExamButton title="MCQ" secondary={questionType !== 'mcq'} onPress={() => setQuestionType('mcq')} /></View>
          <View style={{ flex: 1 }}><ExamButton title="Descriptive" secondary={questionType !== 'descriptive'} onPress={() => setQuestionType('descriptive')} /></View>
        </View>
        {questionType === 'mcq' ? <>
          <ExamField label="Options (one per line)" value={optionsText} onChangeText={setOptionsText} multiline />
          <ExamField label="Correct option (exact text)" value={correctAnswer} onChangeText={setCorrectAnswer} />
        </> : null}
        <ExamField label="Marks" value={marks} onChangeText={setMarks} keyboardType="numeric" />
        <ExamField label="Negative marks" value={negativeMarks} onChangeText={setNegativeMarks} keyboardType="numeric" />
        <ExamField label="Explanation (optional)" value={explanation} onChangeText={setExplanation} multiline />
        <ExamButton title="Save Question" onPress={handleAddQuestion} loading={busy} />
      </ExamCard> : null}
      {questions.map((question, index) => <ExamCard key={question._id}>
        <Text style={examTextStyles.meta}>QUESTION {index + 1} • {question.questionType.toUpperCase()} • {question.marks} MARKS</Text>
        <Text style={[examTextStyles.name, { marginTop: 7 }]}>{question.questionText}</Text>
        {(question.options || []).map((option, i) => <Text key={i} style={examTextStyles.meta}>{String.fromCharCode(65 + i)}. {option.optionText}</Text>)}
        {question.correctAnswer ? <Text style={[examTextStyles.meta, { color: EXAM_COLORS.green }]}>Correct answer: {question.correctAnswer}</Text> : null}
      </ExamCard>)}
      {questions.length === 0 ? <ExamCard><Text style={examTextStyles.meta}>Add questions to this draft. The total of all question marks must equal the exam's total marks before publishing.</Text></ExamCard> : null}
    </ExamPage>
  );
}
