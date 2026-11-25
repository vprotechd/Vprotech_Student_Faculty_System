import React, { useCallback, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { getErrorMessage } from '../../../api/apiClient';
import { createExam, listExams, type Exam } from '../../../api/examinationApi';
import { ExamButton, ExamCard, ExamField, ExamHeader, ExamLoading, ExamNotice, ExamPage, ExamPill, examTextStyles, EXAM_COLORS } from '../../../components/examination/ExamUI';

const isoInput = (date: Date) => date.toISOString();

export default function FacultyExamsScreen() {
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [className, setClassName] = useState('');
  const [batch, setBatch] = useState('');
  const [duration, setDuration] = useState('60');
  const [totalMarks, setTotalMarks] = useState('100');
  const [passingMarks, setPassingMarks] = useState('40');
  const [startTime, setStartTime] = useState(isoInput(new Date(Date.now() + 60 * 60 * 1000)));
  const [endTime, setEndTime] = useState(isoInput(new Date(Date.now() + 2 * 60 * 60 * 1000)));
  const [description, setDescription] = useState('');

  const load = useCallback(async () => {
    setError('');
    try { setExams(await listExams()); }
    catch (e) { setError(getErrorMessage(e, 'Unable to load examinations.')); }
    finally { setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const handleCreate = async () => {
    if (!title.trim() || !subject.trim() || !className.trim() || Number(duration) < 1 || Number(totalMarks) < 1) {
      setError('Enter exam title, subject, class, duration and total marks.');
      return;
    }
    setCreating(true); setError('');
    try {
      const exam = await createExam({ title: title.trim(), subject: subject.trim(), className: className.trim(), batch: batch.trim(), description, duration: Number(duration), totalMarks: Number(totalMarks), passingMarks: Number(passingMarks) || 0, startTime, endTime, status: 'draft' });
      setShowForm(false);
      setTitle(''); setSubject(''); setClassName(''); setBatch(''); setDescription('');
      await load();
      router.push(`/faculty/exams/${exam._id}` as any);
    } catch (e) { setError(getErrorMessage(e, 'Unable to create examination.')); }
    finally { setCreating(false); }
  };

  if (loading) return <ExamPage><ExamLoading /></ExamPage>;
  return (
    <ExamPage>
      <ExamHeader title="Manage Examinations" subtitle="Create exams, add questions, publish and evaluate submissions." onBack={() => router.back()} />
      {error ? <ExamNotice text={error} error /> : null}
      <ExamButton title={showForm ? 'Close create form' : '+ Create New Exam'} onPress={() => setShowForm((v) => !v)} />
      {showForm ? <ExamCard style={{ marginTop: 13 }}>
        <Text style={examTextStyles.section}>Exam details</Text>
        <ExamField label="Exam title" value={title} onChangeText={setTitle} placeholder="e.g. Database Management Systems" />
        <ExamField label="Subject" value={subject} onChangeText={setSubject} placeholder="Subject name" />
        <ExamField label="Class / Course" value={className} onChangeText={setClassName} placeholder="e.g. BCA" />
        <ExamField label="Batch (optional)" value={batch} onChangeText={setBatch} placeholder="e.g. 2025-2028" />
        <ExamField label="Description" value={description} onChangeText={setDescription} placeholder="Exam description" multiline />
        <ExamField label="Duration (minutes)" value={duration} onChangeText={setDuration} keyboardType="numeric" />
        <ExamField label="Total marks" value={totalMarks} onChangeText={setTotalMarks} keyboardType="numeric" />
        <ExamField label="Passing marks" value={passingMarks} onChangeText={setPassingMarks} keyboardType="numeric" />
        <ExamField label="Start date/time (ISO format)" value={startTime} onChangeText={setStartTime} placeholder="2026-12-01T10:00:00.000Z" />
        <ExamField label="End date/time (ISO format)" value={endTime} onChangeText={setEndTime} placeholder="2026-12-01T11:00:00.000Z" />
        <ExamButton title="Create Draft Exam" onPress={handleCreate} loading={creating} />
      </ExamCard> : null}
      <Text style={[examTextStyles.section, { marginTop: 20 }]}>Your examinations</Text>
      {!exams.length ? <ExamCard><Text style={examTextStyles.name}>No exams created yet</Text><Text style={examTextStyles.meta}>Create your first examination using the button above.</Text></ExamCard> :
        exams.map((exam) => <ExamCard key={exam._id}>
          <Text style={examTextStyles.name}>{exam.title}</Text>
          <Text style={examTextStyles.meta}>{exam.subject} • {exam.className}{exam.batch ? ` • ${exam.batch}` : ''}</Text>
          <View style={{ flexDirection: 'row', gap: 7, flexWrap: 'wrap' }}>
            <ExamPill text={exam.status} color={exam.status === 'published' ? EXAM_COLORS.green : EXAM_COLORS.orange} />
            <ExamPill text={`${exam.questionCount || 0} questions`} />
            <ExamPill text={`${exam.totalMarks} marks`} color={EXAM_COLORS.orange} />
          </View>
          <View style={{ marginTop: 12 }}><ExamButton title="Manage Exam" onPress={() => router.push(`/faculty/exams/${exam._id}` as any)} /></View>
        </ExamCard>)
      }
    </ExamPage>
  );
}
