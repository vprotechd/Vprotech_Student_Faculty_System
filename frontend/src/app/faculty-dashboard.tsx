
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { getErrorMessage } from '../api/apiClient';
import { getStoredUser, logoutUser } from '../api/session';
import {
  getFacultyProfile,
  getFacultyDashboard,
  getMyLectures,
  type FacultyDashboardStats,
  type FacultyProfile,
  type Lecture,
} from '../api/facultyApi';

type FacultyUser = {
  _id?: string;
  id?: string;
  name?: string;
  fullName?: string;
  email?: string;
  phone?: string;
  department?: string;
  designation?: string;
  role?: string;
  departmentId?: FacultyProfile['departmentId'];
};

type DashboardData = FacultyDashboardStats;
type ScheduleItem = Lecture;

const COLORS = {
  primary: '#1769AA',
  primaryDark: '#104E85',
  background: '#F4F8FC',
  white: '#FFFFFF',
  heading: '#183B56',
  text: '#718096',
  muted: '#9AA8B6',
  border: '#E8EFF6',
  lightBlue: '#EAF3FC',
  green: '#159B75',
  orange: '#E99A32',
  purple: '#8064CF',
  red: '#D94B4B',
};

export default function FacultyDashboard() {
  const router = useRouter();

  const [user, setUser] = useState<FacultyUser | null>(null);

  const [dashboard, setDashboard] = useState<DashboardData>({
    todayLectures: 0,
    pendingSubmissions: 0,
    materialCount: 0,
  });

  const [schedule, setSchedule] = useState<ScheduleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const loadStoredUser = useCallback(async () => {
    const storedUser = await getStoredUser();

    if (storedUser) {
      setUser(storedUser as FacultyUser);
    }
  }, []);

  const loadDashboard = useCallback(async () => {
    setError('');

    const today = new Date();
    const dateKey = [
      today.getFullYear(),
      String(today.getMonth() + 1).padStart(2, '0'),
      String(today.getDate()).padStart(2, '0'),
    ].join('-');

    const [stats, lectures, facultyProfile] = await Promise.allSettled([
      getFacultyDashboard(),
      getMyLectures(dateKey),
      getFacultyProfile(),
    ]);

    let dashboardError = '';

    if (stats.status === 'fulfilled') {
      setDashboard(stats.value);
    } else {
      dashboardError = getErrorMessage(
        stats.reason,
        'Unable to load faculty dashboard.'
      );
    }

    if (facultyProfile.status === 'fulfilled' && facultyProfile.value) {
      const profile = facultyProfile.value;

      const profileUser =
        typeof profile.userId === 'object' && profile.userId
          ? profile.userId
          : null;

      const department =
        typeof profile.departmentId === 'object' && profile.departmentId
          ? profile.departmentId.name
          : undefined;

      setUser((previous) => ({
        ...previous,
        name: profileUser?.name || previous?.name,
        email: profileUser?.email || previous?.email,
        phone: profile.phone || previous?.phone,
        department: department || previous?.department,
        designation: profile.designation || previous?.designation,
      }));
    } else if (facultyProfile.status === 'rejected') {
      const profileError = getErrorMessage(
        facultyProfile.reason,
        'Unable to load faculty profile details.'
      );

      dashboardError = dashboardError
        ? `${dashboardError} ${profileError}`
        : profileError;
    }

    if (lectures.status === 'fulfilled') {
      setSchedule(
        lectures.value.filter(
          (lecture) => lecture.status !== 'Cancelled'
        )
      );
    } else {
      const lectureError = getErrorMessage(
        lectures.reason,
        'Unable to load today’s schedule.'
      );

      dashboardError = dashboardError
        ? `${dashboardError} ${lectureError}`
        : lectureError;
    }

    setError(dashboardError);
  }, []);

  useEffect(() => {
    let mounted = true;

    const initialize = async () => {
      try {
        await loadStoredUser();

        if (mounted) {
          await loadDashboard();
        }
      } catch (err) {
        if (mounted) {
          setError(getErrorMessage(err, 'Unable to initialize dashboard.'));
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    initialize();

    return () => {
      mounted = false;
    };
  }, [loadStoredUser, loadDashboard]);

  const handleRefresh = useCallback(async () => {
    try {
      setRefreshing(true);
      await Promise.all([loadStoredUser(), loadDashboard()]);
    } finally {
      setRefreshing(false);
    }
  }, [loadStoredUser, loadDashboard]);

  const handleLogout = useCallback(() => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            try {
              await logoutUser();
              router.replace('/');
            } catch {
              Alert.alert('Error', 'Unable to logout. Please try again.');
            }
          },
        },
      ]
    );
  }, [router]);

  const openSchedule = useCallback(() => {
    router.push('/faculty/schedule');
  }, [router]);

  const openExaminations = useCallback(() => {
    router.push('/faculty/exams' as any);
  }, [router]);

  const openMaterials = useCallback(() => {
    router.push('/faculty/upload-materials');
  }, [router]);

  const openGrading = useCallback(() => {
    router.push('/faculty/grading');
  }, [router]);

  const openDoubts = useCallback(() => {
    router.push('/faculty/doubts');
  }, [router]);

  const openNotifications = useCallback(() => {
    router.push('/faculty/notifications');
  }, [router]);

  const openProfile = useCallback(() => {
    router.push('/faculty/profile');
  }, [router]);

  const openChat = useCallback(() => {
    router.push('/chat' as any);
  }, [router]);

  const facultyName =
    user?.fullName || user?.name || 'Faculty Member';

  const initials =
    facultyName
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word.charAt(0).toUpperCase())
      .join('') || 'F';

  const todayLabel = new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingScreen}>
        <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />
        <View style={styles.loadingIcon}>
          <Ionicons name="school" size={36} color={COLORS.primary} />
        </View>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingTitle}>Preparing your dashboard</Text>
        <Text style={styles.loadingSubtitle}>Please wait a moment...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primaryDark} />

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={COLORS.primary}
          />
        }
      >
        {/* TOP HEADER */}

        <View style={styles.hero}>
          <View style={styles.heroTop}>
            <Pressable
              onPress={() =>
                router.canGoBack()
                  ? router.back()
                  : router.replace('/' as any)
              }
              style={styles.headerIconButton}
            >
              <Ionicons name="arrow-back" size={21} color={COLORS.white} />
            </Pressable>

            <Text style={styles.brandText}>FACULTY PORTAL</Text>

            <Pressable
              onPress={handleLogout}
              style={styles.headerIconButton}
            >
              <Ionicons name="log-out-outline" size={21} color={COLORS.white} />
            </Pressable>
          </View>

          <View style={styles.welcomeSection}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>

            <View style={styles.welcomeContent}>
              <Text style={styles.welcomeLabel}>Welcome back 👋</Text>
              <Text style={styles.facultyName} numberOfLines={1}>
                {facultyName}
              </Text>
              <Text style={styles.designation}>
                {user?.designation || user?.department || 'Faculty Member'}
              </Text>
            </View>
          </View>

          <View style={styles.datePill}>
            <Ionicons name="calendar-outline" size={15} color={COLORS.white} />
            <Text style={styles.dateText}>{todayLabel}</Text>
          </View>
        </View>

        {/* ERROR MESSAGE */}

        {error ? (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle-outline" size={22} color={COLORS.red} />
            <View style={styles.errorContent}>
              <Text style={styles.errorTitle}>Dashboard Notice</Text>
              <Text style={styles.errorText}>{error}</Text>
              <Pressable onPress={loadDashboard}>
                <Text style={styles.retryText}>Try Again</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        {/* DASHBOARD TITLE */}

        <View style={styles.sectionHeading}>
          <View>
            <Text style={styles.pageTitle}>Overview</Text>
            <Text style={styles.pageSubtitle}>
              Here is what's happening today.
            </Text>
          </View>

          <View style={styles.liveIndicator}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>Active</Text>
          </View>
        </View>

        {/* STATISTICS */}

        <View style={styles.statsGrid}>
          <StatCard
            icon="calendar"
            title="Today's Lectures"
            value={dashboard.todayLectures}
            color={COLORS.primary}
            background="#EAF3FC"
          />

          <StatCard
            icon="document-text"
            title="To Grade"
            value={dashboard.pendingSubmissions}
            color={COLORS.orange}
            background="#FFF5E8"
          />

          <StatCard
            icon="library"
            title="Materials"
            value={dashboard.materialCount}
            color={COLORS.purple}
            background="#F1EDFF"
          />
        </View>

        {/* QUICK ACTIONS */}

        <View style={styles.sectionHeading}>
          <View>
            <Text style={styles.sectionTitle}>Quick Actions</Text>
            <Text style={styles.sectionSubtitle}>
              Manage your daily activities
            </Text>
          </View>
        </View>

        <View style={styles.actionsGrid}>
          <ActionButton
            icon="calendar-outline"
            title="My Schedule"
            description="View your classes"
            color={COLORS.primary}
            background="#EAF3FC"
            onPress={openSchedule}
          />

          <ActionButton
            icon="document-text-outline"
            title="Examinations"
            description="Create and evaluate exams"
            color={COLORS.orange}
            background="#FFF5E8"
            onPress={openExaminations}
          />

          <ActionButton
            icon="videocam-outline"
            title="Live Classroom"
            description="Today's classes"
            color={COLORS.green}
            background="#E9F8F2"
            onPress={openSchedule}
          />

          <ActionButton
            icon="cloud-upload-outline"
            title="Materials"
            description="Upload resources"
            color={COLORS.purple}
            background="#F1EDFF"
            onPress={openMaterials}
          />

          <ActionButton
            icon="create-outline"
            title="Grading"
            description="Review submissions"
            color={COLORS.orange}
            background="#FFF5E8"
            onPress={openGrading}
          />

          <ActionButton
            icon="help-circle-outline"
            title="Student Doubts"
            description="Review questions and reply"
            color={COLORS.primary}
            background="#EAF3FC"
            onPress={openDoubts}
          />

          <ActionButton
            icon="notifications-outline"
            title="Notifications"
            description="Announcements and updates"
            color={COLORS.orange}
            background="#FFF5E8"
            onPress={openNotifications}
          />

          <ActionButton
            icon="person-outline"
            title="My Profile"
            description="Account details"
            color="#D46B89"
            background="#FFF0F4"
            onPress={openProfile}
          />

          <ActionButton
            icon="chatbubbles-outline"
            title="Student Chat"
            description="Connect with students"
            color="#168C9D"
            background="#E8F7F9"
            onPress={openChat}
          />
        </View>

        {/* SCHEDULE */}

        <View style={styles.sectionHeading}>
          <View>
            <Text style={styles.sectionTitle}>Today's Schedule</Text>
            <Text style={styles.sectionSubtitle}>
              Your upcoming classes
            </Text>
          </View>

          <Pressable onPress={openSchedule} style={styles.viewAllButton}>
            <Text style={styles.viewAllText}>View All</Text>
            <Ionicons name="chevron-forward" size={15} color={COLORS.primary} />
          </Pressable>
        </View>

        {schedule.length > 0 ? (
          <View style={styles.scheduleContainer}>
            {schedule.slice(0, 5).map((item, index) => (
              <ScheduleCard
                key={item._id || `schedule-${index}`}
                item={item}
                index={index}
              />
            ))}
          </View>
        ) : (
          <View style={styles.emptyBox}>
            <View style={styles.emptyIcon}>
              <Ionicons name="calendar-outline" size={30} color={COLORS.primary} />
            </View>
            <Text style={styles.emptyTitle}>No classes scheduled</Text>
            <Text style={styles.emptyText}>
              Your upcoming classes will appear here.
            </Text>
            <Pressable style={styles.emptyButton} onPress={openSchedule}>
              <Text style={styles.emptyButtonText}>View Schedule</Text>
              <Ionicons name="arrow-forward" size={15} color={COLORS.white} />
            </Pressable>
          </View>
        )}

        {/* FACULTY INFORMATION */}

        <View style={styles.profileCard}>
          <View style={styles.profileHeader}>
            <View style={styles.profileIcon}>
              <Ionicons name="person-circle-outline" size={27} color={COLORS.primary} />
            </View>
            <View style={styles.profileHeaderText}>
              <Text style={styles.profileTitle}>Faculty Information</Text>
              <Text style={styles.profileSubtitle}>Your account details</Text>
            </View>
            <Pressable onPress={openProfile}>
              <Ionicons name="create-outline" size={21} color={COLORS.primary} />
            </Pressable>
          </View>

          <InfoRow icon="person-outline" label="Name" value={facultyName} />
          <InfoRow icon="mail-outline" label="Email" value={user?.email || 'Not available'} />
          <InfoRow icon="call-outline" label="Phone" value={user?.phone || 'Not available'} />
          <InfoRow icon="business-outline" label="Department" value={user?.department || 'Not assigned'} />
          <InfoRow icon="briefcase-outline" label="Designation" value={user?.designation || 'Faculty'} />
          <InfoRow icon="shield-checkmark-outline" label="Role" value={user?.role || 'Faculty'} />

          <Pressable style={styles.profileButton} onPress={openProfile}>
            <Text style={styles.profileButtonText}>View Full Profile</Text>
            <Ionicons name="arrow-forward" size={17} color={COLORS.primary} />
          </Pressable>
        </View>

        {/* FOOTER */}

        <View style={styles.footer}>
          <Ionicons name="school-outline" size={18} color={COLORS.muted} />
          <Text style={styles.footerText}>Faculty Portal • Learn & Grow</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ==================================================
// STATISTICS CARD
// ==================================================

type StatCardProps = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  value: number;
  color: string;
  background: string;
};

function StatCard({ icon, title, value, color, background }: StatCardProps) {
  return (
    <View style={styles.statCard}>
      <View style={[styles.statIcon, { backgroundColor: background }]}>
        <Ionicons name={icon} size={23} color={color} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statTitle}>{title}</Text>
    </View>
  );
}

