import React from 'react';
import { Alert, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';

import { logoutUser } from '../../api/session';
import { useStudent } from '../../hooks/use-student';
import { Button, Card, COLORS, ErrorBanner, Header, Loading, Screen } from '../../components/portal';

export default function StudentProfile() {
  const { user, student, loading, error, reload } = useStudent();
  const [refreshing, setRefreshing] = React.useState(false);

  const logout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          await logoutUser();
          router.replace('/login');
        },
      },
    ]);
  };

  const name = user?.name || user?.fullName || 'Student';

  const rows: [string, string | number | null | undefined][] = [
    ['Email', user?.email],
    ['Student ID', student?.studentId],
    ['Roll number', student?.rollNumber],
    ['Semester', student?.semester],
    ['Section', student?.section],
    ['Enrollment year', student?.enrollmentYear],
    ['Phone', student?.phone],
  ];

  return (
    <Screen>
      <Header title="My Profile" subtitle="Your student account" />
      {loading ? (
        <Loading />
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16, gap: 14 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={async () => {
                setRefreshing(true);
                await reload();
                setRefreshing(false);
              }}
              tintColor={COLORS.primary}
            />
          }
        >
          <ErrorBanner message={error} onRetry={reload} />

          <Card style={{ alignItems: 'center', gap: 6 }}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{name.charAt(0).toUpperCase()}</Text>
            </View>
            <Text style={styles.name}>{name}</Text>
            <Text style={styles.role}>Student</Text>
          </Card>

          <Card>
            {rows
              .filter(([, v]) => v !== null && v !== undefined && v !== '')
              .map(([label, value], i, list) => (
                <View key={label} style={[styles.row, i === list.length - 1 && { borderBottomWidth: 0 }]}>
                  <Text style={styles.label}>{label}</Text>
                  <Text style={styles.value}>{String(value)}</Text>
                </View>
              ))}
          </Card>

          <Button
            label="Change password"
            icon="key-outline"
            variant="ghost"
            onPress={() => router.push('/change-password' as any)}
          />
          <Button label="Logout" icon="log-out-outline" variant="danger" onPress={logout} />
        </ScrollView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  avatar: { width: 76, height: 76, borderRadius: 24, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#FFF', fontSize: 30, fontWeight: '800' },
  name: { fontSize: 20, fontWeight: '800', color: COLORS.text },
  role: { fontSize: 13.5, color: COLORS.sub },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  label: { color: COLORS.sub, fontSize: 13.5 },
  value: { color: COLORS.text, fontWeight: '700', fontSize: 13.5, flexShrink: 1, textAlign: 'right' },
});
