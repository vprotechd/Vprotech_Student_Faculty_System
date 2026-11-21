import React, { useCallback, useEffect, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { getErrorMessage } from '../../api/apiClient';
import {
  getMyDoubts,
  refName,
  replyToDoubt,
  type Doubt,
} from '../../api/studentApi';
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

const doubtStatusStyle = (status: Doubt['status']) =>
  status === 'answered'
    ? { color: COLORS.success, bg: COLORS.successSoft }
    : status === 'closed'
    ? { color: COLORS.sub, bg: '#EEF2F5' }
    : { color: COLORS.warning, bg: COLORS.warningSoft };

export default function FacultyDoubts() {
  const [doubts, setDoubts] = useState<Doubt[]>([]);
  const [replies, setReplies] = useState<Record<string, string>>({});
  const [replyErrors, setReplyErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [replyingId, setReplyingId] = useState('');

  const load = useCallback(async () => {
    try {
      setError('');
      setDoubts(await getMyDoubts());
    } catch (e) {
      setError(getErrorMessage(e, 'Unable to load student doubts.'));
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

  const submitReply = async (doubt: Doubt) => {
    const message = (replies[doubt._id] || '').trim();
    if (!message) {
      setReplyErrors((previous) => ({
        ...previous,
        [doubt._id]: 'Write a reply before sending.',
      }));
      return;
    }

    try {
      setReplyingId(doubt._id);
      setReplyErrors((previous) => ({ ...previous, [doubt._id]: '' }));
      const updated = await replyToDoubt(doubt._id, message);
      setDoubts((previous) =>
        previous.map((item) => (item._id === doubt._id ? updated : item))
      );
      setReplies((previous) => ({ ...previous, [doubt._id]: '' }));
    } catch (e) {
      setReplyErrors((previous) => ({
        ...previous,
        [doubt._id]: getErrorMessage(e, 'Unable to send your reply.'),
      }));
    } finally {
      setReplyingId('');
    }
  };

  return (
    <Screen>
      <Header title="Student Doubts" subtitle="Review questions and reply" />
      {loading ? (
        <Loading text="Loading student doubts..." />
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16, gap: 12, flexGrow: 1 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={COLORS.primary}
            />
          }
        >
          <ErrorBanner message={error} onRetry={load} />
          {doubts.length === 0 && !error ? (
            <Empty
              icon="help-circle-outline"
              title="No student doubts"
              text="New questions assigned to you will appear here."
            />
          ) : (
            doubts.map((doubt) => {
              const status = doubtStatusStyle(doubt.status);
              return (
                <Card key={doubt._id} style={{ gap: 8 }}>
                  <View style={styles.between}>
                    <Text style={styles.title} numberOfLines={2}>{doubt.title}</Text>
                    <Pill text={doubt.status} color={status.color} bg={status.bg} />
                  </View>
                  <Text style={styles.sub}>
                    {refName(doubt.subjectId) || 'Subject'} {'\u2022'} {formatDate(doubt.createdAt)}
                  </Text>
                  <Text style={styles.body}>{doubt.message}</Text>

                  {doubt.replies?.map((reply, index) => (
                    <View key={reply._id || index} style={styles.reply}>
                      <Text style={styles.replyLabel}>
                        Faculty reply {'\u2022'} {formatDate(reply.repliedAt)}
                      </Text>
                      <Text style={styles.body}>{reply.message}</Text>
                    </View>
                  ))}

                  <TextInput
                    value={replies[doubt._id] || ''}
                    onChangeText={(value) => {
                      setReplies((previous) => ({ ...previous, [doubt._id]: value }));
                      setReplyErrors((previous) => ({ ...previous, [doubt._id]: '' }));
                    }}
                    multiline
                    maxLength={5000}
                    placeholder="Write your reply"
                    placeholderTextColor="#9AAEBB"
                    style={styles.input}
                  />
                  {replyErrors[doubt._id] ? (
                    <Text style={styles.errorText}>{replyErrors[doubt._id]}</Text>
                  ) : null}
                  <Button
                    label="Send reply"
                    loading={replyingId === doubt._id}
                    disabled={!!replyingId && replyingId !== doubt._id}
                    onPress={() => void submitReply(doubt)}
                  />
                </Card>
              );
            })
          )}
        </ScrollView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  title: { flex: 1, fontSize: 15.5, fontWeight: '800', color: COLORS.text },
  sub: { fontSize: 12.5, color: COLORS.sub },
  body: { fontSize: 13.5, color: COLORS.text, lineHeight: 20 },
  reply: { backgroundColor: COLORS.successSoft, borderRadius: 12, padding: 12, gap: 4 },
  replyLabel: { fontSize: 12, fontWeight: '800', color: COLORS.success },
  input: { minHeight: 90, borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, fontSize: 15, color: COLORS.text, backgroundColor: '#FAFCFE', textAlignVertical: 'top' },
  errorText: { color: COLORS.danger, fontSize: 12.5, fontWeight: '700' },
});