// ==================================================
// QUICK ACTION CARD
// ==================================================

type ActionButtonProps = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  color: string;
  background: string;
  onPress: () => void;
};

function ActionButton({
  icon,
  title,
  description,
  color,
  background,
  onPress,
}: ActionButtonProps) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.actionCard,
        pressed && styles.pressed,
      ]}
      onPress={onPress}
    >
      <View style={[styles.actionIcon, { backgroundColor: background }]}>
        <Ionicons name={icon} size={25} color={color} />
      </View>

      <Text style={styles.actionTitle}>{title}</Text>
      <Text style={styles.actionDescription}>{description}</Text>

      <View style={styles.actionArrow}>
        <Ionicons name="arrow-up-forward" size={14} color={color} />
      </View>
    </Pressable>
  );
}

// ==================================================
// SCHEDULE CARD
// ==================================================

function ScheduleCard({
  item,
  index,
}: {
  item: ScheduleItem;
  index: number;
}) {
  const colors = [COLORS.primary, COLORS.green, COLORS.purple, COLORS.orange];

  const color = colors[index % colors.length];

  return (
    <View style={styles.scheduleCard}>
      <View style={[styles.scheduleAccent, { backgroundColor: color }]} />

      <View style={styles.scheduleTime}>
        <Text style={styles.timeText}>{item.startTime || '--:--'}</Text>
        {item.endTime ? (
          <Text style={styles.endTimeText}>{item.endTime}</Text>
        ) : null}
      </View>

      <View style={styles.scheduleDivider} />

      <View style={styles.scheduleDetails}>
        <Text style={styles.scheduleSubject} numberOfLines={1}>
          {item.course || 'Lecture'}
        </Text>

        <Text style={styles.scheduleClass} numberOfLines={1}>
          {item.cohort || 'Class'} • {item.status || 'Scheduled'}
        </Text>

        {item.room ? (
          <View style={styles.roomRow}>
            <Ionicons name="location-outline" size={14} color={COLORS.muted} />
            <Text style={styles.roomText}>{item.room}</Text>
          </View>
        ) : null}
      </View>

      <Ionicons name="chevron-forward" size={19} color={COLORS.muted} />
    </View>
  );
}

