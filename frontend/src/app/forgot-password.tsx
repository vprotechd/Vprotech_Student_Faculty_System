
import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import { router } from 'expo-router';
import API from '../api/apiClient';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [debugMessage, setDebugMessage] = useState('');

  // ==========================================
  // SEND RESET REQUEST
  // ==========================================

  const handleForgotPassword = async () => {
    const cleanEmail = email.trim();

    // ----------------------------------------
    // VALIDATION
    // ----------------------------------------

    if (!cleanEmail) {
      setDebugMessage('Please enter your email address.');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setDebugMessage('Please enter a valid email address.');
      return;
    }

    setLoading(true);
    setDebugMessage('Sending password reset request...');

    try {
      // ========================================
      // API REQUEST
      // ========================================

      const response = await API.post('/auth/forgot-password', {
        email: cleanEmail,
      });

      const responseBody = response?.data || {};

      const message =
        responseBody?.message ||
        responseBody?.data?.message ||
        'If an account exists with this email, a password reset link has been sent.';

      // ========================================
      // SUCCESS
      // ========================================

      setDebugMessage(message);

      Alert.alert('Check Your Email', message, [
        {
          text: 'Back to Sign In',
          onPress: () => {
            router.replace('/' as any);
          },
        },
      ]);
    } catch (err: any) {
      console.log(
        'Forgot password error:',
        err?.response?.data || err
      );

      const validationErrors =
        err?.response?.data?.errors;

      const details =
        Array.isArray(validationErrors)
          ? validationErrors
              .map(
                ({
                  field,
                  message,
                }: {
                  field: string;
                  message: string;
                }) => `${field}: ${message}`
              )
              .join('\n')
          : '';

      const message = [
        err?.response?.data?.message,
        details,
        err?.message,
      ]
        .filter(Boolean)
        .join('\n');

      setDebugMessage(
        `Password reset failed: ${
          message || 'Could not connect to the backend.'
        }`
      );
    } finally {
      setLoading(false);
    }
  };

  // ==========================================
  // BACK TO LOGIN
  // ==========================================

  const handleBackToLogin = () => {
    if (loading) return;

    router.replace('/' as any);
  };

  // ==========================================
  // RENDER
  // ==========================================

  return (
    <ScrollView
      contentContainerStyle={styles.scrollContainer}
      keyboardShouldPersistTaps="handled"
    >
      <KeyboardAvoidingView
        behavior={
          Platform.OS === 'ios'
            ? 'padding'
            : 'height'
        }
        style={styles.innerContainer}
      >

        {/* =====================================
            HEADER
        ===================================== */}

        <View style={styles.headerContainer}>

          {/* LOGO */}

          <View style={styles.logoContainer}>
            <Image
              source={require('../../assets/images/tabIcons/imagesss.png')}
              style={styles.logoImage}
              resizeMode="contain"
            />
          </View>

          <Text style={styles.title}>
            Forgot Password?
          </Text>

          <Text style={styles.subtitle}>
            Enter your registered email address and
            we'll help you reset your password.
          </Text>

        </View>

        {/* =====================================
            FORM
        ===================================== */}

        <View style={styles.card}>

          {/* EMAIL */}

          <View style={styles.inputGroup}>

            <Text style={styles.label}>
              Email Address
            </Text>

            <TextInput
              style={styles.input}
              placeholder="name@college.edu"
              placeholderTextColor="#94A3B8"
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                setDebugMessage('');
              }}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!loading}
              returnKeyType="send"
              onSubmitEditing={handleForgotPassword}
            />

          </View>

          {/* INFORMATION */}

          <View style={styles.infoBox}>
            <Text style={styles.infoText}>
              We'll send a password reset link to
              your registered email address.
            </Text>
          </View>

          {/* =====================================
              RESET BUTTON
          ===================================== */}

          <TouchableOpacity
            style={[
              styles.resetButton,
              loading && styles.disabledButton,
            ]}
            onPress={handleForgotPassword}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.resetButtonText}>
                Send Reset Link
              </Text>
            )}
          </TouchableOpacity>

          {/* =====================================
              STATUS MESSAGE
          ===================================== */}

          {debugMessage ? (
            <View style={styles.debugBox}>
              <Text style={styles.debugText}>
                {debugMessage}
              </Text>
            </View>
          ) : null}

          {/* =====================================
              BACK TO LOGIN
          ===================================== */}

          <TouchableOpacity
            style={styles.backButton}
            onPress={handleBackToLogin}
            disabled={loading}
            activeOpacity={0.7}
          >
            <Text style={styles.backButtonText}>
              ← Back to Sign In
            </Text>
          </TouchableOpacity>

        </View>

        {/* =====================================
            FOOTER
        ===================================== */}

        <View style={styles.footerContainer}>

          <Text style={styles.footerText}>
            Need assistance?{' '}
          </Text>

          <TouchableOpacity
            onPress={() =>
              Alert.alert(
                'IT Helpdesk',
                'Please contact your institution administrator.'
              )
            }
          >
            <Text style={styles.supportText}>
              Contact IT Helpdesk
            </Text>
          </TouchableOpacity>

        </View>

      </KeyboardAvoidingView>
    </ScrollView>
  );
}

// ============================================
// STYLES
// ============================================

const styles = StyleSheet.create({

  // ========================================
  // MAIN CONTAINER
  // ========================================

  scrollContainer: {
    flexGrow: 1,
    backgroundColor: '#F4F6F8',
    justifyContent: 'center',
    paddingVertical: 40,
  },

  innerContainer: {
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
    paddingHorizontal: 24,
  },

  // ========================================
  // HEADER
  // ========================================

  headerContainer: {
    alignItems: 'center',
    marginBottom: 20,
    width: '100%',
  },

  // ========================================
  // LOGO
  // No background
  // No border
  // No radius
  // No shadow
  // ========================================

  logoContainer: {
    width: 175,
    height: 85,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },

  logoImage: {
    width: 175,
    height: 85,
  },

  // ========================================
  // TITLE
  // ========================================

  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 6,
    textAlign: 'center',
  },

  subtitle: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 21,
    width: '100%',
  },

  // ========================================
  // CARD
  // ========================================

  card: {
    backgroundColor: '#FFFFFF',
    padding: 24,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    width: '100%',
  },

  // ========================================
  // INPUT
  // ========================================

  inputGroup: {
    marginBottom: 16,
    width: '100%',
  },

  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0F172A',
    marginBottom: 6,
  },

  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 14,
    height: 48,
    fontSize: 15,
    color: '#0F172A',
    width: '100%',
  },

  // ========================================
  // INFORMATION BOX
  // ========================================

  infoBox: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    marginBottom: 18,
  },

  infoText: {
    color: '#64748B',
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },

  // ========================================
  // RESET BUTTON
  // ========================================

  resetButton: {
    backgroundColor: '#2563EB',
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },

  disabledButton: {
    opacity: 0.6,
  },

  resetButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },

  // ========================================
  // STATUS MESSAGE
  // ========================================

  debugBox: {
    marginTop: 15,
    padding: 10,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },

  debugText: {
    color: '#2563EB',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 18,
  },

  // ========================================
  // BACK TO LOGIN
  // ========================================

  backButton: {
    alignItems: 'center',
    marginTop: 20,
  },

  backButtonText: {
    color: '#2563EB',
    fontSize: 13,
    fontWeight: '700',
  },

  // ========================================
  // FOOTER
  // ========================================

  footerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
    width: '100%',
  },

  footerText: {
    color: '#64748B',
    fontSize: 13,
  },

  supportText: {
    color: '#2563EB',
    fontSize: 13,
    fontWeight: '600',
  },

});
