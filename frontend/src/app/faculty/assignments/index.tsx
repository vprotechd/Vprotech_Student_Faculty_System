import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Assignment, listAssignments } from '../../../api/assignmentApi';
import { Button, Card, COLORS, Empty, ErrorBanner, Header, Loading, Pill, Screen, formatDate } from '../../../components/portal';

export default function FacultyAssignments() {
  const [items, setItems] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const load = useCallback(async () => { try { setError(''); setItems(await listAssignments()); } catch (e: any) { setError(e?.response?.data?.message || 'Unable to load assignments.'); } finally { setLoading(false); setRefreshing(false); } }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  if (loading) return <Screen><Header title="Assignments" /><Loading text="Loading assignments..." /></Screen>;
  return <Screen>
    <Header title="Assignments" subtitle="Create and manage student work" />
    <ScrollView contentContainerStyle={s.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} />}>
      <Button label="Create assignment" icon="add-circle-outline" onPress={() => router.push('/faculty/assignments/create' as any)} />
      <ErrorBanner message={error} onRetry={() => void load()} />
      {items.length === 0 ? <Card><Empty icon="document-text-outline" title="No assignments yet" text="Create an assignment and publish it for your students." /></Card> : items.map((a) => <Pressable key={a._id} onPress={() => router.push({ pathname: '/faculty/assignments/[assignmentId]', params: { assignmentId: a._id } } as any)}>
        <Card style={s.card}>
          <View style={s.row}><Text style={s.title}>{a.title}</Text><Pill text={a.status} color={a.status === 'published' ? COLORS.success : COLORS.warning} bg={a.status === 'published' ? COLORS.successSoft : COLORS.warningSoft} /></View>
          <Text style={s.muted} numberOfLines={2}>{a.description}</Text>
          <View style={s.meta}><Text style={s.metaText}>Due {formatDate(a.dueDate)}</Text><Text style={s.metaText}>{a.maxMarks} marks</Text></View>
          <Text style={s.link}>Manage assignment  ›</Text>
        </Card>
      </Pressable>)}
    </ScrollView>
  </Screen>;
}
const s = StyleSheet.create({ content: { padding: 16, gap: 12 }, card: { gap: 10 }, row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }, title: { flex: 1, fontSize: 16, fontWeight: '800', color: COLORS.text }, muted: { color: COLORS.sub, lineHeight: 20 }, meta: { flexDirection: 'row', justifyContent: 'space-between' }, metaText: { color: COLORS.sub, fontSize: 12 }, link: { color: COLORS.primary, fontWeight: '700' } });
