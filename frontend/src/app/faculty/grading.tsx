import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { getErrorMessage } from '../../api/apiClient';
import {
  getPendingSubmissions,
  gradeSubmission,
  type Submission,
} from '../../api/facultyApi';
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

const gradeLetter = (marks: number) => {
  if (marks >= 90) return 'A+';
  if (marks >= 80) return 'A';
  if (marks >= 70) return 'B+';
  if (marks >= 60) return 'B';
  if (marks >= 50) return 'C';
  if (marks >= 40) return 'D';
  return 'F';
};

export default function FacultyGrading() {
  const [items, setItems] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const [openId, setOpenId] = useState<string | null>(null);
  const [marks, setMarks] = useState('');
  const [feedback, setFeedback] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setError('');
      setItems(await getPendingSubmissions());
    } catch (e) {
      setError(getErrorMessage(e, 'Unable to load submissions.'));
    }
  }, []);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const toggle = (id: string) => {
    if (openId === id) {
      setOpenId(null);
      return;
    }
    setOpenId(id);
    setMarks('');
    setFeedback('');
  };

  const openFile = async (url: string) => {
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert('Error', 'Unable to open this file.');
    }
  };

  const save = async (item: Submission) => {
    const value = Number(marks);
    const max = item.maxMarks ?? 100;

    if (marks.trim() === '' || Number.isNaN(value)) {
      Alert.alert('Marks required', 'Enter the marks for this submission.');
      return;
    }
    // The API accepts 0-100.
    if (value < 0 || value > 100) {
      Alert.alert('Invalid marks', 'Marks must be between 0 and 100.');
      return;
    }

    try {
      setSaving(true);
      await gradeSubmission(item._id, value, feedback.trim());
      // Graded items leave the pending queue.
      setItems((prev) => prev.filter((s) => s._id !== item._id));
      setOpenId(null);
      Alert.alert('Graded', `Saved ${value}/${max} (${gradeLetter(value)}).`);
    } catch (e) {
      Alert.alert('Error', getErrorMessage(e, 'Unable to save grade.'));
    } finally {
      setSaving(false);
    }
  };

  const renderItem = ({ item }: { item: Submission }) => {
    const open = openId === item._id;
    const studentName = item.student?.name || 'Student';

    return (
      <Card style={{ marginBottom: 12 }}>
        <Pressable onPress={() => toggle(item._id)} style={styles.row}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {studentName.charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
            <Text style={styles.sub} numberOfLines={1}>
              {studentName}
              {item.submittedAt ? `  \u2022  ${formatDate(item.submittedAt)}` : ''}
            </Text>
          </View>
          <Pill text="Pending" color={COLORS.warning} bg={COLORS.warningSoft} />
          <Ionicons
            name={open ? 'chevron-up' : 'chevron-down'}
            size={18}
            color={COLORS.sub}
          />
        </Pressable>

        {open ? (
          <View style={styles.panel}>
            {item.description ? (
              <Text style={styles.desc}>{item.description}</Text>
            ) : null}

            <Pressable onPress={() => openFile(item.fileUrl)} style={styles.fileBtn}>
              <Ionicons name="document-attach-outline" size={18} color={COLORS.primary} />
              <Text style={styles.fileText} numberOfLines={1}>
                {item.fileName || 'Open submitted file'}
              </Text>
            </Pressable>

            <Text style={styles.label}>Marks (out of 100)</Text>
            <TextInput
              value={marks}
              onChangeText={(v) => setMarks(v.replace(/[^0-9.]/g, ''))}
              keyboardType="numeric"
              maxLength={5}
              placeholder="e.g. 85"
              placeholderTextColor="#9AAEBB"
              style={styles.input}
            />
            {marks !== '' && !Number.isNaN(Number(marks)) ? (
              <Text style={styles.gradeHint}>Grade: {gradeLetter(Number(marks))}</Text>
            ) : null}

            <Text style={styles.label}>Feedback (optional)</Text>
            <TextInput
              value={feedback}
              onChangeText={setFeedback}
              multiline
              placeholder="Write feedback for the student"
              placeholderTextColor="#9AAEBB"
              style={[styles.input, { height: 84, textAlignVertical: 'top' }]}
            />

            <Button
              label="Save grade"
              icon="checkmark-circle-outline"
              loading={saving}
              onPress={() => save(item)}
            />
          </View>
        ) : null}
      </Card>
    );
  };

  return (
    <Screen>
      <Header
        title="Grading"
        subtitle={`${items.length} submission${items.length === 1 ? '' : 's'} waiting`}
      />
      {loading ? (
        <Loading text="Loading submissions..." />
      ) : (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <FlatList
            data={items}
            keyExtractor={(item) => item._id}
            renderItem={renderItem}
            contentContainerStyle={{ padding: 16, flexGrow: 1 }}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />
            }
            ListHeaderComponent={
              error ? (
                <View style={{ marginBottom: 12 }}>
                  <ErrorBanner message={error} onRetry={load} />
                </View>
              ) : null
            }
            ListEmptyComponent={
              error ? null : (
                <Empty
                  icon="checkmark-done-outline"
                  title="All caught up"
                  text="There are no submissions waiting for grading."
                />
              )
            }
          />
        </KeyboardAvoidingView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: COLORS.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: COLORS.primary, fontWeight: '800', fontSize: 16 },
  title: { fontSize: 15, fontWeight: '800', color: COLORS.text },
  sub: { fontSize: 12.5, color: COLORS.sub, marginTop: 2 },
  panel: { marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: COLORS.border, gap: 8 },
  desc: { color: COLORS.text, fontSize: 13.5, lineHeight: 20 },
  fileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.primarySoft,
    padding: 12,
    borderRadius: 12,
  },
  fileText: { flex: 1, color: COLORS.primary, fontWeight: '700', fontSize: 13.5 },
  label: { fontSize: 12.5, fontWeight: '700', color: COLORS.sub, marginTop: 4 },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 15,
    color: COLORS.text,
    backgroundColor: '#FAFCFE',
  },
  gradeHint: { color: COLORS.success, fontWeight: '800', fontSize: 13 },
});
