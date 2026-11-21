import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, Linking, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { getErrorMessage } from '../../api/apiClient';
import { getStudyMaterials, type StudyMaterial } from '../../api/studentApi';
import { Card, COLORS, Empty, ErrorBanner, formatDate, Header, Loading, Pill, Screen } from '../../components/portal';

export default function StudentMaterials() {
  const [items, setItems] = useState<StudyMaterial[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setError('');
      setItems(await getStudyMaterials());
    } catch (e: any) {
      setError(getErrorMessage(e, 'Unable to load study materials.'));
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

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((m) => `${m.title} ${m.batch}`.toLowerCase().includes(q));
  }, [items, query]);

  const open = async (url: string) => {
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert('Error', 'Unable to open this file.');
    }
  };

  return (
    <Screen>
      <Header
        title="Study Materials"
        subtitle="Notes and videos from your faculty"
        onBackPress={() =>
          router.canGoBack()
            ? router.back()
            : router.replace('/student-dashboard')
        }
      />
      {loading ? (
        <Loading text="Loading materials..." />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(m) => m._id}
          contentContainerStyle={{ padding: 16, gap: 12, flexGrow: 1 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
          ListHeaderComponent={
            <View style={{ gap: 12 }}>
              <ErrorBanner message={error} onRetry={load} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search by title or batch"
                placeholderTextColor="#9AAEBB"
                style={styles.search}
              />
            </View>
          }
          ListEmptyComponent={
            error ? null : <Empty icon="library-outline" title="No materials yet" text="New notes will appear here." />
          }
          renderItem={({ item }) => (
            <Card style={styles.row}>
              <View style={styles.icon}>
                <Ionicons
                  name={item.type === 'video' ? 'play-circle-outline' : 'document-text-outline'}
                  size={24}
                  color={COLORS.primary}
                />
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={styles.title} numberOfLines={2}>{item.title}</Text>
                <Text style={styles.sub} numberOfLines={1}>
                  {item.batch}
                  {item.createdAt ? ` \u2022 ${formatDate(item.createdAt)}` : ''}
                </Text>
                <Pill text={item.type === 'video' ? 'Video' : 'Notes'} />
              </View>
              <Pressable onPress={() => open(item.fileUrl)} style={styles.openBtn}>
                <Text style={styles.openText}>Open</Text>
              </Pressable>
            </Card>
          )}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  search: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, fontSize: 15, color: COLORS.text, backgroundColor: COLORS.card },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  icon: { width: 46, height: 46, borderRadius: 13, backgroundColor: COLORS.primarySoft, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 15, fontWeight: '800', color: COLORS.text },
  sub: { fontSize: 12.5, color: COLORS.sub },
  openBtn: { backgroundColor: COLORS.primary, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10 },
  openText: { color: '#FFF', fontWeight: '800', fontSize: 13 },
});
