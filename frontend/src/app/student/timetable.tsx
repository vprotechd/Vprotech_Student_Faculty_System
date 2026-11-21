import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  Alert,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { getErrorMessage } from '../../api/apiClient';
import { openMeetingLink } from '../../api/meetingLink';
import {
  getClassroomStatus,
  joinClassroom,
  type ClassroomStatus,
} from '../../api/classroomApi';

import {
  DAYS,
  getMyStudentRecord,
  getStudentLectures,
  getStudentTimetable,
  refName,
  todayName,
  type StudentRecord,
  type StudentLecture,
  type StudentTimetableEntry,
} from '../../api/studentApi';

import {
  Card,
  COLORS,
  Empty,
  ErrorBanner,
  formatDate,
  Header,
  Loading,
  Screen,
} from '../../components/portal';

const lectureDayName = (value: string) => {
  const dateOnly = value.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) return '';
  const [year, month, date] = dateOnly.split('-').map(Number);
  const weekday = new Date(year, month - 1, date).getDay();
  return DAYS[weekday === 0 ? 6 : weekday - 1];
};

export default function StudentTimetable() {
  // =====================================================
  // STATE
  // =====================================================

  const [rows, setRows] =
    useState<StudentTimetableEntry[]>([]);
  const [studentProfile, setStudentProfile] =
    useState<StudentRecord | null>(null);
  const [lectures, setLectures] =
    useState<StudentLecture[]>([]);

  const [day, setDay] = useState(
    DAYS.includes(todayName())
      ? todayName()
      : 'Monday'
  );

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [error, setError] =
    useState('');
  const [classroomStatuses, setClassroomStatuses] =
    useState<Record<string, ClassroomStatus>>({});
  const [joiningClassId, setJoiningClassId] =
    useState('');

  // =====================================================
  // LOAD TIMETABLE
  // =====================================================

  const load = useCallback(async () => {
    try {
      setError('');

      let student = null;

      try {
        student =
          await getMyStudentRecord();
      } catch (studentError) {
        student = null;
        setError(
          getErrorMessage(
            studentError,
            'Unable to load your student profile. Upcoming lectures may not be available.'
          )
        );
        console.log(
          'Student record unavailable:',
          studentError
        );
      }

      setStudentProfile(student);

      if (!student) {
        setError((current) =>
          current ||
          'Your student profile is not complete. Ask the administrator to assign your course, semester and section.'
        );
      }

      const [timetableResult, lecturesResult] = await Promise.allSettled([
        getStudentTimetable(student),
        getStudentLectures(),
      ]);

      if (timetableResult.status === 'fulfilled') {
        setRows(Array.isArray(timetableResult.value) ? timetableResult.value : []);
      } else {
        setRows([]);
        setError(
          getErrorMessage(
            timetableResult.reason,
            'Unable to load your weekly timetable.'
          )
        );
      }

      if (lecturesResult.status === 'fulfilled') {
        setLectures(lecturesResult.value);
      } else {
        setLectures([]);
        setError((current) =>
          current
            ? `${current} One-time scheduled lectures could not be loaded.`
            : getErrorMessage(
                lecturesResult.reason,
                'Unable to load one-time scheduled lectures.'
              )
        );
      }
    } catch (e) {
      console.log(
        'TIMETABLE ERROR:',
        e
      );

      setError(
        getErrorMessage(
          e,
          'Unable to load your timetable.'
        )
      );

      setRows([]);
    }
  }, []);

  // =====================================================
  // INITIAL LOAD
  // =====================================================

  useEffect(() => {
    load().finally(() => {
      setLoading(false);
    });
  }, [load]);

  // =====================================================
  // REFRESH
  // =====================================================

  const onRefresh =
    useCallback(async () => {
      setRefreshing(true);

      await load();

      setRefreshing(false);
    }, [load]);

  // =====================================================
  // SELECTED DAY
  // =====================================================

  const dayRows = useMemo(() => {
    return rows
      .filter(
        (row) =>
          row.dayOfWeek === day
      )
      .sort((a, b) =>
        a.startTime.localeCompare(
          b.startTime
        )
      );
  }, [rows, day]);

  const dayLectures = useMemo(
    () =>
      lectures
        .filter(
          (lecture) =>
            lecture.status !== 'Cancelled' &&
            lectureDayName(lecture.date) === day
        )
        .sort((a, b) =>
          `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`)
        ),
    [day, lectures]
  );

  const classDate = (() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  })();

  useEffect(() => {
    if (
      day !== todayName() ||
      !studentProfile?.courseId ||
      !Number.isInteger(studentProfile.semester) ||
      !studentProfile.section?.trim()
    ) return;
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
  }, [classDate, day, dayRows, studentProfile]);

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

  const openLectureLink = async (lecture: StudentLecture) => {
    const url = lecture.meetingUrl?.trim();
    if (!url) {
      Alert.alert(
        'Meeting link unavailable',
        'Your faculty has not shared a meeting link for this lecture yet.'
      );
      return;
    }

    try {
      const parsedUrl = new URL(url);
      if (parsedUrl.protocol !== 'https:' && parsedUrl.protocol !== 'http:') {
        throw new Error('Unsupported meeting link protocol.');
      }
      await Linking.openURL(parsedUrl.toString());
    } catch {
      Alert.alert('Unable to open meeting', 'The meeting link is invalid or could not be opened.');
    }
  };

  // =====================================================
  // WEEK STATISTICS
  // =====================================================

  const totalWeeklyClasses =
    rows.length + lectures.filter((lecture) => lecture.status !== 'Cancelled').length;

  const selectedDayClasses =
    dayRows.length + dayLectures.length;

  // =====================================================
  // UI
  // =====================================================

  return (
    <Screen>

      {/* =================================================
          HEADER
      ================================================= */}

      <Header
        title="Timetable"
        subtitle="Your weekly class schedule"
      />

      {loading ? (
        <Loading
          text="Loading timetable..."
        />
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={
            styles.container
          }
          refreshControl={
            <RefreshControl
              refreshing={
                refreshing
              }
              onRefresh={
                onRefresh
              }
              tintColor={
                COLORS.primary
              }
            />
          }
        >

          {/* =================================================
              ERROR
          ================================================= */}

          <ErrorBanner
            message={error}
            onRetry={load}
          />

          {/* =================================================
              WELCOME / INTRO
          ================================================= */}

          <View
            style={
              styles.introCard
            }
          >
            <View
              style={
                styles.introIcon
              }
            >
              <Ionicons
                name="calendar-outline"
                size={27}
                color="#1769AA"
              />
            </View>

            <View
              style={
                styles.introContent
              }
            >
              <Text
                style={
                  styles.introTitle
                }
              >
                Class Schedule
              </Text>

              <Text
                style={
                  styles.introSubtitle
                }
              >
                Stay updated with your
                classes, faculty and
                classrooms.
              </Text>
            </View>
          </View>

          {/* =================================================
              SUMMARY
          ================================================= */}

          <View
            style={
              styles.summaryRow
            }
          >

            <View
              style={
                styles.summaryCard
              }
            >
              <View
                style={
                  styles.summaryIcon
                }
              >
                <Ionicons
                  name="calendar-number-outline"
                  size={20}
                  color="#1769AA"
                />
              </View>

              <View>
                <Text
                  style={
                    styles.summaryValue
                  }
                >
                  {
                    totalWeeklyClasses
                  }
                </Text>

                <Text
                  style={
                    styles.summaryLabel
                  }
                >
                  Weekly Classes
                </Text>
              </View>
            </View>

            <View
              style={
                styles.summaryCard
              }
            >
              <View
                style={
                  styles.summaryIcon
                }
              >
                <Ionicons
                  name="today-outline"
                  size={20}
                  color="#1769AA"
                />
              </View>

              <View>
                <Text
                  style={
                    styles.summaryValue
                  }
                >
                  {
                    selectedDayClasses
                  }
                </Text>

                <Text
                  style={
                    styles.summaryLabel
                  }
                >
                  Today's Classes
                </Text>
              </View>
            </View>

          </View>

          <View style={{ marginBottom: 20 }}>
            <Text style={styles.sectionTitle}>Upcoming faculty lectures</Text>
            <Text style={[styles.sectionSubtitle, { marginBottom: 10 }]}>
              Scheduled classes and their meeting links
            </Text>

            {lectures.length === 0 ? (
              <Card style={{ padding: 14 }}>
                <Text style={styles.detailValue}>
                  No upcoming lectures match your course, semester and section. Pull down to refresh. Faculty should enter the cohort in a format such as “BCA Sem 4 - A”.
                </Text>
              </Card>
            ) : (
              <View style={{ gap: 10 }}>
                {lectures.map((lecture) => (
                  <Card key={lecture._id} style={{ gap: 8 }}>
                    <View style={styles.classHeader}>
                      <View style={styles.subjectIcon}>
                        <Ionicons name="videocam-outline" size={22} color="#1769AA" />
                      </View>
                      <View style={styles.subjectInfo}>
                        <Text style={styles.subjectTitle} numberOfLines={2}>
                          {lecture.course || 'Scheduled lecture'}
                        </Text>
                        <Text style={styles.detailValue}>
                          {formatDate(`${lecture.date.slice(0, 10)}T12:00:00`)} · {lecture.startTime}–{lecture.endTime}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.detailValue}>
                      {lecture.cohort} · Room {lecture.room || 'To be announced'}
                    </Text>
                    {lecture.meetingUrl ? (
                      <Pressable
                        onPress={() => void openLectureLink(lecture)}
                        accessibilityRole="button"
                        style={{
                          borderRadius: 10,
                          paddingVertical: 11,
                          alignItems: 'center',
                          backgroundColor: '#1769AA',
                          flexDirection: 'row',
                          justifyContent: 'center',
                          gap: 7,
                        }}
                      >
                        <Ionicons name="open-outline" size={17} color="#FFF" />
                        <Text style={{ color: '#FFF', fontWeight: '800', fontSize: 13 }}>
                          Join lecture
                        </Text>
                      </Pressable>
                    ) : (
                      <Text style={styles.detailValue}>
                        Faculty has not shared a meeting link yet.
                      </Text>
                    )}
                  </Card>
                ))}
              </View>
            )}
          </View>

          {/* =================================================
              DAY SELECTOR
          ================================================= */}

          <View
            style={
              styles.sectionHeading
            }
          >
            <View>
              <Text
                style={
                  styles.sectionTitle
                }
              >
                Weekly Schedule
              </Text>

              <Text
                style={
                  styles.sectionSubtitle
                }
              >
                Select a day to view classes
              </Text>
            </View>

            <View
              style={
                styles.todayBadge
              }
            >
              <Text
                style={
                  styles.todayBadgeText
                }
              >
                TODAY
              </Text>
            </View>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={
              false
            }
            contentContainerStyle={
              styles.daysContainer
            }
          >

            {DAYS.map(
              (d) => {

                const active =
                  day === d;

                const count =
                  rows.filter(
                    (r) =>
                      r.dayOfWeek ===
                      d
                  ).length +
                  lectures.filter(
                    (lecture) =>
                      lecture.status !== 'Cancelled' &&
                      lectureDayName(lecture.date) === d
                  ).length;

                return (
                  <Pressable
                    key={d}
                    onPress={() =>
                      setDay(d)
                    }
                    style={({ pressed }) => [
                      styles.dayButton,

                      active &&
                        styles.dayButtonActive,

                      pressed &&
                        styles.pressed,
                    ]}
                  >

                    <Text
                      style={[
                        styles.dayName,
                        active &&
                          styles.dayNameActive,
                      ]}
                    >
                      {d.slice(0, 3)}
                    </Text>

                    <Text
                      style={[
                        styles.dayCount,
                        active &&
                          styles.dayCountActive,
                      ]}
                    >
                      {count}{' '}
                      {count === 1
                        ? 'class'
                        : 'classes'}
                    </Text>

                  </Pressable>
                );
              }
            )}

          </ScrollView>

          {/* =================================================
              SELECTED DAY HEADER
          ================================================= */}

          <View
            style={
              styles.selectedDayHeader
            }
          >

            <View
              style={
                styles.selectedDayLeft
              }
            >
              <View
                style={
                  styles.selectedDayIcon
                }
              >
                <Ionicons
                  name="calendar"
                  size={19}
                  color="#FFFFFF"
                />
              </View>

              <View>
                <Text
                  style={
                    styles.selectedDayTitle
                  }
                >
                  {day}
                </Text>

                <Text
                  style={
                    styles.selectedDaySubtitle
                  }
                >
                  {selectedDayClasses}{' '}
                  {selectedDayClasses === 1
                    ? 'class'
                    : 'classes'}{' '}
                  scheduled
                </Text>
              </View>
            </View>

            <View
              style={
                styles.classNumber
              }
            >
              <Text
                style={
                  styles.classNumberText
                }
              >
                {
                  selectedDayClasses
                }
              </Text>
            </View>

          </View>

          {/* =================================================
              CLASS LIST
          ================================================= */}

          {dayRows.length === 0 && dayLectures.length === 0 ? (

            <View
              style={
                styles.emptyContainer
              }
            >
              <View
                style={
                  styles.emptyIcon
                }
              >
                <Ionicons
                  name="calendar-outline"
                  size={32}
                  color="#1769AA"
                />
              </View>

              <Text
                style={
                  styles.emptyTitle
                }
              >
                No Classes Scheduled
              </Text>

              <Text
                style={
                  styles.emptyText
                }
              >
                There are no classes or one-time lectures available for{' '}
                {day}.
              </Text>
            </View>

          ) : (

            <View
              style={
                styles.scheduleList
              }
            >

              {dayRows.map(
                (row, index) => {

                  const subject =
                    refName(
                      row.subjectId
                    ) ||
                    row.title ||
                    'Class';

                  const faculty =
                    refName(
                      row.facultyId
                    );

                  return (
                    <View
                      key={
                        row._id ||
                        `${row.dayOfWeek}-${row.startTime}-${index}`
                      }
                      style={
                        styles.scheduleItem
                      }
                    >

                      {/* TIME COLUMN */}

                      <View
                        style={
                          styles.timeColumn
                        }
                      >

                        <Text
                          style={
                            styles.startTime
                          }
                        >
                          {
                            row.startTime
                          }
                        </Text>

                        <View
                          style={
                            styles.timeline
                          }
                        >
                          <View
                            style={
                              styles.timelineDot
                            }
                          />
                        </View>

                        <Text
                          style={
                            styles.endTime
                          }
                        >
                          {
                            row.endTime
                          }
                        </Text>

                      </View>

                      {/* CLASS CARD */}

                      <Card
                        style={
                          styles.classCard
                        }
                      >

                        {/* CARD TOP */}

                        <View
                          style={
                            styles.classHeader
                          }
                        >

                          <View
                            style={
                              styles.subjectIcon
                            }
                          >
                            <Ionicons
                              name="book-outline"
                              size={22}
                              color="#1769AA"
                            />
                          </View>

                          <View
                            style={
                              styles.subjectInfo
                            }
                          >

                            <Text
                              style={
                                styles.subjectTitle
                              }
                              numberOfLines={
                                2
                              }
                            >
                              {
                                subject
                              }
                            </Text>

                            <View
                              style={
                                styles.timeBadge
                              }
                            >
                              <Ionicons
                                name="time-outline"
                                size={12}
                                color="#1769AA"
                              />

                              <Text
                                style={
                                  styles.timeBadgeText
                                }
                              >
                                {
                                  row.startTime
                                }{' '}
                                -{' '}
                                {
                                  row.endTime
                                }
                              </Text>
                            </View>

                          </View>

                        </View>

                        {/* DIVIDER */}

                        <View
                          style={
                            styles.divider
                          }
                        />

                        {/* FACULTY */}

                        {faculty ? (
                          <View
                            style={
                              styles.detailRow
                            }
                          >

                            <View
                              style={
                                styles.detailIcon
                              }
                            >
                              <Ionicons
                                name="person-outline"
                                size={16}
                                color="#1769AA"
                              />
                            </View>

                            <View
                              style={
                                styles.detailTextContainer
                              }
                            >
                              <Text
                                style={
                                  styles.detailLabel
                                }
                              >
                                Faculty
                              </Text>

                              <Text
                                style={
                                  styles.detailValue
                                }
                                numberOfLines={
                                  1
                                }
                              >
                                {
                                  faculty
                                }
                              </Text>
                            </View>

                          </View>
                        ) : null}

                        {/* ROOM */}

                        {row.room ? (
                          <View
                            style={
                              styles.detailRow
                            }
                          >

                            <View
                              style={
                                styles.detailIcon
                              }
                            >
                              <Ionicons
                                name="location-outline"
                                size={16}
                                color="#1769AA"
                              />
                            </View>

                            <View
                              style={
                                styles.detailTextContainer
                              }
                            >
                              <Text
                                style={
                                  styles.detailLabel
                                }
                              >
                                Classroom
                              </Text>

                              <Text
                                style={
                                  styles.detailValue
                                }
                              >
                                Room{' '}
                                {
                                  row.room
                                }
                              </Text>
                            </View>

                          </View>
                        ) : null}

                        {/* SEMESTER / SECTION */}

                        {(row.semester ||
                          row.section) && (
                          <View
                            style={
                              styles.academicContainer
                            }
                          >

                            {row.semester ? (
                              <View
                                style={
                                  styles.academicBadge
                                }
                              >
                                <Ionicons
                                  name="layers-outline"
                                  size={12}
                                  color="#1769AA"
                                />

                                <Text
                                  style={
                                    styles.academicText
                                  }
                                >
                                  Sem{' '}
                                  {
                                    row.semester
                                  }
                                </Text>
                              </View>
                            ) : null}

                            {row.section ? (
                              <View
                                style={
                                  styles.academicBadge
                                }
                              >
                                <Ionicons
                                  name="people-outline"
                                  size={12}
                                  color="#1769AA"
                                />

                                <Text
                                  style={
                                    styles.academicText
                                  }
                                >
                                  Section{' '}
                                  {
                                    row.section
                                  }
                                </Text>
                              </View>
                            ) : null}

                          </View>
                        )}

                        {day === todayName() && classroomStatuses[row._id] ? (
                          <Pressable
                            disabled={
                              classroomStatuses[row._id].status !== 'live' ||
                              joiningClassId === row._id
                            }
                            onPress={() => void enterClassroom(row._id)}
                            style={{
                              marginTop: 12,
                              borderRadius: 10,
                              paddingVertical: 10,
                              alignItems: 'center',
                              backgroundColor:
                                classroomStatuses[row._id].status === 'live'
                                  ? '#1769AA'
                                  : '#EAF3FA',
                              opacity: joiningClassId === row._id ? 0.6 : 1,
                            }}
                          >
                            <Text
                              style={{
                                color:
                                  classroomStatuses[row._id].status === 'live'
                                    ? '#FFF'
                                    : '#557083',
                                fontWeight: '800',
                                fontSize: 13,
                              }}
                            >
                              {joiningClassId === row._id
                                ? 'Joining…'
                                : classroomStatuses[row._id].status === 'live'
                                ? 'Join live class'
                                : classroomStatuses[row._id].status === 'ended'
                                ? 'Class ended'
                                : 'Waiting for faculty to start'}
                            </Text>
                          </Pressable>
                        ) : null}

                        {row.meetingUrl ? (
                          <Pressable
                            onPress={() => void openMeetingLink(row.meetingUrl)}
                            accessibilityRole="button"
                            style={{
                              marginTop: 10,
                              borderRadius: 10,
                              paddingVertical: 11,
                              alignItems: 'center',
                              backgroundColor: '#15803D',
                              flexDirection: 'row',
                              justifyContent: 'center',
                              gap: 7,
                            }}
                          >
                            <Ionicons name="videocam-outline" size={17} color="#FFF" />
                            <Text style={{ color: '#FFF', fontWeight: '800', fontSize: 13 }}>
                              Join class (video link)
                            </Text>
                          </Pressable>
                        ) : null}

                      </Card>

                    </View>
                  );
                }
              )}

              {dayLectures.map((lecture) => (
                <View key={lecture._id} style={styles.scheduleItem}>
                  <View style={styles.timeColumn}>
                    <Text style={styles.startTime}>{lecture.startTime}</Text>
                    <View style={styles.timeline}>
                      <View style={styles.timelineDot} />
                    </View>
                    <Text style={styles.endTime}>{lecture.endTime}</Text>
                  </View>

                  <Card style={styles.classCard}>
                    <View style={styles.classHeader}>
                      <View style={styles.subjectIcon}>
                        <Ionicons name="videocam-outline" size={22} color="#1769AA" />
                      </View>
                      <View style={styles.subjectInfo}>
                        <Text style={styles.subjectTitle} numberOfLines={2}>
                          {lecture.course || 'Scheduled lecture'}
                        </Text>
                        <View style={styles.timeBadge}>
                          <Ionicons name="time-outline" size={12} color="#1769AA" />
                          <Text style={styles.timeBadgeText}>
                            {lecture.startTime} - {lecture.endTime}
                          </Text>
                        </View>
                      </View>
                    </View>

                    <View style={styles.divider} />

                    <View style={styles.detailRow}>
                      <View style={styles.detailIcon}>
                        <Ionicons name="calendar-outline" size={16} color="#1769AA" />
                      </View>
                      <View style={styles.detailTextContainer}>
                        <Text style={styles.detailLabel}>Date and cohort</Text>
                        <Text style={styles.detailValue}>
                          {formatDate(`${lecture.date.slice(0, 10)}T12:00:00`)} · {lecture.cohort}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.detailRow}>
                      <View style={styles.detailIcon}>
                        <Ionicons name="location-outline" size={16} color="#1769AA" />
                      </View>
                      <View style={styles.detailTextContainer}>
                        <Text style={styles.detailLabel}>Classroom</Text>
                        <Text style={styles.detailValue}>Room {lecture.room || 'To be announced'}</Text>
                      </View>
                    </View>

                    {lecture.meetingUrl ? (
                      <Pressable
                        onPress={() => void openLectureLink(lecture)}
                        accessibilityRole="button"
                        style={{
                          marginTop: 6,
                          borderRadius: 10,
                          paddingVertical: 11,
                          alignItems: 'center',
                          backgroundColor: '#1769AA',
                          flexDirection: 'row',
                          justifyContent: 'center',
                          gap: 7,
                        }}
                      >
                        <Ionicons name="open-outline" size={17} color="#FFF" />
                        <Text style={{ color: '#FFF', fontWeight: '800', fontSize: 13 }}>
                          Join lecture
                        </Text>
                      </Pressable>
                    ) : (
                      <Text style={styles.detailValue}>
                        Faculty has not shared a meeting link yet.
                      </Text>
                    )}
                  </Card>
                </View>
              ))}

            </View>
          )}

          {/* =================================================
              INFORMATION CARD
          ================================================= */}

          <View
            style={
              styles.infoCard
            }
          >

            <View
              style={
                styles.infoIcon
              }
            >
              <Ionicons
                name="information-circle-outline"
                size={21}
                color="#1769AA"
              />
            </View>

            <View
              style={
                styles.infoContent
              }
            >
              <Text
                style={
                  styles.infoTitle
                }
              >
                Timetable Information
              </Text>

              <Text
                style={
                  styles.infoText
                }
              >
                Weekly timetable classes and upcoming faculty-scheduled lectures
                appear here. Tap “Join lecture” when a meeting link has been shared.
              </Text>
            </View>

          </View>

          <View
            style={
              styles.bottomSpace
            }
          />

        </ScrollView>
      )}

    </Screen>
  );
}

