import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { getErrorMessage } from '../api/apiClient';
import { openMeetingLink } from '../api/meetingLink';
import {
  getClassroomStatus,
  joinClassroom,
  type ClassroomStatus,
} from '../api/classroomApi';
import { logoutUser } from '../api/session';
import {
  getMyDoubts,
  getStudentLectures,
  getMyStudentRecord,
  getNotifications,
  getStudentTimetable,
  refName,
  todayName,
  type AppNotification,
  type Doubt,
  type StudentRecord,
  type StudentTimetableEntry,
  type StudentLecture,
} from '../api/studentApi';
import { getStoredUser, type SessionUser } from '../api/session';
import {
  Card,
  COLORS,
  Empty,
  ErrorBanner,
  formatDate,
  Loading,
  Screen,
  StatTile,
} from '../components/portal';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

const ACTIONS: { icon: IconName; label: string; path: string }[] = [
  { icon: 'document-text-outline', label: 'Examinations', path: '/student/exams' },
  { icon: 'clipboard-outline', label: 'Assignments', path: '/student/assignments' },
  { icon: 'calendar-outline', label: 'Timetable', path: '/student/timetable' },
  { icon: 'videocam-outline', label: 'Live Classroom', path: '/student/timetable' },
  { icon: 'library-outline', label: 'Materials', path: '/student/materials' },
  { icon: 'help-circle-outline', label: 'Doubts', path: '/student/doubts' },
  { icon: 'notifications-outline', label: 'Alerts', path: '/student/notifications' },
  { icon: 'person-outline', label: 'Profile', path: '/student/profile' },
];

