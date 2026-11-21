
import { useEffect } from 'react';
import { Stack, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import API, { onUnauthorized } from '../api/apiClient';

export default function RootLayout() {
  const router = useRouter();

  // When the server rejects the token (expired / logged out elsewhere), return to login.
  useEffect(() => {
    const unsubscribe = onUnauthorized(() => {
      router.replace('/login' as any);
    });

    return () => {
      unsubscribe();
    };
  }, [router]);

  useEffect(() => {
    let mounted = true;
    let heartbeatRunning = false;

    const heartbeat = async () => {
      if (!mounted || heartbeatRunning) return;

      try {
        const token = await AsyncStorage.getItem('token');

        if (!token) return;

        heartbeatRunning = true;

        await API.post('/auth/heartbeat');
      } catch (error) {
        console.warn('Session heartbeat failed:', error);
      } finally {
        heartbeatRunning = false;
      }
    };

    // Run once when the app starts
    void heartbeat();

    // Run every 60 seconds
    const intervalId = setInterval(() => {
      void heartbeat();
    }, 60000);

    return () => {
      mounted = false;
      clearInterval(intervalId);
    };
  }, []);

  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    />
  );
}
