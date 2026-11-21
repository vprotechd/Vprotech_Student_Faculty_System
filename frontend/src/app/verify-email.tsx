
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
  Pressable,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import API from '../api/apiClient';

export default function VerifyEmail() {
  const { token } = useLocalSearchParams<{
    token?: string | string[];
  }>();

  const [loading, setLoading] = useState(true);
  const [verified, setVerified] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let cancelled = false;

    const verifyEmail = async () => {
      const verificationToken = Array.isArray(token)
        ? token[0]
        : token;

      setLoading(true);
      setVerified(false);

      if (!verificationToken) {
        setMessage('Invalid verification link. Please request a new email.');
        setLoading(false);
        return;
      }

      try {
        const response = await API.get(
          `/auth/verify-email?token=${encodeURIComponent(
            verificationToken
          )}`
        );

        if (cancelled) return;

        setVerified(true);
        setMessage(
          response?.data?.message ||
            'Your email has been verified successfully. You can now sign in.'
        );
      } catch (error: any) {
        if (cancelled) return;

        console.log(
          'EMAIL VERIFICATION ERROR:',
          error?.response?.data || error?.message || error
        );

        setVerified(false);
        setMessage(
          error?.response?.data?.message ||
            'This verification link is invalid or has expired. Please request a new one.'
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    verifyEmail();

    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.iconCircle,
          !loading && (verified
            ? styles.successCircle
            : styles.errorCircle),
        ]}
      >
        {loading ? (
          <ActivityIndicator size="large" color="#1769AA" />
        ) : (
          <Ionicons
            name={verified ? 'checkmark-outline' : 'close-outline'}
            size={42}
            color={verified ? '#15803D' : '#C62828'}
          />
        )}
      </View>

      <Text style={styles.title}>
        {loading
          ? 'Verifying your email'
          : verified
            ? 'Email Verified!'
            : 'Verification Failed'}
      </Text>

      <Text style={styles.subtitle}>
        {loading
          ? 'Please wait while we verify your account.'
          : message}
      </Text>

      {!loading && (
        <Pressable
          style={styles.loginButton}
          onPress={() => router.replace('/')}
        >
          <Ionicons
            name="log-in-outline"
            size={19}
            color="#FFFFFF"
          />
          <Text style={styles.loginButtonText}>
            {verified ? 'Go to Login' : 'Back to Login'}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 25,
  },
  iconCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#EAF3FA',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 22,
  },
  successCircle: {
    backgroundColor: '#DCFCE7',
  },
  errorCircle: {
    backgroundColor: '#FEE2E2',
  },
  title: {
    fontSize: 25,
    fontWeight: '800',
    color: '#183B56',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 20,
    color: '#718096',
    textAlign: 'center',
    marginTop: 9,
    maxWidth: 420,
  },
  loginButton: {
    marginTop: 25,
    minWidth: 160,
    height: 46,
    paddingHorizontal: 20,
    borderRadius: 10,
    backgroundColor: '#1769AA',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loginButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    marginLeft: 7,
  },
});
