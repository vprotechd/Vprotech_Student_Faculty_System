import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { getErrorMessage } from '../../api/apiClient';
import { getNotifications, type AppNotification } from '../../api/studentApi';
import { Card, COLORS, Empty, ErrorBanner, formatDate, Header, Loading, Pill, Screen } from '../../components/portal';

export default function StudentNotifications() {
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setError('');
      setItems(await getNotifications());
    } catch (e) {
      setError(getErrorMessage(e, 'Unable to load notifications.'));
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

  return (
    <Screen>
      <Header title="Notifications" subtitle="Announcements and updates" />
      {loading ? (
        <Loading text="Loading notifications..." />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(n) => n._id}
          contentContainerStyle={{ padding: 16, gap: 12, flexGrow: 1 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
          ListHeaderComponent={error ? <ErrorBanner message={error} onRetry={load} /> : null}
          ListEmptyComponent={
            error ? null : <Empty icon="notifications-off-outline" title="No notifications" text="You are all caught up." />
          }
          renderItem={({ item }) => (
            <Card style={[{ gap: 6 }, !item.isRead && styles.unread]}>
              <View style={styles.head}>
                <Ionicons name="notifications-outline" size={18} color={COLORS.primary} />
                <Text style={styles.title} numberOfLines={2}>{item.title}</Text>
                {!item.isRead ? <Pill text="New" /> : null}
              </View>
              <Text style={styles.message}>{item.message}</Text>
              <Text style={styles.date}>{formatDate(item.createdAt)}</Text>
            </Card>
          )}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  unread: { borderColor: COLORS.primary, borderLeftWidth: 4 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { flex: 1, fontSize: 15, fontWeight: '800', color: COLORS.text },
  message: { fontSize: 13.5, color: COLORS.text, lineHeight: 20 },
  date: { fontSize: 12, color: COLORS.sub },
});
