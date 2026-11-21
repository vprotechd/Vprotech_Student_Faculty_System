import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const DEFAULT_API_URL =
  'https://vprotech-student-faculty-system1.onrender.com/api';

const API_BASE_URL =
  (process.env.EXPO_PUBLIC_API_URL || '').trim() || DEFAULT_API_URL;

if (typeof __DEV__ !== 'undefined' && __DEV__) {
  console.log('API BASE URL:', API_BASE_URL);
}

// Lets the root layout react to an expired / revoked session.
const unauthorizedListeners = new Set();

export const onUnauthorized = (listener) => {
  unauthorizedListeners.add(listener);
  return () => unauthorizedListeners.delete(listener);
};

// Turns any axios / network error into a readable message.
export const getErrorMessage = (error, fallback = 'Something went wrong.') => {
  if (error && error.response) {
    const data = error.response.data;
    if (data && typeof data.message === 'string' && data.message) {
      return data.message;
    }
    if (error.response.status === 404) return 'Requested API endpoint was not found.';
    if (error.response.status === 403) return 'You do not have permission to access this.';
    if (error.response.status === 401) return 'Your session has expired. Please sign in again.';
    if (error.response.status >= 500) return 'Server error. Please try again later.';
  }
  if (error && error.code === 'ECONNABORTED') return 'The request timed out.';
  if (error && error.message === 'Network Error') {
    return 'Cannot reach the server. Check your internet and API URL.';
  }
  return (error && error.message) || fallback;
};

const API = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    Accept: 'application/json',
  },
});

// =================================
// REQUEST INTERCEPTOR
// =================================
API.interceptors.request.use(
  async (config) => {
    try {
      const token = await AsyncStorage.getItem('token');

      if (token) {
        config.headers = config.headers || {};
        config.headers.Authorization = 'Bearer ' + token;
      }

    } catch (error) {
      console.log(
        'TOKEN READ ERROR:',
        error && error.message ? error.message : error
      );
    }

    if (
      typeof FormData !== 'undefined' &&
      config.data instanceof FormData &&
      config.headers
    ) {
      if (typeof config.headers.delete === 'function') {
        config.headers.delete('Content-Type');
      } else {
        delete config.headers['Content-Type'];
        delete config.headers['content-type'];
      }
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// =================================
// RESPONSE INTERCEPTOR
// =================================
API.interceptors.response.use(
  (response) => response,

  async (error) => {
    const status = error && error.response ? error.response.status : undefined;
    const url = error && error.config ? String(error.config.url || '') : '';

    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      console.log(
        'API ERROR',
        status || 'NO RESPONSE',
        String((error && error.config && error.config.method) || '').toUpperCase(),
        url,
        error && error.response ? JSON.stringify(error.response.data) : ''
      );
    }

    // An expired / revoked token: wipe the session and let the app go to login.
    // (A wrong password on /auth/login is also 401, so skip that call.)
    if (status === 401 && !url.includes('/auth/login')) {
      try {
        await AsyncStorage.multiRemove([
          'token', 'user', 'userData', 'userToken', 'userRole', 'role', 'isAdmin',
        ]);
      } catch (_) {}
      unauthorizedListeners.forEach((listener) => {
        try { listener(); } catch (_) {}
      });
    }

    return Promise.reject(error);
  }
);

export default API;
