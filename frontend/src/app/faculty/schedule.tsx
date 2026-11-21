import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
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
  getClassroomStatus,
  joinClassroom,
  startClassroom,
  type ClassroomStatus,
} from '../../api/classroomApi';
import {
  createLecture,
  getFacultyTimetable,
  getMyLectures,
  updateLectureStatus,
  updateTimetableMeetingLink,
  type Lecture,
  type LectureStatus,
  type TimetableEntry,
} from '../../api/facultyApi';
import { DAYS, refName, todayName } from '../../api/studentApi';
import { openMeetingLink } from '../../api/meetingLink';
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

const STATUSES: LectureStatus[] = ['Scheduled', 'Live Soon', 'Live', 'Completed', 'Cancelled'];

const statusColors = (status: LectureStatus) => {
  switch (status) {
    case 'Live':
      return { color: COLORS.danger, bg: COLORS.dangerSoft };
    case 'Live Soon':
      return { color: COLORS.warning, bg: COLORS.warningSoft };
    case 'Completed':
      return { color: COLORS.success, bg: COLORS.successSoft };
    case 'Cancelled':
      return { color: COLORS.sub, bg: '#EEF2F5' };
    default:
      return { color: COLORS.primary, bg: COLORS.primarySoft };
  }
};

const emptyForm = {
  course: '',
  cohort: '',
  date: '',
  startTime: '',
  endTime: '',
  room: '',
  meetingUrl: '',
};

const lectureDayName = (value: string) => {
  const dateOnly = value.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) return '';
  const [year, month, day] = dateOnly.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? '' : DAYS[date.getDay() === 0 ? 6 : date.getDay() - 1];
};