// ======================================================
// STYLES
// ======================================================

const styles =
  StyleSheet.create({

    // ==================================================
    // MAIN
    // ==================================================

    container: {
      padding: 16,
      paddingBottom: 40,
    },

    pressed: {
      opacity: 0.7,
    },

    // ==================================================
    // INTRO
    // ==================================================

    introCard: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
      borderRadius: 16,
      backgroundColor: '#EAF3FA',
      borderWidth: 1,
      borderColor: '#D6E7F2',
      marginBottom: 16,
    },

    introIcon: {
      width: 52,
      height: 52,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#FFFFFF',
      marginRight: 13,
    },

    introContent: {
      flex: 1,
    },

    introTitle: {
      fontSize: 16,
      fontWeight: '900',
      color: '#183B56',
    },

    introSubtitle: {
      fontSize: 11,
      lineHeight: 17,
      color: '#64748B',
      marginTop: 4,
    },

    // ==================================================
    // SUMMARY
    // ==================================================

    summaryRow: {
      flexDirection: 'row',
      gap: 10,
      marginBottom: 22,
    },

    summaryCard: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      padding: 12,
      borderRadius: 14,
      backgroundColor: '#FFFFFF',
      borderWidth: 1,
      borderColor: '#E2E8F0',
    },

    summaryIcon: {
      width: 38,
      height: 38,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#EAF3FA',
      marginRight: 9,
    },

    summaryValue: {
      fontSize: 17,
      fontWeight: '900',
      color: '#183B56',
    },

    summaryLabel: {
      fontSize: 9.5,
      color: '#718096',
      marginTop: 2,
    },

    // ==================================================
    // SECTION HEADING
    // ==================================================

    sectionHeading: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 11,
    },

    sectionTitle: {
      fontSize: 16,
      fontWeight: '900',
      color: '#183B56',
    },

    sectionSubtitle: {
      fontSize: 10.5,
      color: '#718096',
      marginTop: 3,
    },

    todayBadge: {
      paddingHorizontal: 9,
      paddingVertical: 5,
      borderRadius: 8,
      backgroundColor: '#EAF3FA',
    },

    todayBadgeText: {
      fontSize: 8.5,
      fontWeight: '900',
      color: '#1769AA',
      letterSpacing: 0.7,
    },

    // ==================================================
    // DAY SELECTOR
    // ==================================================

    daysContainer: {
      gap: 8,
      paddingBottom: 4,
    },

    dayButton: {
      width: 82,
      minHeight: 62,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 13,
      backgroundColor: '#FFFFFF',
      borderWidth: 1,
      borderColor: '#E2E8F0',
    },

    dayButtonActive: {
      backgroundColor: '#1769AA',
      borderColor: '#1769AA',
    },

    dayName: {
      fontSize: 14,
      fontWeight: '900',
      color: '#526579',
    },

    dayNameActive: {
      color: '#FFFFFF',
    },

    dayCount: {
      fontSize: 9,
      color: '#9AA7B5',
      marginTop: 4,
    },

    dayCountActive: {
      color: '#DDEFFA',
    },

    // ==================================================
    // SELECTED DAY
    // ==================================================

    selectedDayHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 22,
      marginBottom: 14,
    },

    selectedDayLeft: {
      flexDirection: 'row',
      alignItems: 'center',
    },

    selectedDayIcon: {
      width: 40,
      height: 40,
      borderRadius: 11,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#1769AA',
      marginRight: 10,
    },

    selectedDayTitle: {
      fontSize: 17,
      fontWeight: '900',
      color: '#183B56',
    },

    selectedDaySubtitle: {
      fontSize: 10.5,
      color: '#718096',
      marginTop: 2,
    },

    classNumber: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#EAF3FA',
    },

    classNumberText: {
      fontSize: 12,
      fontWeight: '900',
      color: '#1769AA',
    },

    // ==================================================
    // SCHEDULE
    // ==================================================

    scheduleList: {
      gap: 0,
    },

    scheduleItem: {
      flexDirection: 'row',
      alignItems: 'stretch',
      marginBottom: 13,
    },

    // ==================================================
    // TIME
    // ==================================================

    timeColumn: {
      width: 57,
      alignItems: 'center',
      paddingTop: 17,
    },

    startTime: {
      fontSize: 12,
      fontWeight: '900',
      color: '#1769AA',
    },

    endTime: {
      fontSize: 9.5,
      fontWeight: '600',
      color: '#94A3B8',
      marginTop: 5,
    },

    timeline: {
      flex: 1,
      width: 2,
      marginTop: 5,
      marginBottom: 5,
      backgroundColor: '#DCE8EF',
      alignItems: 'center',
    },

    timelineDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: '#1769AA',
      marginTop: 3,
    },

    // ==================================================
    // CLASS CARD
    // ==================================================

    classCard: {
      flex: 1,
      padding: 15,
      borderRadius: 15,
      backgroundColor: '#FFFFFF',
      borderWidth: 1,
      borderColor: '#E2E8F0',
      shadowColor: '#183B56',
      shadowOffset: {
        width: 0,
        height: 2,
      },
      shadowOpacity: 0.04,
      shadowRadius: 5,
      elevation: 2,
    },

    classHeader: {
      flexDirection: 'row',
      alignItems: 'center',
    },

    subjectIcon: {
      width: 45,
      height: 45,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#EAF3FA',
      marginRight: 11,
    },

    subjectInfo: {
      flex: 1,
    },

    subjectTitle: {
      fontSize: 14,
      lineHeight: 19,
      fontWeight: '900',
      color: '#183B56',
    },

    timeBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      marginTop: 5,
      paddingHorizontal: 7,
      paddingVertical: 4,
      borderRadius: 6,
      backgroundColor: '#F1F7FB',
    },

    timeBadgeText: {
      fontSize: 9.5,
      fontWeight: '800',
      color: '#1769AA',
      marginLeft: 4,
    },

    // ==================================================
    // DIVIDER
    // ==================================================

    divider: {
      height: 1,
      backgroundColor: '#EDF1F4',
      marginVertical: 12,
    },

    // ==================================================
    // DETAILS
    // ==================================================

    detailRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 9,
    },

    detailIcon: {
      width: 32,
      height: 32,
      borderRadius: 9,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#F5F9FC',
      marginRight: 9,
    },

    detailTextContainer: {
      flex: 1,
    },

    detailLabel: {
      fontSize: 8.5,
      fontWeight: '800',
      color: '#9AA7B5',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },

    detailValue: {
      fontSize: 11.5,
      fontWeight: '700',
      color: '#526579',
      marginTop: 2,
    },

    // ==================================================
    // ACADEMIC
    // ==================================================

    academicContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 7,
      marginTop: 2,
    },

    academicBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 8,
      paddingVertical: 5,
      borderRadius: 7,
      backgroundColor: '#F1F7FB',
    },

    academicText: {
      fontSize: 9,
      fontWeight: '700',
      color: '#1769AA',
      marginLeft: 4,
    },

    // ==================================================
    // EMPTY
    // ==================================================

    emptyContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 42,
      paddingHorizontal: 25,
      backgroundColor: '#FFFFFF',
      borderRadius: 15,
      borderWidth: 1,
      borderColor: '#E2E8F0',
    },

    emptyIcon: {
      width: 64,
      height: 64,
      borderRadius: 32,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#EAF3FA',
      marginBottom: 13,
    },

    emptyTitle: {
      fontSize: 15,
      fontWeight: '900',
      color: '#183B56',
    },

    emptyText: {
      textAlign: 'center',
      fontSize: 11,
      lineHeight: 17,
      color: '#718096',
      marginTop: 5,
    },

    // ==================================================
    // INFO
    // ==================================================

    infoCard: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginTop: 7,
      padding: 14,
      borderRadius: 14,
      backgroundColor: '#F8FBFD',
      borderWidth: 1,
      borderColor: '#DDE8EF',
    },

    infoIcon: {
      width: 35,
      height: 35,
      borderRadius: 9,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#EAF3FA',
      marginRight: 9,
    },

    infoContent: {
      flex: 1,
    },

    infoTitle: {
      fontSize: 12,
      fontWeight: '800',
      color: '#183B56',
    },

    infoText: {
      fontSize: 10.5,
      lineHeight: 16,
      color: '#718096',
      marginTop: 3,
    },

    // ==================================================
    // GENERAL
    // ==================================================

    bottomSpace: {
      height: 20,
    },
  });