// ==================================================
// PROFILE INFORMATION ROW
// ==================================================

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoIcon}>
        <Ionicons name={icon} size={17} color={COLORS.primary} />
      </View>

      <Text style={styles.infoLabel}>{label}</Text>

      <Text style={styles.infoValue} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

// ==================================================
// STYLES
// ==================================================

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  content: {
    paddingBottom: 30,
  },

  // LOADING

  loadingScreen: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },

  loadingIcon: {
    width: 76,
    height: 76,
    borderRadius: 25,
    backgroundColor: COLORS.lightBlue,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 23,
  },

  loadingTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.heading,
    marginTop: 18,
  },

  loadingSubtitle: {
    fontSize: 13,
    color: COLORS.text,
    marginTop: 6,
  },

  // HERO HEADER

  hero: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 20,
    paddingTop: 15,
    paddingBottom: 25,
    borderBottomLeftRadius: 27,
    borderBottomRightRadius: 27,
  },

  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 27,
  },

  headerIconButton: {
    width: 39,
    height: 39,
    borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.17)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  brandText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 2,
  },

  welcomeSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  avatar: {
    width: 65,
    height: 65,
    borderRadius: 22,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.35)',
  },

  avatarText: {
    fontSize: 22,
    fontWeight: '900',
    color: COLORS.primary,
  },

  welcomeContent: {
    flex: 1,
  },

  welcomeLabel: {
    fontSize: 13,
    color: '#D9EAF8',
    marginBottom: 4,
  },

  facultyName: {
    fontSize: 21,
    fontWeight: '800',
    color: COLORS.white,
  },

  designation: {
    fontSize: 12,
    color: '#D9EAF8',
    marginTop: 4,
  },

  datePill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    marginTop: 20,
    gap: 7,
  },

  dateText: {
    fontSize: 12,
    color: COLORS.white,
    fontWeight: '600',
  },

  // ERROR

  errorBox: {
    flexDirection: 'row',
    backgroundColor: '#FFF1F1',
    borderWidth: 1,
    borderColor: '#FFD7D7',
    borderRadius: 14,
    padding: 14,
    marginHorizontal: 18,
    marginTop: 18,
    gap: 10,
  },

  errorContent: {
    flex: 1,
  },

  errorTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.red,
  },

  errorText: {
    fontSize: 12,
    lineHeight: 18,
    color: '#A94444',
    marginTop: 4,
  },

  retryText: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.primary,
    marginTop: 9,
  },

  // HEADINGS

  sectionHeading: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: 19,
    marginTop: 25,
    marginBottom: 15,
  },

  pageTitle: {
    fontSize: 23,
    fontWeight: '900',
    color: COLORS.heading,
  },

  pageSubtitle: {
    fontSize: 12,
    color: COLORS.text,
    marginTop: 5,
  },

  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E7F7EF',
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 20,
    gap: 6,
  },

  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: COLORS.green,
  },

  liveText: {
    fontSize: 11,
    color: COLORS.green,
    fontWeight: '800',
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: COLORS.heading,
  },

  sectionSubtitle: {
    fontSize: 12,
    color: COLORS.text,
    marginTop: 4,
  },

  // STATS

  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginHorizontal: 18,
  },

  statCard: {
    width: '48.5%',
    backgroundColor: COLORS.white,
    borderRadius: 17,
    padding: 15,
    minHeight: 139,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    elevation: 2,
    shadowColor: '#254A6B',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 7,
  },

  statIcon: {
    width: 43,
    height: 43,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },

  statValue: {
    fontSize: 25,
    fontWeight: '900',
    color: COLORS.heading,
  },

  statTitle: {
    fontSize: 12,
    color: COLORS.text,
    marginTop: 4,
    fontWeight: '600',
  },

  // QUICK ACTIONS

  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginHorizontal: 18,
  },

  actionCard: {
    width: '48.5%',
    backgroundColor: COLORS.white,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    minHeight: 151,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#254A6B',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
  },

  pressed: {
    opacity: 0.75,
    transform: [{ scale: 0.98 }],
  },

  actionIcon: {
    width: 45,
    height: 45,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },

  actionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.heading,
  },

  actionDescription: {
    fontSize: 11,
    color: COLORS.text,
    marginTop: 5,
  },

  actionArrow: {
    position: 'absolute',
    right: 12,
    top: 13,
    width: 25,
    height: 25,
    borderRadius: 9,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // VIEW ALL

  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },

  viewAllText: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: '800',
  },

  // SCHEDULE

  scheduleContainer: {
    marginHorizontal: 18,
  },

  scheduleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    marginBottom: 11,
    minHeight: 93,
  },

  scheduleAccent: {
    width: 4,
    height: 51,
    borderRadius: 5,
    marginRight: 12,
  },

  scheduleTime: {
    width: 67,
  },

  timeText: {
    fontSize: 13,
    fontWeight: '900',
    color: COLORS.heading,
  },

  endTimeText: {
    fontSize: 10,
    color: COLORS.muted,
    marginTop: 4,
  },

  scheduleDivider: {
    width: 1,
    height: 44,
    backgroundColor: COLORS.border,
    marginHorizontal: 11,
  },

  scheduleDetails: {
    flex: 1,
  },

  scheduleSubject: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.heading,
  },

  scheduleClass: {
    fontSize: 11,
    color: COLORS.text,
    marginTop: 5,
  },

  roomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
    gap: 4,
  },

  roomText: {
    fontSize: 10,
    color: COLORS.muted,
  },

  emptyBox: {
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 27,
    marginHorizontal: 18,
  },

  emptyIcon: {
    width: 60,
    height: 60,
    borderRadius: 20,
    backgroundColor: COLORS.lightBlue,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 13,
  },

  emptyTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.heading,
  },

  emptyText: {
    fontSize: 12,
    color: COLORS.text,
    textAlign: 'center',
    marginTop: 6,
  },

  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    paddingHorizontal: 17,
    paddingVertical: 11,
    marginTop: 16,
    gap: 7,
  },

  emptyButtonText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: '800',
  },

  // PROFILE

  profileCard: {
    backgroundColor: COLORS.white,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    marginHorizontal: 18,
    marginTop: 27,
  },

  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    marginBottom: 5,
  },

  profileIcon: {
    width: 45,
    height: 45,
    borderRadius: 14,
    backgroundColor: COLORS.lightBlue,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 11,
  },

  profileHeaderText: {
    flex: 1,
  },

  profileTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: COLORS.heading,
  },

  profileSubtitle: {
    fontSize: 11,
    color: COLORS.text,
    marginTop: 3,
  },

  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 49,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F4F7',
  },

  infoIcon: {
    width: 30,
    alignItems: 'center',
  },

  infoLabel: {
    width: 83,
    fontSize: 11,
    color: COLORS.text,
    marginLeft: 6,
  },

  infoValue: {
    flex: 1,
    textAlign: 'right',
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.heading,
  },

  profileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.lightBlue,
    paddingVertical: 13,
    borderRadius: 11,
    marginTop: 16,
    gap: 8,
  },

  profileButtonText: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.primary,
  },

  // FOOTER

  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 27,
    marginBottom: 10,
    gap: 7,
  },

  footerText: {
    fontSize: 11,
    color: COLORS.muted,
    fontWeight: '600',
  },
});
