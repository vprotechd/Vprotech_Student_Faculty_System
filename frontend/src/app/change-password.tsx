
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import API from '../api/apiClient';
import { getStoredUser } from '../api/session';

export default function ChangePasswordScreen() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);

  const goToDashboard = async (role?: string) => {
    const storedUser = role ? null : await getStoredUser();
    const userRole = role || storedUser?.role;

    switch (userRole) {
      case 'student':
        router.replace('/student-dashboard');
        return;
      case 'faculty':
        router.replace('/faculty-dashboard');
        return;
      case 'admin':
        router.replace('/admin-dashboard');
        return;
      default:
        router.replace('/login');
    }
  };

  const handleBack = async () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    await goToDashboard();
  };

  const validatePassword = (password: string) => {
    if (password.length < 12) {
      return 'Password must be at least 12 characters long.';
    }

    if (password.length > 128) {
      return 'Password must not exceed 128 characters.';
    }

    if (!/[A-Z]/.test(password)) {
      return 'Password must contain at least one uppercase letter.';
    }

    if (!/[a-z]/.test(password)) {
      return 'Password must contain at least one lowercase letter.';
    }

    if (!/[0-9]/.test(password)) {
      return 'Password must contain at least one number.';
    }

    if (!/[^A-Za-z0-9]/.test(password)) {
      return 'Password must contain at least one special character.';
    }

    return null;
  };

  const submit = async () => {
    if (saving) return;

    if (!currentPassword || !newPassword || !confirmPassword) {
      Alert.alert(
        'Missing information',
        'Please fill in all password fields.'
      );
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert(
        'Passwords do not match',
        'Enter the same new password in both fields.'
      );
      return;
    }

    if (currentPassword === newPassword) {
      Alert.alert(
        'Choose a different password',
        'Your new password must be different from your current password.'
      );
      return;
    }

    const passwordError = validatePassword(newPassword);

    if (passwordError) {
      Alert.alert('Invalid password', passwordError);
      return;
    }

    try {
      setSaving(true);

      const response = await API.post('/auth/change-password', {
        currentPassword,
        newPassword,
      });

      console.log('CHANGE PASSWORD RESPONSE:', response.data);

      const responseUser = response?.data?.data?.user;
      const storedUser = await getStoredUser();
      const updatedUser = {
        ...(storedUser || {}),
        ...(responseUser || {}),
        mustChangePassword: false,
      };

      if (storedUser || responseUser) {
        await AsyncStorage.setItem('userData', JSON.stringify(updatedUser));

        if (await AsyncStorage.getItem('user')) {
          await AsyncStorage.setItem('user', JSON.stringify(updatedUser));
        }
      }

      Alert.alert(
        'Password updated',
        response?.data?.message ||
          'Your password has been changed successfully.',
        [
          {
            text: 'Continue',
            onPress: () => goToDashboard(responseUser?.role),
          },
        ],
        { cancelable: false }
      );
    } catch (error: any) {
      console.log(
        'CHANGE PASSWORD ERROR:',
        error?.response?.status
      );

      console.log(
        'CHANGE PASSWORD ERROR DATA:',
        error?.response?.data
      );

      const message =
        error?.response?.data?.message ||
        error?.message ||
        'Unable to change your password. Please try again.';

      Alert.alert('Could not change password', message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView
      contentContainerStyle={styles.scrollContainer}
      keyboardShouldPersistTaps="handled"
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.container}
      >
        <View style={styles.card}>

          {/* Back Button */}
          <TouchableOpacity
            style={styles.backButton}
            onPress={handleBack}
            activeOpacity={0.7}
            disabled={saving}
          >
            <Text style={styles.backArrow}>←</Text>
            <Text style={styles.backText}>Back to Dashboard</Text>
          </TouchableOpacity>

          <Text style={styles.heading}>
            Change your password
          </Text>

          <Text style={styles.description}>
            Your administrator gave you a temporary
            password. Choose a new password to
            continue.
          </Text>

          <Text style={styles.label}>
            Temporary / Current Password
          </Text>

          <TextInput
            style={styles.input}
            placeholder="Enter temporary password"
            placeholderTextColor="#94A3B8"
            value={currentPassword}
            onChangeText={setCurrentPassword}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            editable={!saving}
          />

          <Text style={styles.label}>
            New Password
          </Text>

          <TextInput
            style={styles.input}
            placeholder="New password (12+ characters)"
            placeholderTextColor="#94A3B8"
            value={newPassword}
            onChangeText={setNewPassword}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            editable={!saving}
          />

          <Text style={styles.label}>
            Confirm New Password
          </Text>

          <TextInput
            style={styles.input}
            placeholder="Confirm new password"
            placeholderTextColor="#94A3B8"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            editable={!saving}
          />

          <Text style={styles.hint}>
            Use at least 12 characters with uppercase
            and lowercase letters, a number, and a
            special character.
          </Text>

          <TouchableOpacity
            style={[
              styles.button,
              saving && styles.buttonDisabled,
            ]}
            onPress={submit}
            disabled={saving}
            activeOpacity={0.8}
          >
            {saving ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.buttonText}>
                Update Password
              </Text>
            )}
          </TouchableOpacity>

        </View>
      </KeyboardAvoidingView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
    backgroundColor: '#F7FAFC',
  },

  container: {
    width: '100%',
    alignItems: 'center',
  },

  card: {
    width: '100%',
    maxWidth: 440,
    padding: 24,
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
    borderWidth: 1,
    borderRadius: 14,
  },

  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginBottom: 22,
    paddingVertical: 5,
  },

  backArrow: {
    fontSize: 23,
    color: '#1769AA',
    marginRight: 8,
    fontWeight: '600',
  },

  backText: {
    color: '#1769AA',
    fontSize: 14,
    fontWeight: '700',
  },

  heading: {
    color: '#0F172A',
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 8,
  },

  description: {
    color: '#64748B',
    fontSize: 14,
    marginBottom: 22,
    lineHeight: 20,
  },

  label: {
    color: '#334155',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 7,
  },

  input: {
    height: 48,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    color: '#0F172A',
    paddingHorizontal: 13,
    marginBottom: 14,
    borderRadius: 8,
  },

  hint: {
    color: '#64748B',
    fontSize: 12,
    marginBottom: 20,
    lineHeight: 18,
  },

  button: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    backgroundColor: '#1769AA',
    borderRadius: 8,
  },

  buttonDisabled: {
    opacity: 0.7,
  },

  buttonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
});