export default function StudentDashboard() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [studentProfile, setStudentProfile] = useState<StudentRecord | null>(null);
  const [today, setToday] = useState<StudentTimetableEntry[]>([]);
  const [scheduledLectures, setScheduledLectures] = useState<StudentLecture[]>([]);
  const [classroomStatuses, setClassroomStatuses] = useState<Record<string, ClassroomStatus>>({});
  const [joiningClassId, setJoiningClassId] = useState('');
  const [alerts, setAlerts] = useState<AppNotification[]>([]);
  const [doubts, setDoubts] = useState<Doubt[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    setUser(await getStoredUser());

    let student = null;
    try {
      student = await getMyStudentRecord();
    } catch (e) {
      student = null;
      setError(getErrorMessage(e, 'Unable to load your student profile.'));
    }
    setStudentProfile(student);

    const [tt, nt, db, lectures] = await Promise.allSettled([
      getStudentTimetable(student),
      getNotifications(),
      student ? getMyDoubts() : Promise.resolve([] as Doubt[]),
      student ? getStudentLectures() : Promise.resolve([] as StudentLecture[]),
    ]);

    if (tt.status === 'fulfilled') {
      const day = todayName();
      setToday(
        tt.value
          .filter((row) => row.dayOfWeek === day)
          .sort((a, b) => a.startTime.localeCompare(b.startTime))
      );
    }
    if (nt.status === 'fulfilled') setAlerts(nt.value);
    if (db.status === 'fulfilled') setDoubts(db.value);
    if (lectures.status === 'fulfilled') setScheduledLectures(lectures.value);
    else {
      setError((current) =>
        current
          ? `${current} Upcoming lectures could not be loaded.`
          : getErrorMessage(lectures.reason, 'Unable to load upcoming lectures.')
      );
    }
  }, []);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  const classDate = (() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  })();

  useEffect(() => {
    if (
      today.length === 0 ||
      !studentProfile?.courseId ||
      !Number.isInteger(studentProfile.semester) ||
      !studentProfile.section?.trim()
    ) return;
    let active = true;

    const checkStatuses = async () => {
      const results = await Promise.all(
        today.map(async (row) => {
          try {
            return [row._id, await getClassroomStatus(row._id, classDate)] as const;
          } catch (statusError) {
            if (active) {
              console.warn('Unable to check scheduled classroom status:', statusError);
            }
            return null;
          }
        })
      );
      if (!active) return;
      setClassroomStatuses((previous) => ({
        ...previous,
        ...Object.fromEntries(
          results.filter((item): item is NonNullable<typeof item> => item !== null)
        ),
      }));
    };

    void checkStatuses();
    const timer = setInterval(() => void checkStatuses(), 15000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [classDate, studentProfile, today]);

  const enterClassroom = async (timetableId: string) => {
    try {
      setJoiningClassId(timetableId);
      const credentials = await joinClassroom(timetableId, classDate);
      router.push({
        pathname: '/classroom/[classroomId]',
        params: {
          classroomId: credentials.classroomId,
          title: credentials.title,
        },
      });
    } catch (joinError) {
      Alert.alert('Unable to join class', getErrorMessage(joinError, 'Please try again.'));
    } finally {
      setJoiningClassId('');
    }
  };

  const openLectureLink = async (url?: string) => {
    if (!url?.trim()) {
      Alert.alert('Meeting link unavailable', 'Your faculty has not shared a meeting link for this lecture yet.');
      return;
    }

    try {
      const meetingUrl = new URL(url.trim());
      if (meetingUrl.protocol !== 'https:' && meetingUrl.protocol !== 'http:') {
        throw new Error('Unsupported meeting link protocol.');
      }
      await Linking.openURL(meetingUrl.toString());
    } catch {
      Alert.alert('Unable to open meeting', 'The meeting link is invalid or could not be opened.');
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const logout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          await logoutUser();
          router.replace('/');
        },
      },
    ]);
  };

  const name = user?.name || user?.fullName || 'Student';
  const unread = alerts.filter((a) => !a.isRead).length;
  const openDoubts = doubts.filter((d) => d.status === 'pending').length;

  if (loading) {
    return (
      <Screen>
        <Loading text="Loading your dashboard..." />
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 16 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
      >
        <View style={styles.top}>
          <Pressable
            onPress={() => router.canGoBack() ? router.back() : router.replace('/' as any)}
            style={styles.backButton}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="arrow-back" size={21} color={COLORS.primary} />
          </Pressable>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{name.charAt(0).toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.hello}>Welcome back,</Text>
            <Text style={styles.name} numberOfLines={1}>{name}</Text>
          </View>
          <Pressable onPress={logout} style={styles.logout} accessibilityLabel="Logout">
            <Ionicons name="log-out-outline" size={22} color={COLORS.danger} />
          </Pressable>
        </View>

        <ErrorBanner message={error} onRetry={onRefresh} />

        <View style={styles.statsRow}>
          <StatTile icon="calendar-outline" label="Classes today" value={today.length} />
          <StatTile icon="notifications-outline" label="Unread alerts" value={unread} tint={COLORS.warning} />
          <StatTile icon="help-circle-outline" label="Open doubts" value={openDoubts} tint={COLORS.success} />
        </View>

        <View style={styles.actions}>
          {ACTIONS.map((a) => (
            <Pressable
              key={a.label}
              onPress={() => router.push(a.path as any)}
              style={({ pressed }) => [styles.action, pressed && { opacity: 0.8 }]}
            >
              <View style={styles.actionIcon}>
                <Ionicons name={a.icon} size={22} color={COLORS.primary} />
              </View>
              <Text style={styles.actionLabel}>{a.label}</Text>
            </Pressable>
          ))}
        </View>

        <TouchableOpacity
          onPress={() => router.push('/chat' as any)}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Chat with Faculty"
          style={{
            backgroundColor: '#1769AA',
            padding: 15,
            borderRadius: 12,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          <Ionicons name="chatbubbles-outline" size={20} color="#FFFFFF" />
          <Text style={{ color: '#FFFFFF', fontWeight: '600' }}>Chat with Faculty</Text>
        </TouchableOpacity>

        <View style={styles.sectionHead}>
          <Text style={styles.section}>Live classroom · today</Text>
          <Pressable onPress={() => router.push('/student/timetable' as any)}>
            <Text style={styles.link}>View all</Text>
          </Pressable>
        </View>

        {today.length === 0 ? (
          <Card>
            <Empty icon="cafe-outline" title="No classes today" text="Enjoy your free day." />
          </Card>
        ) : (
          today.slice(0, 5).map((row) => (
            <Card key={row._id} style={styles.classRow}>
              <View style={{ alignItems: 'center', minWidth: 54 }}>
                <Text style={styles.time}>{row.startTime}</Text>
                <Text style={styles.timeEnd}>{row.endTime}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.classTitle} numberOfLines={1}>
                  {refName(row.subjectId) || row.title}
                </Text>
                <Text style={styles.sub} numberOfLines={1}>
                  {row.room ? `Room ${row.room}` : 'Room to be announced'}
                </Text>
                <Pressable
                  disabled={
                    classroomStatuses[row._id]?.status !== 'live' ||
                    joiningClassId === row._id
                  }
                  onPress={() => void enterClassroom(row._id)}
                  style={[
                    styles.joinClass,
                    classroomStatuses[row._id]?.status !== 'live' && styles.joinClassWaiting,
                    joiningClassId === row._id && styles.joinClassDisabled,
                  ]}
                >
                  <Text
                    style={[
                      styles.joinClassText,
                      classroomStatuses[row._id]?.status !== 'live' && styles.joinClassWaitingText,
                    ]}
                  >
                    {joiningClassId === row._id
                      ? 'Joining…'
                      : classroomStatuses[row._id]?.status === 'live'
                      ? 'Join live class'
                      : classroomStatuses[row._id]?.status === 'ended'
                      ? 'Class ended'
                      : 'Scheduled · waiting for faculty'}
                  </Text>
                </Pressable>
                {row.meetingUrl ? (
                  <Pressable
                    onPress={() => void openMeetingLink(row.meetingUrl)}
                    style={[styles.joinClass, { backgroundColor: '#15803D', marginTop: 8 }]}
                    accessibilityRole="button"
                  >
                    <Text style={styles.joinClassText}>Join class (video link)</Text>
                  </Pressable>
                ) : null}
              </View>
            </Card>
          ))
        )}

        <View style={styles.sectionHead}>
          <Text style={styles.section}>Upcoming scheduled lectures</Text>
          <Pressable onPress={() => router.push('/student/timetable' as any)}>
            <Text style={styles.link}>View timetable</Text>
          </Pressable>
        </View>

        {scheduledLectures.length === 0 ? (
          <Card>
            <Empty
              icon="calendar-outline"
              title="No upcoming scheduled lectures"
              text="Faculty-created lectures for your semester and section will appear here."
            />
          </Card>
        ) : (
          scheduledLectures.map((lecture) => (
            <Card key={lecture._id} style={styles.classRow}>
              <View style={{ alignItems: 'center', minWidth: 54 }}>
                <Text style={styles.time}>{lecture.startTime}</Text>
                <Text style={styles.timeEnd}>{lecture.endTime}</Text>
              </View>
              <View style={{ flex: 1, gap: 5 }}>
                <Text style={styles.classTitle} numberOfLines={1}>{lecture.course}</Text>
                <Text style={styles.sub}>
                  {formatDate(`${lecture.date.slice(0, 10)}T12:00:00`)} · {lecture.room}
                </Text>
                <Text style={styles.timeEnd}>
                  {lecture.status} · {lecture.cohort}
                </Text>
                {lecture.meetingUrl ? (
                  <Pressable
                    onPress={() => void openLectureLink(lecture.meetingUrl)}
                    style={styles.joinClass}
                    accessibilityRole="button"
                  >
                    <Text style={styles.joinClassText}>Join lecture</Text>
                  </Pressable>
                ) : (
                  <Text style={styles.timeEnd}>Faculty has not shared a meeting link yet.</Text>
                )}
              </View>
            </Card>
          ))
        )}

        <View style={styles.sectionHead}>
          <Text style={styles.section}>Latest alerts</Text>
          <Pressable onPress={() => router.push('/student/notifications' as any)}>
            <Text style={styles.link}>View all</Text>
          </Pressable>
        </View>

        {alerts.length === 0 ? (
          <Card>
            <Empty icon="notifications-off-outline" title="No notifications yet" />
          </Card>
        ) : (
          alerts.slice(0, 3).map((a) => (
            <Card key={a._id} style={{ gap: 4 }}>
              <Text style={styles.classTitle}>{a.title}</Text>
              <Text style={styles.sub} numberOfLines={2}>{a.message}</Text>
              <Text style={styles.timeEnd}>{formatDate(a.createdAt)}</Text>
            </Card>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  backButton: { width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EAF3FA' },
  top: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 52, height: 52, borderRadius: 16, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#FFF', fontSize: 22, fontWeight: '800' },
  hello: { color: COLORS.sub, fontSize: 13 },
  name: { color: COLORS.text, fontSize: 20, fontWeight: '800' },
  logout: { width: 42, height: 42, borderRadius: 12, backgroundColor: COLORS.dangerSoft, alignItems: 'center', justifyContent: 'center' },
  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  action: { flexGrow: 1, flexBasis: '30%', alignItems: 'center', gap: 8, backgroundColor: COLORS.card, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, paddingVertical: 16 },
  actionIcon: { width: 44, height: 44, borderRadius: 13, backgroundColor: COLORS.primarySoft, alignItems: 'center', justifyContent: 'center' },
  actionLabel: { color: COLORS.text, fontWeight: '700', fontSize: 13 },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  section: { fontSize: 17, fontWeight: '800', color: COLORS.text },
  link: { color: COLORS.primary, fontWeight: '700', fontSize: 13.5 },
  classRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  time: { fontSize: 16, fontWeight: '800', color: COLORS.primary },
  timeEnd: { fontSize: 12, color: COLORS.sub, marginTop: 2 },
  classTitle: { fontSize: 15, fontWeight: '800', color: COLORS.text },
  sub: { fontSize: 12.5, color: COLORS.sub },
  joinClass: { marginTop: 9, alignSelf: 'flex-start', borderRadius: 9, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: COLORS.primary },
  joinClassText: { color: '#FFF', fontWeight: '800', fontSize: 12 },
  joinClassWaiting: { backgroundColor: COLORS.primarySoft },
  joinClassWaitingText: { color: COLORS.sub },
  joinClassDisabled: { opacity: 0.6 },
});