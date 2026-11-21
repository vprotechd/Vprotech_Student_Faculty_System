import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { getErrorMessage } from '../../api/apiClient';
import {
  createDoubt,
  getMyDoubts,
  getSubjects,
  refId,
  refName,
  type Doubt,
  type SubjectRecord,
} from '../../api/studentApi';
import { useStudent } from '../../hooks/use-student';
import {
  Button,
  Card,
  COLORS,
  Empty,
  ErrorBanner,
  formatDate,
  Header,
  Loading,
  Pill,
  Screen,
} from '../../components/portal';

const statusStyle = (status: Doubt['status']) =>
  status === 'answered'
    ? { color: COLORS.success, bg: COLORS.successSoft }
    : status === 'closed'
    ? { color: COLORS.sub, bg: '#EEF2F5' }
    : { color: COLORS.warning, bg: COLORS.warningSoft };

export default function StudentDoubts() {
  const { student, loading: studentLoading, error: studentError } = useStudent();

  const [doubts, setDoubts] = useState<Doubt[]>([]);
  const [subjects, setSubjects] = useState<SubjectRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const [formOpen, setFormOpen] = useState(false);
  const [subjectId, setSubjectId] = useState('');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const load = useCallback(async () => {
    if (!student) return;
    try {
      setError('');
      const [d, s] = await Promise.all([getMyDoubts(), getSubjects()]);
      setDoubts(d);
      setSubjects(s);
    } catch (e) {
      setError(getErrorMessage(e, 'Unable to load your doubts.'));
    }
  }, [student]);

  useEffect(() => {
    if (studentLoading) return;
    load().finally(() => setLoading(false));
  }, [studentLoading, load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  // Only subjects of the student's own course / semester.
  const mySubjects = useMemo(
    () =>
      subjects.filter((s) => {
        if (s.isActive === false) return false;
        if (student?.departmentId && refId(s.departmentId) && refId(s.departmentId) !== student.departmentId) return false;
        if (student?.courseId && refId(s.courseId) && refId(s.courseId) !== student.courseId) return false;
        if (student?.semester && s.semester && s.semester !== student.semester) return false;
        return true;
      }),
    [subjects, student]
  );

  const submit = async () => {
    if (saving) return;
    setFormError('');
    if (!student) {
      setFormError('Your student profile could not be loaded. Please try again.');
      return;
    }
    const subject = mySubjects.find((s) => s._id === subjectId);

    if (!subject) {
      setFormError('Choose the subject your doubt is about.');
      return;
    }
    if (!title.trim() || !message.trim()) {
      setFormError('Enter a title and describe your doubt.');
      return;
    }

    try {
      setSaving(true);
      const created = await createDoubt({
        subjectId: subject._id,
        title: title.trim(),
        message: message.trim(),
      });
      setDoubts((prev) => [{ ...created, replies: created.replies ?? [] }, ...prev]);
      setTitle('');
      setMessage('');
      setSubjectId('');
      setFormError('');
      setFormOpen(false);
    } catch (e) {
      setFormError(getErrorMessage(e, 'Unable to submit your doubt.'));
    } finally {
      setSaving(false);
    }
  };

  const subjectLabel = (d: Doubt) =>
    refName(d.subjectId) || subjects.find((s) => s._id === refId(d.subjectId))?.name || 'Subject';

  return (
    <Screen>
      <Header
        title="Doubts"
        subtitle="Ask your faculty and track answers"
        onBackPress={() =>
          router.canGoBack()
            ? router.back()
            : router.replace('/student-dashboard')
        }
        right={
          student ? (
            <Pressable
              style={styles.addBtn}
              onPress={() => {
                setFormError('');
                setFormOpen(true);
              }}
              accessibilityLabel="Ask a doubt"
            >
              <Ionicons name="add" size={22} color="#FFF" />
            </Pressable>
          ) : undefined
        }
      />

      {loading || studentLoading ? (
        <Loading text="Loading doubts..." />
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16, gap: 12, flexGrow: 1 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
        >
          <ErrorBanner message={error || studentError} onRetry={load} />

          {!student && !studentError ? (
            <Empty icon="person-outline" title="Student profile not found" text="Ask the administrator to complete your student profile." />
          ) : doubts.length === 0 && !error ? (
            <Empty icon="help-circle-outline" title="No doubts yet" text="Tap + to ask your first question." />
          ) : (
            doubts.map((d) => {
              const c = statusStyle(d.status);
              return (
                <Card key={d._id} style={{ gap: 8 }}>
                  <View style={styles.between}>
                    <Text style={styles.title} numberOfLines={2}>{d.title}</Text>
                    <Pill text={d.status} color={c.color} bg={c.bg} />
                  </View>
                  <Text style={styles.sub}>{subjectLabel(d)} {'\u2022'} {formatDate(d.createdAt)}</Text>
                  <Text style={styles.body}>{d.message}</Text>

                  {d.replies?.map((r, i) => (
                    <View key={r._id || i} style={styles.reply}>
                      <Text style={styles.replyLabel}>Faculty reply</Text>
                      <Text style={styles.body}>{r.message}</Text>
                    </View>
                  ))}
                </Card>
              );
            })
          )}
        </ScrollView>
      )}

      <Modal visible={formOpen} animationType="slide" onRequestClose={() => setFormOpen(false)}>
        <Screen>
          <Header
            title="Ask a doubt"
            onBack={false}
            right={
              <Pressable onPress={() => setFormOpen(false)} accessibilityLabel="Close">
                <Ionicons name="close" size={26} color={COLORS.primaryDark} />
              </Pressable>
            }
          />
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <ScrollView contentContainerStyle={{ padding: 16, gap: 10 }} keyboardShouldPersistTaps="handled">
              <ErrorBanner message={formError} />
              <Text style={styles.label}>Subject</Text>
              {mySubjects.length === 0 ? (
                <Text style={styles.sub}>No subjects are available for your course yet.</Text>
              ) : (
                <View style={styles.chips}>
                  {mySubjects.map((s) => (
                    <Pressable
                      key={s._id}
                      onPress={() => {
                        setSubjectId(s._id);
                        setFormError('');
                      }}
                      style={[styles.chip, subjectId === s._id && styles.chipActive]}
                    >
                      <Text style={[styles.chipText, subjectId === s._id && { color: '#FFF' }]}>{s.name}</Text>
                    </Pressable>
                  ))}
                </View>
              )}

              <Text style={styles.label}>Title</Text>
              <TextInput
                value={title}
                onChangeText={(value) => {
                  setTitle(value);
                  setFormError('');
                }}
                maxLength={200}
                placeholder="Short summary of your doubt"
                placeholderTextColor="#9AAEBB"
                style={styles.input}
              />

              <Text style={styles.label}>Details</Text>
              <TextInput
                value={message}
                onChangeText={(value) => {
                  setMessage(value);
                  setFormError('');
                }}
                multiline
                maxLength={5000}
                placeholder="Describe your doubt"
                placeholderTextColor="#9AAEBB"
                style={[styles.input, { height: 130, textAlignVertical: 'top' }]}
              />

              <Button label="Submit doubt" loading={saving} onPress={submit} />
            </ScrollView>
          </KeyboardAvoidingView>
        </Screen>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  addBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  title: { flex: 1, fontSize: 15.5, fontWeight: '800', color: COLORS.text },
  sub: { fontSize: 12.5, color: COLORS.sub },
  body: { fontSize: 13.5, color: COLORS.text, lineHeight: 20 },
  reply: { backgroundColor: COLORS.successSoft, borderRadius: 12, padding: 12, gap: 4 },
  replyLabel: { fontSize: 12, fontWeight: '800', color: COLORS.success },
  label: { fontSize: 12.5, fontWeight: '700', color: COLORS.sub },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border },
  chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { color: COLORS.text, fontWeight: '700', fontSize: 13 },
  input: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, fontSize: 15, color: COLORS.text, backgroundColor: '#FAFCFE' },
});
