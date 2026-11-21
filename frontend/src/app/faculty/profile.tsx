
import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';

import { getFacultyProfile } from '../../api/facultyApi';
import {
  getStoredUser,
  logoutUser,
  type SessionUser,
} from '../../api/session';

import {
  Button,
  Card,
  COLORS,
  Header,
  Screen,
} from '../../components/portal';

type ProfileData = {
  name?: string;
  fullName?: string;
  email?: string;
  emailAddress?: string;
  facultyId?: string;
  employeeId?: string;
  designation?: string;
  qualification?: string | null;
  specialization?: string | null;
  phone?: string | null;
  phoneNumber?: string | null;
  mobile?: string | null;
  joiningDate?: string | null;
};

type ApiResponse = {
  data?: any;
  faculty?: any;
} & ProfileData;

export default function FacultyProfile() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [profile, setProfile] = useState<ProfileData>({});
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  // Load faculty and account details
  const load = useCallback(async () => {
    try {
      const stored = await getStoredUser();

      if (stored) {
        setUser(stored);
      }

      try {
        const faculty = await getFacultyProfile();

        if (faculty) {
          // Handle different possible API response structures.
          const response = faculty as ApiResponse;

          const data =
            response.data?.faculty ||
            response.data?.profile ||
            response.data ||
            response.faculty ||
            response;

          setProfile(data);
        }
      } catch (error) {
        console.log('Faculty profile API error:', error);
        // Stored account information will still be displayed.
      }
    } catch (error) {
      console.log('Profile loading error:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);
  

  // Pull to refresh
  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  // Logout
  const logout = () => {
    const confirmLogout = async () => {
      await logoutUser();
      router.replace('/');
    };

    if (Platform.OS === 'web') {
      if (window.confirm('Are you sure you want to logout?')) {
        void confirmLogout();
      }
      return;
    }

    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            await confirmLogout();
          },
        },
      ]
    );
  };

  // Account details with fallbacks
  const name =
    profile.name ||
    profile.fullName ||
    user?.name ||
    user?.fullName ||
    'Faculty Member';

  const email =
    profile.email ||
    profile.emailAddress ||
    user?.email ||
    (user as any)?.emailAddress;

  const phone =
    profile.phone ||
    profile.phoneNumber ||
    profile.mobile ||
    (user as any)?.phone ||
    (user as any)?.phoneNumber ||
    (user as any)?.mobile;

  // Profile information
  const rows: [string, string | null | undefined][] = [
    ['Email', email],
    ['Phone', phone],
    ['Faculty ID', profile.facultyId],
    ['Employee ID', profile.employeeId],
    ['Designation', profile.designation],
    ['Qualification', profile.qualification],
    ['Specialization', profile.specialization],
    [
      'Joined',
      profile.joiningDate
        ? new Date(profile.joiningDate).toLocaleDateString()
        : null,
    ],
  ];

  return (
    <Screen>
      <Header
        title="My Profile"
        subtitle="Your faculty account"
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.primary}
          />
        }
      >
        {/* Profile Header */}
        <Card style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {name.charAt(0).toUpperCase()}
            </Text>
          </View>

          <Text style={styles.name}>
            {name}
          </Text>

          <Text style={styles.role}>
            {profile.designation || 'Faculty'}
          </Text>

          {email ? (
            <Text style={styles.profileEmail}>
              {email}
            </Text>
          ) : null}
        </Card>

        {/* Personal Information */}
        <Card style={styles.detailsCard}>
          <Text style={styles.sectionTitle}>
            Personal Information
          </Text>

          {loading ? (
            <Text style={styles.emptyText}>
              Loading profile...
            </Text>
          ) : (
            rows.map(([label, value], index) => (
              <View
                key={label}
                style={[
                  styles.row,
                  index === rows.length - 1 && styles.lastRow,
                ]}
              >
                <Text style={styles.label}>
                  {label}
                </Text>

                <Text style={styles.value}>
                  {value || 'Not available'}
                </Text>
              </View>
            ))
          )}
        </Card>

        {/* Account Actions */}
        <View style={styles.actions}>
          <Button
            label="Change password"
            icon="key-outline"
            variant="ghost"
            onPress={() =>
              router.push('/change-password' as any)
            }
          />

          <Button
            label="Logout"
            icon="log-out-outline"
            variant="danger"
            onPress={logout}
          />
        </View>

        <Text style={styles.footer}>
          Faculty Portal
        </Text>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    gap: 16,
    paddingBottom: 30,
  },

  profileCard: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 24,
  },

  avatar: {
    width: 76,
    height: 76,
    borderRadius: 24,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },

  avatarText: {
    color: '#FFF',
    fontSize: 30,
    fontWeight: '800',
  },

  name: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.text,
    textAlign: 'center',
  },

  role: {
    fontSize: 13.5,
    color: COLORS.sub,
    textAlign: 'center',
  },

  profileEmail: {
    fontSize: 12.5,
    color: COLORS.sub,
    textAlign: 'center',
    marginTop: 3,
  },

  detailsCard: {
    paddingVertical: 16,
  },

  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: 8,
  },

  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },

  lastRow: {
    borderBottomWidth: 0,
  },

  label: {
    color: COLORS.sub,
    fontSize: 13,
    flex: 0.8,
  },

  value: {
    color: COLORS.text,
    fontWeight: '700',
    fontSize: 13,
    flex: 1.2,
    textAlign: 'right',
  },

  actions: {
    gap: 12,
  },

  emptyText: {
    color: COLORS.sub,
    fontSize: 13,
    paddingVertical: 15,
  },

  footer: {
    textAlign: 'center',
    fontSize: 12,
    color: COLORS.sub,
    marginTop: 5,
  },
});