export default function FacultySchedule() {
  const [tab, setTab] = useState<'timetable' | 'lectures'>('timetable');
  const [timetable, setTimetable] = useState<TimetableEntry[]>([]);
  const [lectures, setLectures] = useState<Lecture[]>([]);
  const [selectedDay, setSelectedDay] = useState(
    DAYS.includes(todayName()) ? todayName() : 'Monday'
  );
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [classroomStatuses, setClassroomStatuses] = useState<Record<string, ClassroomStatus>>({});
  const [classroomBusyId, setClassroomBusyId] = useState('');

  const [linkRow, setLinkRow] = useState<TimetableEntry | null>(null);
  const [linkValue, setLinkValue] = useState('');
  const [linkSaving, setLinkSaving] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [statusLecture, setStatusLecture] = useState<Lecture | null>(null);
  const [statusSaving, setStatusSaving] = useState(false);

  const load = useCallback(async () => {
    setError('');
    const [t, l] = await Promise.allSettled([getFacultyTimetable(), getMyLectures()]);

    if (t.status === 'fulfilled') setTimetable(t.value);
    if (l.status === 'fulfilled') setLectures(l.value);

    if (t.status === 'rejected' && l.status === 'rejected') {
      setError(getErrorMessage(t.reason, 'Unable to load your schedule.'));
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

  const dayRows = useMemo(
    () =>
      timetable
        .filter((row) => row.dayOfWeek === selectedDay)
        .sort((a, b) => a.startTime.localeCompare(b.startTime)),
    [timetable, selectedDay]
  );

  const dayLectures = useMemo(
    () =>
      lectures
        .filter((lecture) => lectureDayName(lecture.date) === selectedDay)
        .sort((a, b) => `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`)),
    [lectures, selectedDay]
  );

  const classDate = (() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  })();

  useEffect(() => {
    if (selectedDay !== todayName()) return;
    let active = true;
    const checkStatuses = async () => {
      const results = await Promise.all(
        dayRows.map(async (row) => {
          try {
            return [row._id, await getClassroomStatus(row._id, classDate)] as const;
          } catch (statusError) {
            if (active) {
              setError(getErrorMessage(statusError, 'Unable to check live class status.'));
            }
            return null;
          }
        })
      );
      if (!active) return;
      setClassroomStatuses((previous) => ({
        ...previous,
        ...Object.fromEntries(results.filter((item): item is NonNullable<typeof item> => item !== null)),
      }));
    };
    void checkStatuses();
    const timer = setInterval(() => void checkStatuses(), 15000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [classDate, dayRows, selectedDay]);

  const openClassroom = async (row: TimetableEntry) => {
    try {
      setClassroomBusyId(row._id);
      const currentStatus = classroomStatuses[row._id]?.status;
      const credentials =
        currentStatus === 'live'
          ? await joinClassroom(row._id, classDate)
          : await startClassroom(row._id, classDate);
      setClassroomStatuses((previous) => ({
        ...previous,
        [row._id]: {
          classroomId: credentials.classroomId,
          status: 'live',
          startedAt: new Date().toISOString(),
          endedAt: null,
        },
      }));
      router.push({
        pathname: '/classroom/[classroomId]',
        params: {
          classroomId: credentials.classroomId,
          title: credentials.title,
        },
      });
    } catch (classroomError) {
      Alert.alert('Unable to start class', getErrorMessage(classroomError, 'Please try again.'));
    } finally {
      setClassroomBusyId('');
    }
  };

  const openLinkEditor = (row: TimetableEntry) => {
    setLinkRow(row);
    setLinkValue(row.meetingUrl || '');
  };

  const saveMeetingLink = async (value: string) => {
    if (!linkRow) return;
    const trimmed = value.trim();
    if (trimmed && !/^(https?:\/\/)?[^\s/]+\.[^\s]+$/i.test(trimmed)) {
      Alert.alert('Invalid link', 'Enter a valid video link, e.g. https://meet.google.com/abc-defg-hij');
      return;
    }
    try {
      setLinkSaving(true);
      const updated = await updateTimetableMeetingLink(linkRow._id, trimmed);
      setTimetable((prev) =>
        prev.map((r) => (r._id === linkRow._id ? { ...r, meetingUrl: updated?.meetingUrl || '' } : r))
      );
      setLinkRow(null);
      Alert.alert(
        trimmed ? 'Link saved' : 'Link removed',
        trimmed ? 'Students can now join this class from their Live Classes page.' : 'The video link was removed.'
      );
    } catch (e) {
      Alert.alert('Error', getErrorMessage(e, 'Unable to save the video link.'));
    } finally {
      setLinkSaving(false);
    }
  };

  const changeStatus = (lecture: Lecture) => {
    setStatusLecture(lecture);
  };

  const saveLectureStatus = async (status: LectureStatus) => {
    if (!statusLecture || statusSaving) return;
    try {
      setStatusSaving(true);
      const updated = await updateLectureStatus(statusLecture._id, status);
      setLectures((prev) =>
        prev.map((lecture) =>
          lecture._id === statusLecture._id
            ? { ...lecture, ...updated, status }
            : lecture
        )
      );
      setStatusLecture(null);
    } catch (e) {
      Alert.alert('Error', getErrorMessage(e, 'Unable to update status.'));
    } finally {
      setStatusSaving(false);
    }
  };

  const submitLecture = async () => {
    const { course, cohort, date, startTime, endTime, room } = form;

    if (!course.trim() || !cohort.trim() || !date.trim() || !startTime.trim() || !endTime.trim() || !room.trim()) {
      Alert.alert('Missing details', 'Course, cohort, date, times and room are required.');
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date.trim())) {
      Alert.alert('Invalid date', 'Use the format YYYY-MM-DD.');
      return;
    }
    const parsedDate = new Date(`${date.trim()}T00:00:00.000Z`);
    if (
      Number.isNaN(parsedDate.getTime()) ||
      parsedDate.toISOString().slice(0, 10) !== date.trim()
    ) {
      Alert.alert('Invalid date', 'Enter a real calendar date in YYYY-MM-DD format.');
      return;
    }
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(startTime.trim()) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(endTime.trim())) {
      Alert.alert('Invalid time', 'Use 24-hour times like 09:30.');
      return;
    }
    if (startTime.trim() >= endTime.trim()) {
      Alert.alert('Invalid time', 'End time must be after start time.');
      return;
    }

    try {
      setSaving(true);
      const lecture = await createLecture({
        course: course.trim(),
        cohort: cohort.trim(),
        date: date.trim(),
        startTime: startTime.trim(),
        endTime: endTime.trim(),
        room: room.trim(),
        meetingUrl: form.meetingUrl.trim(),
      });
      setLectures((prev) =>
        [...prev, lecture].sort((a, b) =>
          `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`)
        )
      );
      setForm(emptyForm);
      setFormOpen(false);
      setTab('lectures');
    } catch (e) {
      Alert.alert('Error', getErrorMessage(e, 'Unable to schedule lecture.'));
    } finally {
      setSaving(false);
    }
  };

  const field = (key: keyof typeof emptyForm, label: string, placeholder: string) => (
    <View key={key}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={form[key]}
        onChangeText={(v) => setForm((f) => ({ ...f, [key]: v }))}
        placeholder={placeholder}
        placeholderTextColor="#9AAEBB"
        autoCapitalize="none"
        style={styles.input}
      />
    </View>
  );

  return (
    <Screen>
      <Header
        title="My Schedule"
        subtitle="Weekly timetable and scheduled lectures"
        right={
          <Pressable style={styles.addBtn} onPress={() => setFormOpen(true)} accessibilityLabel="Schedule lecture">
            <Ionicons name="add" size={22} color="#FFF" />
          </Pressable>
        }
      />

      <View style={styles.tabs}>
        {(['timetable', 'lectures'] as const).map((key) => (
          <Pressable
            key={key}
            onPress={() => setTab(key)}
            style={[styles.tab, tab === key && styles.tabActive]}
          >
            <Text style={[styles.tabText, tab === key && styles.tabTextActive]}>
              {key === 'timetable' ? 'Weekly timetable' : 'Lectures'}
            </Text>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <Loading text="Loading schedule..." />
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16, gap: 12, flexGrow: 1 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
        >
          <ErrorBanner message={error} onRetry={load} />

          {tab === 'timetable' ? (
            <>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {DAYS.slice(0, 6).map((day) => (
                  <Pressable
                    key={day}
                    onPress={() => setSelectedDay(day)}
                    style={[styles.day, selectedDay === day && styles.dayActive]}
                  >
                    <Text style={[styles.dayText, selectedDay === day && styles.dayTextActive]}>
                      {day.slice(0, 3)}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>

              {dayRows.length === 0 && dayLectures.length === 0 ? (
                <Empty icon="calendar-outline" title={`No classes on ${selectedDay}`} />
              ) : null}
              {dayRows.map((row) => (
                  <Card key={row._id} style={styles.item}>
                    <View style={styles.time}>
                      <Text style={styles.timeText}>{row.startTime}</Text>
                      <Text style={styles.timeEnd}>{row.endTime}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.title} numberOfLines={1}>
                        {refName(row.subjectId) || row.title}
                      </Text>
                      <Text style={styles.sub} numberOfLines={1}>
                        {[refName(row.courseId), `Sem ${row.semester}`, `Sec ${row.section}`]
                          .filter(Boolean)
                          .join(' \u2022 ')}
                      </Text>
                      {row.room ? <Text style={styles.sub}>Room {row.room}</Text> : null}
                      {row.meetingUrl ? (
                        <Text style={[styles.sub, { color: COLORS.primary }]} numberOfLines={1}>
                          Video link: {row.meetingUrl}
                        </Text>
                      ) : null}
                      <View style={{ flexDirection: 'row', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                        <Pressable onPress={() => openLinkEditor(row)} style={styles.statusBtn}>
                          <Text style={styles.statusBtnText}>
                            {row.meetingUrl ? 'Edit video link' : 'Add video link'}
                          </Text>
                        </Pressable>
                        {row.meetingUrl ? (
                          <Pressable onPress={() => void openMeetingLink(row.meetingUrl)} style={styles.statusBtn}>
                            <Text style={styles.statusBtnText}>Open link</Text>
                          </Pressable>
                        ) : null}
                      </View>
                      {selectedDay === todayName() && classroomStatuses[row._id] ? (
                        <Pressable
                          disabled={
                            classroomStatuses[row._id].status === 'ended' ||
                            classroomBusyId === row._id
                          }
                          onPress={() => void openClassroom(row)}
                          style={{
                            marginTop: 10,
                            borderRadius: 9,
                            paddingVertical: 9,
                            alignItems: 'center',
                            backgroundColor:
                              classroomStatuses[row._id].status === 'ended'
                                ? '#EEF2F5'
                                : COLORS.primary,
                            opacity: classroomBusyId === row._id ? 0.6 : 1,
                          }}
                        >
                          <Text
                            style={{
                              color:
                                classroomStatuses[row._id].status === 'ended'
                                  ? COLORS.sub
                                  : '#FFF',
                              fontWeight: '800',
                              fontSize: 13,
                            }}
                          >
                            {classroomBusyId === row._id
                              ? 'Opening…'
                              : classroomStatuses[row._id].status === 'live'
                              ? 'Rejoin live class'
                              : classroomStatuses[row._id].status === 'ended'
                              ? 'Class ended'
                              : 'Start live class'}
                          </Text>
                        </Pressable>
                      ) : null}
                    </View>
                  </Card>
              ))}

              {dayLectures.length > 0 ? (
                <View style={{ gap: 10, marginTop: dayRows.length ? 6 : 0 }}>
                  <Text style={styles.sectionLabel}>One-time scheduled lectures</Text>
                  {dayLectures.map((lecture) => {
                    const colors = statusColors(lecture.status);
                    return (
                      <Card key={lecture._id} style={{ gap: 6 }}>
                        <View style={styles.between}>
                          <Text style={styles.title} numberOfLines={1}>{lecture.course}</Text>
                          <Pill text={lecture.status} color={colors.color} bg={colors.bg} />
                        </View>
                        <Text style={styles.sub}>
                          {lecture.cohort} {'\u2022'} {formatDate(lecture.date)}
                        </Text>
                        <Text style={styles.sub}>
                          {lecture.startTime} - {lecture.endTime} {'\u2022'} Room {lecture.room}
                        </Text>
                        <Pressable onPress={() => changeStatus(lecture)} style={styles.statusBtn}>
                          <Text style={styles.statusBtnText}>Update status</Text>
                        </Pressable>
                      </Card>
                    );
                  })}
                </View>
              ) : null}
            </>
          ) : lectures.length === 0 ? (
            <Empty
              icon="videocam-outline"
              title="No lectures scheduled"
              text="Tap + to schedule a lecture."
            />
          ) : (
            lectures.map((lecture) => {
              const c = statusColors(lecture.status);
              return (
                <Card key={lecture._id} style={{ gap: 6 }}>
                  <View style={styles.between}>
                    <Text style={styles.title} numberOfLines={1}>{lecture.course}</Text>
                    <Pill text={lecture.status} color={c.color} bg={c.bg} />
                  </View>
                  <Text style={styles.sub}>
                    {lecture.cohort} {'\u2022'} {formatDate(lecture.date)}
                  </Text>
                  <Text style={styles.sub}>
                    {lecture.startTime} - {lecture.endTime} {'\u2022'} Room {lecture.room}
                  </Text>
                  <Pressable onPress={() => changeStatus(lecture)} style={styles.statusBtn}>
                    <Text style={styles.statusBtnText}>Update status</Text>
                  </Pressable>
                </Card>
              );
            })
          )}
        </ScrollView>
      )}

      <Modal visible={!!linkRow} transparent animationType="fade" onRequestClose={() => setLinkRow(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: 20 }}>
          <View style={{ backgroundColor: COLORS.card, borderRadius: 16, padding: 18, gap: 10 }}>
            <Text style={styles.title}>Video class link</Text>
            <Text style={styles.sub}>
              {linkRow ? `${refName(linkRow.subjectId) || linkRow.title} \u2022 ${linkRow.dayOfWeek} ${linkRow.startTime}-${linkRow.endTime}` : ''}
            </Text>
            <Text style={styles.sub}>
              Paste a Google Meet / Zoom / Teams link. Students will see a Join button on their Live Classes page.
            </Text>
            <TextInput
              value={linkValue}
              onChangeText={setLinkValue}
              placeholder="https://meet.google.com/abc-defg-hij"
              placeholderTextColor="#9AAEBB"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              style={styles.input}
            />
            <Button label="Save link" loading={linkSaving} onPress={() => void saveMeetingLink(linkValue)} />
            {linkRow?.meetingUrl ? (
              <Pressable onPress={() => void saveMeetingLink('')} style={{ alignItems: 'center', padding: 8 }}>
                <Text style={{ color: COLORS.danger, fontWeight: '800' }}>Remove link</Text>
              </Pressable>
            ) : null}
            <Pressable onPress={() => setLinkRow(null)} style={{ alignItems: 'center', padding: 6 }}>
              <Text style={{ color: COLORS.sub, fontWeight: '700' }}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal
        visible={!!statusLecture}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!statusSaving) setStatusLecture(null);
        }}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.statusModal}>
            <Text style={styles.title}>Update lecture status</Text>
            <Text style={styles.sub}>
              {statusLecture ? `${statusLecture.course} \u2022 ${statusLecture.cohort}` : ''}
            </Text>
            <Text style={styles.label}>Current status: {statusLecture?.status}</Text>
            <View style={{ gap: 8 }}>
              {STATUSES.filter((status) => status !== statusLecture?.status).map((status) => {
                const colors = statusColors(status);
                return (
                  <Pressable
                    key={status}
                    disabled={statusSaving}
                    onPress={() => void saveLectureStatus(status)}
                    style={[
                      styles.statusOption,
                      { backgroundColor: colors.bg, opacity: statusSaving ? 0.6 : 1 },
                    ]}
                  >
                    <Text style={[styles.statusOptionText, { color: colors.color }]}>
                      {statusSaving ? 'Updating…' : `Set to ${status}`}
                    </Text>
                    <Ionicons name="chevron-forward" size={18} color={colors.color} />
                  </Pressable>
                );
              })}
            </View>
            <Pressable
              disabled={statusSaving}
              onPress={() => setStatusLecture(null)}
              style={{ alignItems: 'center', padding: 8 }}
            >
              <Text style={{ color: COLORS.sub, fontWeight: '700' }}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={formOpen} animationType="slide" onRequestClose={() => setFormOpen(false)}>
        <Screen>
          <Header
            title="Schedule lecture"
            onBackPress={() => setFormOpen(false)}
            right={
              <Pressable onPress={() => setFormOpen(false)} accessibilityLabel="Close">
                <Ionicons name="close" size={26} color={COLORS.primaryDark} />
              </Pressable>
            }
          />
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <ScrollView contentContainerStyle={{ padding: 16, gap: 10 }} keyboardShouldPersistTaps="handled">
              {field('course', 'Course', 'e.g. Web Development')}
              {field('cohort', 'Cohort / batch', 'e.g. BCA Sem 4 - A')}
              {field('date', 'Date', 'YYYY-MM-DD')}
              {field('startTime', 'Start time', '09:30')}
              {field('endTime', 'End time', '10:30')}
              {field('room', 'Room', 'e.g. Lab 2')}
              {field('meetingUrl', 'Meeting link (optional)', 'https://...')}
              <Button label="Schedule lecture" loading={saving} onPress={submitLecture} />
            </ScrollView>
          </KeyboardAvoidingView>
        </Screen>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabs: { flexDirection: 'row', margin: 16, marginBottom: 0, backgroundColor: '#E3EDF4', borderRadius: 12, padding: 4 },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 9, alignItems: 'center' },
  tabActive: { backgroundColor: COLORS.card },
  tabText: { color: COLORS.sub, fontWeight: '700', fontSize: 13.5 },
  tabTextActive: { color: COLORS.primary },
  day: { paddingHorizontal: 18, paddingVertical: 9, borderRadius: 20, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border },
  dayActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  dayText: { color: COLORS.sub, fontWeight: '700' },
  dayTextActive: { color: '#FFF' },
  sectionLabel: { color: COLORS.primaryDark, fontSize: 13, fontWeight: '800', marginBottom: 2 },
  item: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  time: { alignItems: 'center', minWidth: 54 },
  timeText: { fontSize: 16, fontWeight: '800', color: COLORS.primary },
  timeEnd: { fontSize: 12, color: COLORS.sub, marginTop: 2 },
  title: { fontSize: 15.5, fontWeight: '800', color: COLORS.text, flexShrink: 1 },
  sub: { fontSize: 12.5, color: COLORS.sub },
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  statusBtn: { alignSelf: 'flex-start', marginTop: 6, backgroundColor: COLORS.primarySoft, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 9 },
  statusBtnText: { color: COLORS.primary, fontWeight: '800', fontSize: 12.5 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: 20 },
  statusModal: { backgroundColor: COLORS.card, borderRadius: 16, padding: 18, gap: 12 },
  statusOption: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, borderRadius: 10 },
  statusOptionText: { fontWeight: '800', fontSize: 14 },
  label: { fontSize: 12.5, fontWeight: '700', color: COLORS.sub, marginBottom: 5 },
  input: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, fontSize: 15, color: COLORS.text, backgroundColor: '#FAFCFE' },
});
